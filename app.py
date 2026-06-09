"""
SPK Parkir Bandung - Backend Flask
Sistem Pendukung Keputusan Penentuan Lokasi Kantong Parkir
Berbasis Web GIS + Metode AHP

Kelompok 12 - Informatika UTY 2026
"""

from flask import Flask, render_template, jsonify, request
import json
import os
import math

app = Flask(__name__)

# ─────────────────────────────────────────────
# DATA STATIK (dalam produksi: ambil dari MySQL)
# ─────────────────────────────────────────────

KRITERIA = [
    {"id": "C1", "nama": "Jarak ke Pusat Keramaian", "satuan": "meter",    "bobot_default": 0.465},
    {"id": "C2", "nama": "Tingkat Kepadatan Jalan",  "satuan": "unit/hari", "bobot_default": 0.277},
    {"id": "C3", "nama": "Luas Lahan Tersedia",      "satuan": "m²",        "bobot_default": 0.160},
    {"id": "C4", "nama": "Estimasi Harga Lahan",     "satuan": "Rp/m²",     "bobot_default": 0.097},
]

ALTERNATIF = [
    {"id": "A1", "nama": "Lahan Jl. Asia Afrika",     "jarak": 50,  "kepadatan": 1500, "luas": 1200, "harga": 5_000_000},
    {"id": "A2", "nama": "Lahan Jl. Braga",            "jarak": 200, "kepadatan": 1200, "luas": 800,  "harga": 8_000_000},
    {"id": "A3", "nama": "Lahan Jl. Sudirman",         "jarak": 500, "kepadatan": 800,  "luas": 1500, "harga": 3_000_000},
    {"id": "A4", "nama": "Lahan Jl. Kebon Kawung",     "jarak": 150, "kepadatan": 1800, "luas": 1000, "harga": 7_000_000},
    {"id": "A5", "nama": "Lahan Jl. Soekarno Hatta",  "jarak": 800, "kepadatan": 500,  "luas": 2000, "harga": 2_000_000},
]

# Skala transformasi nilai (1-5) dari data mentah
SKALA_NILAI = {
    "A1": {"C1": 5, "C2": 4, "C3": 3, "C4": 3},
    "A2": {"C1": 4, "C2": 3, "C3": 2, "C4": 1},
    "A3": {"C1": 2, "C2": 2, "C3": 4, "C4": 5},
    "A4": {"C1": 5, "C2": 5, "C3": 3, "C4": 2},
    "A5": {"C1": 1, "C2": 1, "C3": 5, "C4": 5},
}

# RI Saaty
RANDOM_INDEX = {1: 0, 2: 0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45}

# ─────────────────────────────────────────────
# FUNGSI AHP
# ─────────────────────────────────────────────

def hitung_ahp(matrix: list) -> dict:
    """
    Menghitung bobot, λmax, CI, CR dari matriks perbandingan berpasangan.
    Parameter:
        matrix: list 2D, matriks n×n nilai perbandingan
    Return:
        dict berisi bobot, lambda_max, CI, CR, konsisten
    """
    n = len(matrix)

    # 1. Jumlah tiap kolom
    sum_kol = [sum(matrix[i][j] for i in range(n)) for j in range(n)]

    # 2. Normalisasi
    norm = [[matrix[i][j] / sum_kol[j] for j in range(n)] for i in range(n)]

    # 3. Bobot prioritas (rata-rata baris)
    bobot = [sum(norm[i]) / n for i in range(n)]

    # 4. Weighted sum vector
    ws = [sum(matrix[i][j] * bobot[j] for j in range(n)) for i in range(n)]

    # 5. λ_max
    lambda_max = sum(ws[i] / bobot[i] for i in range(n)) / n

    # 6. CI dan CR
    ci = (lambda_max - n) / (n - 1)
    ri = RANDOM_INDEX.get(n, 1.49)
    cr = ci / ri if ri != 0 else 0

    return {
        "n": n,
        "bobot": bobot,
        "lambda_max": round(lambda_max, 6),
        "CI": round(ci, 6),
        "CR": round(cr, 6),
        "konsisten": cr <= 0.1,
        "sum_kolom": sum_kol,
        "matriks_norm": norm,
    }


def hitung_skor_akhir(bobot: list) -> list:
    """
    Menghitung skor akhir dan ranking tiap alternatif.
    """
    kriteria_ids = [k["id"] for k in KRITERIA]
    hasil = []
    for alt in ALTERNATIF:
        skala = SKALA_NILAI[alt["id"]]
        skor = sum(skala[k_id] * bobot[i] for i, k_id in enumerate(kriteria_ids))
        hasil.append({**alt, "skor": round(skor, 4)})

    # Sort descending by skor
    hasil.sort(key=lambda x: x["skor"], reverse=True)
    for i, item in enumerate(hasil):
        item["ranking"] = i + 1
        skor = item["skor"]
        if skor >= 4.0:
            item["kategori"] = "Sangat Layak"
        elif skor >= 3.5:
            item["kategori"] = "Layak"
        elif skor >= 2.5:
            item["kategori"] = "Cukup Layak"
        else:
            item["kategori"] = "Tidak Layak"

    return hasil


# Matriks default dari laporan
DEFAULT_MATRIX = [
    [1.00, 2.00, 3.00, 4.00],
    [0.50, 1.00, 2.00, 3.00],
    [0.33, 0.50, 1.00, 2.00],
    [0.25, 0.33, 0.50, 1.00],
]

# ─────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────

@app.route("/")
def index():
    """Halaman utama: Dashboard + Peta GIS"""
    ahp = hitung_ahp(DEFAULT_MATRIX)
    ranking = hitung_skor_akhir(ahp["bobot"])
    return render_template(
        "index.html",
        kriteria=KRITERIA,
        alternatif=ALTERNATIF,
        ahp=ahp,
        ranking=ranking,
    )


@app.route("/hitung")
def hitung():
    """Halaman form perhitungan AHP"""
    ahp = hitung_ahp(DEFAULT_MATRIX)
    ranking = hitung_skor_akhir(ahp["bobot"])
    return render_template(
        "hitung.html",
        kriteria=KRITERIA,
        alternatif=ALTERNATIF,
        ahp=ahp,
        ranking=ranking,
        default_matrix=DEFAULT_MATRIX,
    )


@app.route("/api/hitung-ahp", methods=["POST"])
def api_hitung_ahp():
    """
    API endpoint untuk perhitungan AHP dari input pengguna.
    Request body: { "matrix": [[...], [...], ...] }
    Response: { bobot, lambda_max, CI, CR, konsisten, ranking }
    """
    try:
        data = request.get_json()
        matrix = data.get("matrix")

        if not matrix or not isinstance(matrix, list):
            return jsonify({"error": "Format matrix tidak valid"}), 400

        n = len(matrix)
        if n < 2 or n > 9:
            return jsonify({"error": f"Ukuran matrix harus antara 2-9. Diterima: {n}"}), 400

        # Validasi matrix n×n
        for row in matrix:
            if len(row) != n:
                return jsonify({"error": "Matrix harus berbentuk persegi (n×n)"}), 400

        ahp = hitung_ahp(matrix)
        ranking = hitung_skor_akhir(ahp["bobot"])

        return jsonify({
            "success": True,
            "ahp": ahp,
            "ranking": ranking,
            "pesan": (
                f"✅ CR = {ahp['CR']:.4f} — Konsisten" if ahp["konsisten"]
                else f"❌ CR = {ahp['CR']:.4f} — Tidak Konsisten (CR > 0.1)"
            )
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/alternatif")
def api_alternatif():
    """Mengembalikan data semua alternatif lahan parkir"""
    ahp = hitung_ahp(DEFAULT_MATRIX)
    ranking = hitung_skor_akhir(ahp["bobot"])
    return jsonify({"data": ranking, "bobot": ahp["bobot"]})


@app.route("/api/geojson")
def api_geojson():
    """Mengembalikan data GeoJSON untuk peta Leaflet"""
    geojson_path = os.path.join(app.static_folder, "data", "lahan_parkir.geojson")
    try:
        with open(geojson_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify({"error": "File GeoJSON tidak ditemukan"}), 404

@app.route("/api/tambah-lokasi", methods=["POST"])
def tambah_lokasi():
    try:
        data = request.json
        
        # 1. Ambil Data Mentah dari Form
        jarak = float(data["jarak"])
        kepadatan = float(data["kepadatan"])
        luas = float(data["luas"])
        harga = float(data["harga"])

        # 2. MESIN AUTO-SCALING (Mengubah data mentah ke Skala 1-5 sesuai Tabel 3.5)
        # C1: Jarak (Makin dekat makin tinggi)
        if jarak <= 150: s_jarak = 5
        elif jarak <= 250: s_jarak = 4
        elif jarak <= 400: s_jarak = 3
        elif jarak <= 600: s_jarak = 2
        else: s_jarak = 1

        # C2: Kepadatan (Makin padat makin tinggi)
        if kepadatan >= 1800: s_kep = 5
        elif kepadatan >= 1500: s_kep = 4
        elif kepadatan >= 1200: s_kep = 3
        elif kepadatan >= 800: s_kep = 2
        else: s_kep = 1

        # C3: Luas Lahan (Makin luas makin tinggi)
        if luas >= 2000: s_luas = 5
        elif luas >= 1500: s_luas = 4
        elif luas >= 1000: s_luas = 3
        elif luas >= 800: s_luas = 2
        else: s_luas = 1

        # C4: Harga Lahan (Makin murah makin tinggi)
        if harga <= 3000000: s_harga = 5
        elif harga <= 4000000: s_harga = 4
        elif harga <= 5000000: s_harga = 3
        elif harga <= 7000000: s_harga = 2
        else: s_harga = 1

        # 3. Masukkan ke Memori Alternatif Python
        new_alt = {
            "id": data["id"],
            "nama": data["nama"],
            "jarak": jarak,
            "kepadatan": kepadatan,
            "luas": luas,
            "harga": harga
        }
        ALTERNATIF.append(new_alt)

        # 4. Masukkan ke Memori Skala agar tidak Error saat AHP dihitung
        SKALA_NILAI[data["id"]] = {
            "C1": s_jarak,
            "C2": s_kep,
            "C3": s_luas,
            "C4": s_harga
        }

        # 5. Buat Titik Marker (Point) & Simpan ke GeoJSON
        geojson_path = os.path.join(app.static_folder, "data", "lahan_parkir.geojson")
        with open(geojson_path, "r", encoding="utf-8") as f:
            geo_data = json.load(f)

        lat = float(data["lat"])
        lng = float(data["lng"])
        
        new_feature = {
            "type": "Feature",
            "properties": {
                "id": data["id"],
                "nama": data["nama"],
                "jarak_keramaian": jarak,
                "kepadatan_jalan": kepadatan,
                "luas_lahan": luas,
                "harga_lahan": harga,
                "skala_jarak": s_jarak,
                "skala_kepadatan": s_kep,
                "skala_luas": s_luas,
                "skala_harga": s_harga,
                "skor_akhir": 0,    
                "ranking": 99, 
                "kategori": "Belum Dihitung",
                "warna": "#888888" 
            },
            "geometry": {
                "type": "Point",
                "coordinates": [lng, lat] 
            }
        }
        geo_data["features"].append(new_feature)

        with open(geojson_path, "w", encoding="utf-8") as f:
            json.dump(geo_data, f, indent=2)

        return jsonify({"success": True, "pesan": "Lokasi marker berhasil ditambahkan!"})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/hapus-lokasi/<lokasi_id>", methods=["DELETE"])
def hapus_lokasi(lokasi_id):
    global ALTERNATIF, SKALA_NILAI
    try:
        # 1. Hapus dari Memori Python (ALTERNATIF)
        ALTERNATIF = [alt for alt in ALTERNATIF if alt["id"] != lokasi_id]
        
        # 2. Hapus dari Memori Skala AHP (SKALA_NILAI)
        if lokasi_id in SKALA_NILAI:
            del SKALA_NILAI[lokasi_id]

        # 3. Hapus dari File Peta (GeoJSON)
        geojson_path = os.path.join(app.static_folder, "data", "lahan_parkir.geojson")
        with open(geojson_path, "r", encoding="utf-8") as f:
            geo_data = json.load(f)

        # Filter ulang: Ambil semua lahan KECUALI yang ID-nya ingin dihapus
        geo_data["features"] = [
            f for f in geo_data["features"] 
            if f["properties"]["id"] != lokasi_id
        ]

        # Simpan kembali ke file
        with open(geojson_path, "w", encoding="utf-8") as f:
            json.dump(geo_data, f, indent=2)

        return jsonify({"success": True, "pesan": f"Lokasi {lokasi_id} berhasil dihapus dari sistem dan peta!"})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  SPK Parkir Bandung - Flask Backend")
    print("  Kelompok 12 | Informatika UTY 2026")
    print("=" * 60)
    print("  URL: http://127.0.0.1:5000")
    print("  API: http://127.0.0.1:5000/api/hitung-ahp")
    print("=" * 60)
    app.run(debug=True, host="0.0.0.0", port=5000)
