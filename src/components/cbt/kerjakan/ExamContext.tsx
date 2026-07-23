import { createContext, useContext } from "react";
import type { useExamState } from "./useExamState";
import type { Ujian, SesiUjian } from "@/lib/cbt/types";

type ExamContextType = ReturnType<typeof useExamState> & {
  ujian: Ujian;
  sesi: SesiUjian; // non-null since context is wrapped when sesi exists
};

export const ExamContext = createContext<ExamContextType | null>(null);

export function useExamContext() {
  const ctx = useContext(ExamContext);
  if (!ctx) {
    throw new Error("useExamContext must be used within ExamContextProvider");
  }
  return ctx;
}
