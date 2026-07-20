import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { soalRepo } from "@/lib/cbt/repos";
import { uid } from "@/lib/cbt/storage";
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
import { Upload, Check, Lock } from "lucide-react";
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
  const fileRef = useRef<HTMLInputElement>(null);

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
        Jenis: "SOAL",
        Kode: "Q",
        Isi: "Apa nama alat pada gambar berikut?",
        Gambar: "https://contoh-website.com/mikroskop.jpg",
        "Status Jawaban": "",
        "Tingkat kesulitan Soal": 1,
      },
      {
        No: "",
        Jenis: "JAWABAN",
        Kode: "A",
        Isi: "Mikroskop",
        Gambar: "",
        "Status Jawaban": 1,
        "Tingkat kesulitan Soal": "",
      },
      {
        No: "",
        Jenis: "JAWABAN",
        Kode: "A",
        Isi: "Teleskop",
        Gambar: "",
        "Status Jawaban": 0,
        "Tingkat kesulitan Soal": "",
      },
      {
        No: "",
        Jenis: "JAWABAN",
        Kode: "A",
        Isi: "Stetoskop",
        Gambar: "",
        "Status Jawaban": 0,
        "Tingkat kesulitan Soal": "",
      },
      {
        No: "",
        Jenis: "JAWABAN",
        Kode: "A",
        Isi: "Periskop",
        Gambar: "",
        "Status Jawaban": 0,
        "Tingkat kesulitan Soal": "",
      },
      {
        No: 2,
        Jenis: "SOAL",
        Kode: "Q",
        Isi: "Jelaskan proses fotosintesis secara ringkas.",
        Gambar: "",
        "Status Jawaban": "",
        "Tingkat kesulitan Soal": 3,
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "soal");
    XLSX.writeFile(wb, "template-soal-baru.xlsx");
  }

  async function loadFile(file: File) {
    if (!topikId) {
      toast.error("Pilih topik dulu");
      return;
    }
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const out: PreviewRow[] = [];
    let currentSoal: Soal | null = null;
    let currentError: string | undefined;

    const commitCurrentSoal = () => {
      if (!currentSoal) return;
      
      if (currentSoal.jawaban.length === 0) {
        currentSoal.tipe = "essay";
      } else {
        const correctCount = currentSoal.jawaban.filter(j => j.benar).length;
        if (correctCount > 1) {
          currentSoal.tipe = "multi";
        } else {
          currentSoal.tipe = "pg";
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
        const gambar = String(r.Gambar ?? "").trim();
        const tingkat = String(r["Tingkat kesulitan Soal"] ?? "2").trim();
        
        if (!isi && !gambar) {
          currentError = "Isi pertanyaan kosong";
        }
        
        if (gambar) {
          isi = `<div class="mb-4"><img src="${gambar}" alt="Gambar Soal" class="max-w-full h-auto rounded-md shadow-sm border border-slate-200 dark:border-slate-800" /></div>${isi}`;
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
      } 
      else if (jenis === "JAWABAN" || kode === "A") {
        if (!currentSoal) continue; // Orphaned answer, skip
        
        let isi = String(r.Isi ?? "").trim();
        const gambar = String(r.Gambar ?? "").trim();
        const statusStr = String(r["Status Jawaban"] ?? "0").trim();
        const status = statusStr === "1" || statusStr.toLowerCase() === "benar" || statusStr.toLowerCase() === "true";
        
        if (gambar) {
          isi = `<div class="mb-2"><img src="${gambar}" alt="Gambar Opsi" class="max-w-xs h-auto rounded shadow-sm border border-slate-200 dark:border-slate-800" /></div>${isi}`;
        }
        
        currentSoal.jawaban.push({
          id: uid("j_"),
          detail: isi,
          benar: status,
        });
      }
    }
    
    commitCurrentSoal();
    setPreview(out);
  }

  function commit() {
    if (!topikId || !isTopikAllowed(user, topikId)) {
      toast.error("Topik tujuan di luar cakupan Anda");
      return;
    }
    const valid = preview.filter((r) => r.valid);
    valid.forEach((r) => soalRepo.upsert(r.soal));
    toast.success(`${valid.length} soal disimpan`);
    setPreview([]);
  }

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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Modul tujuan</label>
              <Select
                value={modulId}
                onValueChange={(v) => {
                  setModulId(v);
                  const ts = visibleTopiks(user).filter((t) => t.modulId === v);
                  setTopikId(ts[0]?.id ?? "");
                }}
              >
                <SelectTrigger>
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
            <div>
              <label className="text-sm font-medium">Topik tujuan</label>
              <Select value={topikId} onValueChange={setTopikId}>
                <SelectTrigger>
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              Download Template Excel
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
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" />
              Pilih File
            </Button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>Format Kolom Baru:</strong> <code>No</code>, <code>Jenis</code> (SOAL/JAWABAN), <code>Kode</code> (Q/A), <code>Isi</code>, <code>Gambar</code>, <code>Status Jawaban</code> (1/0), <code>Tingkat kesulitan Soal</code> (1/2/3).
            <br/>Setiap baris <strong>SOAL</strong> akan diikuti oleh baris-baris <strong>JAWABAN</strong> opsinya di bawah.
            Tipe soal (PG/Multi/Essay) akan dideteksi otomatis berdasarkan jumlah jawaban. 
            Untuk kolom <code>Gambar</code>, isikan URL gambar yang sudah diunggah di File Manager.
          </p>
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b p-3">
              <p className="text-sm">
                Preview {preview.length} baris · {preview.filter((r) => r.valid).length} valid ·{" "}
                {preview.filter((r) => !r.valid).length} error
              </p>
              <Button size="sm" onClick={commit} disabled={!preview.some((r) => r.valid)}>
                <Check className="mr-1 h-4 w-4" />
                Simpan yang valid
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Pertanyaan</th>
                  <th className="p-2">Tipe</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2 max-w-md truncate">{r.soal?.detail ?? "-"}</td>
                    <td className="p-2">{r.soal?.tipe ?? "-"}</td>
                    <td className="p-2">
                      {r.valid ? (
                        <span className="text-success">✓ OK</span>
                      ) : (
                        <span className="text-destructive">✗ {r.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
