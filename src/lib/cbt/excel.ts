// Helper export Excel ringkas pakai SheetJS
import * as XLSX from "xlsx";

export function exportSheet(
  filename: string,
  sheets: { name: string; aoa: (string | number | null | undefined)[][]; merges?: XLSX.Range[] }[],
): void {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.aoa);
    
    if (s.merges) {
      ws['!merges'] = s.merges;
    }

    // Auto-calculate column widths
    const colWidths: { wch: number }[] = [];
    for (const row of s.aoa) {
      row.forEach((cell, i) => {
        const str = cell !== null && cell !== undefined ? cell.toString() : "";
        const len = str.length;
        const current = colWidths[i]?.wch || 10;
        // Cap max width at 60 characters so it doesn't get ridiculously wide for long paragraphs
        colWidths[i] = { wch: Math.min(Math.max(current, len + 2), 60) };
      });
    }
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

// Strip HTML tags simple — biar ekspor Excel bersih
export function stripHtml(html: string): string {
  return (html || "")
    .replace(/<style[^>]*>.*?<\/style>/gi, "")
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
