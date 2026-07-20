import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { configRepo } from "@/lib/cbt/repos";

export const Route = createFileRoute("/_authenticated/admin/panduan")({
  component: PanduanPage,
});

// ponytail: flat data, no abstractions
const tocSections = [
  { id: "alur-kerja", label: "Alur Kerja Ujian" },
  { id: "bank-soal", label: "1. Bank Soal" },
  { id: "paket-ujian", label: "2. Paket Ujian" },
  { id: "jadwal-token", label: "3. Jadwal & Token" },
  { id: "pantau-live", label: "4. Pantau Live" },
  { id: "evaluasi", label: "5. Evaluasi & Hasil" },
  { id: "import", label: "Import Soal" },
  { id: "peserta", label: "Peserta & Grup" },
  { id: "backup", label: "Backup & Restore" },
  { id: "faq", label: "FAQ" },
];

function PanduanPage() {
  const cfg = configRepo.get();
  const [activeId, setActiveId] = useState("alur-kerja");
  const contentRef = useRef<HTMLDivElement>(null);

  // Intersection observer for TOC highlight
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const headings = el.querySelectorAll("[data-section]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.getAttribute("data-section") ?? "");
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
          Panduan Penggunaan
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          Referensi lengkap {cfg.appName} — dari pembuatan soal hingga evaluasi hasil.
        </p>
      </div>

      <div className="flex gap-8 items-start">
        {/* Main Content */}
        <article
          ref={contentRef}
          className="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-300 leading-relaxed divide-y divide-slate-200/80 dark:divide-slate-800/80 [&>section]:py-10 first:[&>section]:pt-0"
        >
          {/* Alur Kerja Overview */}
          <section data-section="alur-kerja">
            <SectionTitle id="alur-kerja">Alur Kerja Ujian</SectionTitle>
            <p className="mb-4">
              Seluruh proses pelaksanaan ujian mengikuti 5 tahap berurutan. Setiap
              tahap memiliki halaman khusus di sidebar yang bisa diakses langsung.
            </p>
            <div className="grid grid-cols-5 gap-px bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden text-center text-xs font-medium">
              {[
                { step: "1", label: "Buat Soal", sub: "Bank Soal" },
                { step: "2", label: "Susun Ujian", sub: "Paket Ujian" },
                { step: "3", label: "Jadwalkan", sub: "Token & Waktu" },
                { step: "4", label: "Pantau", sub: "Monitoring Live" },
                { step: "5", label: "Evaluasi", sub: "Grading & Laporan" },
              ].map((s) => (
                <div key={s.step} className="bg-white dark:bg-slate-900 py-3 px-2">
                  <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-900 dark:bg-zinc-100 text-white dark:text-slate-900 text-[10px] font-bold mb-1.5">
                    {s.step}
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-zinc-100">{s.label}</div>
                  <div className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 1. Bank Soal */}
          <section data-section="bank-soal">
            <SectionTitle id="bank-soal">1. Membuat Bank Soal</SectionTitle>
            <p className="mb-3">
              Bank Soal menggunakan hierarki <Strong>Modul → Topik → Soal</Strong>. Modul
              adalah folder utama (biasanya per mata kuliah), Topik adalah sub-folder di
              dalamnya, dan Soal adalah butir pertanyaan individual.
            </p>
            <StepList steps={[
              <>Buka <MenuRef>Bank Soal</MenuRef> di sidebar. Klik <Strong>+ Buat Modul</Strong> dan beri nama (misal: "Algoritma Dasar").</>,
              <>Masuk ke modul → buat <Strong>Topik</Strong> untuk kategorisasi (misal: "BAB 1 - Pengantar", "BAB 2 - Sorting").</>,
              <>Klik pada topik → <Strong>+ Tambah Soal</Strong>. Isi teks pertanyaan, pilihan jawaban, kunci, dan bobot nilai.</>,
              <>Tipe soal yang tersedia: <Strong>Pilihan Ganda</Strong>, <Strong>PG Kompleks</Strong> (multi-answer), dan <Strong>Essay</Strong>.</>,
            ]} />
            <Tip>
              Untuk jumlah soal banyak, gunakan fitur <Strong>Import dari Excel/Word</Strong> agar
              tidak perlu input satu per satu. Lihat bagian Import di bawah.
            </Tip>
          </section>

          {/* 2. Paket Ujian */}
          <section data-section="paket-ujian">
            <SectionTitle id="paket-ujian">2. Menyusun Paket Ujian</SectionTitle>
            <p className="mb-3">
              Paket Ujian menghubungkan soal dari Bank Soal dengan peserta dan jadwal
              pelaksanaan.
            </p>
            <StepList steps={[
              <>Buka <MenuRef>Paket Ujian</MenuRef> → klik <Strong>+ Buat Ujian</Strong>.</>,
              <>Isi: nama ujian, durasi pengerjaan (menit), dan deskripsi (opsional).</>,
              <>Tambahkan soal dari bank soal yang sudah ada. Anda bisa memilih per topik atau per soal individual.</>,
              <>Atur urutan soal: <Strong>Tetap</Strong> (semua peserta urutan sama) atau <Strong>Acak</Strong> (diacak per peserta).</>,
              <>Assign peserta yang berhak mengikuti ujian — bisa per individu atau per <Strong>Grup</Strong>.</>,
            ]} />
          </section>

          {/* 3. Jadwal & Token */}
          <section data-section="jadwal-token">
            <SectionTitle id="jadwal-token">3. Jadwal & Token Akses</SectionTitle>
            <p className="mb-3">
              Setelah paket ujian siap, atur kapan ujian bisa diakses dan aktifkan
              token sebagai lapisan keamanan tambahan.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Jadwal</div>
                <ul className="space-y-1.5 text-sm">
                  <li>• <Strong>Mulai (beginAt)</Strong> — peserta bisa masuk ujian</li>
                  <li>• <Strong>Selesai (endAt)</Strong> — ujian otomatis ditutup</li>
                  <li>• Di luar rentang ini, peserta tidak bisa mengakses ujian</li>
                </ul>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Token</div>
                <ul className="space-y-1.5 text-sm">
                  <li>• Kode akses yang harus dimasukkan peserta sebelum memulai</li>
                  <li>• Bisa di-generate otomatis atau diisi manual</li>
                  <li>• Bagikan di ruang ujian saja, jangan sebelumnya</li>
                </ul>
              </div>
            </div>
            <Warning>
              Pastikan jam server dan jam peserta sinkron. Perbedaan timezone bisa
              menyebabkan peserta tidak bisa masuk meskipun jadwal sudah benar.
            </Warning>
          </section>

          {/* 4. Pantau Live */}
          <section data-section="pantau-live">
            <SectionTitle id="pantau-live">4. Memantau Ujian Secara Live</SectionTitle>
            <p className="mb-3">
              Saat ujian berlangsung, buka <MenuRef>Pantau Ujian Live</MenuRef> untuk
              melihat aktivitas peserta secara real-time.
            </p>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5">Informasi</th>
                    <th className="px-4 py-2.5">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr><td className="px-4 py-2 font-medium text-slate-900 dark:text-zinc-100">Status Online</td><td className="px-4 py-2">Indikator hijau jika peserta aktif terhubung</td></tr>
                  <tr><td className="px-4 py-2 font-medium text-slate-900 dark:text-zinc-100">Progress Soal</td><td className="px-4 py-2">Jumlah soal yang sudah dijawab dari total</td></tr>
                  <tr><td className="px-4 py-2 font-medium text-slate-900 dark:text-zinc-100">Waktu Mulai</td><td className="px-4 py-2">Kapan peserta memulai sesi ujian</td></tr>
                  <tr><td className="px-4 py-2 font-medium text-slate-900 dark:text-zinc-100">Sisa Waktu</td><td className="px-4 py-2">Countdown durasi pengerjaan per peserta</td></tr>
                </tbody>
              </table>
            </div>
            <Tip>
              Halaman ini auto-refresh. Tidak perlu reload manual — cukup biarkan
              terbuka di tab browser Anda selama ujian berlangsung.
            </Tip>
          </section>

          {/* 5. Evaluasi */}
          <section data-section="evaluasi">
            <SectionTitle id="evaluasi">5. Evaluasi Essay & Melihat Hasil</SectionTitle>
            <p className="mb-3">
              Soal PG dinilai otomatis oleh sistem. Soal essay memerlukan penilaian
              manual oleh admin/dosen melalui <MenuRef>Evaluasi Essay</MenuRef>.
            </p>
            <StepList steps={[
              <>Buka <MenuRef>Evaluasi Essay</MenuRef>. Halaman menampilkan daftar ujian yang memiliki essay belum dinilai beserta jumlahnya.</>,
              <>Klik pada ujian → pilih peserta → baca jawaban essay mereka satu per satu.</>,
              <>Berikan skor (0 sampai bobot maksimum soal) dan catatan (opsional) → klik <Strong>Simpan</Strong>.</>,
              <>Setelah semua essay dinilai, buka <MenuRef>Analitik & Laporan</MenuRef> untuk rekap nilai gabungan (PG + Essay).</>,
            ]} />
          </section>



          {/* Import */}
          <section data-section="import">
            <SectionTitle id="import">Import Soal dari Excel / Word</SectionTitle>
            <p className="mb-3">
              Untuk memasukkan soal dalam jumlah besar, gunakan fitur import yang
              tersedia di dalam setiap modul di Bank Soal.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Import Excel (.xlsx)</div>
                <ul className="space-y-1.5 text-sm">
                  <li>• Download template kolom yang disediakan</li>
                  <li>• Isi kolom: Nomor, Pertanyaan, Opsi A–E, Kunci, Bobot</li>
                  <li>• Upload file → review → konfirmasi</li>
                </ul>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Import Word (.docx)</div>
                <ul className="space-y-1.5 text-sm">
                  <li>• Tulis soal dengan format penomoran standar</li>
                  <li>• Sistem otomatis mendeteksi struktur pertanyaan & pilihan</li>
                  <li>• Cocok untuk soal yang sudah ada dalam format dokumen</li>
                </ul>
              </div>
            </div>
            <Warning>
              Selalu review hasil parsing sebelum mengkonfirmasi import. Pastikan
              kunci jawaban dan bobot sudah benar karena tidak bisa di-undo secara batch.
            </Warning>
          </section>

          {/* Peserta & Grup */}
          <section data-section="peserta">
            <SectionTitle id="peserta">Manajemen Peserta & Grup</SectionTitle>
            <p className="mb-3">
              Kelola akun mahasiswa dan pengelompokan mereka melalui menu{" "}
              <MenuRef>Akun Peserta</MenuRef>.
            </p>
            <StepList steps={[
              <>Tambah peserta manual atau import dari Excel (NIM, nama, password default).</>,
              <>Buat <Strong>Grup</Strong> untuk mengelompokkan peserta (misal: per kelas, angkatan, atau mata kuliah).</>,
              <>Saat membuat ujian, Anda bisa assign <Strong>seluruh grup</Strong> sekaligus — tidak perlu pilih satu per satu.</>,
              <>Gunakan <MenuRef>Cetak Kartu Peserta</MenuRef> untuk mencetak kartu berisi username dan password yang bisa dibagikan ke mahasiswa.</>,
            ]} />
          </section>

          {/* Backup */}
          <section data-section="backup">
            <SectionTitle id="backup">Backup & Restore Data</SectionTitle>
            <p className="mb-3">
              Lindungi data aplikasi dengan melakukan backup berkala melalui menu{" "}
              <MenuRef>Backup & Tools</MenuRef>.
            </p>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5">Aksi</th>
                    <th className="px-4 py-2.5">Penjelasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr><td className="px-4 py-2 font-medium text-slate-900 dark:text-zinc-100">Unduh Backup</td><td className="px-4 py-2">Mengekspor seluruh database ke file JSON tunggal. Simpan di tempat aman.</td></tr>
                  <tr><td className="px-4 py-2 font-medium text-slate-900 dark:text-zinc-100">Restore</td><td className="px-4 py-2">Memulihkan dari file backup JSON. Struktur divalidasi sebelum ditimpa.</td></tr>
                  <tr><td className="px-4 py-2 font-medium text-slate-900 dark:text-zinc-100">Seed Data</td><td className="px-4 py-2">Mengisi database kosong dengan data demo otomatis untuk uji coba.</td></tr>
                  <tr className="bg-red-50/50 dark:bg-red-950/10"><td className="px-4 py-2 font-medium text-red-700 dark:text-red-400">Reset</td><td className="px-4 py-2 text-red-700 dark:text-red-400">Menghapus SELURUH data. Tidak bisa dibatalkan. Ketik "HAPUS" untuk konfirmasi.</td></tr>
                </tbody>
              </table>
            </div>
          </section>



          {/* FAQ */}
          <section data-section="faq">
            <SectionTitle id="faq">FAQ & Troubleshooting</SectionTitle>

            <FaqItem q="Peserta tidak bisa login">
              Periksa apakah akun sudah terdaftar di menu Akun Peserta. Pastikan
              username dan password benar (case-sensitive). Jika lupa password,
              admin bisa mereset langsung dari halaman data peserta.
            </FaqItem>

            <FaqItem q="Token tidak berfungsi">
              Token bersifat case-sensitive — pastikan peserta mengetik persis
              sama. Periksa juga apakah ujian sudah memasuki rentang jadwal
              (beginAt–endAt) dan token sudah diaktifkan di Editor Ujian.
            </FaqItem>

            <FaqItem q="Soal tidak muncul di ujian">
              Pastikan soal sudah ditambahkan ke <em>paket ujian</em> (bukan hanya
              di bank soal). Cek juga apakah peserta sudah di-assign ke ujian
              tersebut dan jadwal sudah aktif.
            </FaqItem>

            <FaqItem q="Bagaimana mereset password peserta?">
              Buka Akun Peserta → cari peserta → klik edit → ubah password →
              simpan. Informasikan password baru secara langsung kepada peserta.
            </FaqItem>

            <FaqItem q="Hasil ujian tidak muncul di Analitik">
              Pastikan sesi ujian sudah berakhir (melewati endAt). Jika ujian
              memiliki soal essay, nilai baru muncul setelah semua essay dinilai
              melalui menu Evaluasi Essay.
            </FaqItem>
          </section>

          {/* Footer */}
          <div className="text-xs text-slate-400 dark:text-slate-500 pt-4 pb-8 border-t border-slate-200 dark:border-slate-800">
            <p>{cfg.appName} v1.2.0 — Dokumentasi ini berlaku untuk versi saat ini.</p>
            <p className="mt-1">Butuh bantuan lebih lanjut? Hubungi administrator sistem Anda.</p>
          </div>
        </article>

        {/* Floating TOC Sidebar */}
        <nav aria-label="Daftar Isi Panduan" className="hidden lg:block w-56 shrink-0 sticky top-24 self-start bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 px-2">
            Daftar Isi
          </div>
          <ul className="space-y-1">
            {tocSections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={activeId === s.id ? "true" : undefined}
                  className={`block px-3 py-1.5 text-xs rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                    activeId === s.id
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-zinc-100 font-semibold"
                      : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-zinc-300"
                  }`}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

/* ── Tiny helper components (inline, no separate file) ── */

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-lg font-semibold text-slate-900 dark:text-white mb-3 scroll-mt-24"
    >
      {children}
    </h2>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-slate-900 dark:text-zinc-100">{children}</strong>;
}

function MenuRef({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
      {children}
    </code>
  );
}

function StepList({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="space-y-2 mb-4">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 dark:bg-zinc-100 text-white dark:text-slate-900 text-[10px] font-bold mt-0.5">
            {i + 1}
          </span>
          <span className="flex-1">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div role="note" className="flex gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-sm text-blue-800 dark:text-blue-300 mb-4">
      <span className="shrink-0 text-blue-500 font-bold text-xs mt-0.5" aria-hidden="true">TIP</span>
      <span>{children}</span>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-sm text-amber-800 dark:text-amber-300 mb-4">
      <span className="shrink-0 text-amber-600 font-bold text-xs mt-0.5" aria-hidden="true">⚠</span>
      <span>{children}</span>
    </div>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 mb-1">{q}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-0">{children}</p>
    </div>
  );
}
