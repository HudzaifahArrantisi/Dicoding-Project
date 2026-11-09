import { describe, expect, test } from 'bun:test'
import { answerMitraQuestion } from './knowledge'

describe('asisten mitra', () => {
  test.each(['hi', 'Hai!', 'halo', 'Selamat pagi', 'permisi'])('membalas sapaan %s', (question) => {
    const answer = answerMitraQuestion(question)
    expect(answer.reply).toContain('Halo!')
    expect(answer.suggestedTour).toBeUndefined()
    expect(answer.quickReplies).toHaveLength(5)
  })

  test.each([
    ['pesan barang untuk toko', 'restock'],
    ['lapor stok harian', 'stock_report'],
    ['scan resi di dus', 'delivery'],
    ['lihat log mutasi', 'logs'],
    ['ubah profil toko', 'profile'],
  ] as const)('mengenali %s', (question, tour) => {
    const answer = answerMitraQuestion(question)
    expect(answer.suggestedTour).toBe(tour)
    expect(answer.tourLabel).toBeTruthy()
    expect(answer.quickReplies).toHaveLength(5)
  })

  test('menolak pertanyaan di luar inventaris meski mengandung kata restock', () => {
    const answer = answerMitraQuestion('Buatkan resep masakan untuk restock toko')
    expect(answer.suggestedTour).toBeUndefined()
    expect(answer.reply).toContain('asisten khusus inventaris Daisuki B2B')
  })

  test('sapaan bersama pertanyaan tetap mengikuti topiknya', () => {
    expect(answerMitraQuestion('Halo, stok saya sekarang berapa?').suggestedTour).toBe('stock_report')
    expect(answerMitraQuestion('Hi, buatkan resep masakan').reply).toContain('asisten khusus inventaris Daisuki B2B')
  })

  test('menolak pertanyaan umum yang tidak cocok dengan kata kunci', () => {
    const answer = answerMitraQuestion('Siapa penemu listrik?')
    expect(answer.suggestedTour).toBeUndefined()
    expect(answer.reply).toContain('asisten khusus inventaris Daisuki B2B')
  })

  test('menjelaskan stok tanpa kapasitas maksimum dan hanya bertambah setelah verifikasi', () => {
    const report = answerMitraQuestion('lapor stok harian').reply
    const delivery = answerMitraQuestion('scan resi').reply
    expect(report).toContain('tidak punya batas maksimum')
    expect(report).not.toContain('40 pcs')
    expect(report).not.toContain('kapasitas rak')
    expect(delivery).toContain('setelah verifikasi berhasil')
    expect(delivery).toContain('jumlah yang disetujui')
  })

  test('menjawab pertanyaan tentang identitas diri asisten dengan profil resmi daisuki.pkl', () => {
    expect(answerMitraQuestion('kamu siapa').reply).toContain('Daisuki AI Assistant')
    expect(answerMitraQuestion('siapa kamu').reply).toContain('daisuki.pkl')
    expect(answerMitraQuestion('siapa kah anda').reply).toContain('Daisuki AI Assistant')
    expect(answerMitraQuestion('siapakah anda').reply).toContain('Daisuki AI Assistant')
    expect(answerMitraQuestion('apa itu daisuki pkl').reply).toContain('Multinomial Naive Bayes')
  })
})
