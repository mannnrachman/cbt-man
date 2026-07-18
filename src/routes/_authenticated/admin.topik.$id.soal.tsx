import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { topikRepo, modulRepo, soalRepo } from "@/lib/cbt/repos";
import { uid } from "@/lib/cbt/storage";
import type { Soal, TipeSoal, Kesulitan, Jawaban } from "@/lib/cbt/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Search, BookOpen, Layers, CheckCircle2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { RichEditor, RichView } from "@/components/cbt/RichEditor";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { isTopikAllowed } from "@/lib/cbt/access";

export const Route = createFileRoute("/_authenticated/admin/topik/$id/soal")({
  component: SoalPage,
});

const TIPE_LABEL: Record<TipeSoal, string> = {
  pg: "Pilihan Ganda", multi: "Multi Jawaban", bs: "Benar-Salah", essay: "Essay",
};
const KES_LABEL: Record<Kesulitan, string> = { mudah: "Mudah", sedang: "Sedang", sulit: "Sulit" };

function SoalPage() {
  const { id: topikId } = useParams({ from: "/_authenticated/admin/topik/$id/soal" });
  const topik = topikRepo.byId(topikId);
  const modul = topik ? modulRepo.byId(topik.modulId) : null;
  const user = useAuthStore((s) => s.user);
  const allowed = isTopikAllowed(user, topikId);
  const [soals, setSoals] = useState<Soal[]>(soalRepo.all().filter((s) => s.topikId === topikId));
  const [query, setQuery] = useState("");
  const [tipe, setTipe] = useState<string>("all");
  const [kes, setKes] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Soal | null>(null);

  if (!topik || !modul) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-slate-500 mb-4">Topik tidak ditemukan.</p>
      <Button asChild variant="outline"><Link to="/admin/modul">Kembali ke Bank Soal</Link></Button>
    </div>
  );
  
  if (!allowed) return (
    <div className="flex items-center gap-3 rounded-xl border border-red-200/50 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-400 mt-6 max-w-4xl mx-auto">
      Anda tidak memiliki akses ke topik <strong>{topik.nama}</strong>. Hubungi admin.
      <Link to="/admin/modul" className="font-semibold underline ml-2">← Kembali ke Modul</Link>
    </div>
  );

  function refresh() { setSoals(soalRepo.all().filter((s) => s.topikId === topikId)); }
  function remove(id: string) {
    if (!confirm("Hapus soal?")) return;
    soalRepo.remove(id); refresh();
  }

  const shown = soals.filter((s) =>
    (tipe === "all" || s.tipe === tipe) &&
    (kes === "all" || s.kesulitan === kes) &&
    (query === "" || s.detail.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-in fade-in duration-500 pb-12 pt-4">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end justify-between border-b border-slate-200 dark:border-white/10 pb-6">
        <div className="space-y-2">
          <div className="flex items-center text-sm font-medium text-muted-foreground gap-2">
            <Link to="/admin/modul" className="hover:text-primary transition-colors flex items-center gap-1">
              ← Modul
            </Link>
            <span>/</span>
            <Link to="/admin/modul/$id/topik" params={{ id: modul.id }} className="hover:text-primary transition-colors">
              {modul.nama}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-slate-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{topik.nama}</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold ml-2">
              {soals.length} Soal
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" 
            placeholder="Cari kata kunci dalam soal…" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={tipe} onValueChange={setTipe}>
            <SelectTrigger className="w-full sm:w-44 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua tipe</SelectItem>
              {Object.entries(TIPE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={kes} onValueChange={setKes}>
            <SelectTrigger className="w-full sm:w-40 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kesulitan</SelectItem>
              {Object.entries(KES_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="w-full sm:w-auto font-semibold">
            <Plus className="mr-2 h-4 w-4" />Soal Baru
          </Button>
        </div>
      </div>

      {/* Cards Section */}
      <div className="space-y-6">
        {shown.map((s, i) => (
          <div key={s.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center justify-center w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                  {i + 1}
                </span>
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {TIPE_LABEL[s.tipe]}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  s.kesulitan === 'mudah' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' :
                  s.kesulitan === 'sedang' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' :
                  'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                }`}>
                  {KES_LABEL[s.kesulitan]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100" onClick={() => { setEditing(s); setOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Edit</span>
                </Button>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => remove(s.id)}>
                  <Trash2 className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Hapus</span>
                </Button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-5 space-y-5">
              <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed">
                <RichView html={s.detail} />
              </div>
              
              {s.tipe !== "essay" && (
                <div className="grid gap-2">
                  {s.jawaban.map((j, idx) => (
                    <div key={j.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      j.benar 
                        ? 'bg-emerald-50/50 border-emerald-500 dark:bg-emerald-950/20 dark:border-emerald-500/50' 
                        : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                    }`}>
                      <span className={`flex shrink-0 items-center justify-center w-6 h-6 rounded-md font-mono text-sm font-semibold ${
                        j.benar 
                          ? 'bg-emerald-500 text-white dark:bg-emerald-600' 
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <div className={`flex-1 text-sm pt-0.5 ${j.benar ? 'text-emerald-900 dark:text-emerald-100' : 'text-slate-700 dark:text-slate-300'}`}>
                        <RichView html={j.detail} className="inline" />
                      </div>
                      {j.benar && (
                        <div className="flex shrink-0 items-center justify-center h-6">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {shown.length === 0 && (
          <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Belum ada soal untuk topik ini.</p>
          </div>
        )}
      </div>

      <SoalDialog open={open} onOpenChange={setOpen} editing={editing} topikId={topikId} onSaved={refresh} />
    </div>
  );
}

function SoalDialog({
  open, onOpenChange, editing, topikId, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing: Soal | null; topikId: string; onSaved: () => void }) {
  const [detail, setDetail] = useState(editing?.detail ?? "");
  const [tipe, setTipe] = useState<TipeSoal>(editing?.tipe ?? "pg");
  const [kesulitan, setKesulitan] = useState<Kesulitan>(editing?.kesulitan ?? "sedang");
  const [pembahasan, setPembahasan] = useState(editing?.pembahasan ?? "");
  const [audioFileId, setAudioFileId] = useState<string | undefined>(editing?.audioFileId);
  const [audioPlayOnce, setAudioPlayOnce] = useState(editing?.audioPlayOnce ?? false);
  const [jawaban, setJawaban] = useState<Jawaban[]>(
    editing?.jawaban ?? [
      { id: uid("j_"), detail: "", benar: false },
      { id: uid("j_"), detail: "", benar: false },
      { id: uid("j_"), detail: "", benar: false },
      { id: uid("j_"), detail: "", benar: false },
    ],
  );

  const editingId = editing?.id ?? "new";
  const [lastInit, setLastInit] = useState<string>("");
  if (open && lastInit !== editingId) {
    setLastInit(editingId);
    setDetail(editing?.detail ?? "");
    setTipe(editing?.tipe ?? "pg");
    setKesulitan(editing?.kesulitan ?? "sedang");
    setPembahasan(editing?.pembahasan ?? "");
    setAudioFileId(editing?.audioFileId);
    setAudioPlayOnce(editing?.audioPlayOnce ?? false);
    setJawaban(editing?.jawaban ?? [
      { id: uid("j_"), detail: "", benar: false },
      { id: uid("j_"), detail: "", benar: false },
      { id: uid("j_"), detail: "", benar: false },
      { id: uid("j_"), detail: "", benar: false },
    ]);
  }

  function setTipeWithDefaults(t: TipeSoal) {
    setTipe(t);
    if (t === "bs") {
      setJawaban([
        { id: uid("j_"), detail: "Benar", benar: false },
        { id: uid("j_"), detail: "Salah", benar: false },
      ]);
    } else if (t === "essay") {
      setJawaban([]);
    } else if (jawaban.length < 2) {
      setJawaban([
        { id: uid("j_"), detail: "", benar: false },
        { id: uid("j_"), detail: "", benar: false },
      ]);
    }
  }

  function save() {
    if (!detail.trim()) { toast.error("Pertanyaan kosong"); return; }
    if (tipe !== "essay") {
      if (jawaban.length < 2) { toast.error("Minimal 2 opsi jawaban"); return; }
      if (!jawaban.some((j) => j.benar)) { toast.error("Tandai minimal 1 jawaban benar"); return; }
      if (tipe === "pg" && jawaban.filter((j) => j.benar).length !== 1) {
        toast.error("Pilihan ganda hanya boleh 1 jawaban benar"); return;
      }
    }
    const soal: Soal = {
      id: editing?.id ?? uid("s_"),
      topikId, detail, tipe, kesulitan, pembahasan,
      audioFileId, audioPlayOnce,
      jawaban,
      createdAt: editing?.createdAt ?? Date.now(),
    };
    soalRepo.upsert(soal);
    toast.success("Soal disimpan");
    onSaved(); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit Soal" : "Soal Baru"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Tipe</Label>
              <Select value={tipe} onValueChange={(v) => setTipeWithDefaults(v as TipeSoal)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TIPE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>Kesulitan</Label>
              <Select value={kesulitan} onValueChange={(v) => setKesulitan(v as Kesulitan)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(KES_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <div><Label>Pertanyaan</Label><RichEditor value={detail} onChange={setDetail} placeholder="Tulis pertanyaan… gunakan $x^2$ untuk rumus." minHeight={120} /></div>

          <div className="rounded border p-3 space-y-2">
            <Label className="text-xs">Audio (opsional) — pakai ID dari File Manager</Label>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded border px-2 py-1 font-mono text-xs"
                placeholder="f_xxxxxx (kosongkan untuk hapus)"
                value={audioFileId ?? ""}
                onChange={(e) => setAudioFileId(e.target.value.trim() || undefined)}
              />
              <label className="flex items-center gap-1 text-xs">
                <Checkbox checked={audioPlayOnce} onCheckedChange={(v) => setAudioPlayOnce(!!v)} />
                Play once
              </label>
            </div>
          </div>

          {tipe !== "essay" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>Opsi jawaban</Label>
                {tipe !== "bs" && <Button size="sm" variant="outline" onClick={() => setJawaban([...jawaban, { id: uid("j_"), detail: "", benar: false }])}>+ opsi</Button>}
              </div>
              {jawaban.map((j, idx) => (
                <div key={j.id} className="flex gap-2 rounded border p-2">
                  <div className="flex flex-col items-center gap-1 pt-2 text-xs">
                    <span className="font-mono">{String.fromCharCode(65 + idx)}</span>
                    <Checkbox checked={j.benar} onCheckedChange={(v) => {
                      const next = jawaban.map((x, i) => {
                        if (tipe === "pg" || tipe === "bs") return { ...x, benar: i === idx ? !!v : false };
                        return i === idx ? { ...x, benar: !!v } : x;
                      });
                      setJawaban(next);
                    }} />
                  </div>
                  <div className="flex-1"><RichEditor value={j.detail} onChange={(html) => {
                    setJawaban(jawaban.map((x, i) => i === idx ? { ...x, detail: html } : x));
                  }} minHeight={50} /></div>
                  {tipe !== "bs" && (
                    <Button size="sm" variant="ghost" onClick={() => setJawaban(jawaban.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div><Label>Pembahasan (opsional)</Label><RichEditor value={pembahasan} onChange={setPembahasan} minHeight={70} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
