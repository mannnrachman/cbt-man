export function getExamStatus(beginAt: number | undefined, endAt: number | undefined, now: number) {
  if (!beginAt || !endAt) return { text: "Belum Ditentukan", color: "text-slate-500" };

  if (now > endAt) {
    return {
      text: "Ujian Sudah Berlalu",
      color:
        "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-900/30",
    };
  } else if (now >= beginAt && now <= endAt) {
    return {
      text: "Ujian Sedang Berlangsung",
      color:
        "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200/50 dark:border-green-900/30",
    };
  } else {
    return {
      text: "Ujian Akan Berlangsung",
      color:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/30",
    };
  }
}

export function getExamCountdown(beginAt: number | undefined, endAt: number | undefined, now: number) {
  if (!beginAt || !endAt) return { text: "—", color: "text-slate-400 dark:text-slate-500 font-medium" };

  if (now > endAt) {
    return {
      text: "—",
      color: "text-slate-400 dark:text-slate-500 font-medium",
    };
  } else if (now >= beginAt && now <= endAt) {
    const diffSeconds = Math.floor((endAt - now) / 1000);
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    const formatted = [
      hours > 0 ? String(hours).padStart(2, "0") : null,
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0"),
    ]
      .filter(Boolean)
      .join(":");

    return {
      text: `${formatted} (Sisa)`,
      color:
        "text-green-600 dark:text-green-400 font-bold font-mono animate-pulse",
    };
  } else {
    const diffSeconds = Math.floor((beginAt - now) / 1000);
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    const formatted = [
      hours > 0 ? String(hours).padStart(2, "0") : null,
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0"),
    ]
      .filter(Boolean)
      .join(":");

    return {
      text: `${formatted} (Mulai)`,
      color: "text-amber-600 dark:text-amber-400 font-bold font-mono",
    };
  }
}
