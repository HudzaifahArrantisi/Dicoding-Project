// Placeholder env untuk menjalankan unit test tanpa .env lokal.
// Nilai ini tidak dipakai untuk koneksi nyata: klien postgres baru menghubung
// saat query pertama, dan test yang butuh database harus opt-in lewat
// DAISUKI_TEST_DB=1 dengan DATABASE_URL asli.

process.env.DATABASE_URL ??= "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder";
process.env.WEB_ORIGIN ??= "http://localhost:3000";
