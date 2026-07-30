import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { soalRepo } from "@/lib/cbt/repos";
import { uid } from "@/lib/cbt/storage";
import { putFile } from "@/lib/cbt/files";
import type { Soal, Jawaban, TipeSoal, Kesulitan } from "@/lib/cbt/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Check, Lock, AlertTriangle, Download, Info, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { isTopikAllowed, visibleModuls, visibleTopiks } from "@/lib/cbt/access";

export const Route = createFileRoute("/_authenticated/admin/modul/import")({
  component: ImportPage,
});

type PreviewRow = { soal: Soal; valid: boolean; error?: string };

function ImportPage() {
  const user = useAuthStore((s) => s.user);
  const moduls = visibleModuls(user);
  const [modulId, setModulId] = useState<string>(moduls[0]?.id ?? "");
  const topiks = visibleTopiks(user).filter((t) => t.modulId === modulId);
  const [topikId, setTopikId] = useState<string>(topiks[0]?.id ?? "");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  if (moduls.length === 0 || topiks.length === 0) {
    return (
      <div className="space-y-4 max-w-5xl">
        <div>
          <Link to="/admin/modul" className="text-sm text-muted-foreground hover:underline">
            ← Modul
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Import Soal dari Excel</h1>
        </div>
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="rounded-md border bg-muted/30 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Lock className="h-4 w-4" />
                Tidak ada topik yang dapat Anda importi.
              </div>
              <p className="mt-1 text-muted-foreground">
                Operator dengan cakupan topik terbatas hanya dapat import soal ke topik yang
                termasuk dalam <code>allowedTopikIds</code>. Minta admin untuk menambah akses jika
                diperlukan.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([
      {
        No: 1,
        Soal: "Siapakah penemu jaringan komputer berbasis ARPANET?",
        Gambar: "",
        "Opsi A": "Alan Turing",
        "Opsi B": "Tim Berners-Lee",
        "Opsi C": "Vint Cerf & Bob Kahn",
        "Opsi D": "Charles Babbage",
        "Opsi E": "Steve Jobs",
        "Kunci Jawaban": "C",
        "Tingkat Kesulitan": 1,
      },
      {
        No: 2,
        Soal: "Pilih bahasa pemrogramannya yang tergolong Strongly Typed!",
        Gambar: "",
        "Opsi A": "TypeScript",
        "Opsi B": "Rust",
        "Opsi C": "Python",
        "Opsi D": "Go",
        "Opsi E": "JavaScript",
        "Kunci Jawaban": "A, B, D",
        "Tingkat Kesulitan": 2,
      },
      {
        No: 3,
        Soal: "Jelaskan prinsip kerja dari algoritma Dijkstra secara singkat!",
        Gambar: "",
        "Opsi A": "",
        "Opsi B": "",
        "Opsi C": "",
        "Opsi D": "",
        "Opsi E": "",
        "Kunci Jawaban": "",
        "Tingkat Kesulitan": 3,
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "template_soal");
    XLSX.writeFile(wb, "template-soal-standar.xlsx");
  }

  async function handleImageUpload(files: FileList) {
    setIsUploadingImages(true);
    let success = 0;
    const newMap = { ...imageMap };
    
    toast.info(`Mengunggah ${files.length} gambar lampiran...`);
    
    for (const f of Array.from(files)) {
      try {
        const meta = await putFile(f);
        newMap[f.name.toLowerCase()] = `file://${meta.id}`;
        success++;
      } catch (err) {
        toast.error(`Gagal mengunggah ${f.name}`);
      }
    }
    
    setImageMap(newMap);
    setIsUploadingImages(false);
    toast.success(`${success} gambar berhasil diunggah. Tulis nama file (contoh: ${files[0]?.name ?? 'gambar.jpg'}) di kolom 'Gambar' Excel Anda.`);
  }

  async function loadFile(file: File) {
    if (!topikId) {
      toast.error("Pilih topik tujuan terlebih dahulu");
      return;
    }
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    
    if (rows.length === 0) {
      toast.error("File Excel kosong atau tidak terbaca");
      return;
    }

    const out: PreviewRow[] = [];

    // Detect format: Horizontal (Standard) vs Vertical (Legacy)
    const firstRowKeys = Object.keys(rows[0] ?? {});
    const isHorizontal = firstRowKeys.some((k) => 
      /^(soal|pertanyaan|opsi\s*[a-e]|kunci)/i.test(k.trim())
    );

    if (isHorizontal) {
      // Parse Standard Horizontal Format (1 row = 1 question)
      for (const r of rows) {
        const isiRaw = String(r.Soal ?? r.Pertanyaan ?? r.isi ?? r.Isi ?? "").trim();
        let gambarSrc = String(r.Gambar ?? r.gambar ?? "").trim();
        const kunciRaw = String(r["Kunci Jawaban"] ?? r.Kunci ?? r.kunci ?? r.Jawaban ?? "").toUpperCase().trim();
        const tingkatRaw = String(r["Tingkat Kesulitan"] ?? r["Tingkat Kesulitan Soal"] ?? r.Kesulitan ?? "2").trim();

        if (gambarSrc && imageMap[gambarSrc.toLowerCase()]) {
          gambarSrc = imageMap[gambarSrc.toLowerCase()];
        }

        if (!isiRaw && !gambarSrc) continue; // Skip empty row

        let isi = isiRaw;
        if (gambarSrc) {
          isi = `<div class="mb-4"><img src="${gambarSrc}" alt="Gambar Soal" class="max-w-full h-auto rounded-md shadow-sm border border-slate-200 dark:border-slate-800" /></div>${isi}`;
        }

        let kesulitan: Kesulitan = "sedang";
        if (tingkatRaw === "1" || tingkatRaw.toLowerCase().includes("mudah")) kesulitan = "mudah";
        else if (tingkatRaw === "3" || tingkatRaw.toLowerCase().includes("sulit")) kesulitan = "sulit";

        const optionEntries: { letter: string; text: string }[] = [];
        ["A", "B", "C", "D", "E"].forEach((letter) => {
          const val = r[`Opsi ${letter}`] ?? r[`Opsi_${letter}`] ?? r[`Opsi${letter}`] ?? r[letter];
          if (val !== undefined && String(val).trim() !== "") {
            optionEntries.push({ letter, text: String(val).trim() });
          }
        });

        const correctLetters = kunciRaw.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);

        let tipe: TipeSoal = "pg";
        let error: string | undefined = undefined;

        if (optionEntries.length === 0 || !kunciRaw) {
          tipe = "essay";
        } else if (correctLetters.length > 1) {
          tipe = "multi";
        } else if (
          optionEntries.length === 2 &&
          optionEntries.some((o) => /^(benar|true|b)$/i.test(o.text.trim())) &&
          optionEntries.some((o) => /^(salah|false|s)$/i.test(o.text.trim()))
        ) {
          tipe = "bs";
        } else {
          tipe = "pg";
        }

        if (tipe !== "essay") {
          if (optionEntries.length < 2) {
            error = "Pilihan ganda minimal 2 opsi (Opsi A dan Opsi B)";
          } else if (correctLetters.length === 0) {
            error = "Kunci jawaban belum ditentukan";
          }
        }

        const jawaban: Jawaban[] = optionEntries.map((opt) => ({
          id: uid("j_"),
          detail: opt.text,
          benar: correctLetters.includes(opt.letter),
        }));

        const soal: Soal = {
          id: uid("s_"),
          topikId,
          detail: isi,
          tipe,
          kesulitan,
          audioPlayOnce: false,
          jawaban,
          pembahasan: "",
          createdAt: Date.now(),
        };

        out.push({ soal, valid: !error, error });
      }
    } else {
      // Legacy Vertical Parsing Fallback
      let currentSoal: Soal | null = null;
      let currentError: string | undefined;

      const commitCurrentSoal = () => {
        if (!currentSoal) return;
        if (currentSoal.jawaban.length === 0) {
          currentSoal.tipe = "essay";
        } else {
          const correctCount = currentSoal.jawaban.filter((j) => j.benar).length;
          const isBs = currentSoal.jawaban.length === 2 &&
            currentSoal.jawaban.some((j) => /^(benar|true|b)$/i.test(j.detail.trim())) &&
            currentSoal.jawaban.some((j) => /^(salah|false|s)$/i.test(j.detail.trim()));

          if (isBs) {
            currentSoal.tipe = "bs";
          } else {
            currentSoal.tipe = correctCount > 1 ? "multi" : "pg";
          }

          if (currentSoal.jawaban.length < 2) {
            currentError = "Soal pilihan ganda minimal 2 opsi jawaban";
          }
        }
        out.push({ soal: currentSoal, valid: !currentError, error: currentError });
        currentSoal = null;
        currentError = undefined;
      };

      for (const r of rows) {
        const jenis = String(r.Jenis ?? "").toUpperCase().trim();
        const kode = String(r.Kode ?? "").toUpperCase().trim();

        if (jenis === "SOAL" || kode === "Q") {
          commitCurrentSoal();
          let isi = String(r.Isi ?? "").trim();
          let gambarSrc = String(r.Gambar ?? "").trim();
          const tingkat = String(r["Tingkat kesulitan Soal"] ?? "2").trim();

          if (gambarSrc && imageMap[gambarSrc.toLowerCase()]) {
            gambarSrc = imageMap[gambarSrc.toLowerCase()];
          }

          if (!isi && !gambarSrc) currentError = "Isi pertanyaan kosong";
          if (gambarSrc) {
            isi = `<div class="mb-4"><img src="${gambarSrc}" alt="Gambar Soal" class="max-w-full h-auto rounded-md shadow-sm border border-slate-200 dark:border-slate-800" /></div>${isi}`;
          }

          let kesulitan: Kesulitan = "sedang";
          if (tingkat === "1") kesulitan = "mudah";
          else if (tingkat === "3") kesulitan = "sulit";

          currentSoal = {
            id: uid("s_"),
            topikId,
            detail: isi,
            tipe: "pg",
            kesulitan,
            audioPlayOnce: false,
            jawaban: [],
            pembahasan: "",
            createdAt: Date.now(),
          };
        } else if (jenis === "JAWABAN" || kode === "A") {
          if (!currentSoal) continue;
          let isi = String(r.Isi ?? "").trim();
          let gambarSrc = String(r.Gambar ?? "").trim();
          const statusStr = String(r["Status Jawaban"] ?? "0").trim();
          const status = statusStr === "1" || statusStr.toLowerCase() === "benar" || statusStr.toLowerCase() === "true";

          if (gambarSrc && imageMap[gambarSrc.toLowerCase()]) {
            gambarSrc = imageMap[gambarSrc.toLowerCase()];
          }

          if (gambarSrc) {
            isi = `<div class="mb-2"><img src="${gambarSrc}" alt="Gambar Opsi" class="max-w-xs h-auto rounded shadow-sm border border-slate-200 dark:border-slate-800" /></div>${isi}`;
          }

          currentSoal.jawaban.push({
            id: uid("j_"),
            detail: isi,
            benar: status,
          });
        }
      }
      commitCurrentSoal();
    }

    setPreview(out);
    if (out.length === 0) toast.error("Tidak ada soal valid yang terdeteksi");
    else toast.success(`${out.length} baris soal berhasil diproses`);
  }

  function commit() {
    if (!topikId || !isTopikAllowed(user, topikId)) {
      toast.error("Topik tujuan di luar cakupan Anda");
      return;
    }
    const valid = preview.filter((r) => r.valid);
    valid.forEach((r) => soalRepo.upsert(r.soal));
    toast.success(`${valid.length} soal berhasil disimpan ke bank soal`);
    setPreview([]);
  }

  return (
    <div className="space-y-6 max-w-5xl pb-12">
      <div>
        <Link to="/admin/modul" className="text-sm font-medium text-slate-500 hover:text-primary transition-colors">
          ← Kembali ke Bank Soal
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
          Import Soal dari Excel
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Upload file spreadsheet Excel dengan format standar untuk menambahkan banyak soal sekaligus.
        </p>
      </div>

      {/* Target Module & Topic Selection */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Modul Tujuan</label>
              <Select
                value={modulId}
                onValueChange={(v) => {
                  setModulId(v);
                  const ts = visibleTopiks(user).filter((t) => t.modulId === v);
                  setTopikId(ts[0]?.id ?? "");
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Pilih modul" />
                </SelectTrigger>
                <SelectContent>
                  {moduls.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Topik / Bab Tujuan *</label>
              <Select value={topikId} onValueChange={setTopikId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Pilih topik" />
                </SelectTrigger>
                <SelectContent>
                  {topiks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="outline" onClick={downloadTemplate} className="h-10 font-semibold border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
              <Download className="mr-2 h-4 w-4" /> Download Template Standar (.xlsx)
            </Button>
            
            <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block"></div>

            <input
              ref={imageRef}
              type="file"
              multiple
              accept="image/*"
              hidden
              onChange={(e) => {
                if (e.target.files) handleImageUpload(e.target.files);
                e.target.value = "";
              }}
            />
            <Button 
              variant="outline" 
              onClick={() => imageRef.current?.click()} 
              disabled={isUploadingImages}
              className="h-10 font-semibold border-amber-200 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-400"
            >
              {isUploadingImages ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
              {Object.keys(imageMap).length > 0 ? `${Object.keys(imageMap).length} Gambar Tersimpan` : "Upload Gambar (Opsional)"}
            </Button>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f);
                e.target.value = "";
              }}
            />
            <Button onClick={() => fileRef.current?.click()} className="h-10 font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500">
              <Upload className="mr-2 h-4 w-4" /> Pilih File Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Prominent UX Standard & Constraint Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-5 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-indigo-900 dark:text-indigo-300">
            <Info className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Format Standar Excel (Horizontal)
          </div>
          <ul className="text-xs text-indigo-950/80 dark:text-indigo-200/80 space-y-1.5 list-disc pl-4 leading-relaxed">
            <li><strong>Soal</strong>: Tuliskan teks pertanyaan soal.</li>
            <li><strong>Opsi A s/d Opsi E</strong>: Isikan teks pilihan jawaban.</li>
            <li><strong>Kunci Jawaban</strong>: Isikan <code>A</code>, <code>B</code>, <code>C</code>, <code>D</code>, atau <code>E</code>. Untuk <em>Multi Jawaban</em> isikan terpisah koma (contoh: <code>A, C</code>). Kosongkan untuk soal <em>Essay</em>.</li>
            <li><strong>Tingkat Kesulitan</strong>: <code>1</code> (Mudah), <code>2</code> (Sedang), <code>3</code> (Sulit).</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-amber-200/60 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-5 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-900 dark:text-amber-300">
            <ImagePlus className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Cara Mudah Memasukkan Gambar
          </div>
          <p className="text-xs text-amber-950/80 dark:text-amber-200/80 leading-relaxed">
            Gambar yang di-<em>copy-paste</em> langsung ke dalam sel Excel <strong>TIDAK DAPAT DIBACA</strong> oleh sistem. 
            <strong>Solusi Praktis:</strong> 
            Klik tombol <strong className="text-amber-700 dark:text-amber-400">Upload Gambar</strong> di atas, lalu pilih gambar-gambar dari komputer Anda. Setelah itu, cukup ketikkan <strong>nama file</strong> (contoh: <code>gambar1.jpg</code>) di kolom <strong>Gambar</strong> pada Excel. Sistem akan otomatis menyambungkannya!
          </p>
        </div>
      </div>

      {/* Preview Section */}
      {preview.length > 0 && (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Preview: <strong>{preview.length}</strong> baris ·{" "}
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{preview.filter((r) => r.valid).length} valid</span> ·{" "}
                <span className="text-rose-600 dark:text-rose-400 font-bold">{preview.filter((r) => !r.valid).length} error</span>
              </div>
              <Button size="sm" onClick={commit} disabled={!preview.some((r) => r.valid)} className="font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                <Check className="mr-1.5 h-4 w-4" />
                Simpan Soal Valid ({preview.filter((r) => r.valid).length})
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/40 text-left font-bold text-slate-500">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">Pertanyaan</th>
                    <th className="p-3 w-28">Tipe</th>
                    <th className="p-3 w-24">Kesulitan</th>
                    <th className="p-3 w-28">Opsi/Kunci</th>
                    <th className="p-3 w-40">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {preview.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-3 text-center font-mono font-medium text-slate-400">{i + 1}</td>
                      <td className="p-3 max-w-md font-medium text-slate-900 dark:text-slate-100 truncate">{r.soal?.detail ?? "-"}</td>
                      <td className="p-3 uppercase font-bold text-slate-500">{r.soal?.tipe ?? "-"}</td>
                      <td className="p-3 capitalize">{r.soal?.kesulitan ?? "-"}</td>
                      <td className="p-3 font-mono">{r.soal?.jawaban?.length ?? 0} opsi</td>
                      <td className="p-3">
                        {r.valid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                            <Check className="h-3.5 w-3.5" /> Ready
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 font-medium">
                            ✗ {r.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
