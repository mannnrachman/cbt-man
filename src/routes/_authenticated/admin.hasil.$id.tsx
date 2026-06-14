import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ujianRepo, sesiRepo, usersRepo, soalRepo, hydrateRepos } from "@/lib/cbt/repos";
import { recomputeSkor } from "@/lib/cbt/exam";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Pencil, Save, X } from "lucide-react";
import { useState } from "react";
import { RichView } from "@/components/cbt/RichEditor";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/hasil/$id")({
  loader: async () => {
    try {
      await hydrateRepos();
    } catch {
      // Fallback ke cache; jangan brick navigasi saat snapshot gagal.
    }
  },
  component: HasilUjian,
});

function HasilUjian() {
  const { id } = useParams({ from: "/_authenticated/admin/hasil/$id" });
  const ujian = ujianRepo.byId(id);
  const [sesis, setSesis] = useState(sesiRepo.all().filter((s) => s.ujianId === id));
  const [openId, setOpenId] = useState<string | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editSkor, setEditSkor] = useState<string>("");

  if (!ujian) return <div>Tidak ditemukan</div>;
  const users = usersRepo.all();

  function refresh() {
    setSesis(sesiRepo.all().filter((s) => s.ujianId === id));
  }

  function saveEdit(sesiId: string, idx: number) {
    const s = sesiRepo.byId(sesiId);
    if (!s) return;
    const v = editSkor === "" ? undefined : Number(editSkor);
    const next = { ...s, jawaban: s.jawaban.map((j, i) => (i === idx ? { ...j, skor: v } : j)) };
    const recalc = recomputeSkor(next, ujian!);
    sesiRepo.upsert(recalc);
    setEditIdx(null);
    setEditSkor("");
    refresh();
    toast.success("Nilai diperbarui");
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/admin/hasil" className="text-sm text-muted-foreground hover:underline">
          ← Hasil
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{ujian.nama}</h1>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="p-3">Peserta</th>
                <th className="p-3">Status</th>
                <th className="p-3">Mulai</th>
                <th className="p-3">Skor</th>
                <th className="p-3">Pelanggaran</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sesis.map((s) => {
                const u = users.find((x) => x.id === s.pesertaId);
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="p-3">{u?.namaLengkap ?? s.pesertaId}</td>
                    <td className="p-3">
                      <span className="rounded bg-accent px-2 py-0.5 text-xs">{s.status}</span>
                    </td>
                    <td className="p-3 text-xs">
                      {s.mulaiAt ? new Date(s.mulaiAt).toLocaleString("id-ID") : "-"}
                    </td>
                    <td className="p-3 font-medium">
                      {s.status === "selesai" ? `${s.skorTotal ?? 0} / ${s.maxSkor ?? 0}` : "-"}
                    </td>
                    <td className="p-3">{s.pelanggaran}</td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOpenId(openId === s.id ? null : s.id);
                          setEditIdx(null);
                        }}
                      >
                        {openId === s.id ? "Tutup" : "Detail"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Hapus sesi?")) {
                            sesiRepo.remove(s.id);
                            refresh();
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {sesis.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Belum ada sesi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {openId &&
        (() => {
          const s = sesis.find((x) => x.id === openId);
          if (!s) {
            return (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Detail sesi tidak lagi tersedia.
                </CardContent>
              </Card>
            );
          }
          return (
            <Card>
              <CardContent className="space-y-3 p-4">
                <h3 className="font-medium">Detail jawaban</h3>
                {s.jawaban.map((j, i) => {
                  const soal = soalRepo.byId(j.soalId);
                  if (!soal) {
                    return (
                      <div
                        key={i}
                        className="space-y-1 rounded border border-dashed p-3 text-sm text-muted-foreground"
                      >
                        Soal #{i + 1} tidak ditemukan di bank soal saat ini.
                      </div>
                    );
                  }
                  const benarIds = soal.jawaban.filter((x) => x.benar).map((x) => x.id);
                  const selesai = s.status === "selesai";
                  const isEssay = soal.tipe === "essay";
                  const isCorrect =
                    selesai &&
                    !isEssay &&
                    j.jawabanIds.length === benarIds.length &&
                    benarIds.every((id) => j.jawabanIds.includes(id));
                  return (
                    <div key={i} className="space-y-1 rounded border p-3 text-sm">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Soal #{i + 1} · {soal.tipe} ·{" "}
                          {selesai &&
                            (isEssay ? (
                              <span>Skor: {j.skor ?? <em>belum dinilai</em>}</span>
                            ) : isCorrect ? (
                              <span className="text-success">benar</span>
                            ) : (
                              <span className="text-destructive">salah</span>
                            ))}
                        </span>
                        <span className="flex items-center gap-1">
                          {editIdx === i ? (
                            <>
                              <Input
                                type="number"
                                className="h-7 w-20"
                                value={editSkor}
                                onChange={(e) => setEditSkor(e.target.value)}
                              />
                              <Button size="sm" variant="ghost" onClick={() => saveEdit(s.id, i)}>
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditIdx(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : isEssay ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditIdx(i);
                                setEditSkor(String(j.skor ?? ""));
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          ) : null}
                        </span>
                      </div>
                      <RichView html={soal.detail} />
                      {soal.tipe !== "essay" ? (
                        <ul className="ml-4 list-disc text-xs">
                          {soal.jawaban.map((opt) => (
                            <li
                              key={opt.id}
                              className={
                                opt.benar
                                  ? "text-success"
                                  : j.jawabanIds.includes(opt.id)
                                    ? "text-destructive"
                                    : ""
                              }
                            >
                              <RichView html={opt.detail} className="inline" />
                              {opt.benar && " ✓"}
                              {j.jawabanIds.includes(opt.id) && " (dijawab)"}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="whitespace-pre-wrap rounded bg-muted p-2 text-xs">
                          {j.jawabanEssay || <em>kosong</em>}
                        </div>
                      )}
                      {j.catatanGrader && (
                        <div className="rounded bg-accent/50 p-2 text-xs">
                          <strong>Catatan grader:</strong> {j.catatanGrader}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })()}
    </div>
  );
}
