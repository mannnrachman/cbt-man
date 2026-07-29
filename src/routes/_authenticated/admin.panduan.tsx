import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import { configRepo } from "@/lib/cbt/repos";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";

// Official shadcn/ui Components
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Breadcrumb, 
  BreadcrumbList, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbPage, 
  BreadcrumbSeparator 
} from "@/components/ui/breadcrumb";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// Lucide Icons (Minimal & Crisp)
import { 
  Search, 
  ExternalLink, 
  BookOpen, 
  ChevronRight, 
  ChevronLeft,
  HelpCircle, 
  FileText, 
  Layers, 
  Lightbulb, 
  AlertTriangle,
  Info,
  ShieldAlert,
  Download,
  ArrowUpRight
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/panduan")({
  component: PanduanPage,
});

/* ─── 1. DOCS REGISTRY (Docusaurus Structure) ─── */
export interface DocArticle {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  description: string;
  content: (onNavigate: (id: string) => void) => React.ReactNode;
  toc: { id: string; label: string }[];
}

export interface DocCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  articles: { id: string; title: string }[];
}

const docCategories: DocCategory[] = [
  {
    id: "memulai",
    label: "1. Memulai Cepat",
    icon: BookOpen,
    articles: [
      { id: "alur-kerja", title: "Overview Alur Kerja Ujian" },
    ]
  },
  {
    id: "kelola-ujian",
    label: "2. Manajemen Bank Soal & Ujian",
    icon: Layers,
    articles: [
      { id: "bank-soal", title: "Membuat Bank Soal (Modul & Topik)" },
      { id: "paket-ujian", title: "Menyusun Paket Ujian & Acak" },
      { id: "jadwal-token", title: "Jadwal Waktu & Token Akses" },
    ]
  },
  {
    id: "pengawasan",
    label: "3. Pengawasan & Evaluasi",
    icon: ShieldAlert,
    articles: [
      { id: "pantau-live", title: "Monitoring Live & Proctoring" },
      { id: "evaluasi-essay", title: "Evaluasi Essay & Rekap Nilai" },
    ]
  },
  {
    id: "impor-sistem",
    label: "4. Impor & Pemeliharaan",
    icon: Download,
    articles: [
      { id: "import-soal", title: "Impor Soal Excel & Word" },
      { id: "peserta-role", title: "Manajemen Peserta & Role RBAC" },
      { id: "backup-tools", title: "Pencadangan, Restore & Reset" },
    ]
  },
  {
    id: "bantuan",
    label: "5. Pusat Bantuan",
    icon: HelpCircle,
    articles: [
      { id: "faq-troubleshooting", title: "FAQ & Pemecahan Masalah" },
    ]
  }
];

const articlesMap: Record<string, DocArticle> = {
  "alur-kerja": {
    id: "alur-kerja",
    title: "Overview Alur Kerja Ujian",
    category: "memulai",
    categoryLabel: "Memulai Cepat",
    description: "Panduan ringkas 5 tahapan utama pelaksanaan ujian CBT dari pembuatan soal hingga evaluasi.",
    toc: [
      { id: "tahapan", label: "5 Tahapan Ujian" },
      { id: "akses-cepat", label: "Pintasan Akses" },
    ],
    content: (onNavigate) => (
      <div className="space-y-8">
        <section id="tahapan" data-heading="tahapan" className="space-y-4">
          <h2 className="text-lg font-bold text-foreground tracking-tight">5 Tahapan Pelaksanaan Ujian</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Seluruh operasional ujian pada sistem CBT mengikuti 5 langkah berurutan yang saling terhubung:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
            {[
              { step: "1", label: "Buat Soal", sub: "Bank Soal", target: "bank-soal" },
              { step: "2", label: "Susun Ujian", sub: "Paket Ujian", target: "paket-ujian" },
              { step: "3", label: "Jadwalkan", sub: "Token & Waktu", target: "jadwal-token" },
              { step: "4", label: "Pantau", sub: "Monitoring Live", target: "pantau-live" },
              { step: "5", label: "Evaluasi", sub: "Grading & Hasil", target: "evaluasi-essay" },
            ].map((s) => (
              <Card 
                key={s.step} 
                onClick={() => onNavigate(s.target)} 
                className="group border-border bg-card text-card-foreground hover:bg-muted/80 transition-all text-center cursor-pointer shadow-none rounded-xl"
              >
                <CardContent className="p-4 flex flex-col items-center">
                  <Badge variant="outline" className="h-7 w-7 rounded-full p-0 flex items-center justify-center font-mono font-bold text-xs mb-2 border-border text-foreground group-hover:border-foreground/30 transition-colors">
                    {s.step}
                  </Badge>
                  <div className="font-semibold text-foreground text-xs transition-colors flex items-center gap-1">
                    {s.label}
                    <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-muted-foreground text-[11px] mt-0.5">{s.sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <DocCallout type="tip" title="Tips Pengelola">
          Anda dapat menavigasi setiap bab dokumen menggunakan panel kategori di sebelah kiri atau menekan tombol navigasi di bagian bawah halaman ini.
        </DocCallout>

        <section id="akses-cepat" data-heading="akses-cepat" className="space-y-4 pt-4">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Pintasan Halaman Utama</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Akses langsung halaman kerja aplikasi melalui pintasan resmi di bawah:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <DocMenuLink to="/admin/modul">Buka Bank Soal →</DocMenuLink>
            <DocMenuLink to="/admin/peserta/online">Buka Monitoring →</DocMenuLink>
            <DocMenuLink to="/admin/evaluasi">Buka Evaluasi Essay →</DocMenuLink>
          </div>
        </section>
      </div>
    )
  },

  "bank-soal": {
    id: "bank-soal",
    title: "Membuat Bank Soal (Modul & Topik)",
    category: "kelola-ujian",
    categoryLabel: "Manajemen Bank Soal & Ujian",
    description: "Mengelola struktur bank soal menggunakan pengelompokan Modul dan Topik.",
    toc: [
      { id: "struktur-hierarki", label: "Struktur Hierarki" },
      { id: "langkah-pembuatan", label: "Langkah Pembuatan" },
      { id: "tipe-soal", label: "Tipe Soal yang Didukung" },
    ],
    content: () => (
      <div className="space-y-8">
        <section id="struktur-hierarki" data-heading="struktur-hierarki" className="space-y-3">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Struktur Hierarki Soal</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Bank soal menggunakan susunan berjenjang: <Strong>Modul → Topik → Soal</Strong>.
          </p>
          <Card className="border-border bg-muted/40 p-4 text-xs font-mono space-y-1.5 shadow-none rounded-xl">
            <div className="text-foreground font-semibold">📦 Modul (Mata Kuliah / Subjek Utama)</div>
            <div className="pl-4 text-muted-foreground">└─ 📂 Topik 1 (Bab / Pokok Bahasan)</div>
            <div className="pl-8 text-muted-foreground/70">├─ ❓ Soal #1 (Pilihan Ganda)</div>
            <div className="pl-8 text-muted-foreground/70">└─ ❓ Soal #2 (Essay)</div>
          </Card>
        </section>

        <section id="langkah-pembuatan" data-heading="langkah-pembuatan" className="space-y-4">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Langkah Pembuatan</h2>
          <StepList steps={[
            <>Buka <DocMenuLink to="/admin/modul">Bank Soal</DocMenuLink> di menu navigasi utama.</>,
            <>Klik tombol <Strong>+ Buat Modul</Strong> dan masukkan nama mata kuliah.</>,
            <>Buka modul yang telah dibuat, lalu tambahkan <Strong>Topik</Strong> baru untuk mengelompokkan bab.</>,
            <>Klik topik → pilih <Strong>+ Tambah Soal</Strong> untuk menginput teks pertanyaan, opsi jawaban, dan kunci.</>,
          ]} />
        </section>

        <section id="tipe-soal" data-heading="tipe-soal" className="space-y-3">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Tipe Soal yang Didukung</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <Card className="border-border bg-card p-4 space-y-1 shadow-none rounded-xl">
              <CardTitle className="text-xs font-semibold text-foreground">Pilihan Ganda (PG)</CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground leading-normal">Satu jawaban benar. Koreksi otomatis.</CardDescription>
            </Card>
            <Card className="border-border bg-card p-4 space-y-1 shadow-none rounded-xl">
              <CardTitle className="text-xs font-semibold text-foreground">PG Kompleks (Multi)</CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground leading-normal">Beberapa jawaban benar. Koreksi otomatis.</CardDescription>
            </Card>
            <Card className="border-border bg-card p-4 space-y-1 shadow-none rounded-xl">
              <CardTitle className="text-xs font-semibold text-foreground">Essay Uraian</CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground leading-normal">Jawaban teks bebas. Penilaian manual admin/dosen.</CardDescription>
            </Card>
          </div>
        </section>
      </div>
    )
  },

  "paket-ujian": {
    id: "paket-ujian",
    title: "Menyusun Paket Ujian & Acak",
    category: "kelola-ujian",
    categoryLabel: "Manajemen Bank Soal & Ujian",
    description: "Menyusun lembar ujian, durasi menit, dan pengacak butir soal.",
    toc: [
      { id: "konfigurasi-paket", label: "Konfigurasi Paket" },
      { id: "metode-acak", label: "Metode Pengacakan" },
    ],
    content: () => (
      <div className="space-y-8">
        <section id="konfigurasi-paket" data-heading="konfigurasi-paket" className="space-y-4">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Konfigurasi Ujian Baru</h2>
          <StepList steps={[
            <>Buka <DocMenuLink to="/admin/ujian">Paket Ujian</DocMenuLink> → klik <Strong>+ Buat Ujian Baru</Strong>.</>,
            <>Isi judul ujian, deskripsi/petunjuk, dan tentukan durasi maksimal pengerjaan (dalam menit).</>,
            <>Pilih soal yang akan diujikan dari bank soal.</>,
            <>Hubungkan ujian ke peserta tertentu atau seluruh <Strong>Grup Kelas</Strong>.</>,
          ]} />
        </section>

        <DocCallout type="note" title="Pengacakan Soal">
          Pengacakan nomor soal dihitung secara unik per sesi pengerjaan peserta, sehingga urutan soal peserta A tidak akan sama dengan peserta B.
        </DocCallout>
      </div>
    )
  },

  "jadwal-token": {
    id: "jadwal-token",
    title: "Jadwal Waktu & Token Akses",
    category: "kelola-ujian",
    categoryLabel: "Manajemen Bank Soal & Ujian",
    description: "Pengaturan jendela waktu ujian dan perlindungan kode akses token.",
    toc: [
      { id: "rentang-waktu", label: "Rentang Waktu Akses" },
      { id: "keamanan-token", label: "Pengamanan Token" },
    ],
    content: () => (
      <div className="space-y-8">
        <section id="rentang-waktu" data-heading="rentang-waktu" className="space-y-3">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Rentang Waktu Akses</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Setiap ujian memiliki dua parameter jadwal utama:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Card className="border-border bg-card p-4 space-y-1.5 shadow-none rounded-xl">
              <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rentang Waktu</CardTitle>
              <CardContent className="p-0 text-xs text-muted-foreground space-y-1">
                <div>• <Strong>Waktu Mulai</Strong>: Akses sesi pengerjaan dibuka.</div>
                <div>• <Strong>Waktu Selesai</Strong>: Batas akhir peserta memulai ujian.</div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card p-4 space-y-1.5 shadow-none rounded-xl">
              <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Token Akses</CardTitle>
              <CardContent className="p-0 text-xs text-muted-foreground space-y-1">
                <div>• Kode acak yang wajib diisi peserta sebelum mulai.</div>
                <div>• Bagikan token secara langsung di ruang ujian.</div>
              </CardContent>
            </Card>
          </div>
        </section>

        <DocCallout type="warning" title="Perhatian Kalibrasi Jam">
          Pastikan jam pada server dan perangkat peserta telah terkalibrasi dengan benar agar tidak menghambat akses masuk.
        </DocCallout>
      </div>
    )
  },

  "pantau-live": {
    id: "pantau-live",
    title: "Monitoring Live & Proctoring",
    category: "pengawasan",
    categoryLabel: "Pengawasan & Evaluasi",
    description: "Pengawasan sesi aktif, insiden pelanggaran, dan aksi pengawas.",
    toc: [
      { id: "fitur-pengawas", label: "Fitur Pengawasan" },
      { id: "aksi-interaktif", label: "Aksi Pengawas" },
    ],
    content: () => (
      <div className="space-y-8">
        <section id="fitur-pengawas" data-heading="fitur-pengawas" className="space-y-4">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Fitur Dashboard Pengawas</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Buka menu <DocMenuLink to="/admin/peserta/online">Monitoring Live</DocMenuLink> saat ujian berlangsung.
          </p>

          <Card className="border-border overflow-hidden shadow-none rounded-xl">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-muted-foreground text-xs">Fitur Monitoring</TableHead>
                  <TableHead className="font-semibold text-muted-foreground text-xs">Fungsi Utama</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-card">
                <TableRow className="border-border">
                  <TableCell className="font-medium text-foreground text-xs">Status Online & Progress</TableCell>
                  <TableCell className="text-muted-foreground text-xs">Melihat keaktifan koneksi dan jumlah soal yang telah dijawab.</TableCell>
                </TableRow>
                <TableRow className="border-border">
                  <TableCell className="font-medium text-foreground text-xs">Deteksi Pelanggaran</TableCell>
                  <TableCell className="text-muted-foreground text-xs">Mencatat indikasi kecurangan (pindah tab / keluar layar).</TableCell>
                </TableRow>
                <TableRow className="border-border">
                  <TableCell className="font-medium text-foreground text-xs">Aksi Pengawas</TableCell>
                  <TableCell className="text-muted-foreground text-xs">Fitur paksa kumpulkan, tambah waktu pengerjaan, atau riset insiden.</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </section>

        <section id="aksi-interaktif" data-heading="aksi-interaktif" className="space-y-3">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Aksi Pengawas</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pengawas dapat melakukan aksi langsung dari dasbor: <Strong>Paksa Kumpulkan</Strong>, <Strong>Tambah Waktu</Strong>, atau <Strong>Riset Insiden</Strong>.
          </p>
        </section>
      </div>
    )
  },

  "evaluasi-essay": {
    id: "evaluasi-essay",
    title: "Evaluasi Essay & Rekap Nilai",
    category: "pengawasan",
    categoryLabel: "Pengawasan & Evaluasi",
    description: "Proses pemberian nilai manual untuk jawaban essay dan kalkulasi akhir.",
    toc: [
      { id: "penilaian-manual", label: "Penilaian Manual" },
    ],
    content: () => (
      <div className="space-y-8">
        <section id="penilaian-manual" data-heading="penilaian-manual" className="space-y-4">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Proses Evaluasi Essay</h2>
          <StepList steps={[
            <>Buka <DocMenuLink to="/admin/evaluasi">Evaluasi Essay</DocMenuLink>.</>,
            <>Pilih peserta dan berikan skor sesuai bobot maksimal soal.</>,
            <>Manfaatkan fitur <Strong>Beri 0 untuk Kosong</Strong> untuk mempercepat penilaian jawaban kosong.</>,
            <>Setelah penilaian selesai, rekap nilai dapat diunduh melalui laporan hasil.</>,
          ]} />
        </section>
      </div>
    )
  },

  "import-soal": {
    id: "import-soal",
    title: "Impor Soal Excel & Word",
    category: "impor-sistem",
    categoryLabel: "Impor & Pemeliharaan",
    description: "Petunjuk format masal file Microsoft Excel dan Word.",
    toc: [
      { id: "format-excel", label: "Format Excel" },
      { id: "format-word", label: "Format Word" },
    ],
    content: () => (
      <div className="space-y-8">
        <section id="format-excel" data-heading="format-excel" className="space-y-3">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Impor Berkas Excel (.xlsx)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Gunakan template resmi dari menu Bank Soal. Pastikan nama kolom sesuai: <Strong>Nomor, Pertanyaan, Pilihan A–E, Kunci, Bobot</Strong>.
          </p>
        </section>

        <section id="format-word" data-heading="format-word" className="space-y-3">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Impor Berkas Word (.docx)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Gunakan penomoran standar angka (1., 2.) dan pilihan (A., B., C.). Kunci jawaban dapat ditandai dengan cetak tebal (*bold*).
          </p>
        </section>
      </div>
    )
  },

  "peserta-role": {
    id: "peserta-role",
    title: "Manajemen Peserta & Role RBAC",
    category: "impor-sistem",
    categoryLabel: "Impor & Pemeliharaan",
    description: "Pengelolaan akun mahasiswa, grup kelas, dan wewenang operator.",
    toc: [
      { id: "akun-peserta", label: "Akun Peserta" },
      { id: "matriks-rbac", label: "Matriks RBAC" },
    ],
    content: () => (
      <div className="space-y-8">
        <section id="akun-peserta" data-heading="akun-peserta" className="space-y-3">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Manajemen Akun Peserta</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Daftarkan peserta melalui <DocMenuLink to="/admin/users">Pengguna</DocMenuLink> atau impor masal dari file Excel.
          </p>
        </section>

        <section id="matriks-rbac" data-heading="matriks-rbac" className="space-y-3">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Hak Akses Role (RBAC)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Atur wewenang khusus Admin Jurusan dan Evaluator di menu <DocMenuLink to="/admin/users/roles">Hak Akses Role</DocMenuLink>.
          </p>
        </section>
      </div>
    )
  },

  "backup-tools": {
    id: "backup-tools",
    title: "Pencadangan, Restore & Reset",
    category: "impor-sistem",
    categoryLabel: "Impor & Pemeliharaan",
    description: "Fitur keamanan pencadangan database JSON dan reset sistem.",
    toc: [
      { id: "pencadangan", label: "Pencadangan & Restore" },
    ],
    content: () => (
      <div className="space-y-8">
        <section id="pencadangan" data-heading="pencadangan" className="space-y-3">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Pencadangan & Pemulihan</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Buka menu <DocMenuLink to="/admin/tools">Alat Sistem</DocMenuLink> untuk mengunduh snapshot JSON atau memulihkan database.
          </p>
        </section>
      </div>
    )
  },

  "faq-troubleshooting": {
    id: "faq-troubleshooting",
    title: "FAQ & Pemecahan Masalah",
    category: "bantuan",
    categoryLabel: "Pusat Bantuan",
    description: "Jawaban pertanyaan umum dan pemecahan kendala teknis operasional.",
    toc: [
      { id: "pertanyaan-umum", label: "Pertanyaan Umum" },
    ],
    content: () => (
      <div className="space-y-8">
        <section id="pertanyaan-umum" data-heading="pertanyaan-umum" className="space-y-4">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Pertanyaan yang Sering Diajukan</h2>
          
          <div className="space-y-3">
            <FaqAccordion q="Peserta tidak bisa masuk menggunakan Token">
              Pastikan token diketik persis sesuai huruf besar/kecil. Periksa juga apakah waktu ujian (`beginAt` & `endAt`) sedang aktif di server.
            </FaqAccordion>

            <FaqAccordion q="Jawaban peserta tidak muncul di Evaluasi">
              Jawaban essay hanya akan muncul jika sesi ujian peserta telah berakhir (`selesai`). Jika sesi masih berjalan, lakukan paksa submit dari menu Monitoring Live.
            </FaqAccordion>

            <FaqAccordion q="Bagaimana mereset password akun peserta?">
              Buka menu <DocMenuLink to="/admin/users">Pengguna</DocMenuLink>, pilih peserta yang bersangkutan, lalu klik tombol ubah password.
            </FaqAccordion>

            <FaqAccordion q="Soal atau Gambar tidak muncul di layar peserta">
              Pastikan gambar di-upload menggunakan format WebP/PNG/JPG standar. Jika menggunakan server lokal, pastikan folder media dapat diakses publik.
            </FaqAccordion>
          </div>
        </section>
      </div>
    )
  }
};

/* ─── 2. MAIN DOCUSAURUS ENGINE PAGE COMPONENT (LINEAR/VERCEL ULTRA-CLEAN AESTHETIC) ─── */
function PanduanPage() {
  const cfg = configRepo.get();
  const [activeDocId, setActiveDocId] = useState("alur-kerja");
  const [search, setSearch] = useState("");
  const [activeHeadingId, setActiveHeadingId] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  const activeDoc = useMemo(() => {
    return articlesMap[activeDocId] || articlesMap["alur-kerja"];
  }, [activeDocId]);

  const allArticlesList = useMemo(() => {
    const list: { id: string; title: string }[] = [];
    docCategories.forEach((cat) => {
      cat.articles.forEach((art) => {
        list.push(art);
      });
    });
    return list;
  }, []);

  const { prevDoc, nextDoc } = useMemo(() => {
    const currentIndex = allArticlesList.findIndex((a) => a.id === activeDocId);
    return {
      prevDoc: currentIndex > 0 ? allArticlesList[currentIndex - 1] : null,
      nextDoc: currentIndex < allArticlesList.length - 1 ? allArticlesList[currentIndex + 1] : null,
    };
  }, [activeDocId, allArticlesList]);

  // Scrollspy observer for in-page TOC
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const headings = el.querySelectorAll("[data-heading]");
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHeadingId(entry.target.getAttribute("data-heading") ?? "");
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [activeDocId]);

  function handleNavigate(docId: string) {
    setActiveDocId(docId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return docCategories;
    const q = search.toLowerCase();
    return docCategories
      .map((cat) => ({
        ...cat,
        articles: cat.articles.filter((art) => art.title.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.articles.length > 0);
  }, [search]);

  return (
    <AdminPage className=" max-w-7xl mx-auto space-y-6 pb-28">
      <AdminPageHeader
        title="Dokumentasi & Panduan"
        description={`Pusat pengetahuan resmi ${cfg.appName} — panduan alur kerja, pengelolaan ujian, dan pemecahan masalah.`}
      />

      {/* QUICK SEARCH BAR (Linear Neutral Surface) */}
      <Card className="border-border bg-card text-card-foreground shadow-none rounded-xl">
        <CardContent className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Cari kata kunci dokumen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-background border-border text-foreground focus-visible:ring-1 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-600 focus-visible:border-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 shrink-0 text-xs font-semibold">
            <Button variant="outline" size="sm" asChild className="rounded-lg h-8 px-3 text-xs border-border bg-card text-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Link to="/admin/modul">
                <Layers className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /> Bank Soal
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="rounded-lg h-8 px-3 text-xs border-border bg-card text-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Link to="/admin/peserta/online">
                <BookOpen className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /> Monitoring
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="rounded-lg h-8 px-3 text-xs border-border bg-card text-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Link to="/admin/evaluasi">
                <FileText className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /> Evaluasi
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3-COLUMN DOCUSAURUS ULTRA-CLEAN LAYOUT */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* COLUMN 1: LEFT DOCS CATEGORY SIDEBAR (Linear Style) */}
        <Card className="w-full lg:w-64 shrink-0 border-border bg-card text-card-foreground shadow-none rounded-xl">
          <CardContent className="p-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Filter dokumen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-background border-border text-foreground focus-visible:ring-1 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-600 focus-visible:border-slate-400"
              />
            </div>
            <nav aria-label="Kategori Panduan" className="space-y-4 text-xs">
              {filteredCategories.map((cat) => {
                const IconComp = cat.icon;
                return (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-[11px] text-muted-foreground px-2 py-1">
                      <IconComp className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span>{cat.label}</span>
                    </div>
                    <ul className="space-y-0.5">
                      {cat.articles.map((art) => {
                        const isActive = art.id === activeDocId;
                        return (
                          <li key={art.id}>
                            <Button
                              variant={isActive ? "default" : "ghost"}
                              size="sm"
                              onClick={() => handleNavigate(art.id)}
                              className={`w-full justify-start text-left text-xs font-normal h-8 rounded-lg transition-colors cursor-pointer ${
                                isActive 
                                  ? "bg-primary text-primary-foreground font-semibold shadow-none" 
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              }`}
                            >
                              <span className="truncate">{art.title}</span>
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* COLUMN 2: CENTER DOCS READING CANVAS (Vercel Neutral Canvas) */}
        <Card className="flex-1 min-w-0 border-border bg-card text-card-foreground shadow-none rounded-xl">
          <CardHeader className="p-6 sm:p-8 border-b border-border space-y-3">
            
            {/* Official shadcn Breadcrumb */}
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink className="text-xs text-muted-foreground">Dokumentasi</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink className="text-xs text-muted-foreground">{activeDoc.categoryLabel}</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs font-semibold text-foreground">{activeDoc.title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {activeDoc.title}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground leading-relaxed">
              {activeDoc.description}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 sm:p-8 space-y-8">
            
            {/* Render Active Document Content */}
            <div ref={contentRef} className="prose prose-slate dark:prose-invert max-w-none">
              {activeDoc.content(handleNavigate)}
            </div>

            <div className="h-px w-full bg-border pt-4" />

            {/* Bottom Docusaurus Pagination Bar (Linear Style Buttons) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 text-xs font-semibold">
              {prevDoc ? (
                <Button
                  variant="outline"
                  onClick={() => handleNavigate(prevDoc.id)}
                  className="w-full sm:w-auto h-auto p-3 justify-start rounded-lg border-border bg-card text-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
                >
                  <ChevronLeft className="h-4 w-4 mr-2 text-muted-foreground" />
                  <div className="text-left">
                    <span className="text-[10px] text-muted-foreground font-normal block">Bab Sebelumnya</span>
                    <span className="font-semibold text-foreground">{prevDoc.title}</span>
                  </div>
                </Button>
              ) : <div />}

              {nextDoc ? (
                <Button
                  variant="outline"
                  onClick={() => handleNavigate(nextDoc.id)}
                  className="w-full sm:w-auto h-auto p-3 justify-end rounded-lg border-border bg-card text-foreground hover:bg-muted hover:text-foreground cursor-pointer text-right ml-auto transition-colors"
                >
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground font-normal block">Bab Selanjutnya</span>
                    <span className="font-semibold text-foreground">{nextDoc.title}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 ml-2 text-muted-foreground" />
                </Button>
              ) : <div />}
            </div>

          </CardContent>
        </Card>

        {/* COLUMN 3: RIGHT IN-PAGE TOC (Raycast/Linear Scrollspy) */}
        {activeDoc.toc.length > 0 && (
          <Card className="hidden xl:block w-56 shrink-0 sticky top-24 self-start border-border bg-card text-card-foreground shadow-none rounded-xl">
            <CardContent className="p-4 text-xs space-y-3">
              <div className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground px-2">
                Daftar Isi Halaman
              </div>
              <ul className="space-y-1">
                {activeDoc.toc.map((item) => {
                  const isActive = activeHeadingId === item.id;
                  return (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className={`block py-1 transition-all ${
                          isActive
                            ? "text-foreground font-semibold border-l-2 border-primary pl-2.5"
                            : "text-muted-foreground hover:text-foreground pl-3"
                        }`}
                      >
                        {item.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

      </div>
    </AdminPage>
  );
}

/* ─── 3. ULTRA-CLEAN HELPER COMPONENTS (NO PASTEL TINTS, NEUTRAL FIRST) ─── */

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

function DocMenuLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Button variant="outline" size="sm" asChild className="rounded-lg font-semibold h-8 px-3 text-xs border border-border bg-card text-foreground hover:bg-muted hover:text-foreground transition-colors">
      <Link to={to} className="inline-flex items-center gap-1.5">
        {children} <ExternalLink className="h-3 w-3 opacity-60" />
      </Link>
    </Button>
  );
}

function StepList({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="space-y-3 mb-6">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-xs sm:text-sm">
          <Badge variant="outline" className="shrink-0 h-5 w-5 rounded-full p-0 flex items-center justify-center font-mono font-bold text-[10px] mt-0.5 border-border text-foreground">
            {i + 1}
          </Badge>
          <span className="flex-1 text-foreground leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function DocCallout({ 
  type = "note", 
  title, 
  children 
}: { 
  type?: "note" | "tip" | "warning" | "danger"; 
  title?: string; 
  children: React.ReactNode 
}) {
  const icons = {
    note: Info,
    tip: Lightbulb,
    warning: AlertTriangle,
    danger: AlertTriangle,
  };

  const IconComp = icons[type];
  const isDestructive = type === "danger";

  return (
    <Alert variant={isDestructive ? "destructive" : "default"} className="rounded-xl border-border bg-muted/40 text-foreground p-4 space-y-1 shadow-none">
      <IconComp className="h-4 w-4 shrink-0 text-foreground" />
      <AlertTitle className="font-semibold text-xs text-foreground">
        {title || type}
      </AlertTitle>
      <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
        {children}
      </AlertDescription>
    </Alert>
  );
}

function FaqAccordion({ q, children }: { q: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="border-border bg-card text-card-foreground shadow-none rounded-xl overflow-hidden transition-colors">
      <Button 
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 h-auto flex items-center justify-between text-left font-semibold text-xs sm:text-sm text-foreground hover:bg-muted/50 transition-colors cursor-pointer rounded-none"
      >
        <span className="flex items-center gap-2.5">
          <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" /> {q}
        </span>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-90 text-foreground" : ""}`} />
      </Button>
      {isOpen && (
        <CardContent className="px-4 pb-4 pt-2 text-xs text-muted-foreground leading-relaxed border-t border-border bg-muted/20">
          <div className="pl-6">{children}</div>
        </CardContent>
      )}
    </Card>
  );
}
