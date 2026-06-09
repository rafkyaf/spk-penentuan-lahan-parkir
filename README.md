# SPK Parkir Bandung 🅿

**Sistem Pendukung Keputusan Penentuan Lokasi Strategis Kantong Parkir Publik**  
Berbasis Web GIS · Metode Analytical Hierarchy Process (AHP)  
Kelompok 12 — Informatika UTY 2026

---

## Struktur Folder

```
spk-parkir-bandung/
├── app.py                  # Backend Flask (logika AHP di sini)
├── requirements.txt        # Library Python yang dibutuhkan
├── README.md
│
├── static/
│   ├── css/
│   │   └── style.css       # Styling web
│   ├── js/
│   │   └── main.js         # Logika Leaflet.js + AHP frontend
│   └── data/
│       └── lahan_parkir.geojson   # Data spasial lahan parkir
│
└── templates/
    ├── index.html          # Halaman utama (Dashboard + Peta GIS)
    └── hitung.html         # Halaman kalkulator AHP
```

---

## Cara Menjalankan

### 1. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 2. Jalankan Flask
```bash
python app.py
```

### 3. Buka di browser
```
http://127.0.0.1:5000
```

---

## Fitur Sistem

| Fitur | Keterangan |
|-------|-----------|
| 🗺️ **Web GIS** | Peta interaktif Leaflet.js, Kota Bandung |
| 📊 **Kalkulasi AHP** | Input matriks perbandingan, hitung bobot & CR |
| 🏆 **Perankingan** | Skor akhir 5 alternatif lahan parkir |
| 🎨 **Simbologi** | Warna area berdasarkan tingkat kelayakan |
| 💬 **Pop-up Info** | Klik polygon untuk detail lahan |
| ⚡ **API REST** | Endpoint `/api/hitung-ahp` untuk kalkulasi dinamis |

---

## Kriteria AHP

| Kode | Kriteria | Bobot |
|------|----------|-------|
| C1 | Jarak ke Pusat Keramaian | **46.5%** |
| C2 | Tingkat Kepadatan Jalan | **27.7%** |
| C3 | Luas Lahan Tersedia | **16.0%** |
| C4 | Estimasi Harga Lahan | **9.7%** |

**Consistency Ratio (CR) = 0.021 < 0.1 → ✅ Konsisten**

---

## Hasil Perankingan

| Rank | Lokasi | Skor | Kategori |
|------|--------|------|----------|
| 🥇 1 | Jl. Kebon Kawung (A4) | 4.384 | Sangat Layak |
| 🥈 2 | Jl. Asia Afrika (A1) | 4.204 | Sangat Layak |
| 🥉 3 | Jl. Braga (A2) | 3.108 | Layak |
| 4 | Jl. Sudirman (A3) | 2.609 | Cukup Layak |
| 5 | Jl. Soekarno Hatta (A5) | 2.027 | Tidak Layak |

---

## API Endpoint

### POST `/api/hitung-ahp`
Hitung AHP dengan matriks custom.

```json
// Request Body
{
  "matrix": [
    [1, 2, 3, 4],
    [0.5, 1, 2, 3],
    [0.33, 0.5, 1, 2],
    [0.25, 0.33, 0.5, 1]
  ]
}

// Response
{
  "success": true,
  "ahp": {
    "bobot": [0.465, 0.277, 0.160, 0.097],
    "CR": 0.021,
    "konsisten": true
  },
  "ranking": [...]
}
```

### GET `/api/alternatif`
Ambil data semua alternatif beserta skor.

### GET `/api/geojson`
Ambil data GeoJSON untuk peta Leaflet.

---

## Tim Pengembang

- Adimas Dzaky Khairullah (5230411226)
- M. Rizqi Febriansyah (5230411230)
- Rafky Anas Fauzi (5230411250)
- La Ode Muhammad (5230411346)
- Muhammad Farhan Hafiyyan (5230411366)

**Program Studi Informatika — Fakultas Sains & Teknologi**  
**Universitas Teknologi Yogyakarta — 2026**
