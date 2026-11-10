export type MitraTour = "restock" | "stock_report" | "delivery" | "logs" | "profile";

export interface MitraAssistantReply {
  reply: string;
  suggestedTour?: MitraTour;
  tourLabel?: string;
  quickReplies: string[];
}

export const OUT_OF_SCOPE_REPLY = "Maaf, saya adalah asisten khusus inventaris Daisuki B2B. Saya hanya dapat membantu terkait stok fisik, pesanan restock, profil Daisuki, dan panduan operasional aplikasi cabang Anda.";

const quickReplies = [
  "Bagaimana cara restock barang?",
  "Bagaimana cara lapor stok harian?",
  "Bagaimana cara konfirmasi barang sampai (scan resi)?",
  "Bagaimana cara membaca status stok & log?",
  "Bagaimana cara melengkapi profil toko?",
];

const answers: Record<MitraTour, { reply: string; label: string }> = {
  restock: {
    reply: "Buka Restock/Pesan, cek stok gudang pusat, lalu pilih produk dan jumlah sesuai kebutuhan toko. Tambahkan catatan bila perlu, kemudian kirim pengajuan. Jumlah pesanan dibatasi stok gudang pusat yang tersedia, bukan kapasitas toko. Admin pusat dapat menyetujui penuh atau sebagian sebelum barang dikirim.",
    label: "Mulai panduan restock",
  },
  stock_report: {
    reply: "Buka Stok, cocokkan angka setiap produk dengan sisa fisik di toko, lalu tekan Simpan Laporan Stok. Angka stok toko tidak punya batas maksimum. Buffer minimal hanya membantu menunjukkan kapan stok perlu diperhatikan. Aman berarti di atas 50% buffer, Waspada di atas 20% sampai 50%, dan Kritis 20% atau kurang. Jika lebih dari 24 jam belum diperbarui, laporan ditandai belum update.",
    label: "Mulai panduan laporan stok",
  },
  delivery: {
    reply: "Buka Riwayat dan pilih pesanan berstatus Dalam Pengiriman. Saat dus fisik tiba, tekan Konfirmasi Barang Sampai, lalu pindai barcode atau masukkan kode resi yang tertera pada kiriman. Stok toko baru bertambah sebesar jumlah yang disetujui setelah verifikasi berhasil dan status menjadi Selesai.",
    label: "Mulai panduan penerimaan barang",
  },
  logs: {
    reply: "Di Riwayat, lihat status dan catatan admin pada setiap pesanan: Diproses, Disetujui, Dalam Pengiriman, lalu Selesai. Pesanan juga bisa Ditolak atau Dibatalkan sebelum pengiriman. Tab Log mencatat perubahan stok dari laporan fisik dan penerimaan restock. Gunakan filter untuk mencari catatan tertentu.",
    label: "Mulai panduan riwayat dan log",
  },
  profile: {
    reply: "Buka Profil untuk memeriksa nama penanggung jawab toko, nomor telepon, dan alamat. Lengkapi wilayah dari provinsi sampai desa atau kelurahan agar data tujuan pengiriman akurat, lalu simpan perubahan.",
    label: "Mulai panduan profil toko",
  },
};

const outOfScope = /\b(resep|masak|memasak|coding|kode program|python|javascript|politik|presiden|pemilu|gosip|selebriti|film|cuaca|olahraga|matematika)\b/i;
const greeting = /^(?:hi|hai|halo|helo|hello|pagi|siang|sore|malam|selamat pagi|selamat siang|selamat sore|selamat malam|assalamualaikum|permisi|tes|test|terima kasih|makasih|thanks|oke|ok)(?: semua| admin| kak)?$/i;
const identity = /\b(siapa(?:\s*kah)?\s+(?:kamu|anda|dirimu|ini|nih)|(?:kamu|anda|dirimu)\s+(?:ini\s+)?siapa(?:\s*kah)?|siapa(?:\s*kah)?\s+nama(?:mu|\s+(?:kamu|anda))|nama(?:mu|\s+(?:kamu|anda))\s+siapa(?:\s*kah)?|perkenalkan\s+diri(?:mu)?|kenalan\s+dong|dengan\s+siapa\s+saya\s+bicara|(?:kamu|anda)\s+(?:sistem|robot|bot|ai)\s+apa|apakah\s+(?:kamu|anda)\s+ai|tentang\s+(?:kamu|anda|asisten|bot)|profil\s+(?:ai|asisten|kamu|anda)|apa\s+itu\s+daisuki(?:\.pkl)?|daisuki\.?pkl)\b/i;
const operationalTerms = /\b(daisuki|stok|stock|restock|restok|gudang|produk|barang|pesanan|order|mitra|cabang|toko|jualan|penjualan|terjual|terlaris|laku|konsumsi|daerah|wilayah|zona|resi|pindai|scan|barcode|log|mutasi|profil|pengiriman|seblak|basreng|makaroni|keripik|laporan|lapor|pasokan|buffer)\b/i;
const intentPatterns: Array<[MitraTour, RegExp]> = [
  ["delivery", /\b(scan|pindai|barcode|qr|resi|terima dus|barang sampai|penerimaan barang|konfirmasi barang|kurir|pengiriman)\b/i],
  ["restock", /\b(restock|pesan barang|pesanan baru|ajukan pesanan|tambah pesanan|stok gudang|stok pusat|gudang pusat|pengajuan barang)\b/i],
  ["stock_report", /\b(lapor stok|laporan stok|stok harian|stok fisik|sisa stok|stok toko|stok cabang|stok saya|stok sekarang|stok di toko|status stok|aman|waspada|kritis|buffer|tutup toko|belum update)\b/i],
  ["logs", /\b(log|mutasi|riwayat|status pesanan|status order|catatan admin|persetujuan pesanan)\b/i],
  ["profile", /\b(profil|profile|pic|penanggung jawab|nomor telepon|alamat toko|wilayah|provinsi|kelurahan|desa)\b/i],
];

export function answerMitraQuestion(message: string): MitraAssistantReply {
  const normalized = message.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const base = { quickReplies: [...quickReplies] };

  if (!normalized || outOfScope.test(normalized)) return { ...base, reply: OUT_OF_SCOPE_REPLY };

  if (identity.test(message) || identity.test(normalized)) {
    return {
      ...base,
      reply: "Saya Daisuki AI Assistant, asisten inventaris mitra. Saya menggunakan model klasifikasi Multinomial Naive Bayes dalam daisuki.pkl dan data operasional PostgreSQL Daisuki untuk membantu memantau stok, konsumsi, serta risiko restock cabang Anda.",
    };
  }

  if (greeting.test(normalized)) {
    return { ...base, reply: "Halo! Ada yang ingin kamu cek soal toko Daisuki? Saya bisa bantu lihat stok, prioritas restock, pesanan, penerimaan barang, log, atau profil toko. Pilih pertanyaan cepat di bawah atau tulis pertanyaanmu." };
  }

  for (const [intent, pattern] of intentPatterns) {
    if (pattern.test(normalized)) {
      return { ...base, reply: answers[intent].reply, suggestedTour: intent, tourLabel: answers[intent].label };
    }
  }

  return { ...base, reply: OUT_OF_SCOPE_REPLY };
}

export function isOutOfScopeQuestion(message: string): boolean {
  return outOfScope.test(message.toLowerCase());
}

export function isOperationalQuestion(message: string): boolean {
  return greeting.test(message.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()) || identity.test(message) || operationalTerms.test(message);
}
