import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { soalRepo, sesiRepo } from "@/lib/cbt/repos";
import { gradeSesi } from "@/lib/cbt/grading";
import type { SesiUjian, Ujian } from "@/lib/cbt/types";

export type FontSize = "sm" | "base" | "lg";

export function useExamState(ujian: Ujian | undefined, user: { id: string } | null) {
  const navigate = useNavigate();
  
  const [sesiDicari, setSesiDicari] = useState(false);
  const [sesi, setSesi] = useState<SesiUjian | null>(null);
  const [idx, setIdx] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [showList, setShowList] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("base");

  const submittingRef = useRef(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const sesiRef = useRef(sesi);

  useEffect(() => {
    sesiRef.current = sesi;
  }, [sesi]);

  useEffect(() => {
    if (!user || !ujian) return;
    const active = sesiRepo.all().find(
      (x) => x.ujianId === ujian.id && x.pesertaId === user.id && x.status === "sedang"
    );
    setSesi(active || null);
    setSesiDicari(true);
  }, [user, ujian]);

  useEffect(() => {
    if (sesi && sesi.status === "selesai") {
      navigate({
        to: "/peserta/ujian/$id/hasil",
        params: { id: sesi.ujianId },
      });
    }
  }, [sesi, navigate]);

  const endsAt = useMemo(() => {
    if (!sesi || !ujian) return 0;
    if (sesi.endsAt) return sesi.endsAt;
    const start = sesi.mulaiAt || Date.now();
    return start + (ujian.durasiMenit || 60) * 60 * 1000;
  }, [sesi, ujian]);

  const submit = useCallback(async (reason?: string) => {
    if (submittingRef.current || !ujian || !sesiRef.current) return;
    submittingRef.current = true;
    try {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const graded = gradeSesi(sesiRef.current, ujian);
      sesiRepo.upsert(graded);
      const result = await sesiRepo.flush();
      if (!result.ok) {
        toast.error("Gagal menyimpan jawaban. Coba kumpulkan lagi.");
        submittingRef.current = false;
        return;
      }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      toast.success(
        reason ? `Ujian disubmit (${reason})` : "Ujian berhasil disubmit",
      );
      navigate({
        to: "/peserta/ujian/$id/hasil",
        params: { id: ujian.id },
      });
    } catch {
      toast.error("Gagal menyimpan jawaban. Coba kumpulkan lagi.");
      submittingRef.current = false;
    }
  }, [ujian, navigate]);

  useEffect(() => {
    if (!sesi || !ujian || sesi.status === "selesai") return;
    const interval = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= endsAt) {
        clearInterval(interval);
        submit("Waktu Habis");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sesi, ujian, endsAt, submit]);

  const updateJawaban = useCallback((partial: Partial<SesiUjian["jawaban"][0]>) => {
    if (!sesi) return;
    const nextSesi = { ...sesi };
    nextSesi.jawaban = [...nextSesi.jawaban];
    nextSesi.jawaban[idx] = { ...nextSesi.jawaban[idx], ...partial };
    setSesi(nextSesi);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      sesiRepo.upsert(nextSesi);
      sesiRepo.flush();
    }, 2000);
  }, [sesi, idx]);

  const toggleOption = useCallback((jawabanId: string) => {
    if (!sesi) return;
    const soalId = sesi.soalIds[idx];
    const soal = soalId ? soalRepo.byId(soalId) : undefined;
    if (!soal) return;

    const currentJawaban = sesi.jawaban[idx];
    let nextJawabanIds = [...currentJawaban.jawabanIds];

    if (soal.tipe === "multi") {
      const has = currentJawaban.jawabanIds.includes(jawabanId);
      nextJawabanIds = has
        ? currentJawaban.jawabanIds.filter((x) => x !== jawabanId)
        : [...currentJawaban.jawabanIds, jawabanId];
    } else {
      nextJawabanIds = [jawabanId];
    }

    updateJawaban({ jawabanIds: nextJawabanIds });
  }, [sesi, idx, updateJawaban]);

  const handleNavigateIdx = useCallback((newIdx: number) => {
    if (!sesi) return;
    const currentJawaban = sesi.jawaban[idx];
    
    if (newIdx !== idx) {
      const dijawab = currentJawaban.jawabanIds.length > 0 || currentJawaban.jawabanEssay.trim().length > 0;
      if (!dijawab) {
        toast.error("Silakan pilih atau isi jawaban terlebih dahulu.");
        return;
      }
    }
    
    setIdx(newIdx);
  }, [sesi, idx]);

  const remaining = Math.max(0, endsAt - now);

  return {
    sesiDicari,
    sesi,
    idx,
    now,
    remaining,
    showList,
    setShowList,
    fontSize,
    setFontSize,
    updateJawaban,
    toggleOption,
    handleNavigateIdx,
    submit
  };
}
