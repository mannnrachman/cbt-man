const NILAI_NORMAL_DATA = [
  { kategori: "Darah Rutin", tes: "Hemoglobin (Hb)", pria: "13.5 - 17.5 g/dL", wanita: "12.0 - 15.5 g/dL" },
  { kategori: "Darah Rutin", tes: "Leukosit (WBC)", pria: "4,500 - 11,000 /µL", wanita: "4,500 - 11,000 /µL" },
  { kategori: "Darah Rutin", tes: "Trombosit (PLT)", pria: "150,000 - 450,000 /µL", wanita: "150,000 - 450,000 /µL" },
  { kategori: "Darah Rutin", tes: "Hematokrit (Ht)", pria: "41% - 50%", wanita: "36% - 48%" },
  { kategori: "Kimia Klinik", tes: "Gula Darah Puasa", pria: "70 - 99 mg/dL", wanita: "70 - 99 mg/dL" },
  { kategori: "Kimia Klinik", tes: "Gula Darah 2 Jam PP", pria: "< 140 mg/dL", wanita: "< 140 mg/dL" },
  { kategori: "Kimia Klinik", tes: "Kolesterol Total", pria: "< 200 mg/dL", wanita: "< 200 mg/dL" },
  { kategori: "Kimia Klinik", tes: "Asam Urat", pria: "3.4 - 7.0 mg/dL", wanita: "2.4 - 6.0 mg/dL" },
  { kategori: "Fungsi Ginjal", tes: "BUN (Blood Urea Nitrogen)", pria: "8 - 24 mg/dL", wanita: "8 - 24 mg/dL" },
  { kategori: "Fungsi Ginjal", tes: "Ureum (Urea)", pria: "17 - 50 mg/dL", wanita: "17 - 50 mg/dL" },
  { kategori: "Fungsi Ginjal", tes: "Kreatinin Darah", pria: "0.7 - 1.3 mg/dL", wanita: "0.6 - 1.1 mg/dL" },
  { kategori: "Fungsi Hati", tes: "SGOT (AST)", pria: "< 40 U/L", wanita: "< 40 U/L" },
  { kategori: "Fungsi Hati", tes: "SGPT (ALT)", pria: "< 41 U/L", wanita: "< 41 U/L" },
];

const KATEGORI_BADGE_STYLE: Record<string, string> = {
  "Darah Rutin":
    "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60",
  "Kimia Klinik":
    "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/60",
  "Fungsi Ginjal":
    "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60",
  "Fungsi Hati":
    "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200/80 dark:border-teal-800/60",
};

export function NilaiNormalTable() {
  return (
    <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Table Container with Slim Custom Scrollbar */}
      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100 dark:[&::-webkit-scrollbar-track]:bg-slate-950">
        <table className="w-full min-w-[480px] text-xs sm:text-sm text-left border-collapse">
          <thead className="text-[11px] uppercase tracking-wider font-extrabold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 sticky top-0 backdrop-blur-md z-10">
            <tr>
              <th scope="col" className="px-3.5 py-3 text-left">
                Pemeriksaan
              </th>
              <th scope="col" className="px-3.5 py-3 text-left">
                Nilai Normal (Pria)
              </th>
              <th scope="col" className="px-3.5 py-3 text-left">
                Nilai Normal (Wanita)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
            {NILAI_NORMAL_DATA.map((item, idx) => {
              const badgeStyle =
                KATEGORI_BADGE_STYLE[item.kategori] ||
                "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";

              return (
                <tr
                  key={idx}
                  className="even:bg-slate-50/60 dark:even:bg-slate-800/20 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-3.5 py-2.5">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{item.tes}</div>
                    <span
                      className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeStyle}`}
                    >
                      {item.kategori}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300 font-mono text-xs">
                    {item.pria}
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300 font-mono text-xs">
                    {item.wanita}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
