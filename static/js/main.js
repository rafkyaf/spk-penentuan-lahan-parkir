/* ============================================================
   SPK Parkir Bandung - Main JavaScript
   Logika AHP + Leaflet GIS + Dashboard
   ============================================================ */

// ── DATA GLOBAL ──────────────────────────────────────────────
const ALTERNATIF = [
  { id: "A1", nama: "Jl. Asia Afrika", jarak: 50, kepadatan: 1500, luas: 1200, harga: 5000000, skor: 4.204, ranking: 2 },
  { id: "A2", nama: "Jl. Braga", jarak: 200, kepadatan: 1200, luas: 800, harga: 8000000, skor: 3.108, ranking: 3 },
  { id: "A3", nama: "Jl. Sudirman", jarak: 500, kepadatan: 800, luas: 1500, harga: 3000000, skor: 2.609, ranking: 4 },
  { id: "A4", nama: "Jl. Kebon Kawung", jarak: 150, kepadatan: 1800, luas: 1000, harga: 7000000, skor: 4.384, ranking: 1 },
  { id: "A5", nama: "Jl. Soekarno Hatta", jarak: 800, kepadatan: 500, luas: 2000, harga: 2000000, skor: 2.027, ranking: 5 },
];

const KRITERIA = [
  { id: "C1", nama: "Jarak ke Keramaian", bobot: 0.465, satuan: "meter", icon: "📍" },
  { id: "C2", nama: "Kepadatan Jalan", bobot: 0.277, satuan: "unit/hari", icon: "🚗" },
  { id: "C3", nama: "Luas Lahan", bobot: 0.16, satuan: "m²", icon: "📐" },
  { id: "C4", nama: "Harga Lahan", bobot: 0.097, satuan: "Rp/m²", icon: "💰" },
];

const KATEGORI_MAP = {
  A1: { label: "Sangat Layak", cls: "badge-sangat-layak", warna: "#2d6a4f" },
  A2: { label: "Layak", cls: "badge-layak", warna: "#52b788" },
  A3: { label: "Cukup Layak", cls: "badge-cukup", warna: "#f4a261" },
  A4: { label: "Sangat Layak", cls: "badge-sangat-layak", warna: "#1b4332" },
  A5: { label: "Tidak Layak", cls: "badge-tidak", warna: "#e63946" },
};

// ── TAB NAVIGATION ───────────────────────────────────────────
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const target = this.dataset.tab;
      const group = this.closest(".tab-group") || this.parentElement.parentElement;
      group.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      group.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      this.classList.add("active");
      const el = document.getElementById(target);
      if (el) el.classList.add("active");
    });
  });
}

// ── FORMAT ANGKA ─────────────────────────────────────────────
function formatRupiah(n) {
  return "Rp " + n.toLocaleString("id-ID");
}
function formatAngka(n) {
  return n.toLocaleString("id-ID");
}

// ── KATEGORI HELPER ──────────────────────────────────────────
function getKategori(skor) {
  if (skor >= 4.0) return { label: "Sangat Layak", cls: "badge-sangat-layak" };
  if (skor >= 3.5) return { label: "Layak", cls: "badge-layak" };
  if (skor >= 2.5) return { label: "Cukup Layak", cls: "badge-cukup" };
  return { label: "Tidak Layak", cls: "badge-tidak" };
}

// ── LEAFLET MAP ──────────────────────────────────────────────
let map, geojsonLayer;

async function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  // 1. Jaga-jaga agar Leaflet tidak crash karena map dibuat 2 kali
  if (!map) {
    map = L.map("map", { zoomControl: true, attributionControl: true }).setView([-6.9175, 107.6075], 13);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '© <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd", maxZoom: 19,
    }).addTo(map);

    addKeramaianPoints(); // Panggil titik keramaian cukup 1x
  }

  // 2. Jika layer geojson sudah ada (saat di-refresh), hapus dulu yang lama
  if (geojsonLayer) {
    map.removeLayer(geojsonLayer);
  }

  // 3. Load GeoJSON dengan trik anti-cache (?t=waktu_sekarang)
  try {
    const response = await fetch("/static/data/lahan_parkir.geojson?t=" + new Date().getTime());
    const data = await response.json();

    geojsonLayer = L.geoJSON(data, {
      style: (feature) => ({
        fillColor: feature.properties.warna,
        color: "#fff", weight: 2, opacity: 0.8, fillOpacity: 0.7,
      }),
      pointToLayer: function (feature, latlng) {
        const warna = feature.properties.warna;
        const customIcon = L.divIcon({
          html: `<div style="background:${warna};width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow: 0 2px 4px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:white; font-size:10px; font-weight:bold;">P</div>`,
          className: "", iconSize: [24, 24], iconAnchor: [12, 12]
        });
        return L.marker(latlng, { icon: customIcon });
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        const kat = getKategori(p.skor_akhir);
        layer.bindPopup(
          `<div class="popup-header">🅿 ${p.nama}</div>
          <div class="popup-row"><span class="popup-key">Ranking</span><span class="popup-val">#${p.ranking}</span></div>
          <div class="popup-row"><span class="popup-key">Skor AHP</span><span class="popup-val">${p.skor_akhir.toFixed(3)}</span></div>
          <div class="popup-row"><span class="popup-key">Kategori</span><span class="badge ${kat.cls}">${kat.label}</span></div>
          <hr style="border-color:rgba(255,255,255,0.08);margin:10px 0">
          <div class="popup-row"><span class="popup-key">Jarak Keramaian</span><span class="popup-val">${p.jarak_keramaian} m</span></div>
          <div class="popup-row"><span class="popup-key">Kepadatan Jalan</span><span class="popup-val">${formatAngka(p.kepadatan_jalan)} unit/hr</span></div>
          <div class="popup-row"><span class="popup-key">Luas Lahan</span><span class="popup-val">${formatAngka(p.luas_lahan)} m²</span></div>
          <div class="popup-row"><span class="popup-key">Harga Lahan</span><span class="popup-val">${formatRupiah(p.harga_lahan)}/m²</span></div>`,
          { maxWidth: 280 }
        );

        layer.on("mouseover", function () {
          if (this.setStyle) this.setStyle({ weight: 3, fillOpacity: 0.9 });
        });
        layer.on("mouseout", function () {
          if (geojsonLayer.resetStyle) geojsonLayer.resetStyle(this);
        });
      },
    }).addTo(map);

    map.fitBounds(geojsonLayer.getBounds(), { padding: [40, 40] });
  } catch (err) {
    console.error("Gagal memuat peta:", err);
  }
}

function renderManualMarkers() {
  ALTERNATIF.forEach((alt) => {
    const kat = getKategori(alt.skor);

    // Warna tidak lagi diambil dari konstanta mati, tapi dari perhitungan dinamis
    let warnaPolygon = "#e63946";
    if (kat.label === "Sangat Layak") warnaPolygon = "#1b4332";
    else if (kat.label === "Layak") warnaPolygon = "#52b788";
    else if (kat.label === "Cukup Layak") warnaPolygon = "#f4a261";

    const coords = {
      A1: [-6.9221, 107.6079],
      A2: [-6.918, 107.6102],
      A3: [-6.9147, 107.6152],
      A4: [-6.9114, 107.5978],
      A5: [-6.9517, 107.6322],
    };
    if (!coords[alt.id]) return;

    const icon = L.divIcon({
      html: `<div style="background:${warnaPolygon};width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;border:2px solid rgba(255,255,255,0.4);">${alt.id}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      className: "",
    });

    L.marker(coords[alt.id], { icon })
      .addTo(map)
      .bindPopup(
        `<div class="popup-header">🅿 ${alt.nama}</div>
       <div class="popup-row"><span class="popup-key">Skor AHP</span><span class="popup-val">${alt.skor}</span></div>
       <div class="popup-row"><span class="popup-key">Kategori</span><span class="badge ${kat.cls}">${kat.label}</span></div>`,
      );
  });
}

function addKeramaianPoints() {
  const pusat = [
    { nama: "Pasar Baru Bandung", lat: -6.9194, lng: 107.6069, icon: "🏪" },
    { nama: "Stasiun Bandung", lat: -6.9118, lng: 107.5994, icon: "🚉" },
    { nama: "Alun-alun Bandung", lat: -6.9218, lng: 107.6076, icon: "🏛️" },
    { nama: "BIP Mall", lat: -6.9121, lng: 107.6081, icon: "🏬" },
  ];
  pusat.forEach((p) => {
    const icon = L.divIcon({
      html: `<div style="background:rgba(244,162,97,0.9);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid rgba(255,255,255,0.6);">${p.icon}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      className: "",
    });
    L.marker([p.lat, p.lng], { icon }).addTo(map).bindPopup(`<div class="popup-header">${p.icon} ${p.nama}</div><div style="font-size:11px;color:var(--text-muted);">Pusat Keramaian</div>`);
  });
}

// ── AHP CALCULATOR & API INTEGRATION ─────────────────────────
// Matriks default dari laporan
const DEFAULT_MATRIX = [
  [1.0, 2.0, 3.0, 4.0],
  [0.5, 1.0, 2.0, 3.0],
  [0.33, 0.5, 1.0, 2.0],
  [0.25, 0.33, 0.5, 1.0],
];

// FUNGSI 1: Memanggil API Python untuk menghitung AHP
async function hitungDanRender() {
  const matrix = getMatrixValues();

  // Simpan matriks ke memori lokal setiap kali dihitung agar tidak amnesia saat pindah tab
  localStorage.setItem("ahp_matrix_memori", JSON.stringify(matrix));

  // Ubah tulisan semua tombol saat proses (menggunakan querySelectorAll)
  document.querySelectorAll('[id^="btn-hitung"]').forEach((btn) => (btn.innerHTML = "⏳ Menghitung..."));

  try {
    const response = await fetch("/api/hitung-ahp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matrix: matrix }),
    });

    const data = await response.json();

    if (data.success) {
      renderAHPResult(data.ahp);
      renderRankingTable(data.ranking);
      updateMapColors(data.ranking);
      renderChartBobotDinamic(data.ahp.bobot);

      updateTabHasil(data.ahp);
      updateTabRankingHitung(data.ranking, data.ahp.bobot);
      updateDashboardStats(data.ahp, data.ranking);

      // ++ TAMBAHKAN BARIS INI ++
      renderAtributTable(data.ranking);
    }
  } catch (err) {
    console.error("Koneksi ke backend gagal:", err);
  } finally {
    // Kembalikan tulisan semua tombol
    document.querySelectorAll('[id^="btn-hitung"]').forEach((btn) => (btn.innerHTML = "⚡ Hitung AHP"));
  }
}

// FUNGSI 2: Menampilkan hasil pembobotan AHP
function renderAHPResult(ahp) {
  const el = document.getElementById("ahp-result");
  if (!el) return;

  // Perhatikan: kita menggunakan variabel ahp.lambda_max dari Python
  el.innerHTML = `
    <div class="alert ${ahp.konsisten ? "alert-success" : "alert-danger"}">
      ${ahp.konsisten ? "✅" : "❌"} CR = <strong>${ahp.CR.toFixed(4)}</strong>
      ${ahp.konsisten ? "— Konsisten (CR ≤ 0,1). Bobot valid!" : "— Tidak Konsisten (CR > 0,1). Harap revisi nilai perbandingan!"}
    </div>
    <div class="criteria-grid">
      ${KRITERIA.map(
    (k, i) => `
        <div class="criteria-item">
          <div class="criteria-label">${k.icon} ${k.nama}</div>
          <div class="criteria-weight">${(ahp.bobot[i] * 100).toFixed(1)}%</div>
          <div class="progress mt-16"><div class="progress-fill" style="width:${ahp.bobot[i] * 100}%"></div></div>
          <div class="criteria-pct text-muted" style="margin-top:6px;font-size:11px">Bobot: ${ahp.bobot[i].toFixed(4)}</div>
        </div>
      `,
  ).join("")}
    </div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:4px;">
      <div class="card" style="flex:1;min-width:140px;">
        <div class="card-title">λ Maksimum</div>
        <div class="card-value text-mono" style="font-size:22px;">${ahp.lambda_max.toFixed(4)}</div>
      </div>
      <div class="card" style="flex:1;min-width:140px;">
        <div class="card-title">Consistency Index (CI)</div>
        <div class="card-value text-mono" style="font-size:22px;">${ahp.CI.toFixed(4)}</div>
      </div>
      <div class="card" style="flex:1;min-width:140px;">
        <div class="card-title">Consistency Ratio (CR)</div>
        <div class="card-value text-mono ${ahp.konsisten ? "text-accent" : "text-danger"}" style="font-size:22px;">${ahp.CR.toFixed(4)}</div>
      </div>
    </div>
  `;
}

// FUNGSI 3: Memperbarui tabel ranking dari data Python
function renderRankingTable(rankingData) {
  const tbody = document.getElementById("ranking-tbody");
  if (!tbody) return;

  tbody.innerHTML = rankingData
    .map((alt, idx) => {
      // Karena Python sudah menghitung skor dan kategori, kita tinggal pakai
      const kat = getKategori(alt.skor);
      const pct = ((alt.skor / 5) * 100).toFixed(1);

      return `
      <tr>
        <td><span class="rank-badge rank-${idx + 1}">${idx + 1}</span></td>
        <td><strong>${alt.id}</strong></td>
        <td>${alt.nama}</td>
        <td>
          <span class="text-mono fw-700">${alt.skor.toFixed(3)}</span>
          <div class="score-bar"><div class="score-fill" style="width:${pct}%"></div></div>
        </td>
        <td><span class="badge ${kat.cls}">${alt.kategori}</span></td>
      </tr>
    `;
    })
    .join("");
}

// FUNGSI BARU: Memperbarui tabel atribut mentah di Dashboard
function renderAtributTable(rankingData) {
  const tbody = document.getElementById("atribut-tbody");
  if (!tbody) return;

  const sortedData = [...rankingData].sort((a, b) => a.id.localeCompare(b.id));

  tbody.innerHTML = sortedData.map((alt) => {
    return `
      <tr>
        <td class="text-mono fw-700">${alt.id}</td>
        <td>${alt.nama}</td>
        <td class="text-mono">${alt.jarak} m</td>
        <td class="text-mono">${formatAngka(alt.kepadatan)} unit/hr</td>
        <td class="text-mono">${formatAngka(alt.luas)} m²</td>
        <td class="text-mono">${formatRupiah(alt.harga)}/m²</td>
        <td>
          <button onclick="hapusLokasi('${alt.id}')" class="btn btn-outline btn-sm" style="color:#ff6b6b; border-color:#ff6b6b; padding:4px 8px;">🗑️ Hapus</button>
        </td>
      </tr>
    `;
  }).join("");
}

// FUNGSI 4: MEWARNAI PETA SECARA DINAMIS (OVERRIDE GEOJSON)
function updateMapColors(rankingData) {
  if (!geojsonLayer) return;

  // Ubah rankingData menjadi dictionary agar mudah dicari berdasarkan ID (A1, A2, dst)
  const rankDict = {};
  rankingData.forEach((r) => {
    rankDict[r.id] = r;
  });

  geojsonLayer.eachLayer((layer) => {
    const id = layer.feature.properties.id;
    const dataAlt = rankDict[id];

    if (dataAlt) {
      // Menentukan warna berdasarkan kategori dari Python
      let warnaPolygon = "#e63946"; // Default Merah (Tidak Layak)
      if (dataAlt.kategori === "Sangat Layak")
        warnaPolygon = "#1b4332"; // Hijau Tua
      else if (dataAlt.kategori === "Layak")
        warnaPolygon = "#52b788"; // Hijau Muda
      else if (dataAlt.kategori === "Cukup Layak")
        warnaPolygon = "#f4a261"; // Kuning/Oranye

      // Update property warna di feature agar saat resetStyle (mouseout) tetap pakai warna yang baru
      layer.feature.properties.warna = warnaPolygon;

      // Cek apakah layer ini adalah Titik (Marker manual) atau Kotak (Poligon bawaan)
      if (layer instanceof L.Marker) {
        // Terapkan warna baru ke ikon Marker
        const newIcon = L.divIcon({
          html: `<div style="background:${warnaPolygon};width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow: 0 2px 4px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:white; font-size:10px; font-weight:bold;">P</div>`,
          className: "", iconSize: [24, 24], iconAnchor: [12, 12]
        });
        layer.setIcon(newIcon);
      } else {
        // Terapkan warna baru ke isian Polygon
        layer.setStyle({ fillColor: warnaPolygon });
      }

      // Perbarui isi pop-up peta dengan skor terbaru
      const katStyle = getKategori(dataAlt.skor);
      layer.bindPopup(
        `
        <div class="popup-header">🅿 ${dataAlt.nama}</div>
        <div class="popup-row"><span class="popup-key">Ranking Saat Ini</span><span class="popup-val">#${dataAlt.ranking}</span></div>
        <div class="popup-row"><span class="popup-key">Skor AHP</span><span class="popup-val">${dataAlt.skor.toFixed(3)}</span></div>
        <div class="popup-row"><span class="popup-key">Kategori</span><span class="badge ${katStyle.cls}">${dataAlt.kategori}</span></div>
        <hr style="border-color:rgba(255,255,255,0.08);margin:10px 0">
        <div class="popup-row"><span class="popup-key">Jarak Keramaian</span><span class="popup-val">${dataAlt.jarak} m</span></div>
        <div class="popup-row"><span class="popup-key">Kepadatan Jalan</span><span class="popup-val">${formatAngka(dataAlt.kepadatan)} unit/hr</span></div>
        <div class="popup-row"><span class="popup-key">Luas Lahan</span><span class="popup-val">${formatAngka(dataAlt.luas)} m²</span></div>
        <div class="popup-row"><span class="popup-key">Harga Lahan</span><span class="popup-val">${formatRupiah(dataAlt.harga)}/m²</span></div>
      `,
        { maxWidth: 280 },
      );
    }
  });
}

// ── FUNGSI PENDUKUNG (UI MATRIX) ─────────────────────────────
function buildMatrixForm() {
  const el = document.getElementById("matrix-form");
  if (!el) return;

  // Baca memori lokal, agar saat kembali ke tab ini, ketikan user tidak hilang
  const saved = localStorage.getItem("ahp_matrix_memori");
  const startMatrix = saved ? JSON.parse(saved) : DEFAULT_MATRIX;

  const kriteria = ["C1 (Jarak)", "C2 (Kepadatan)", "C3 (Luas)", "C4 (Harga)"];
  const n = 4;
  let html = `<table class="matrix-table"><thead><tr><th></th>`;
  kriteria.forEach((k) => {
    html += `<th>${k}</th>`;
  });
  html += "</tr></thead><tbody>";

  for (let i = 0; i < n; i++) {
    html += `<tr><th>${kriteria[i]}</th>`;
    for (let j = 0; j < n; j++) {
      if (i === j) {
        html += `<td class="diagonal">1.00</td>`;
      } else if (i < j) {
        // Gunakan startMatrix, bukan DEFAULT_MATRIX
        html += `<td><input type="number" id="m${i}${j}" min="0.111" max="9" step="0.01" value="${startMatrix[i][j]}"></td>`;
      } else {
        html += `<td id="cell${i}${j}" class="text-muted">${startMatrix[i][j].toFixed(2)}</td>`;
      }
    }
    html += "</tr>";
  }
  html += "</tbody></table>";
  el.innerHTML = html;

  // Sinkronisasi otomatis nilai kebalikan (1/x)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const inp = document.getElementById(`m${i}${j}`);
      if (inp)
        inp.addEventListener("input", function () {
          const val = parseFloat(this.value) || 1;
          const cell = document.getElementById(`cell${j}${i}`);
          if (cell) cell.textContent = (1 / val).toFixed(3);
        });
    }
  }
}

function getMatrixValues() {
  const el = document.getElementById("matrix-form");

  // Jika di halaman Peta (tidak ada form matriks), ambil dari ingatan lokal (localStorage)
  if (!el) {
    const saved = localStorage.getItem("ahp_matrix_memori");
    return saved ? JSON.parse(saved) : DEFAULT_MATRIX;
  }

  const n = 4;
  const mat = Array.from({ length: n }, () => Array(n).fill(1));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i < j) {
        const inp = document.getElementById(`m${i}${j}`);
        mat[i][j] = inp ? parseFloat(inp.value) || 1 : DEFAULT_MATRIX[i][j];
        mat[j][i] = 1 / mat[i][j];
      }
    }
  }
  return mat;
}

function resetMatrix() {
  localStorage.removeItem("ahp_matrix_memori"); // Hapus ingatan
  buildMatrixForm(); // Gambar ulang form dengan nilai default
  hitungDanRender(); // Hitung ulang
}

function renderChartBobotDinamic(bobotArr) {
  const el = document.getElementById("chart-bobot");
  if (!el || !bobotArr) return;

  const total = bobotArr.reduce((a, b) => a + b, 0);
  const colors = ["#1b4332", "#2d6a4f", "#74c69d", "#f4a261"];
  let html = '<div style="display:flex;flex-direction:column;gap:12px;">';

  KRITERIA.forEach((k, i) => {
    const pct = ((bobotArr[i] / total) * 100).toFixed(1);
    html += `
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:13px;">${k.icon} ${k.nama}</span>
          <span class="text-mono fw-700 text-accent">${pct}%</span>
        </div>
        <div class="progress">
          <div class="progress-fill" style="width:${pct}%;background:${colors[i]};"></div>
        </div>
      </div>
    `;
  });
  html += "</div>";
  el.innerHTML = html;
}

// ── INIT SEMUA ───────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  buildMatrixForm();

  // TUNGGU peta dan GeoJSON selesai dimuat sebelum menghitung AHP
  await initMap();

  // Panggil data perhitungan dari server untuk mewarnai peta
  hitungDanRender();

  // Solusi untuk tombol ganda: Gunakan querySelectorAll untuk menangkap SEMUA tombol
  document.querySelectorAll('[id^="btn-hitung"]').forEach((btn) => {
    btn.addEventListener("click", hitungDanRender);
  });

  document.querySelectorAll('[id^="btn-reset"]').forEach((btn) => {
    btn.addEventListener("click", resetMatrix);
  });
  // Letakkan di dalam document.addEventListener("DOMContentLoaded", ...)
  const formTambah = document.getElementById("form-tambah-lokasi");
  if (formTambah) {
    formTambah.addEventListener("submit", async function (e) {
      e.preventDefault();

      const payload = {
        id: document.getElementById("input-id").value,
        nama: document.getElementById("input-nama").value,
        jarak: document.getElementById("input-jarak").value,
        kepadatan: document.getElementById("input-kepadatan").value,
        luas: document.getElementById("input-luas").value,
        harga: document.getElementById("input-harga").value,
        lat: document.getElementById("input-lat").value,
        lng: document.getElementById("input-lng").value
      };

      try {
        const response = await fetch("/api/tambah-lokasi", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.success) {
          alert("Berhasil! Marker lokasi baru telah ditambahkan.");
          formTambah.reset();
          // Hapus peta lama, load ulang peta, lalu hitung ulang AHP-nya!
          map.removeLayer(geojsonLayer);
          await initMap();
          hitungDanRender();
        }
      } catch (err) { alert("Terjadi kesalahan jaringan."); }
    });
  }
});

// ── FUNGSI KHUSUS UNTUK TAB HASIL (TAB 2) ──────────────────
function updateTabHasil(ahp) {
  // Update Nilai Kartu
  const elLambda = document.getElementById("val-lambda");
  const elCI = document.getElementById("val-ci");
  const elCR = document.getElementById("val-cr");
  const elAlert = document.getElementById("alert-cr-hasil");

  if (elLambda) elLambda.innerText = ahp.lambda_max.toFixed(4);
  if (elCI) elCI.innerText = ahp.CI.toFixed(4);

  if (elCR) {
    elCR.innerText = ahp.CR.toFixed(4);
    elCR.className = `card-value text-mono ${ahp.konsisten ? "text-accent" : "text-danger"}`;
  }

  if (elAlert) {
    elAlert.className = `alert ${ahp.konsisten ? "alert-success" : "alert-danger"}`;
    elAlert.innerHTML = ahp.konsisten
      ? `✅ <strong>CR = ${ahp.CR.toFixed(4)} &lt; 0.1</strong> — Penilaian perbandingan berpasangan KONSISTEN dan valid.`
      : `❌ <strong>CR = ${ahp.CR.toFixed(4)} &gt; 0.1</strong> — Penilaian TIDAK KONSISTEN! Ulangi input matriks.`;
  }

  // Update Tabel Normalisasi Matriks
  const tbodyNorm = document.getElementById("tbody-normalisasi");
  if (tbodyNorm && ahp.matriks_norm) {
    let html = "";
    KRITERIA.forEach((k, i) => {
      html += `<tr><th>${k.id}</th>`;
      ahp.matriks_norm[i].forEach((val) => {
        html += `<td>${val.toFixed(2)}</td>`;
      });
      html += `<td class="text-accent fw-700">${ahp.bobot[i].toFixed(3)}</td>`;
      html += `<td class="text-accent fw-700">${(ahp.bobot[i] * 100).toFixed(1)}%</td></tr>`;
    });
    tbodyNorm.innerHTML = html;
  }
}

// ── FUNGSI KHUSUS UNTUK TAB PERANKINGAN (TAB 3) ────────────
function updateTabRankingHitung(rankingData, bobot) {
  const tbody = document.getElementById("ranking-tbody-hitung");
  const rumusEl = document.getElementById("rumus-skor-akhir");
  if (!tbody) return;

  // Update Teks Rumus
  if (rumusEl && bobot) {
    rumusEl.innerText = `S = (C1 × ${bobot[0].toFixed(3)}) + (C2 × ${bobot[1].toFixed(3)}) + (C3 × ${bobot[2].toFixed(3)}) + (C4 × ${bobot[3].toFixed(3)})`;
  }

  // Data skala mentah sesuai laporan
  const SKALA = {
    A1: [5, 4, 3, 3],
    A2: [4, 3, 2, 1],
    A3: [2, 2, 4, 5],
    A4: [5, 5, 3, 2],
    A5: [1, 1, 5, 5],
  };

  // Render Tabel
  tbody.innerHTML = rankingData
    .map((alt, idx) => {
      const s = SKALA[alt.id];
      const kat = getKategori(alt.skor);
      return `
      <tr>
        <td><span class="rank-badge rank-${idx + 1}">${idx + 1}</span></td>
        <td class="text-mono fw-700">${alt.id}</td>
        <td>${alt.nama}</td>
        <td class="text-mono">${(s[0] * bobot[0]).toFixed(3)}</td>
        <td class="text-mono">${(s[1] * bobot[1]).toFixed(3)}</td>
        <td class="text-mono">${(s[2] * bobot[2]).toFixed(3)}</td>
        <td class="text-mono">${(s[3] * bobot[3]).toFixed(3)}</td>
        <td class="text-mono fw-700 text-accent">${alt.skor.toFixed(3)}</td>
        <td><span class="badge ${kat.cls}">${alt.kategori}</span></td>
      </tr>
    `;
    })
    .join("");
}

// ── FUNGSI KHUSUS UNTUK UPDATE DASHBOARD (INDEX.HTML) ──────
function updateDashboardStats(ahp, rankingData) {
  const elStatCR = document.getElementById("stat-cr");
  const elStatTerbaik = document.getElementById("stat-terbaik");
  const elIndexAlert = document.getElementById("index-cr-alert");

  // ++ TAMBAHAN BARU: Tangkap ID untuk total lahan ++
  const elStatTotal = document.getElementById("stat-total-lahan");

  // ++ TAMBAHAN BARU: Update angka total lahan sesuai jumlah data ++
  if (elStatTotal) {
    elStatTotal.innerText = rankingData.length;
  }

  // Update angka CR di kartu atas
  if (elStatCR) elStatCR.innerText = ahp.CR.toFixed(3);

  // Update lokasi pemenang di kartu atas
  if (elStatTerbaik && rankingData.length > 0) {
    elStatTerbaik.innerText = rankingData[0].id;
  }

  // Update Alert CR di bawah chart
  if (elIndexAlert) {
    elIndexAlert.className = `mt-16 alert ${ahp.konsisten ? "alert-success" : "alert-danger"}`;
    elIndexAlert.innerHTML = ahp.konsisten ? `✅ CR = ${ahp.CR.toFixed(3)} — Konsisten (CR ≤ 0,1)` : `❌ CR = ${ahp.CR.toFixed(3)} — Tidak Konsisten (CR > 0,1)`;
  }
}

// Letakkan di dalam document.addEventListener("DOMContentLoaded", ...)
const formTambah = document.getElementById("form-tambah-lokasi");
if (formTambah) {
  formTambah.addEventListener("submit", async function (e) {
    e.preventDefault();

    const payload = {
      id: document.getElementById("input-id").value,
      nama: document.getElementById("input-nama").value,
      jarak: document.getElementById("input-jarak").value,
      kepadatan: document.getElementById("input-kepadatan").value,
      luas: document.getElementById("input-luas").value,
      harga: document.getElementById("input-harga").value,
      lat: document.getElementById("input-lat").value,
      lng: document.getElementById("input-lng").value
    };

    try {
      const response = await fetch("/api/tambah-lokasi", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (data.success) {
        alert("Berhasil! Marker lokasi baru telah ditambahkan.");
        formTambah.reset();
        // Hapus peta lama, load ulang peta, lalu hitung ulang AHP-nya!
        map.removeLayer(geojsonLayer);
        await initMap();
        hitungDanRender();
      }
    } catch (err) { alert("Terjadi kesalahan jaringan."); }
  });
}

// FUNGSI KHUSUS UNTUK MENGHAPUS LOKASI
async function hapusLokasi(id) {
  // Munculkan dialog konfirmasi untuk mencegah salah pencet
  const yakin = confirm(`Peringatan: Apakah Anda yakin ingin menghapus data dan peta untuk lokasi ${id}?`);
  if (!yakin) return;

  try {
    const response = await fetch(`/api/hapus-lokasi/${id}`, {
      method: "DELETE"
    });
    const data = await response.json();

    if (data.success) {
      alert(data.pesan);
      // Hapus peta lama, muat ulang peta baru, dan hitung ulang AHP
      if (geojsonLayer) map.removeLayer(geojsonLayer);
      await initMap();
      hitungDanRender();
    } else {
      alert("Gagal menghapus lokasi: " + data.error);
    }
  } catch (err) {
    alert("Kesalahan jaringan saat mencoba menghapus lokasi.");
  }
}