
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

export function NilaiNormalTable() {
  return (
    <div className="flex flex-col gap-2">
      <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 text-xs text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200 leading-normal shadow-sm">
        <p className="font-semibold text-[11px]">Rentang Referensi Nilai Normal (Dewasa)</p>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 max-h-[380px] overflow-auto relative [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400">
        <table className="w-full text-xs text-left">
          <thead className="text-[11px] text-slate-700 uppercase bg-slate-100 dark:bg-slate-800 dark:text-slate-300 sticky top-0 shadow-sm font-bold">
            <tr>
              <th scope="col" className="px-2.5 py-2">Pemeriksaan</th>
              <th scope="col" className="px-2.5 py-2">Nilai Normal (Pria)</th>
              <th scope="col" className="px-2.5 py-2">Nilai Normal (Wanita)</th>
            </tr>
          </thead>
          <tbody>
            {NILAI_NORMAL_DATA.map((item, idx) => (
              <tr
                key={idx}
                className="bg-white border-b dark:bg-slate-900 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <td className="px-2.5 py-1.5">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">{item.tes}</div>
                  <div className="text-[10px] text-slate-400">{item.kategori}</div>
                </td>
                <td className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 text-xs font-mono">{item.pria}</td>
                <td className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 text-xs font-mono">{item.wanita}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
