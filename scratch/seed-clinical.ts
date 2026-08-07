import { PrismaClient, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();
const uid = () => 'uid_' + randomBytes(8).toString('hex');

async function main() {
  const modulId = (await prisma.modul.findFirst())?.id;
  if (!modulId) throw new Error("No modul found");

  const adminId = (await prisma.user.findFirst())?.id;
  if (!adminId) throw new Error("No admin found");

  const topikId = uid();
  await prisma.topik.create({
    data: {
      id: topikId,
      modulId,
      nama: "Keperawatan & Farmasi - Hitungan & Nilai Normal"
    }
  });

  const generateOptions = (benar: string, salah1: string, salah2: string, salah3: string, salah4: string) => ({
    create: [
      { id: uid(), detail: benar, benar: true },
      { id: uid(), detail: salah1, benar: false },
      { id: uid(), detail: salah2, benar: false },
      { id: uid(), detail: salah3, benar: false },
      { id: uid(), detail: salah4, benar: false },
    ].sort(() => Math.random() - 0.5)
  });

  const soals: Prisma.SoalCreateInput[] = [];
  for (let i = 0; i < 5; i++) {
    // 1. Infus
    const vol = (Math.floor(Math.random() * 5) + 1) * 500;
    const time = (Math.floor(Math.random() * 12) + 1) * 2;
    const drop = 20;
    const tpm = Math.round((vol * drop) / (time * 60));
    soals.push({
      id: uid(), topikId, tipe: "pg", kesulitan: "sedang", createdAt: BigInt(Date.now()),
      detail: `<p>Seorang pasien membutuhkan cairan infus RL sebanyak ${vol} ml dalam waktu ${time} jam. Menggunakan set infus makro (faktor tetes ${drop} tetes/ml). Berapa tetes per menit (tpm) yang harus diberikan?</p>`,
      pembahasan: `<p>(Volume x Faktor Tetes) / (Waktu x 60) = (${vol} x ${drop}) / (${time} x 60) = ${tpm} tpm</p>`,
      jawaban: generateOptions(`${tpm} tpm`, `${tpm + 5} tpm`, `${tpm - 5} tpm`, `${tpm + 10} tpm`, `${tpm - 10} tpm`)
    });

    // 2. Dosis
    const order = (Math.floor(Math.random() * 10) + 1) * 100;
    const avail = (Math.floor(Math.random() * 5) + 1) * 100 + order; 
    const volD = Math.floor(Math.random() * 5) + 2;
    const dose = (order / avail) * volD;
    soals.push({
      id: uid(), topikId, tipe: "pg", kesulitan: "sedang", createdAt: BigInt(Date.now()),
      detail: `<p>Dokter meresepkan obat ${order} mg. Tersedia obat dalam vial dengan konsentrasi ${avail} mg dalam ${volD} ml pelarut. Berapa ml yang harus diambil dalam spuit?</p>`,
      pembahasan: `<p>(Dosis diminta / Dosis tersedia) x Volume = (${order} / ${avail}) x ${volD} = ${dose.toFixed(2)} ml</p>`,
      jawaban: generateOptions(`${dose.toFixed(2)} ml`, `${(dose+0.5).toFixed(2)} ml`, `${(dose-0.2).toFixed(2)} ml`, `${(dose+1).toFixed(2)} ml`, `${(dose*2).toFixed(2)} ml`)
    });

    // 3. BMI
    const bb = Math.floor(Math.random() * 50) + 40;
    const tb = (Math.floor(Math.random() * 40) + 140) / 100;
    const bmi = (bb / (tb * tb)).toFixed(1);
    soals.push({
      id: uid(), topikId, tipe: "pg", kesulitan: "mudah", createdAt: BigInt(Date.now()),
      detail: `<p>Seorang pasien memiliki berat badan ${bb} kg dan tinggi badan ${Math.round(tb*100)} cm. Hitunglah Body Mass Index (BMI) pasien tersebut!</p>`,
      pembahasan: `<p>BMI = BB / TB^2 (dalam meter) = ${bb} / (${tb} x ${tb}) = ${bmi}</p>`,
      jawaban: generateOptions(`${bmi}`, `${(parseFloat(bmi)+2.1).toFixed(1)}`, `${(parseFloat(bmi)-1.5).toFixed(1)}`, `${(parseFloat(bmi)+4.0).toFixed(1)}`, `${(parseFloat(bmi)-3.2).toFixed(1)}`)
    });

    // 4. Tekanan Darah
    const sistol = Math.floor(Math.random() * 80) + 100;
    const diastol = Math.floor(Math.random() * 50) + 60;
    let interpret = "Normal";
    if (sistol > 140 || diastol > 90) interpret = "Hipertensi";
    else if (sistol < 90 || diastol < 60) interpret = "Hipotensi";
    else if (sistol >= 120) interpret = "Prehipertensi";

    const falses = ["Normal", "Hipertensi", "Hipotensi", "Prehipertensi", "Krisis Hipertensi"].filter(x => x !== interpret);
    soals.push({
      id: uid(), topikId, tipe: "pg", kesulitan: "sedang", createdAt: BigInt(Date.now()),
      detail: `<p>Hasil pengukuran tekanan darah pasien adalah ${sistol}/${diastol} mmHg. Berdasarkan tabel nilai normal tanda vital orang dewasa, bagaimana interpretasi kondisi ini?</p>`,
      pembahasan: `<p>Nilai normal tekanan darah dewasa adalah Sistolik &lt; 120 dan Diastolik &lt; 80. Pasien ini masuk dalam kategori ${interpret}.</p>`,
      jawaban: generateOptions(interpret, falses[0], falses[1], falses[2], falses[3])
    });

    // 5. Gula Darah Puasa
    const gdp = Math.floor(Math.random() * 150) + 60;
    let intGdp = "Normal";
    if (gdp < 70) intGdp = "Hipoglikemia";
    else if (gdp >= 126) intGdp = "Diabetes";
    else if (gdp >= 100) intGdp = "Prediabetes";

    const falsesGdp = ["Normal", "Hipoglikemia", "Diabetes", "Prediabetes", "Ketoasidosis"].filter(x => x !== intGdp);
    soals.push({
      id: uid(), topikId, tipe: "pg", kesulitan: "sedang", createdAt: BigInt(Date.now()),
      detail: `<p>Pemeriksaan Gula Darah Puasa (GDP) pasien menunjukkan angka ${gdp} mg/dL. Berdasarkan nilai normal, pasien ini diklasifikasikan sebagai?</p>`,
      pembahasan: `<p>Normal: 70-99 mg/dL. ${gdp} masuk ke kategori ${intGdp}.</p>`,
      jawaban: generateOptions(intGdp, falsesGdp[0], falsesGdp[1], falsesGdp[2], falsesGdp[3])
    });

    // 6. Hemoglobin Pria
    const hb = Math.floor(Math.random() * 100) / 10 + 8.0;
    let intHb = "Normal";
    if (hb < 13.8) intHb = "Anemia";
    else if (hb > 17.2) intHb = "Polisitemia";

    const falsesHb = ["Normal", "Anemia", "Polisitemia", "Trombositopenia", "Leukopenia"].filter(x => x !== intHb);
    soals.push({
      id: uid(), topikId, tipe: "pg", kesulitan: "sedang", createdAt: BigInt(Date.now()),
      detail: `<p>Seorang pasien pria dewasa memiliki kadar Hemoglobin ${hb.toFixed(1)} g/dL. Berdasarkan nilai rujukan hematologi, interpretasinya adalah?</p>`,
      pembahasan: `<p>Nilai normal Hb pria dewasa adalah 13.8 - 17.2 g/dL. Angka ${hb.toFixed(1)} berarti ${intHb}.</p>`,
      jawaban: generateOptions(intHb, falsesHb[0], falsesHb[1], falsesHb[2], falsesHb[3])
    });
  }

  for (const s of soals) {
    await prisma.soal.create({ data: s });
  }

  const ujianId = uid();
  await prisma.ujian.create({
    data: {
      id: ujianId,
      nama: "Ujian Khusus: Klinis, Farmasi, & Nilai Normal",
      deskripsi: "Ujian berisi 30 soal hitungan klinis dan nilai normal. Gunakan Kalkulator & Tabel Rujukan.",
      durasiMenit: 60,
      createdBy: adminId,
      createdAt: BigInt(Date.now()),
      allowCalculator: true,
      allowNormalValues: true,
      tokenAktif: false,
      groupIds: "[]",
      topicSets: JSON.stringify([{ topikId, tipe: null, kesulitan: null, jumlah: 30, acakSoal: true, acakJawaban: true }])
    }
  });

  console.log(`Created Ujian '${ujianId}' with 30 Soal.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
