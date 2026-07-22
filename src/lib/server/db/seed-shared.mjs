import crypto from "crypto";

const DEFAULT_ROLE_ACCESS = {
  admin_prodi: [
    "dashboard",
    "peserta",
    "modul",
    "files",
    "ujian",
    "hasil",
    "evaluasi",
    "laporan",
    "leaderboard",
  ],
  evaluator: [
    "dashboard",
    "hasil",
    "evaluasi",
    "laporan",
    "leaderboard",
  ],
};

function pickAnswerIds(soal, labels) {
  const normalized = new Set(labels.map((label) => label.trim().toUpperCase()));
  return soal.jawaban
    .filter((item) => normalized.has(item.label.toUpperCase()))
    .map((item) => item.id);
}

function parseDurationMinutes(minutes) {
  return minutes * 60_000;
}

function distributeObjectiveAnswers(soal, pattern) {
  if (soal.tipe === "essay") {
    return { jawabanIds: [], jawabanEssay: pattern.essay ?? "", skor: pattern.skor };
  }

  if (pattern.empty) {
    return { jawabanIds: [], jawabanEssay: "", skor: undefined };
  }

  return {
    jawabanIds: pickAnswerIds(soal, pattern.labels ?? []),
    jawabanEssay: "",
    skor: pattern.skor,
  };
}

function scoreObjectiveAnswer(ujian, soal, jawabanIds) {
  const benarIds = soal.jawaban.filter((item) => item.benar).map((item) => item.id).sort();
  const selected = [...jawabanIds].sort();
  if (selected.length === 0) return ujian.poinKosong;
  const match =
    benarIds.length === selected.length && benarIds.every((id, index) => id === selected[index]);
  return match ? ujian.poinBenar : ujian.poinSalah;
}

function buildSesiRecord({ uid, now, ujian, peserta, questionEntries, answerPlan, status, offsets, graderId }) {
  const mulaiAt = now + (offsets.mulaiMinutes ?? 0) * 60_000;
  const selesaiAt =
    status === "selesai"
      ? mulaiAt + Math.min(ujian.durasiMenit - 2, offsets.durasiMinutes ?? ujian.durasiMenit - 2) * 60_000
      : undefined;
  const endsAt = status === "sedang" ? mulaiAt + parseDurationMinutes(ujian.durasiMenit) : undefined;
  const jawabanOrder = Object.fromEntries(
    questionEntries.map(({ soal, acakJawaban }) => {
      const ids = soal.jawaban.map((item) => item.id);
      return [soal.id, acakJawaban ? [...ids].reverse() : ids];
    }),
  );

  let total = 0;
  let maxSkor = 0;
  let gradedAt;

  const jawaban = questionEntries.map(({ soal }, index) => {
    const pattern = answerPlan[index] ?? { empty: true };
    const payload = distributeObjectiveAnswers(soal, pattern);

    if (soal.tipe === "essay") {
      maxSkor += ujian.poinBenar;
      if (typeof payload.skor === "number") {
        total += payload.skor;
        gradedAt = selesaiAt ?? now;
      }
      return {
        soalId: soal.id,
        jawabanIds: payload.jawabanIds,
        jawabanEssay: payload.jawabanEssay,
        ragu: !!pattern.ragu,
        skor: payload.skor,
        catatanGrader: pattern.catatanGrader,
      };
    }

    maxSkor += ujian.poinBenar;
    const skor = scoreObjectiveAnswer(ujian, soal, payload.jawabanIds);
    total += skor;
    return {
      soalId: soal.id,
      jawabanIds: payload.jawabanIds,
      jawabanEssay: "",
      ragu: !!pattern.ragu,
      skor,
      catatanGrader: undefined,
    };
  });

  return {
    id: uid("se_"),
    ujianId: ujian.id,
    pesertaId: peserta.id,
    status,
    mulaiAt,
    selesaiAt,
    endsAt,
    soalIds: questionEntries.map(({ soal }) => soal.id),
    jawabanOrder,
    jawaban,
    pelanggaran: offsets.pelanggaran ?? 0,
    skorTotal: status === "selesai" ? total : undefined,
    maxSkor: status === "selesai" ? maxSkor : undefined,
    gradedAt,
    gradedBy: gradedAt ? graderId : undefined,
    createdAt: mulaiAt - 10 * 60_000,
  };
}

export async function createSeedDataset({ uid, now, hashPassword }) {
  const ts = now ?? Date.now();
  const schoolName = "Universitas Teknologi Nusantara";

  const groups = [
    { id: uid("g_"), nama: "Teknik Informatika", keterangan: `${schoolName} · Program Studi Teknik Informatika` },
    { id: uid("g_"), nama: "Sistem Informasi", keterangan: `${schoolName} · Program Studi Sistem Informasi` },
    { id: uid("g_"), nama: "Ilmu Komputer", keterangan: `${schoolName} · Program Studi Ilmu Komputer` },
    { id: uid("g_"), nama: "Bisnis Digital", keterangan: `${schoolName} · Program Studi Bisnis Digital` },
  ];

  const adminPassword = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? crypto.randomBytes(8).toString("hex") : "admin123");
  if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PASSWORD) {
    console.warn(`[WARNING] No ADMIN_PASSWORD provided in production! Generated random password for super_admin: ${adminPassword}`);
  }

  const admin = {
    id: uid("u_"),
    username: "admin",
    passwordHash: await hashPassword(adminPassword),
    namaLengkap: "Rahmawati Kusuma, M.Pd",
    role: "super_admin",
    allowedTopikIds: [],
    detail: `${schoolName} · Kepala Sistem CBT`,
    aktif: true,
    createdAt: ts,
  };

  if (process.env.NODE_ENV === "production") {
    return {
      groups: [],
      users: [admin],
      modul: [],
      topik: [],
      soal: [],
      ujian: [],
      token: [],
      sesi: [],
      config: {
        appName: "CBT-MAN",
        appLogo: "",
        appDeskripsi: "Sistem CBT Universitas",
        pesanLogin: "Silakan login menggunakan akun Anda.",
        mobileLock: false,
        multiDevice: false,
        roleAccess: DEFAULT_ROLE_ACCESS,
      }
    };
  }

  const operator = {
    id: uid("u_"),
    username: "operator1",
    passwordHash: await hashPassword("operator123"),
    namaLengkap: "Budi Santoso, S.Kom",
    role: "admin_prodi",
    allowedTopikIds: [],
    detail: `${schoolName} · Operator Laboratorium Komputer`,
    aktif: true,
    createdAt: ts + 1,
  };

  const evaluator1 = {
    id: uid("u_"),
    username: "evaluator1",
    passwordHash: await hashPassword("evaluator123"),
    namaLengkap: "Dr. Evaluator Utama",
    role: "evaluator",
    allowedTopikIds: [],
    detail: `${schoolName} · Evaluator Penilaian Ujian`,
    aktif: true,
    createdAt: ts + 2,
  };

  const guruNames = [
    ["dosen_rpl", "Dr. Dian Puspitasari, S.Kom., M.Cs."],
    ["dosen_db", "Prof. Andri Wijaya, Ph.D."],
    ["dosen_algo", "Rina Marlina, M.Kom."],
  ];

  const pesertaSeed = [
    ["alif.mahendra", "Alif Mahendra Putra", groups[0].id],
    ["nayla.putri", "Nayla Putri Anindya", groups[0].id],
    ["fajar.ramadhan", "Fajar Ramadhan", groups[1].id],
    ["salma.azzahra", "Salma Azzahra", groups[1].id],
    ["rizky.pratama", "Rizky Pratama", groups[2].id],
    ["intan.permata", "Intan Permata Sari", groups[2].id],
    ["bagas.saputra", "Bagas Saputra", groups[3].id],
    ["citra.lestari", "Citra Lestari", groups[3].id],
  ];

  const modul = [
    { id: uid("m_"), nama: "Pemrograman Web", aktif: true },
    { id: uid("m_"), nama: "Basis Data", aktif: true },
    { id: uid("m_"), nama: "Algoritma", aktif: true },
  ];

  const topik = [
    { id: uid("t_"), modulId: modul[0].id, nama: "HTML & CSS Dasar" },
    { id: uid("t_"), modulId: modul[0].id, nama: "React dan State Management" },
    { id: uid("t_"), modulId: modul[1].id, nama: "Desain Skema Relasional" },
    { id: uid("t_"), modulId: modul[1].id, nama: "Query SQL Lanjut" },
    { id: uid("t_"), modulId: modul[2].id, nama: "Struktur Data Pohon" },
    { id: uid("t_"), modulId: modul[2].id, nama: "Kompleksitas Waktu (Big O)" },
  ];

  const users = [admin, operator, evaluator1];
  for (const [username, namaLengkap] of guruNames) {
    users.push({
      id: uid("u_"),
      username,
      passwordHash: await hashPassword("dosen123"),
      namaLengkap,
      role: "admin_prodi",
      allowedTopikIds: [],
      detail: `${schoolName} · Dosen Pengampu`,
      aktif: true,
      createdAt: ts + users.length,
    });
  }
  for (const [username, namaLengkap] of pesertaSeed) {
    users.push({
      id: uid("u_"),
      username,
      passwordHash: await hashPassword("peserta123"),
      namaLengkap,
      role: "mahasiswa",
      allowedTopikIds: [],
      detail: `${schoolName} · Mahasiswa aktif`,
      aktif: true,
      createdAt: ts + users.length,
    });
  }

  const restrictedTeacher = users.find((item) => item.username === "dosen_db");
  if (restrictedTeacher) {
    restrictedTeacher.allowedTopikIds = [topik[2].id, topik[3].id];
    restrictedTeacher.detail = `${schoolName} · Dosen Basis Data (akses topik terbatas)`;
  }

  const soalBlueprints = [
    { topikIndex: 0, tipe: "pg", kesulitan: "mudah", detail: "Nilai x yang memenuhi 3x + 9 = 24 adalah …", jawaban: [["A", "3", false], ["B", "4", false], ["C", "5", true], ["D", "6", false]], pembahasan: "3x = 15 sehingga x = 5." },
    { topikIndex: 0, tipe: "multi", kesulitan: "sedang", detail: "Pilih semua persamaan yang memiliki akar x = 2.", jawaban: [["A", "x² - 4 = 0", true], ["B", "x + 2 = 0", false], ["C", "2x - 4 = 0", true], ["D", "x² + 4 = 0", false]], pembahasan: "Substitusi x = 2 memenuhi opsi A dan C." },
    { topikIndex: 0, tipe: "essay", kesulitan: "sulit", detail: "Jelaskan langkah menyelesaikan sistem persamaan 2x + y = 11 dan x - y = 1.", jawaban: [], pembahasan: "Gunakan eliminasi atau substitusi hingga diperoleh x = 4 dan y = 3." },
    { topikIndex: 1, tipe: "pg", kesulitan: "mudah", detail: "Median dari data 4, 7, 8, 10, 13 adalah …", jawaban: [["A", "7", false], ["B", "8", true], ["C", "9", false], ["D", "10", false]], pembahasan: "Data sudah urut, nilai tengah adalah 8." },
    { topikIndex: 1, tipe: "bs", kesulitan: "sedang", detail: "Benar atau salah: Modus adalah nilai yang paling sering muncul dalam kumpulan data.", jawaban: [["A", "Benar", true], ["B", "Salah", false]], pembahasan: "Definisi modus adalah nilai yang paling sering muncul." },
    { topikIndex: 1, tipe: "essay", kesulitan: "sedang", detail: "Tuliskan interpretasi sederhana dari rata-rata nilai kelas bila mean = 78.", jawaban: [], pembahasan: "Rata-rata menunjukkan capaian umum kelas berada di angka 78." },
    { topikIndex: 2, tipe: "pg", kesulitan: "mudah", detail: "Satuan SI untuk gaya adalah …", jawaban: [["A", "Joule", false], ["B", "Newton", true], ["C", "Pascal", false], ["D", "Watt", false]], pembahasan: "Gaya diukur dalam Newton (N)." },
    { topikIndex: 2, tipe: "multi", kesulitan: "sedang", detail: "Pilih semua besaran turunan berikut.", jawaban: [["A", "Kecepatan", true], ["B", "Massa", false], ["C", "Percepatan", true], ["D", "Waktu", false]], pembahasan: "Kecepatan dan percepatan adalah besaran turunan." },
    { topikIndex: 2, tipe: "essay", kesulitan: "sulit", detail: "Jelaskan hubungan massa, gaya, dan percepatan menurut Hukum II Newton.", jawaban: [], pembahasan: "F = m × a, sehingga percepatan sebanding dengan gaya dan berbanding terbalik dengan massa." },
    { topikIndex: 3, tipe: "pg", kesulitan: "mudah", detail: "Hambatan listrik dilambangkan dengan satuan …", jawaban: [["A", "Volt", false], ["B", "Ampere", false], ["C", "Ohm", true], ["D", "Watt", false]], pembahasan: "Hambatan listrik memiliki satuan ohm (Ω)." },
    { topikIndex: 3, tipe: "bs", kesulitan: "sedang", detail: "Benar atau salah: Arus listrik mengalir dari potensial tinggi ke potensial rendah pada arah arus konvensional.", jawaban: [["A", "Benar", true], ["B", "Salah", false]], pembahasan: "Arah arus konvensional didefinisikan dari potensial tinggi ke rendah." },
    { topikIndex: 4, tipe: "pg", kesulitan: "mudah", detail: "Organel sel yang berfungsi sebagai pusat respirasi sel adalah …", jawaban: [["A", "Nukleus", false], ["B", "Mitokondria", true], ["C", "Ribosom", false], ["D", "Lisosom", false]], pembahasan: "Mitokondria menghasilkan energi melalui respirasi sel." },
    { topikIndex: 4, tipe: "essay", kesulitan: "sedang", detail: "Jelaskan perbedaan fungsi ribosom dan mitokondria secara singkat.", jawaban: [], pembahasan: "Ribosom menyintesis protein, sedangkan mitokondria menghasilkan energi." },
    { topikIndex: 5, tipe: "pg", kesulitan: "mudah", detail: "Interaksi antara lebah dan bunga tergolong …", jawaban: [["A", "Parasitisme", false], ["B", "Komensalisme", false], ["C", "Mutualisme", true], ["D", "Predasi", false]], pembahasan: "Keduanya saling diuntungkan sehingga termasuk mutualisme." },
    { topikIndex: 5, tipe: "multi", kesulitan: "sedang", detail: "Pilih komponen biotik dalam ekosistem berikut.", jawaban: [["A", "Tanah", false], ["B", "Rumput", true], ["C", "Belalang", true], ["D", "Air", false]], pembahasan: "Komponen biotik adalah makhluk hidup, seperti rumput dan belalang." },
  ];

  const soal = soalBlueprints.map((blueprint, index) => {
    const soalId = uid("s_");
    const topikId = topik[blueprint.topikIndex].id;
    return {
      id: soalId,
      topikId,
      detail: `<p>${blueprint.detail}</p>`,
      tipe: blueprint.tipe,
      kesulitan: blueprint.kesulitan,
      audioFileId: undefined,
      audioPlayOnce: false,
      pembahasan: blueprint.pembahasan,
      createdAt: ts + 100 + index,
      jawaban: blueprint.jawaban.map(([label, detail, benar]) => ({
        id: uid("j_"),
        label,
        detail: `<p>${detail}</p>`,
        benar,
      })),
    };
  });

  const peserta = users.filter((item) => item.role === "mahasiswa");

  const ujian = [
    {
      id: uid("ex_"),
      nama: "Ujian Akhir Semester Pemrograman Web",
      deskripsi: "<p>Ujian Akhir Semester untuk mata kuliah Pemrograman Web. Kerjakan dengan teliti.</p>",
      durasiMenit: 45,
      poinBenar: 10,
      poinSalah: 0,
      poinKosong: 0,
      beginAt: ts - parseDurationMinutes(180),
      endAt: ts + parseDurationMinutes(720),
      tokenAktif: true,
      ipRange: "",
      groupIds: [groups[0].id, groups[1].id],
      topicSets: [
        { id: uid("ts_"), topikId: topik[0].id, jumlah: 3, jumlahOpsi: 4, acakSoal: true, acakJawaban: true },
        { id: uid("ts_"), topikId: topik[1].id, jumlah: 3, jumlahOpsi: 4, acakSoal: true, acakJawaban: true },
      ],
      showResult: true,
      showResultDetail: true,
      fullscreenWajib: true,
      maxPindahTab: 3,
      blokirShortcut: true,
      createdBy: admin.id,
      createdAt: ts + 300,
    },
    {
      id: uid("ex_"),
      nama: "Ujian Tengah Semester Basis Data",
      deskripsi: "<p>Ujian Tengah Semester mata kuliah Basis Data Relasional.</p>",
      durasiMenit: 40,
      poinBenar: 5,
      poinSalah: -1,
      poinKosong: 0,
      beginAt: ts - parseDurationMinutes(1440),
      endAt: ts + parseDurationMinutes(1440),
      tokenAktif: false,
      ipRange: "",
      groupIds: [groups[1].id, groups[2].id],
      topicSets: [
        { id: uid("ts_"), topikId: topik[2].id, jumlah: 3, jumlahOpsi: 4, acakSoal: true, acakJawaban: true },
        { id: uid("ts_"), topikId: topik[3].id, jumlah: 2, jumlahOpsi: 4, acakSoal: true, acakJawaban: true },
      ],
      showResult: true,
      showResultDetail: true,
      fullscreenWajib: false,
      maxPindahTab: 5,
      blokirShortcut: false,
      createdBy: operator.id,
      createdAt: ts + 301,
    },
    {
      id: uid("ex_"),
      nama: "Ujian Komprehensif Algoritma",
      deskripsi: "<p>Asesmen akhir mata kuliah Algoritma dan Struktur Data.</p>",
      durasiMenit: 50,
      poinBenar: 10,
      poinSalah: 0,
      poinKosong: 0,
      beginAt: ts - parseDurationMinutes(2880),
      endAt: ts + parseDurationMinutes(360),
      tokenAktif: true,
      ipRange: "",
      groupIds: [groups[2].id, groups[3].id],
      topicSets: [
        { id: uid("ts_"), topikId: topik[4].id, jumlah: 2, jumlahOpsi: 4, acakSoal: true, acakJawaban: true },
        { id: uid("ts_"), topikId: topik[5].id, jumlah: 2, jumlahOpsi: 4, acakSoal: true, acakJawaban: true },
      ],
      showResult: true,
      showResultDetail: false,
      fullscreenWajib: true,
      maxPindahTab: 2,
      blokirShortcut: true,
      createdBy: admin.id,
      createdAt: ts + 302,
    },
  ];

  for (let i = 1; i <= 20; i++) {
    ujian.push({
      id: uid("ex_"),
      nama: `Ujian Simulasi ${i} - Tes Kemampuan Dasar`,
      deskripsi: `<p>Ujian simulasi otomatis ke-${i} untuk pengujian performa tabel dan pagination.</p>`,
      durasiMenit: 60,
      poinBenar: 10,
      poinSalah: 0,
      poinKosong: 0,
      beginAt: ts - parseDurationMinutes(300 + (i * 5)),
      endAt: ts + parseDurationMinutes(1440 + (i * 10)),
      tokenAktif: true,
      ipRange: "",
      groupIds: [groups[0].id, groups[1].id, groups[2].id, groups[3].id],
      topicSets: [
        { id: uid("ts_"), topikId: topik[0].id, jumlah: 1, jumlahOpsi: 4, acakSoal: true, acakJawaban: true },
      ],
      showResult: true,
      showResultDetail: false,
      fullscreenWajib: false,
      maxPindahTab: 5,
      blokirShortcut: false,
      createdBy: admin.id,
      createdAt: ts + 302 + i,
    });
  }

  const token = [
    { id: uid("tk_"), ujianId: ujian[0].id, kode: "UAS-WEB-01", dipakaiOleh: peserta[0].id, dipakaiAt: ts - parseDurationMinutes(70) },
    { id: uid("tk_"), ujianId: ujian[0].id, kode: "UAS-WEB-02" },
    { id: uid("tk_"), ujianId: ujian[0].id, kode: "UAS-WEB-03" },
    { id: uid("tk_"), ujianId: ujian[2].id, kode: "KOMP-ALG-01", dipakaiOleh: peserta[4].id, dipakaiAt: ts - parseDurationMinutes(120) },
    { id: uid("tk_"), ujianId: ujian[2].id, kode: "KOMP-ALG-02" },
  ];

  const soalByTopik = Object.fromEntries(topik.map((item) => [item.id, soal.filter((entry) => entry.topikId === item.id)]));
  const resolveQuestionEntries = (exam) =>
    exam.topicSets.flatMap((topicSet) => {
      let pool = soalByTopik[topicSet.topikId] ?? [];
      if (topicSet.tipe) pool = pool.filter((item) => item.tipe === topicSet.tipe);
      if (topicSet.kesulitan) pool = pool.filter((item) => item.kesulitan === topicSet.kesulitan);
      return pool.slice(0, topicSet.jumlah).map((entry) => ({ soal: entry, acakJawaban: topicSet.acakJawaban }));
    });

  const sesi = [];

  const qMath = resolveQuestionEntries(ujian[0]);
  sesi.push(
    buildSesiRecord({
      uid,
      now: ts,
      ujian: ujian[0],
      peserta: peserta[0],
      questionEntries: qMath,
      status: "selesai",
      graderId: admin.id,
      offsets: { mulaiMinutes: -70, durasiMinutes: 31, pelanggaran: 0 },
      answerPlan: [
        { labels: ["C"] },
        { labels: ["A", "C"] },
        { essay: "Saya gunakan eliminasi. Dari x - y = 1 maka y = x - 1, lalu substitusi ke 2x + y = 11 sehingga 3x = 12 dan x = 4, maka y = 3.", skor: 10, catatanGrader: "Langkah lengkap dan hasil benar." },
        { labels: ["B"] },
        { labels: ["A"] },
        { essay: "Mean 78 menunjukkan kemampuan rata-rata kelas berada di angka 78 dan sebagian besar siswa dekat di sekitar nilai itu.", skor: 8, catatanGrader: "Interpretasi cukup baik." },
      ],
    }),
  );
  sesi.push(
    buildSesiRecord({
      uid,
      now: ts,
      ujian: ujian[0],
      peserta: peserta[1],
      questionEntries: qMath,
      status: "sedang",
      graderId: admin.id,
      offsets: { mulaiMinutes: -10, pelanggaran: 1 },
      answerPlan: [
        { labels: ["C"] },
        { labels: ["A"] },
        { essay: "Metodenya saya belum selesai, tapi dimulai dari substitusi y = x - 1.", ragu: true },
        { labels: ["B"] },
        { empty: true },
        { essay: "Rata-rata 78 berarti nilai keseluruhan kelas sekitar itu.", ragu: true },
      ],
    }),
  );
  sesi.push(
    buildSesiRecord({
      uid,
      now: ts,
      ujian: ujian[0],
      peserta: peserta[2],
      questionEntries: qMath,
      status: "belum",
      graderId: admin.id,
      offsets: { mulaiMinutes: 0, pelanggaran: 0 },
      answerPlan: [],
    }),
  );

  const qPhysics = resolveQuestionEntries(ujian[1]);
  sesi.push(
    buildSesiRecord({
      uid,
      now: ts,
      ujian: ujian[1],
      peserta: peserta[3],
      questionEntries: qPhysics,
      status: "selesai",
      graderId: operator.id,
      offsets: { mulaiMinutes: -190, durasiMinutes: 28, pelanggaran: 2 },
      answerPlan: [
        { labels: ["B"] },
        { labels: ["A", "C"] },
        { essay: "Menurut Hukum II Newton, jika gaya diperbesar pada massa tetap maka percepatan bertambah. Jika massa diperbesar pada gaya tetap, percepatan mengecil.", skor: 4, catatanGrader: "Penjelasan baik, contoh bisa diperjelas." },
        { labels: ["C"] },
        { labels: ["A"] },
      ],
    }),
  );
  sesi.push(
    buildSesiRecord({
      uid,
      now: ts,
      ujian: ujian[1],
      peserta: peserta[4],
      questionEntries: qPhysics,
      status: "selesai",
      graderId: operator.id,
      offsets: { mulaiMinutes: -250, durasiMinutes: 35, pelanggaran: 0 },
      answerPlan: [
        { labels: ["A"] },
        { labels: ["A", "B"] },
        { essay: "Gaya, massa, dan percepatan saling terkait dalam rumus F = ma.", skor: 3, catatanGrader: "Konsep inti sudah ada, butuh elaborasi." },
        { labels: ["C"] },
        { labels: ["A"] },
      ],
    }),
  );

  const qBiology = resolveQuestionEntries(ujian[2]);
  sesi.push(
    buildSesiRecord({
      uid,
      now: ts,
      ujian: ujian[2],
      peserta: peserta[5],
      questionEntries: qBiology,
      status: "selesai",
      graderId: admin.id,
      offsets: { mulaiMinutes: -120, durasiMinutes: 39, pelanggaran: 0 },
      answerPlan: [
        { labels: ["B"] },
        { essay: "Ribosom berperan menyusun protein, sedangkan mitokondria menghasilkan energi dari respirasi sel.", skor: 9, catatanGrader: "Sangat baik." },
        { labels: ["C"] },
        { labels: ["B", "C"] },
      ],
    }),
  );
  sesi.push(
    buildSesiRecord({
      uid,
      now: ts,
      ujian: ujian[2],
      peserta: peserta[6],
      questionEntries: qBiology,
      status: "selesai",
      graderId: admin.id,
      offsets: { mulaiMinutes: -90, durasiMinutes: 41, pelanggaran: 1 },
      answerPlan: [
        { labels: ["B"] },
        { essay: "Ribosom dan mitokondria sama-sama organel sel, tetapi saya lupa perbedaan rinci fungsinya.", catatanGrader: "Jawaban terlalu umum, perlu diperjelas." },
        { labels: ["A"] },
        { labels: ["B"] },
      ],
    }),
  );

  const config = {
    appName: "CBT-MAN",
    appDeskripsi: "Simulasi CBT Kampus dengan data dummy realistis untuk preview lokal.",
    pesanLogin: "Selamat datang di portal ujian Universitas Teknologi Nusantara. Gunakan akun demo sesuai peran untuk mencoba alur sistem.",
    mobileLock: false,
    multiDevice: false,
    roleAccess: DEFAULT_ROLE_ACCESS,
  };

  return { groups, users, modul, topik, soal, ujian, token, sesi, config };
}

export async function seedDatabase({ prisma, dataset, stringifyJson }) {
  await prisma.jawaban.deleteMany();
  await prisma.sesiUjian.deleteMany();
  await prisma.tokenUjian.deleteMany();
  await prisma.soal.deleteMany();
  await prisma.ujian.deleteMany();
  await prisma.topik.deleteMany();
  await prisma.modul.deleteMany();
  await prisma.user.deleteMany();
  await prisma.appConfig.deleteMany();
  // ponytail: Seed script isn't transactional because it's a one-time setup. If it fails, wipe DB and retry. Upgrade path: Use prisma.$transaction for production data migrations.
  await prisma.user.createMany({
    data: dataset.users.map((item) => ({
      ...item,
      allowedTopikIds: stringifyJson(item.allowedTopikIds),
      detail: item.detail ?? null,
      createdAt: BigInt(item.createdAt),
    })),
  });
  await prisma.modul.createMany({ data: dataset.modul });
  await prisma.topik.createMany({ data: dataset.topik });

  for (const item of dataset.soal) {
    await prisma.soal.create({
      data: {
        id: item.id,
        topikId: item.topikId,
        detail: item.detail,
        tipe: item.tipe,
        kesulitan: item.kesulitan,
        audioFileId: item.audioFileId ?? null,
        audioPlayOnce: item.audioPlayOnce,
        pembahasan: item.pembahasan,
        createdAt: BigInt(item.createdAt),
        jawaban: {
          create: item.jawaban.map((jawaban) => ({
            id: jawaban.id,
            detail: jawaban.detail,
            benar: jawaban.benar,
          })),
        },
      },
    });
  }

  await prisma.ujian.createMany({
    data: dataset.ujian.map((item) => ({
      ...item,
      beginAt: item.beginAt ? BigInt(item.beginAt) : null,
      endAt: item.endAt ? BigInt(item.endAt) : null,
      groupIds: stringifyJson(item.groupIds),
      topicSets: stringifyJson(item.topicSets),
      createdAt: BigInt(item.createdAt),
    })),
  });

  await prisma.tokenUjian.createMany({
    data: dataset.token.map((item) => ({
      ...item,
      dipakaiOleh: item.dipakaiOleh ?? null,
      dipakaiAt: item.dipakaiAt ? BigInt(item.dipakaiAt) : null,
    })),
  });

  await prisma.sesiUjian.createMany({
    data: dataset.sesi.map((item) => ({
      ...item,
      mulaiAt: item.mulaiAt ? BigInt(item.mulaiAt) : null,
      selesaiAt: item.selesaiAt ? BigInt(item.selesaiAt) : null,
      endsAt: item.endsAt ? BigInt(item.endsAt) : null,
      soalIds: stringifyJson(item.soalIds),
      jawabanOrder: stringifyJson(item.jawabanOrder),
      jawaban: stringifyJson(item.jawaban),
      skorTotal: item.skorTotal ?? null,
      maxSkor: item.maxSkor ?? null,
      gradedAt: item.gradedAt ? BigInt(item.gradedAt) : null,
      gradedBy: item.gradedBy ?? null,
      createdAt: BigInt(item.createdAt),
    })),
  });

  await prisma.appConfig.create({
    data: {
      id: "app",
      appName: dataset.config.appName,
      appDeskripsi: dataset.config.appDeskripsi,
      pesanLogin: dataset.config.pesanLogin,
      mobileLock: dataset.config.mobileLock,
      multiDevice: dataset.config.multiDevice,
      roleAccess: stringifyJson(dataset.config.roleAccess),
    },
  });
}
