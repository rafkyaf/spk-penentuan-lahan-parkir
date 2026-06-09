"""
SPK Parkir Bandung - Backend Flask
Sistem Pendukung Keputusan Penentuan Lokasi Kantong Parkir
Berbasis Web GIS + Metode AHP
"""

from flask import Flask, render_template, jsonify, request
import json
import os

app = Flask(__name__)

# Kriteria tetap statis karena tidak berubah
KRITERIA = [
    {"id": "C1", "nama": "Jarak ke Pusat Keramaian", "satuan": "meter"},
    {"id": "C2", "nama": "Tingkat Kepadatan Jalan",  "satuan": "unit/hari"},
    {"id": "C3", "nama": "Luas Lahan Tersedia",      "satuan": "m²"},
    {"id": "C4", "nama": "Estimasi Harga Lahan",     "satuan": "Rp/m²"},
]

RANDOM_INDEX = {1: 0, 2: 0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45}

DEFAULT_MATRIX = [
    [1.00, 2.00, 3.00, 4.00],
    [0.50, 1.00, 2.00, 3.00],
    [0.33, 0.50, 1.00, 2.00],
    [0.25, 0.33, 0.50, 1.00],
]

# ── FUNGSI DATABASE (BACA DARI GEOJSON) ──
def get_data_dari_geojson():
    geojson_path = os.path.join(app.static_folder, "data", "lahan_parkir.geojson")
    with open(geojson_path, "r", encoding="utf-8") as f:
        geo_data = json.load(f)
    
    alternatif = []
    skala_nilai = {}
    
    for feature in geo_data["features"]:
        p = feature["properties"]
        alternatif.append({
            "id": p["id"],
            "nama": p["nama"],
            "jarak": p["jarak_keramaian"],
            "kepadatan": p["kepadatan_jalan"],
            "luas": p["luas_lahan"],
            "harga": p["harga_lahan"]
        })
        skala_nilai[p["id"]] = {
            "C1": p.get("skala_jarak", 1),
            "C2": p.get("skala_kepadatan", 1),
            "C3": p.get("skala_luas", 1),
            "C4": p.get("skala_harga", 1)
        }
    return alternatif, skala_nilai

# ── FUNGSI AHP ──
def hitung_ahp(matrix: list) -> dict:
    n = len(matrix)
    sum_kol = [sum(matrix[i][j] for i in range(n)) for j in range(n)]
    norm = [[matrix[i][j] / sum_kol[j] for j in range(n)] for i in range(n)]
    bobot = [sum(norm[i]) / n for i in range(n)]
    ws = [sum(matrix[i][j] * bobot[j] for j in range(n)) for i in range(n)]
    lambda_max = sum(ws[i] / bobot[i] for i in range(n)) / n
    ci = (lambda_max - n) / (n - 1)
    ri = RANDOM_INDEX.get(n, 1.49)
    cr = ci / ri if ri != 0 else 0

    return {
        "bobot": bobot,
        "lambda_max": round(lambda_max, 6),
        "CI": round(ci, 6),
        "CR": round(cr, 6),
        "konsisten": cr <= 0.1,
        "matriks_norm": norm,
    }

def hitung_skor_akhir(bobot: list) -> list:
    alternatif, skala_nilai = get_data_dari_geojson()
    kriteria_ids = [k["id"] for k in KRITERIA]
    hasil = []
    
    for alt in alternatif:
        skala = skala_nilai[alt["id"]]
        skor = sum(skala[k_id] * bobot[i] for i, k_id in enumerate(kriteria_ids))
        hasil.append({**alt, "skor": round(skor, 4)})

    hasil.sort(key=lambda x: x["skor"], reverse=True)
    for i, item in enumerate(hasil):
        item["ranking"] = i + 1
        skor = item["skor"]
        if skor >= 4.0: item["kategori"] = "Sangat Layak"
        elif skor >= 3.5: item["kategori"] = "Layak"
        elif skor >= 2.5: item["kategori"] = "Cukup Layak"
        else: item["kategori"] = "Tidak Layak"
    return hasil

# ── ROUTES WEB ──
@app.route("/")
def index():
    ahp = hitung_ahp(DEFAULT_MATRIX)
    return render_template("index.html")

@app.route("/hitung")
def hitung():
    return render_template("hitung.html")

@app.route("/api/hitung-ahp", methods=["POST"])
def api_hitung_ahp():
    try:
        matrix = request.json.get("matrix")
        ahp = hitung_ahp(matrix)
        ranking = hitung_skor_akhir(ahp["bobot"])
        return jsonify({"success": True, "ahp": ahp, "ranking": ranking})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/tambah-lokasi", methods=["POST"])
def tambah_lokasi():
    try:
        data = request.json
        jarak, kepadatan, luas, harga = float(data["jarak"]), float(data["kepadatan"]), float(data["luas"]), float(data["harga"])

        # Auto-scaling
        if jarak <= 150: s_jarak = 5
        elif jarak <= 250: s_jarak = 4
        elif jarak <= 400: s_jarak = 3
        elif jarak <= 600: s_jarak = 2
        else: s_jarak = 1

        if kepadatan >= 1800: s_kep = 5
        elif kepadatan >= 1500: s_kep = 4
        elif kepadatan >= 1200: s_kep = 3
        elif kepadatan >= 800: s_kep = 2
        else: s_kep = 1

        if luas >= 2000: s_luas = 5
        elif luas >= 1500: s_luas = 4
        elif luas >= 1000: s_luas = 3
        elif luas >= 800: s_luas = 2
        else: s_luas = 1

        if harga <= 3000000: s_harga = 5
        elif harga <= 4000000: s_harga = 4
        elif harga <= 5000000: s_harga = 3
        elif harga <= 7000000: s_harga = 2
        else: s_harga = 1

        geojson_path = os.path.join(app.static_folder, "data", "lahan_parkir.geojson")
        with open(geojson_path, "r", encoding="utf-8") as f: geo_data = json.load(f)
        
        new_feature = {
            "type": "Feature",
            "properties": {
                "id": data["id"], "nama": data["nama"],
                "jarak_keramaian": jarak, "kepadatan_jalan": kepadatan,
                "luas_lahan": luas, "harga_lahan": harga,
                "skala_jarak": s_jarak, "skala_kepadatan": s_kep,
                "skala_luas": s_luas, "skala_harga": s_harga,
                "skor_akhir": 0, "ranking": 99, "kategori": "Baru", "warna": "#888888" 
            },
            "geometry": {"type": "Point", "coordinates": [float(data["lng"]), float(data["lat"])] }
        }
        geo_data["features"].append(new_feature)

        with open(geojson_path, "w", encoding="utf-8") as f: json.dump(geo_data, f, indent=2)
        return jsonify({"success": True, "pesan": "Berhasil ditambahkan!"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/hapus-lokasi/<lokasi_id>", methods=["DELETE"])
def hapus_lokasi(lokasi_id):
    try:
        geojson_path = os.path.join(app.static_folder, "data", "lahan_parkir.geojson")
        with open(geojson_path, "r", encoding="utf-8") as f: geo_data = json.load(f)

        geo_data["features"] = [f for f in geo_data["features"] if f["properties"]["id"] != lokasi_id]

        with open(geojson_path, "w", encoding="utf-8") as f: json.dump(geo_data, f, indent=2)
        return jsonify({"success": True, "pesan": f"Lokasi {lokasi_id} berhasil dihapus!"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

# if __name__ == "__main__":
#     print("=" * 60)
#     print("  SPK Parkir Bandung - Flask Backend")
#     print("  Kelompok 12 | Informatika UTY 2026")
#     print("=" * 60)
#     print("  URL: http://127.0.0.1:5000")
#     print("  API: http://127.0.0.1:5000/api/hitung-ahp")
#     print("=" * 60)
#     app.run(debug=True, host="0.0.0.0", port=5000)
