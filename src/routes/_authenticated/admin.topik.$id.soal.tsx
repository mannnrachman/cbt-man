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
    <div className="relative min-h-screen">
      {/* Subtle radial glow background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-50/50 via-white to-white dark:from-indigo-950/20 dark:via-zinc-950 dark:to-zinc-950 -z-10" />
      
      <div className="mx-auto max-w-6xl space-y-12 animate-in fade-in duration-700 pb-32 pt-16 px-4 sm:px-6 lg:px-8">
        {/* Studio-Tier Header Section */}
        <div className="flex flex-col gap-8 md:flex-row md:items-end justify-between">
          <div className="space-y-5">
            <div className="flex items-center text-sm font-medium text-slate-500 dark:text-zinc-400 gap-3">
              <Link to="/admin/modul" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                ← Bank Soal
              </Link>
              <span className="text-slate-300 dark:text-zinc-700">/</span>
              <Link to="/admin/modul/$id/topik" params={{ id: modul.id }} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                {modul.nama}
              </Link>
            </div>
            
            <div className="flex flex-col gap-3">
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-zinc-50 leading-none">
                {topik.nama}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-sm font-bold border border-indigo-100 dark:border-indigo-500/20">
                  <ListChecks className="h-4 w-4" />
                  {soals.length} Soal Tersedia
                </span>
              </div>
            </div>
          </div>
        </div>

      {/* Premium Toolbar / Filters */}
      <div className="p-2.5 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-zinc-800/60 shadow-sm flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <Input 
            className="pl-11 h-12 bg-white dark:bg-zinc-950 border-transparent hover:border-slate-200 dark:hover:border-zinc-800 focus:border-indigo-500 rounded-xl transition-all shadow-none text-base" 
            placeholder="Cari kata kunci dalam soal…" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={tipe} onValueChange={setTipe}>
            <SelectTrigger className="w-full sm:w-44 h-12 rounded-xl bg-white dark:bg-zinc-950 border-transparent hover:border-slate-200 dark:hover:border-zinc-800 shadow-none font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua tipe</SelectItem>
              {Object.entries(TIPE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={kes} onValueChange={setKes}>
            <SelectTrigger className="w-full sm:w-40 h-12 rounded-xl bg-white dark:bg-zinc-950 border-transparent hover:border-slate-200 dark:hover:border-zinc-800 shadow-none font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kesulitan</SelectItem>
              {Object.entries(KES_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="w-full sm:w-auto h-12 rounded-xl px-6 font-bold bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white shadow-md shadow-slate-900/10 dark:shadow-indigo-900/20 transition-all">
            <Plus className="mr-2 h-4 w-4" />Soal Baru
          </Button>
        </div>
      </div>

      {/* Studio-Tier Cards Section */}
      <div className="space-y-8">
        {shown.map((s, i) => (
          <div key={s.id} className="bg-white/80 dark:bg-zinc-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-zinc-700 transition-all overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/40 dark:bg-zinc-950/40 gap-3">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 dark:bg-zinc-100 font-mono text-xs font-black text-white dark:text-zinc-900 shadow-sm">
                  {i + 1}
                </span>
                <span className="rounded-full bg-slate-200/60 dark:bg-zinc-800 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-zinc-400">
                  {TIPE_LABEL[s.tipe]}
                </span>
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                  s.kesulitan === 'mudah' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' :
                  s.kesulitan === 'sedang' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' :
                  'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
                }`}>
                  {KES_LABEL[s.kesulitan]}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" className="h-8 px-3 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 font-medium" aria-label="Edit" onClick={() => { setEditing(s); setOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5 sm:mr-2" /> <span className="hidden sm:inline">Edit</span>
                </Button>
                <div className="w-px h-5 bg-slate-200 dark:bg-zinc-700 mx-1"></div>
                <Button size="sm" variant="ghost" className="h-8 px-3 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-medium" aria-label="Hapus" onClick={() => remove(s.id)}>
                  <Trash2 className="h-3.5 w-3.5 sm:mr-2" /> <span className="hidden sm:inline">Hapus</span>
                </Button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="text-base prose prose-slate dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:tracking-tight">
                <RichView html={s.detail} />
              </div>
              
              {s.tipe !== "essay" && (
                <div className="grid gap-3 mt-4">
                  {s.jawaban.map((j, idx) => (
                    <div key={j.id} className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                      j.benar 
                        ? 'bg-emerald-50/80 border-emerald-500/50 dark:bg-emerald-500/10 dark:border-emerald-500/30 shadow-sm shadow-emerald-100/50 dark:shadow-none' 
                        : 'bg-white border-slate-200/80 hover:border-slate-300 dark:bg-zinc-900/50 dark:border-zinc-800 dark:hover:border-zinc-700'
                    }`}>
                      <span className={`flex shrink-0 items-center justify-center w-7 h-7 rounded-md font-mono text-sm font-bold shadow-sm ${
                        j.benar 
                          ? 'bg-emerald-500 text-white dark:bg-emerald-600' 
                          : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <div className={`flex-1 text-sm pt-1 font-medium ${j.benar ? 'text-emerald-950 dark:text-emerald-100' : 'text-slate-700 dark:text-zinc-300'}`}>
                        <RichView html={j.detail} className="inline" />
                      </div>
                      {j.benar && (
                        <div className="flex shrink-0 items-center justify-center h-7">
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
          <div className="py-24 text-center bg-white/50 dark:bg-zinc-900/30 backdrop-blur-sm rounded-2xl border border-dashed border-slate-300 dark:border-zinc-800">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800 mb-4">
              <BookOpen className="h-8 w-8 text-slate-400 dark:text-zinc-500" />
            </div>
            <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">Belum ada soal</h3>
            <p className="text-slate-500 dark:text-zinc-400 mt-1">Gunakan tombol "Soal Baru" untuk mulai menambahkan soal.</p>
          </div>
        )}
      </div>

      <SoalDialog open={open} onOpenChange={setOpen} editing={editing} topikId={topikId} onSaved={refresh} />
      </div>
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
