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
    "bg-destructive/10 text-destructive border-destructive/80",
  "Kimia Klinik":
    "bg-muted text-muted-foreground border-border",
  "Fungsi Ginjal":
    "bg-warn/10 text-warn border-warn/80",
  "Fungsi Hati":
    "bg-primary/10 text-primary border-primary/80",
};

export function NilaiNormalTable() {
  return (
    <div className="w-full rounded-lg border border-border bg-card overflow-hidden">
      {/* Table Container with Slim Custom Scrollbar */}
      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-muted">
        <table className="w-full min-w-[480px] text-label sm:text-sm text-left border-collapse">
          <thead className="text-label font-semibold text-foreground bg-muted border-b border-border sticky top-0 z-10">
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
          <tbody className="divide-y divide-border font-medium">
            {NILAI_NORMAL_DATA.map((item, idx) => {
              const badgeStyle =
                KATEGORI_BADGE_STYLE[item.kategori] ||
                "bg-muted text-foreground border-border";

              return (
                <tr
                  key={idx}
                  className="even:bg-muted/60 hover:bg-muted transition-colors"
                >
                  <td className="px-3.5 py-2.5">
                    <div className="font-semibold text-foreground">{item.tes}</div>
                    <span
                      className={`inline-block mt-0.5 px-2 py-0.5 rounded text-label font-semibold border ${badgeStyle}`}
                    >
                      {item.kategori}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-foreground font-mono text-label">
                    {item.pria}
                  </td>
                  <td className="px-3.5 py-2.5 text-foreground font-mono text-label">
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
