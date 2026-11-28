import { eq } from "drizzle-orm";
import { db } from "./client";
import { partners } from "./schema";
import { getRegionOptions } from "../modules/regions";

interface LocationTemplate {
  districtName: string;
  villageName: string;
  streetName: string;
  postalCode: string;
}

// Data template wilayah administratif & jalan realistis per kota/kabupaten
const REGENCY_DATA: Record<string, {
  provinceCode: string;
  provinceName: string;
  regencyCode: string;
  regencyName: string;
  locations: LocationTemplate[];
}> = {
  "Kota Administrasi Jakarta Selatan": {
    provinceCode: "31",
    provinceName: "DKI Jakarta",
    regencyCode: "31.74",
    regencyName: "Kota Administrasi Jakarta Selatan",
    locations: [
      { districtName: "Pasar Minggu", villageName: "Kebagusan", postalCode: "12520", streetName: "Jl. Kebagusan Raya No. 41, RT 03/RW 06" },
      { districtName: "Cilandak", villageName: "Cilandak Barat", postalCode: "12430", streetName: "Jl. RS. Fatmawati Raya No. 15, RT 02/RW 04" },
      { districtName: "Kebayoran Baru", villageName: "Senayan", postalCode: "12190", streetName: "Jl. Senopati No. 88, RT 05/RW 03" },
      { districtName: "Setiabudi", villageName: "Karet Kuningan", postalCode: "12940", streetName: "Jl. Prof. DR. Satrio No. 24, RT 01/RW 02" },
      { districtName: "Tebet", villageName: "Tebet Barat", postalCode: "12810", streetName: "Jl. Tebet Barat Dalam Raya No. 32, RT 06/RW 01" },
    ],
  },
  "Kota Administrasi Jakarta Barat": {
    provinceCode: "31",
    provinceName: "DKI Jakarta",
    regencyCode: "31.73",
    regencyName: "Kota Administrasi Jakarta Barat",
    locations: [
      { districtName: "Grogol Petamburan", villageName: "Tanjung Duren Selatan", postalCode: "11470", streetName: "Jl. Tanjung Duren Raya No. 72, RT 04/RW 05" },
      { districtName: "Kebon Jeruk", villageName: "Kebon Jeruk", postalCode: "11530", streetName: "Jl. Surya Mandala No. 19, RT 01/RW 03" },
      { districtName: "Palmerah", villageName: "Slipi", postalCode: "11480", streetName: "Jl. Kemanggisan Utama No. 8, RT 07/RW 02" },
      { districtName: "Kembangan", villageName: "Kembangan Selatan", postalCode: "11610", streetName: "Jl. Puri Indah Raya Blok A No. 12, RT 02/RW 06" },
    ],
  },
  "Kota Administrasi Jakarta Timur": {
    provinceCode: "31",
    provinceName: "DKI Jakarta",
    regencyCode: "31.75",
    regencyName: "Kota Administrasi Jakarta Timur",
    locations: [
      { districtName: "Jatinegara", villageName: "Cipinang Cempedak", postalCode: "13340", streetName: "Jl. Otista Raya No. 56, RT 03/RW 07" },
      { districtName: "Duren Sawit", villageName: "Pondok Kelapa", postalCode: "13450", streetName: "Jl. Raden Inten II No. 18, RT 02/RW 08" },
      { districtName: "Kramat Jati", villageName: "Cililitan", postalCode: "13640", streetName: "Jl. Raya Bogor Km. 19 No. 4, RT 05/RW 01" },
      { districtName: "Pulo Gadung", villageName: "Rawamangun", postalCode: "13220", streetName: "Jl. Balai Pustaka Timur No. 21, RT 04/RW 09" },
    ],
  },
  "Kota Administrasi Jakarta Utara": {
    provinceCode: "31",
    provinceName: "DKI Jakarta",
    regencyCode: "31.72",
    regencyName: "Kota Administrasi Jakarta Utara",
    locations: [
      { districtName: "Kelapa Gading", villageName: "Kelapa Gading Timur", postalCode: "14240", streetName: "Jl. Boulevard Raya Blok LA No. 10, RT 01/RW 12" },
      { districtName: "Penjaringan", villageName: "Pluit", postalCode: "14450", streetName: "Jl. Pluit Putra Raya No. 35, RT 06/RW 06" },
      { districtName: "Tanjung Priok", villageName: "Sunter Agung", postalCode: "14350", streetName: "Jl. Danau Sunter Utara Blok F No. 8, RT 03/RW 11" },
      { districtName: "Pademangan", villageName: "Ancol", postalCode: "14430", streetName: "Jl. Lodan Raya No. 14, RT 02/RW 02" },
    ],
  },
  "Kota Administrasi Jakarta Pusat": {
    provinceCode: "31",
    provinceName: "DKI Jakarta",
    regencyCode: "31.71",
    regencyName: "Kota Administrasi Jakarta Pusat",
    locations: [
      { districtName: "Menteng", villageName: "Gondangdia", postalCode: "10350", streetName: "Jl. Teuku Cik Ditiro No. 27, RT 01/RW 05" },
      { districtName: "Tanah Abang", villageName: "Bendungan Hilir", postalCode: "10210", streetName: "Jl. Bendungan Hilir Raya No. 45, RT 08/RW 01" },
    ],
  },
  "Kota Tangerang Selatan": {
    provinceCode: "36",
    provinceName: "Banten",
    regencyCode: "36.74",
    regencyName: "Kota Tangerang Selatan",
    locations: [
      { districtName: "Serpong", villageName: "Lengkong Gudang", postalCode: "15310", streetName: "Ruko Tol Boulevard Blok B No. 12, BSD City, RT 02/RW 05" },
      { districtName: "Serpong Utara", villageName: "Pakulonan", postalCode: "15325", streetName: "Jl. Jalur Sutera Boulevard Kav. 16, Alam Sutera, RT 01/RW 07" },
      { districtName: "Pondok Aren", villageName: "Bintaro", postalCode: "15222", streetName: "Sektor 7 Bintaro Jaya, Jl. Boulevard Bintaro No. 29, RT 03/RW 04" },
      { districtName: "Ciputat Timur", villageName: "Cireundeu", postalCode: "15419", streetName: "Jl. Cireundeu Raya No. 50, RT 04/RW 03" },
      { districtName: "Pamulang", villageName: "Pamulang Barat", postalCode: "15417", streetName: "Jl. Surya Kencana No. 88, RT 02/RW 06" },
      { districtName: "Serpong", villageName: "Rawa Buntu", postalCode: "15318", streetName: "Jl. Rawa Buntu No. 14, RT 03/RW 01" },
      { districtName: "Setu", villageName: "Muncul", postalCode: "15314", streetName: "Jl. Raya Puspitek No. 22, RT 01/RW 04" },
    ],
  },
  "Kota Tangerang": {
    provinceCode: "36",
    provinceName: "Banten",
    regencyCode: "36.71",
    regencyName: "Kota Tangerang",
    locations: [
      { districtName: "Tangerang", villageName: "Sukasari", postalCode: "15118", streetName: "Jl. Kisamaun No. 64, RT 02/RW 03" },
      { districtName: "Cipondoh", villageName: "Poris Plawad", postalCode: "15141", streetName: "Jl. KH. Hasyim Ashari No. 102, RT 05/RW 04" },
      { districtName: "Karawaci", villageName: "Bojong Jaya", postalCode: "15115", streetName: "Jl. Imam Bonjol No. 33, RT 01/RW 02" },
      { districtName: "Ciledug", villageName: "Sudimara Barat", postalCode: "15151", streetName: "Jl. Raden Fatah No. 75, RT 03/RW 08" },
    ],
  },
  "Kota Serang": {
    provinceCode: "36",
    provinceName: "Banten",
    regencyCode: "36.73",
    regencyName: "Kota Serang",
    locations: [
      { districtName: "Serang", villageName: "Kotabaru", postalCode: "42112", streetName: "Jl. Veteran No. 14, RT 01/RW 04" },
      { districtName: "Cipocok Jaya", villageName: "Cipocok Jaya", postalCode: "42121", streetName: "Jl. Raya Petir No. 88, RT 03/RW 02" },
      { districtName: "Curug", villageName: "Curugmanis", postalCode: "42171", streetName: "Jl. Syeh Nawawi Al-Bantani No. 40, RT 02/RW 01" },
      { districtName: "Kasemen", villageName: "Banten", postalCode: "42191", streetName: "Jl. Pelabuhan Karangantu No. 19, RT 04/RW 05" },
    ],
  },
  "Kota Bandung": {
    provinceCode: "32",
    provinceName: "Jawa Barat",
    regencyCode: "32.73",
    regencyName: "Kota Bandung",
    locations: [
      { districtName: "Coblong", villageName: "Dago", postalCode: "40135", streetName: "Jl. Ir. H. Juanda No. 142, RT 03/RW 08" },
      { districtName: "Sumur Bandung", villageName: "Braga", postalCode: "40111", streetName: "Jl. Braga No. 58, RT 02/RW 04" },
      { districtName: "Sukajadi", villageName: "Pasteur", postalCode: "40161", streetName: "Jl. Sukajadi No. 176, RT 05/RW 02" },
      { districtName: "Lengkong", villageName: "Malabar", postalCode: "40262", streetName: "Jl. Lodaya No. 24, RT 01/RW 06" },
    ],
  },
  "Kota Bekasi": {
    provinceCode: "32",
    provinceName: "Jawa Barat",
    regencyCode: "32.75",
    regencyName: "Kota Bekasi",
    locations: [
      { districtName: "Bekasi Selatan", villageName: "Pekayon Jaya", postalCode: "17148", streetName: "Jl. Boulevard Ahmad Yani Blok M No. 8, Grand Galaxy, RT 02/RW 10" },
      { districtName: "Bekasi Barat", villageName: "Kranji", postalCode: "17135", streetName: "Jl. Jenderal Sudirman No. 91, RT 04/RW 03" },
      { districtName: "Rawalumbu", villageName: "Bojong Rawalumbu", postalCode: "17116", streetName: "Jl. Pengasinan Raya No. 47, RT 03/RW 05" },
      { districtName: "Pondok Gede", villageName: "Jaticempaka", postalCode: "17411", streetName: "Jl. Raya Jatiwaringin No. 112, RT 01/RW 08" },
    ],
  },
  "Kota Bogor": {
    provinceCode: "32",
    provinceName: "Jawa Barat",
    regencyCode: "32.71",
    regencyName: "Kota Bogor",
    locations: [
      { districtName: "Bogor Tengah", villageName: "Babakan", postalCode: "16128", streetName: "Jl. Pajajaran No. 84, RT 02/RW 05" },
      { districtName: "Bogor Timur", villageName: "Baranangsiang", postalCode: "16143", streetName: "Jl. Riau No. 12, RT 03/RW 03" },
      { districtName: "Bogor Selatan", villageName: "Batutulis", postalCode: "16133", streetName: "Jl. Batu Tulis No. 67, RT 01/RW 04" },
      { districtName: "Tanah Sareal", villageName: "Kebon Pedes", postalCode: "16162", streetName: "Jl. Sholeh Iskandar No. 30, RT 04/RW 02" },
      { districtName: "Bogor Barat", villageName: "Loji", postalCode: "16117", streetName: "Jl. RE Martadinata No. 51, RT 03/RW 01" },
    ],
  },
  "Kota Depok": {
    provinceCode: "32",
    provinceName: "Jawa Barat",
    regencyCode: "32.76",
    regencyName: "Kota Depok",
    locations: [
      { districtName: "Beji", villageName: "Pondok Cina", postalCode: "16424", streetName: "Jl. Margonda Raya No. 288, RT 03/RW 07" },
      { districtName: "Pancoran Mas", villageName: "Depok", postalCode: "16431", streetName: "Jl. Nusantara Raya No. 52, RT 02/RW 04" },
      { districtName: "Sukmajaya", villageName: "Mekarjaya", postalCode: "16411", streetName: "Jl. Kejayaan No. 16, RT 05/RW 09" },
      { districtName: "Cinere", villageName: "Cinere", postalCode: "16514", streetName: "Jl. Cinere Raya Blok A No. 20, RT 01/RW 03" },
    ],
  },
  "Kota Cirebon": {
    provinceCode: "32",
    provinceName: "Jawa Barat",
    regencyCode: "32.74",
    regencyName: "Kota Cirebon",
    locations: [
      { districtName: "Kejaksan", villageName: "Kebonbaru", postalCode: "45121", streetName: "Jl. Siliwangi No. 108, RT 02/RW 04" },
      { districtName: "Kesambi", villageName: "Kesambi", postalCode: "45134", streetName: "Jl. Kesambi Raya No. 77, RT 01/RW 05" },
      { districtName: "Lemahwungkuk", villageName: "Lemahwungkuk", postalCode: "45111", streetName: "Jl. Pasuketan No. 34, RT 03/RW 02" },
      { districtName: "Harjamukti", villageName: "Kalijaga", postalCode: "45144", streetName: "Jl. Jenderal Ahmad Yani No. 59, RT 04/RW 07" },
    ],
  },
  "Kota Semarang": {
    provinceCode: "33",
    provinceName: "Jawa Tengah",
    regencyCode: "33.74",
    regencyName: "Kota Semarang",
    locations: [
      { districtName: "Semarang Tengah", villageName: "Pandansari", postalCode: "50139", streetName: "Jl. Pemuda No. 118, RT 02/RW 03" },
      { districtName: "Gajahmungkur", villageName: "Bendan Ngisor", postalCode: "50233", streetName: "Jl. Sultan Agung No. 65, RT 04/RW 02" },
      { districtName: "Banyumanik", villageName: "Srondol Kulon", postalCode: "50263", streetName: "Jl. Setiabudi No. 142, RT 01/RW 06" },
      { districtName: "Candisari", villageName: "Candi", postalCode: "50257", streetName: "Jl. Dr. Wahidin No. 89, RT 03/RW 05" },
    ],
  },
  "Kota Surakarta": {
    provinceCode: "33",
    provinceName: "Jawa Tengah",
    regencyCode: "33.72",
    regencyName: "Kota Surakarta",
    locations: [
      { districtName: "Banjarsari", villageName: "Manahan", postalCode: "57139", streetName: "Jl. Adi Sucipto No. 78, RT 02/RW 06" },
      { districtName: "Laweyan", villageName: "Purwosari", postalCode: "57142", streetName: "Jl. Slamet Riyadi No. 350, RT 04/RW 03" },
      { districtName: "Jebres", villageName: "Jebres", postalCode: "57126", streetName: "Jl. Kolonel Sutarto No. 45, RT 01/RW 05" },
      { districtName: "Pasar Kliwon", villageName: "Kauman", postalCode: "57112", streetName: "Jl. Kapten Mulyadi No. 92, RT 03/RW 02" },
    ],
  },
  "Kota Yogyakarta": {
    provinceCode: "34",
    provinceName: "Daerah Istimewa Yogyakarta",
    regencyCode: "34.71",
    regencyName: "Kota Yogyakarta",
    locations: [
      { districtName: "Gondomanan", villageName: "Ngupasan", postalCode: "55122", streetName: "Jl. Malioboro No. 64, RT 02/RW 04" },
      { districtName: "Danurejan", villageName: "Bausasran", postalCode: "55211", streetName: "Jl. Mataram No. 82, RT 01/RW 03" },
      { districtName: "Umbulharjo", villageName: "Mujamuju", postalCode: "55167", streetName: "Jl. Kusumanegara No. 135, RT 05/RW 02" },
      { districtName: "Jetis", villageName: "Cokrodiningratan", postalCode: "55233", streetName: "Jl. AM Sangaji No. 49, RT 03/RW 05" },
    ],
  },
  "Kota Surabaya": {
    provinceCode: "35",
    provinceName: "Jawa Timur",
    regencyCode: "35.78",
    regencyName: "Kota Surabaya",
    locations: [
      { districtName: "Tegalsari", villageName: "Tegalsari", postalCode: "60262", streetName: "Jl. Basuki Rahmat No. 95, RT 03/RW 06" },
      { districtName: "Gubeng", villageName: "Gubeng", postalCode: "60281", streetName: "Jl. Raya Gubeng No. 44, RT 02/RW 04" },
      { districtName: "Wonokromo", villageName: "Darmo", postalCode: "60241", streetName: "Jl. Raya Darmo No. 120, RT 01/RW 05" },
      { districtName: "Rungkut", villageName: "Rungkut Menanggal", postalCode: "60293", streetName: "Jl. Rungkut Madya No. 68, RT 04/RW 08" },
    ],
  },
  "Kota Malang": {
    provinceCode: "35",
    provinceName: "Jawa Timur",
    regencyCode: "35.73",
    regencyName: "Kota Malang",
    locations: [
      { districtName: "Klojen", villageName: "Kauman", postalCode: "65119", streetName: "Jl. Ijen No. 42, RT 02/RW 05" },
      { districtName: "Lowokwaru", villageName: "Jatimulyo", postalCode: "65141", streetName: "Jl. Soekarno-Hatta No. 88, RT 03/RW 04" },
      { districtName: "Blimbing", villageName: "Blimbing", postalCode: "65126", streetName: "Jl. Borobudur No. 19, RT 01/RW 07" },
      { districtName: "Sukun", villageName: "Bandulan", postalCode: "65146", streetName: "Jl. S. Supriadi No. 74, RT 04/RW 02" },
    ],
  },
  "Kabupaten Sidoarjo": {
    provinceCode: "35",
    provinceName: "Jawa Timur",
    regencyCode: "35.15",
    regencyName: "Kabupaten Sidoarjo",
    locations: [
      { districtName: "Sidoarjo", villageName: "Sidokumpul", postalCode: "61212", streetName: "Jl. Pahlawan No. 56, RT 02/RW 03" },
      { districtName: "Waru", villageName: "Waru", postalCode: "61256", streetName: "Jl. Raya Waru No. 82, RT 04/RW 05" },
      { districtName: "Gedangan", villageName: "Gedangan", postalCode: "61254", streetName: "Jl. Raya Gedangan No. 39, RT 01/RW 04" },
      { districtName: "Candi", villageName: "Candi", postalCode: "61271", streetName: "Jl. Raya Candi No. 105, RT 03/RW 02" },
    ],
  },
  "Kota Denpasar": {
    provinceCode: "51",
    provinceName: "Bali",
    regencyCode: "51.71",
    regencyName: "Kota Denpasar",
    locations: [
      { districtName: "Denpasar Selatan", villageName: "Sanur", postalCode: "80228", streetName: "Jl. Danau Tamblingan No. 88, Sanur, RT 02/RW 04" },
      { districtName: "Denpasar Barat", villageName: "Pemecutan", postalCode: "80112", streetName: "Jl. Teuku Umar No. 145, RT 03/RW 02" },
      { districtName: "Denpasar Timur", villageName: "Sumerta", postalCode: "80236", streetName: "Jl. Hayam Wuruk No. 90, RT 01/RW 05" },
      { districtName: "Denpasar Utara", villageName: "Tonja", postalCode: "80239", streetName: "Jl. Gatot Subroto Timur No. 128, RT 04/RW 03" },
    ],
  },
  "Kota Mataram": {
    provinceCode: "52",
    provinceName: "Nusa Tenggara Barat",
    regencyCode: "52.71",
    regencyName: "Kota Mataram",
    locations: [
      { districtName: "Mataram", villageName: "Mataram Barat", postalCode: "83121", streetName: "Jl. Pejanggik No. 74, RT 02/RW 03" },
      { districtName: "Cakranegara", villageName: "Cakranegara Barat", postalCode: "83239", streetName: "Jl. Selaparang No. 110, RT 01/RW 04" },
      { districtName: "Ampenan", villageName: "Ampenan Tengah", postalCode: "83111", streetName: "Jl. Yos Sudarso No. 48, RT 03/RW 05" },
      { districtName: "Selaparang", villageName: "Rembiga", postalCode: "83124", streetName: "Jl. Dr. Wahidin No. 35, RT 04/RW 02" },
    ],
  },
  "Kota Medan": {
    provinceCode: "12",
    provinceName: "Sumatera Utara",
    regencyCode: "12.71",
    regencyName: "Kota Medan",
    locations: [
      { districtName: "Medan Petisah", villageName: "Petisah Tengah", postalCode: "20112", streetName: "Jl. Gatot Subroto No. 124, RT 02/RW 04" },
      { districtName: "Medan Baru", villageName: "Padang Bulan", postalCode: "20155", streetName: "Jl. Dr. Mansyur No. 86, RT 03/RW 06" },
      { districtName: "Medan Kota", villageName: "Pasar Merah Barat", postalCode: "20216", streetName: "Jl. Brigjen Katamso No. 175, RT 01/RW 03" },
      { districtName: "Medan Selayang", villageName: "Padang Bulan Selayang I", postalCode: "20131", streetName: "Jl. Ngumban Surbakti No. 40, RT 04/RW 02" },
    ],
  },
  "Kota Padang": {
    provinceCode: "13",
    provinceName: "Sumatera Barat",
    regencyCode: "13.71",
    regencyName: "Kota Padang",
    locations: [
      { districtName: "Padang Barat", villageName: "Belakang Tangsi", postalCode: "25114", streetName: "Jl. Veteran No. 58, RT 02/RW 04" },
      { districtName: "Padang Selatan", villageName: "Alang Laweh", postalCode: "25211", streetName: "Jl. Thamrin No. 42, RT 01/RW 03" },
      { districtName: "Padang Timur", villageName: "Simpang Haru", postalCode: "25123", streetName: "Jl. Sawahan No. 69, RT 03/RW 05" },
      { districtName: "Koto Tangah", villageName: "Lubuk Buaya", postalCode: "25173", streetName: "Jl. Adinegoro No. 88, RT 04/RW 02" },
    ],
  },
  "Kota Palembang": {
    provinceCode: "16",
    provinceName: "Sumatera Selatan",
    regencyCode: "16.71",
    regencyName: "Kota Palembang",
    locations: [
      { districtName: "Ilir Barat I", villageName: "Lorok Pakjo", postalCode: "30137", streetName: "Jl. Angkatan 45 No. 92, RT 02/RW 04" },
      { districtName: "Ilir Timur I", villageName: "20 Ilir D. I", postalCode: "30129", streetName: "Jl. Jenderal Sudirman No. 180, RT 04/RW 02" },
      { districtName: "Bukit Kecil", villageName: "26 Ilir", postalCode: "30136", streetName: "Jl. Merdeka No. 65, RT 01/RW 03" },
      { districtName: "Seberang Ulu I", villageName: "7 Ulu", postalCode: "30252", streetName: "Jl. KH. Azhari No. 114, RT 03/RW 05" },
    ],
  },
  "Kota Makassar": {
    provinceCode: "73",
    provinceName: "Sulawesi Selatan",
    regencyCode: "73.71",
    regencyName: "Kota Makassar",
    locations: [
      { districtName: "Ujung Pandang", villageName: "Sawerigading", postalCode: "90115", streetName: "Jl. Penghibur No. 50, Pantai Losari, RT 02/RW 03" },
      { districtName: "Panakkukang", villageName: "Masale", postalCode: "90231", streetName: "Ruko Ruby Blok A No. 15, Panakkukang Mas, RT 01/RW 06" },
      { districtName: "Rappocini", villageName: "Kassi-Kassi", postalCode: "90222", streetName: "Jl. Hertasning No. 72, RT 03/RW 04" },
      { districtName: "Tamalate", villageName: "Jongaya", postalCode: "90223", streetName: "Jl. Kumala No. 44, RT 04/RW 02" },
    ],
  },
  "Kota Balikpapan": {
    provinceCode: "64",
    provinceName: "Kalimantan Timur",
    regencyCode: "64.71",
    regencyName: "Kota Balikpapan",
    locations: [
      { districtName: "Balikpapan Kota", villageName: "Klandasan Ulu", postalCode: "76112", streetName: "Jl. Jenderal Sudirman No. 89, RT 02/RW 05" },
      { districtName: "Balikpapan Selatan", villageName: "Sepinggan", postalCode: "76115", streetName: "Jl. Marsma R. Iswahyudi No. 120, RT 03/RW 04" },
      { districtName: "Balikpapan Tengah", villageName: "Gunung Sari Ilir", postalCode: "76121", streetName: "Jl. Ahmad Yani No. 64, RT 01/RW 03" },
    ],
  },
};

async function resolveCodes(
  regencyCode: string,
  districtName: string,
  villageName: string
): Promise<{ districtCode: string | null; villageCode: string | null }> {
  try {
    const districts = await getRegionOptions("districts", regencyCode);
    const matchedDistrict = districts.find(
      (d) => d.name.toLowerCase().trim() === districtName.toLowerCase().trim()
    );
    if (!matchedDistrict) return { districtCode: null, villageCode: null };

    const villages = await getRegionOptions("villages", matchedDistrict.code);
    const matchedVillage = villages.find(
      (v) => v.name.toLowerCase().trim() === villageName.toLowerCase().trim()
    );

    return {
      districtCode: matchedDistrict.code,
      villageCode: matchedVillage?.code ?? null,
    };
  } catch {
    return { districtCode: null, villageCode: null };
  }
}

async function main() {
  console.log("Memulai pengayaan detail alamat seluruh cabang mitra di database...");

  const allPartners = await db
    .select({
      id: partners.id,
      name: partners.name,
      type: partners.type,
      regency_name: partners.regency_name,
      province_name: partners.province_name,
      district_name: partners.district_name,
      village_name: partners.village_name,
      address: partners.address,
    })
    .from(partners)
    .orderBy(partners.name);

  console.log(`Ditemukan total ${allPartners.length} mitra.`);

  const regencyUsage = new Map<string, number>();
  let updatedCount = 0;

  for (const partner of allPartners) {
    const regencyKey = partner.regency_name?.trim() || "";
    const regData = REGENCY_DATA[regencyKey];

    if (!regData) {
      console.warn(`[SKIP] Tidak ada data template untuk regency: "${regencyKey}" pada mitra: "${partner.name}"`);
      continue;
    }

    // Kasus khusus mitra jaksel hotel: sudah memiliki detail yang sangat bagus & dijadikan rujukan contoh oleh user
    if (partner.name.toLowerCase() === "jaksel hotel") {
      const address = "Jl. Kebagusan III No.41, RT.3/RW.6, Kebagusan, Ps. Minggu, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12520";
      await db
        .update(partners)
        .set({
          province_code: "31",
          province_name: "DKI Jakarta",
          regency_code: "31.74",
          regency_name: "Kota Administrasi Jakarta Selatan",
          district_code: "31.74.04",
          district_name: "Pasar Minggu",
          village_code: "31.74.04.1007",
          village_name: "Kebagusan",
          address,
        })
        .where(eq(partners.id, partner.id));
      console.log(`[DIPERBARUI] ${partner.name} -> Pasar Minggu / Kebagusan (Rujukan Utama)`);
      updatedCount++;
      continue;
    }

    const usageIndex = regencyUsage.get(regencyKey) || 0;
    const loc = regData.locations[usageIndex % regData.locations.length]!;
    regencyUsage.set(regencyKey, usageIndex + 1);

    // Ambil kode resmi Kemendagri jika tersedia
    const { districtCode, villageCode } = await resolveCodes(
      regData.regencyCode,
      loc.districtName,
      loc.villageName
    );

    // Format alamat lengkap standar:
    // {streetName}, Kel. {villageName}, Kec. {districtName}, {regencyName}, {provinceName} {postalCode}
    const formattedAddress = `${loc.streetName}, Kel. ${loc.villageName}, Kec. ${loc.districtName}, ${regData.regencyName}, ${regData.provinceName} ${loc.postalCode}`;

    await db
      .update(partners)
      .set({
        province_code: regData.provinceCode,
        province_name: regData.provinceName,
        regency_code: regData.regencyCode,
        regency_name: regData.regencyName,
        district_code: districtCode,
        district_name: loc.districtName,
        village_code: villageCode,
        village_name: loc.villageName,
        address: formattedAddress,
      })
      .where(eq(partners.id, partner.id));

    updatedCount++;
    console.log(`[DIPERBARUI] ${partner.name} -> Kec. ${loc.districtName}, Kel. ${loc.villageName} | ${formattedAddress}`);
  }

  console.log(`\nSelesai! Berhasil memperbarui ${updatedCount} dari ${allPartners.length} cabang mitra.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Gagal memperbarui lokasi mitra:", err);
  process.exit(1);
});
