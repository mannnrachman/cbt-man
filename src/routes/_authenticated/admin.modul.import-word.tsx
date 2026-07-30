import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import mammoth from "mammoth";
import { soalRepo } from "@/lib/cbt/repos";
import { uid } from "@/lib/cbt/storage";
import type { Soal, Jawaban, TipeSoal } from "@/lib/cbt/types";
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
import { RichView } from "@/components/cbt/RichEditor";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { isTopikAllowed, visibleModuls, visibleTopiks } from "@/lib/cbt/access";

export const Route = createFileRoute("/_authenticated/admin/modul/import-word")({
  component: ImportWord,
});

type Parsed = { detail: string; tipe: TipeSoal; jawaban: Jawaban[]; benarIdx: number[] };

function parseDocxText(text: string): Parsed[] {
  // Format:
  // 1. Pertanyaan...
  // A. opsi
  // B. opsi
  // ...
  // Jawaban: B
  // (kosong) → soal berikutnya
  const blocks = text
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const out: Parsed[] = [];
  for (const block of blocks) {
    const lines = block
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;
    const detailLines: string[] = [];
    const opsi: { huruf: string; teks: string }[] = [];
    let jawabanKey: string | null = null;
    for (const ln of lines) {
      const opt = /^([A-Fa-f])[.)]\s*(.+)$/.exec(ln);
      const jaw = /^Jawaban\s*:\s*([A-Fa-f,\s]+)$/i.exec(ln);
      if (jaw) {
        jawabanKey = jaw[1].toUpperCase();
      } else if (opt) {
        opsi.push({ huruf: opt[1].toUpperCase(), teks: opt[2] });
      } else {
        detailLines.push(ln);
      }
    }
    const detail = detailLines
      .join(" ")
      .replace(/^\d+[.)]\s*/, "")
      .trim();
    if (!detail) continue;
    if (opsi.length === 0) {
      out.push({ detail, tipe: "essay", jawaban: [], benarIdx: [] });
      continue;
    }
    const benarLetters = (jawabanKey ?? "").split(/[,\s]+/).filter(Boolean);
    const benarIdx = benarLetters
      .map((l) => l.charCodeAt(0) - 65)
      .filter((i) => i >= 0 && i < opsi.length);
    const tipe: TipeSoal = benarIdx.length > 1 ? "multi" : "pg";
    const jawaban: Jawaban[] = opsi.map((o, i) => ({
      id: uid("j_"),
      detail: o.teks,
      benar: benarIdx.includes(i),
    }));
    out.push({ detail, tipe, jawaban, benarIdx });
  }
  return out;
}

function ImportWord() {
  const user = useAuthStore((s) => s.user);
  const moduls = visibleModuls(user);
  const [modulId, setModulId] = useState(moduls[0]?.id ?? "");
  const topiks = visibleTopiks(user).filter((t) => t.modulId === modulId);
  const [topikId, setTopikId] = useState(topiks[0]?.id ?? "");
  const [parsed, setParsed] = useState<Parsed[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  if (moduls.length === 0 || topiks.length === 0) {
    return (
      <div className="max-w-5xl space-y-4">
        <div>
          <Link to="/admin/modul" className="text-sm text-muted-foreground hover:underline">
            ← Modul
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Import Soal dari Word (.docx)</h1>
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

  async function loadFile(file: File) {
    if (!topikId) {
      toast.error("Pilih topik dulu");
      return;
    }
    const buf = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer: buf });
    const items = parseDocxText(res.value);
    setParsed(items);
    if (items.length === 0) toast.error("Tidak ada soal terdeteksi");
    else toast.success(`${items.length} soal terdeteksi`);
  }

  function commit() {
    if (!topikId || !isTopikAllowed(user, topikId)) {
      toast.error("Topik tujuan di luar cakupan Anda");
      return;
    }
    const valid = parsed.filter((p) => p.tipe === "essay" || p.benarIdx.length > 0);
    valid.forEach((p) => {
      const soal: Soal = {
        id: uid("s_"),
        topikId,
        detail: p.detail,
        tipe: p.tipe,
        kesulitan: "sedang",
        audioPlayOnce: false,
        jawaban: p.jawaban,
        pembahasan: "",
        createdAt: Date.now(),
      };
      soalRepo.upsert(soal);
    });
    toast.success(`${valid.length} soal disimpan`);
    setParsed([]);
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <Link to="/admin/modul" className="text-sm text-muted-foreground hover:underline">
          ← Modul
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Import Soal dari Word (.docx)</h1>
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
                  <SelectValue />
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
                  <SelectValue />
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
            <input
              ref={fileRef}
              type="file"
              accept=".docx"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f);
                e.target.value = "";
              }}
            />
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" />
              Pilih file .docx
            </Button>
          </div>

          <div className="rounded bg-muted/30 p-3 text-xs">
            <p className="font-medium">Format yang didukung (per blok dipisah baris kosong):</p>
            <pre className="mt-1 whitespace-pre-wrap">{`1. Ibukota Indonesia adalah?
A. Bandung
B. Jakarta
C. Medan
D. Surabaya
Jawaban: B

2. Jelaskan fotosintesis.`}</pre>
            <p className="mt-1 text-muted-foreground">
              Soal tanpa opsi A/B/C dianggap essay. Multi-jawaban: <code>Jawaban: A,C</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      {parsed.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b p-3">
              <p className="text-sm">
                {parsed.length} soal terdeteksi ·{" "}
                {parsed.filter((p) => p.tipe === "essay" || p.benarIdx.length > 0).length} valid
              </p>
              <Button size="sm" onClick={commit}>
                <Check className="mr-1 h-4 w-4" />
                Simpan semua valid
              </Button>
            </div>
            <div className="space-y-3 p-3">
              {parsed.map((p, i) => (
                <div key={i} className="rounded border p-3 text-sm">
                  <div className="mb-1 text-xs text-muted-foreground">
                    #{i + 1} · {p.tipe}
                  </div>
                  <RichView html={p.detail} />
                  {p.jawaban.length > 0 && (
                    <ul className="ml-4 mt-1 list-disc text-xs">
                      {p.jawaban.map((j, idx) => (
                        <li key={j.id} className={j.benar ? "text-success font-medium" : ""}>
                          {String.fromCharCode(65 + idx)}. {j.detail} {j.benar && "✓"}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
