// Console Audit Delivery — masuk pakai PIN, upload CSV (tersimpan di server untuk semua), ubah aturan.
(function () {
  const KEY_TOKEN = 'kb-console-token-v1';
  const WAJIB = ['order_no', 'status', 'delivery_type', 'outlet_name', 'customer_name', 'customer_phone', 'address_text',
    'created_at', 'cnw_packed_at', 'batch_assigned_at', 'batch_departed_at', 'batch_return_at', 'estimated_arrived_at', 'arrived_at',
    'scheduled_delivery', 'selected_batch_id', 'selected_driver_name', 'selected_cnw_name', 'notes_entries', 'receipt_modified_at', 'distance_from_outlet_km'];
  const ATURAN = ['BATAS', 'SIAP', 'NYARIS', 'NY_MAX', 'JAM_MULAI', 'JAM_SELESAI'];
  const BATAS_ANGKA = {BATAS: [1, 60], SIAP: [1, 120], NYARIS: [0, 60], NY_MAX: [1, 240], JAM_MULAI: [0, 23], JAM_SELESAI: [0, 23]};
  const $$ = (s) => document.querySelectorAll(s);
  const setUp = (state, msg) => { window.DT_UP = {state, msg}; dash.draw('status-upload'); };
  const setAt = (state, msg) => { window.DT_AT = {state, msg}; dash.draw('status-aturan'); };
  const setMasuk = (state, msg) => { window.DT_MS = {state, msg}; dash.draw('status-masuk'); };
  const wib = (iso) => new Intl.DateTimeFormat('id-ID', {timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}).format(new Date(iso)) + ' WIB';
  const ambilToken = () => { try { return localStorage.getItem(KEY_TOKEN) || ''; } catch { return window.__tok || ''; } };
  const simpanToken = (t) => { window.__tok = t; try { if (t) localStorage.setItem(KEY_TOKEN, t); else localStorage.removeItem(KEY_TOKEN); } catch { /* memori saja */ } };
  let versi = {diupload: null, aturan_diubah: null};

  dash.draw('status-masuk', (el) => {
    const s = window.DT_MS || {};
    el.className = 'dt-msg dt-mt' + (s.state === 'gagal' ? ' dt-bad' : '');
    el.textContent = s.msg || '';
  });

  async function api(path, opts = {}) {
    const res = await fetch(path, {...opts, headers: {'content-type': 'application/json', authorization: 'Bearer ' + ambilToken(), ...(opts.headers || {})}});
    let data = {};
    try { data = await res.json(); } catch { /* bukan JSON */ }
    if (res.status === 401 && path !== '/api/masuk') { keluar(data.error || 'Sesi habis, masukkan PIN lagi.'); throw new Error(data.error || 'Sesi habis.'); }
    if (!res.ok) throw new Error(data.error || `Server menjawab ${res.status}.`);
    return data;
  }

  // ---- kompres / buka file (supaya file beberapa hari tetap muat dikirim)
  async function kompres(text) {
    if (typeof CompressionStream === 'undefined') return {enc: 'plain', isi: text};
    const buf = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    let s = ''; const b = new Uint8Array(buf);
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return {enc: 'gzip-base64', isi: btoa(s)};
  }
  async function buka(enc, isi) {
    if (enc === 'plain') return isi;
    const bin = atob(isi); const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }

  function cekFile(text) {
    const {kolom, baris} = bacaCSV(text);
    if (kolom.length < 5) throw new Error('File ini bukan CSV order master (kolomnya tidak terbaca). Pastikan export CSV dari BAUS.');
    const kurang = WAJIB.filter((k) => !kolom.includes(k));
    if (kurang.length) throw new Error(`Kolom ini tidak ada di file: ${kurang.join(', ')}. Pastikan ini CSV order master dari BAUS.`);
    if (!baris.length) throw new Error('File-nya kosong, tidak ada order.');
    const t = baris.map((r) => window.DT_T.ts(r.created_at)).filter((x) => x != null);
    if (!t.length) throw new Error('Jam order dibuat (created_at) tidak terbaca.');
    return {baris, dari: window.DT_T.jam(Math.min(...t)), ke: window.DT_T.jam(Math.max(...t))};
  }
  const tampil = (ada) => { $$('.dt-perlu-data').forEach((s) => { s.hidden = !ada; }); $$('.dt-perlu-kosong').forEach((s) => { s.hidden = ada; }); };
  const tampilMasuk = (masuk) => { $$('#masuk').forEach((s) => { s.hidden = masuk; }); $$('.dt-perlu-masuk').forEach((s) => { s.hidden = !masuk; }); if (!masuk) tampil(false); };

  function pakai(nama, baris, diupload) {
    dash.set('order_master', baris, [{label: 'File', value: nama}, {label: 'Diupload', value: wib(diupload)}]);
    tampil(true);
  }

  async function muat() {
    const d = await api('/api/data');
    dash.set('aturan', d.aturan ? [d.aturan] : []);
    if (d.file) {
      const text = await buka(d.file.enc, d.file.isi);
      const {baris} = cekFile(text);
      pakai(d.file.nama, baris, d.file.diupload);
    } else {
      dash.set('order_master', []);
      tampil(false);
    }
    versi = {diupload: d.file ? d.file.diupload : null, aturan_diubah: d.aturan_diubah};
    dash.setParams({hari: ''});
  }

  function keluar(pesan) {
    simpanToken('');
    dash.set('order_master', []);
    tampilMasuk(false);
    dash.refresh();
    if (pesan) setMasuk('gagal', pesan);
  }

  async function mulai() {
    tampilMasuk(true);
    setUp('baca', 'Memuat data terakhir…');
    try { await muat(); setUp('', ''); } catch (e) { if (ambilToken()) setUp('gagal', 'Gagal memuat: ' + e.message); }
  }

  dash.onData(() => {
    const d = dash.data('atur');
    if (d.status === 'ok' && d.data) {
      $$('input.dt-in[data-k]').forEach((inp) => { if (document.activeElement !== inp) inp.value = String(d.data[inp.dataset.k] ?? ''); });
    }
    const h = dash.data('hari_list');
    $$('#pilih-hari-wrap').forEach((w) => { w.hidden = !(h.status === 'ok' && h.data.length > 1); });
  });

  // ---- awal
  dash.set('aturan', []);
  dash.set('order_master', []);
  tampil(false);
  if (ambilToken()) mulai(); else tampilMasuk(false);
  dash.refresh();

  $$('#form-masuk').forEach((f) => f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const inp = document.getElementById('isi-pin');
    const pin = inp ? inp.value.trim() : '';
    if (!pin) { setMasuk('gagal', 'PIN belum diisi.'); return; }
    setMasuk('baca', 'Memeriksa PIN…');
    try {
      const r = await api('/api/masuk', {method: 'POST', body: JSON.stringify({pin})});
      simpanToken(r.token);
      if (inp) inp.value = '';
      setMasuk('', '');
      await mulai();
    } catch (e) { setMasuk('gagal', e.message); }
  }));

  $$('#tombol-keluar').forEach((b) => b.addEventListener('click', () => keluar('')));
  $$('#tombol-muat').forEach((b) => b.addEventListener('click', async () => {
    setUp('baca', 'Memuat data terbaru…');
    try { await muat(); setUp('ok', 'Data sudah yang terbaru.'); } catch (e) { setUp('gagal', 'Gagal memuat: ' + e.message); }
  }));

  $$('#pilih-file').forEach((inp) => inp.addEventListener('change', async () => {
    const file = inp.files && inp.files[0];
    inp.value = '';
    if (!file) return;
    setUp('baca', `Membaca ${file.name}…`);
    try {
      const text = await file.text();
      const r = cekFile(text);
      setUp('kirim', `Menyimpan ${r.baris.length} order ke server…`);
      const k = await kompres(text);
      const res = await api('/api/upload', {method: 'POST', body: JSON.stringify({nama: file.name, enc: k.enc, isi: k.isi, jumlah_order: r.baris.length})});
      pakai(file.name, r.baris, res.diupload);
      versi.diupload = res.diupload;
      dash.setParams({hari: ''});
      setUp('ok', `Berhasil. ${r.baris.length} order (dibuat ${r.dari} – ${r.ke}) tersimpan dan sudah terlihat oleh semua orang. File lama diganti.`);
    } catch (e) {
      setUp('gagal', 'Gagal: ' + ((e && e.message) || String(e)) + ' Data sebelumnya tetap dipakai.');
    }
  }));

  const simpanAturan = async (vals) => {
    setAt('kirim', 'Menyimpan…');
    try {
      const r = await api('/api/aturan', {method: 'POST', body: JSON.stringify(vals)});
      dash.set('aturan', [r.aturan]);
      versi.aturan_diubah = r.diubah;
      dash.refresh();
      setAt('ok', 'Aturan tersimpan untuk semua orang. Semua angka sudah dihitung ulang.');
    } catch (e) { setAt('gagal', 'Gagal menyimpan: ' + e.message); }
  };
  $$('#simpan-aturan').forEach((b) => b.addEventListener('click', () => {
    const vals = {};
    for (const k of ATURAN) {
      const inp = document.querySelector(`input.dt-in[data-k="${k}"]`);
      const v = inp ? Number(inp.value) : NaN;
      const [lo, hi] = BATAS_ANGKA[k];
      if (!Number.isFinite(v) || v < lo || v > hi) { setAt('gagal', `Angka "${inp ? inp.closest('label').textContent.trim() : k}" harus antara ${lo} dan ${hi}.`); return; }
      vals[k] = v;
    }
    simpanAturan(vals);
  }));
  $$('#aturan-standar').forEach((b) => b.addEventListener('click', () => {
    const vals = {};
    for (const k of ATURAN) vals[k] = window.DT_DEFAULT[k];
    simpanAturan(vals);
  }));

  // Kalau orang lain baru upload / ubah aturan, data dimuat ulang saat tab ini dibuka lagi.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !ambilToken()) return;
    try {
      const s = await api('/api/status');
      if (s.diupload !== versi.diupload || s.aturan_diubah !== versi.aturan_diubah) {
        await muat();
        setUp('ok', 'Ada data baru, sudah dimuat.');
      }
    } catch { /* diam */ }
  });

  let tunda;
  window.addEventListener('resize', () => { clearTimeout(tunda); tunda = setTimeout(() => dash.draw('chart-outlet'), 150); });
})();
