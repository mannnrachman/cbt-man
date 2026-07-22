import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { AudioPlayer } from "@/components/cbt/AudioPlayer";
import { RichView } from "@/components/cbt/RichEditor";
import { useExamContext } from "./ExamContext";
import { soalRepo } from "@/lib/cbt/repos";

export function ExamQuestion() {
  const { sesi, idx, fontSize, updateJawaban, toggleOption } = useExamContext();

  const soalId = sesi.soalIds[idx];
  const soal = soalId ? soalRepo.byId(soalId) : undefined;
  const currentJawaban = sesi.jawaban[idx];

  if (!soal || !currentJawaban) {
    return <div className="p-8 text-center font-medium">Soal bermasalah.</div>;
  }

  const optOrder = sesi.jawabanOrder[soal.id] ?? soal.jawaban.map((o) => o.id);

  const textSizeClass = 
    fontSize === "sm" ? "text-sm sm:text-base prose-sm" : 
    fontSize === "lg" ? "text-xl sm:text-2xl prose-xl" : "text-base sm:text-lg prose-base";

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
      <div className="max-w-4xl mx-auto px-5 sm:px-10 py-8 sm:py-12 pb-32">
        
        {/* Question Text */}
        <div className={cn("prose prose-slate dark:prose-invert max-w-none mb-10 text-slate-800 dark:text-slate-200 leading-loose", textSizeClass)}>
          <RichView html={soal.detail} />
        </div>
        
        {/* Audio Player if present */}
        {soal.audioFileId && (
          <div className="mb-10 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-widest">Audio Pendukung</p>
            <AudioPlayer
              fileId={soal.audioFileId}
              playOnce={soal.audioPlayOnce}
              storageKey={`cbtman:audio:${sesi.id}:${soal.id}`}
            />
          </div>
        )}

        {/* Options / Essay Input */}
        <div className="space-y-4">
          {soal.tipe === "essay" ? (
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-primary opacity-0 group-focus-within:opacity-100 rounded-2xl blur transition duration-300" />
              <Textarea
                rows={10}
                value={currentJawaban.jawabanEssay}
                onChange={(e) => updateJawaban({ jawabanEssay: e.target.value })}
                placeholder="Ketik jawaban esai Anda secara lengkap dan jelas di sini..."
                className={cn(
                  "relative bg-white dark:bg-slate-950 resize-y p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 focus-visible:ring-0 focus-visible:border-primary shadow-inner transition-colors",
                  textSizeClass
                )}
              />
            </div>
          ) : (
            optOrder.map((oid, i) => {
              const opt = soal.jawaban.find((x) => x.id === oid);
              if (!opt) return null;
              const isChecked = currentJawaban.jawabanIds.includes(oid);
              const optLetter = String.fromCharCode(65 + i);

              return (
                <label 
                  key={oid}
                  className={cn(
                    "group relative flex items-start p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:-translate-y-0.5",
                    isChecked 
                      ? "bg-primary/5 border-primary shadow-[0_0_0_1px_rgba(3,165,89,1)] dark:bg-primary/10 dark:shadow-[0_0_0_1px_rgba(3,165,89,0.5)]" 
                      : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md"
                  )}
                >
                  <input
                    type={soal.tipe === "multi" ? "checkbox" : "radio"}
                    name={`soal-${soal.id}`}
                    className="sr-only"
                    checked={isChecked}
                    onChange={() => toggleOption(oid)}
                  />
                  
                  <div className="flex shrink-0 items-center justify-center mt-0.5 sm:mt-1 mr-4 sm:mr-6">
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 font-bold transition-all duration-300",
                      isChecked
                        ? "bg-primary border-primary text-white scale-110 shadow-md"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 group-hover:border-primary/50 group-hover:text-primary"
                    )}>
                      {optLetter}
                    </div>
                  </div>

                  <div className={cn(
                    "flex-1 min-w-0 prose prose-slate dark:prose-invert max-w-none prose-p:my-0 leading-relaxed transition-colors",
                    textSizeClass,
                    isChecked ? "text-slate-900 dark:text-white font-medium" : "text-slate-600 dark:text-slate-300"
                  )}>
                    <RichView html={opt.detail} />
                  </div>
                </label>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
