# Berkontribusi ke CBT-MAN

Terima kasih atas minat Anda berkontribusi pada **CBT-MAN**.

Proyek ini didedikasikan untuk pendidikan dan bersifat **open source (MIT)**. Kontribusi yang meningkatkan kualitas, keamanan, dan kegunaan aplikasi dipersilakan.

## Sebelum Berkontribusi

- Repositori ini dilisensikan under **MIT**.
- Perubahan besar pada arsitektur atau domain model sebaiknya didiskusikan dulu lewat issue.

## Kontribusi yang Disambut

- perbaikan bug
- peningkatan type-safety
- peningkatan testing
- perbaikan dokumentasi
- perbaikan performa dan aksesibilitas
- penanganan error dan persistensi yang lebih aman

## Alur Kerja

1. Fork repositori.
2. Buat branch fokus.
3. Jaga perubahan tetap kecil dan dapat ditinjau.
4. Jalankan verifikasi sebelum mengirim PR.
5. Buka pull request dengan deskripsi jelas.

## Verifikasi

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

## Gaya

- penamaan jelas
- commit kecil dan koheren
- hindari refactor tidak perlu yang bercampur dengan perubahan fitur
- konsisten dengan domain sekolah/CBT yang sudah ada

## Pertanyaan

Untuk perubahan besar atau sensitif, buka issue terlebih dahulu untuk didiskusikan sebelum implementasi.
