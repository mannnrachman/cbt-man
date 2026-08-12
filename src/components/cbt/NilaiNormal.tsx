
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
    <div className="flex flex-col gap-4">
      <div className="bg-blue-50/50 p-3 rounded border border-blue-100 text-xs text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200 leading-relaxed shadow-sm">
        <p className="font-semibold mb-1">Rentang Referensi Nilai Normal (Dewasa)</p>
        <p>
          <strong>Sumber Dokumen:</strong> Pedoman Interpretasi Data Klinik Kemenkes RI (Versi 2.0).
          <strong> Populasi:</strong> Dewasa, Non-Hamil. <strong>Metode:</strong> Standar ISO 15189.
        </p>
        <p className="mt-1 italic opacity-80">
          *Disclaimer: Data di bawah ini murni ditujukan untuk keperluan simulasi ujian dan edukasi sistem CBT. Tidak boleh digunakan sebagai rujukan diagnosis atau penanganan medis di dunia nyata.
        </p>
      </div>

      <div className="rounded-md border max-h-[60vh] overflow-auto relative">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-700 uppercase bg-slate-100 dark:bg-slate-800 dark:text-slate-300 sticky top-0 shadow-sm">
            <tr>
              <th scope="col" className="px-4 py-3">Pemeriksaan</th>
              <th scope="col" className="px-4 py-3">Nilai Normal (Pria)</th>
              <th scope="col" className="px-4 py-3">Nilai Normal (Wanita)</th>
            </tr>
          </thead>
          <tbody>
            {NILAI_NORMAL_DATA.map((item, idx) => (
              <tr
                key={idx}
                className="bg-white border-b dark:bg-slate-900 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{item.tes}</div>
                  <div className="text-xs text-slate-500">{item.kategori}</div>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.pria}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.wanita}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
