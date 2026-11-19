// Console Audit Delivery — gambar tabel, angka dan grafik.
const fmt = (v) => (typeof v === 'number' ? window.DT_FMT.format(v) : (v ?? ''));
const p2 = (n) => String(n).padStart(2, '0');

dash.draw('k', (el) => {
  const d = dash.data('atur');
  const v = d.status === 'ok' && d.data ? d.data[el.dataset.k] : window.DT_DEFAULT[el.dataset.k];
  if (v == null) { el.textContent = '—'; return; }
  el.textContent = el.dataset.format === 'jam' ? `${p2(v)}.00` : fmt(v);
});

dash.draw('angka', (el) => {
  const d = dash.data(el.dataset.source);
  el.classList.toggle('dash-skeleton', d.status === 'loading');
  if (d.status !== 'ok' || !d.data || !d.data.length) { el.textContent = '—'; return; }
  el.textContent = fmt(d.data[0][el.dataset.field]);
});

function rows(tbody, data, cols, key) {
  tbody.replaceChildren();
  d3.select(tbody).selectAll('tr').data(data).join('tr')
    .attr('data-key', (r) => r[key])
    .selectAll('td').data((r) => cols.map((c) => ({c, r, v: r[c.f]}))).join('td')
    .attr('class', (x) => [x.c.n ? 'dt-n' : '', x.c.cls ? (x.c.cls(x.r) || '') : ''].join(' ').trim() || null)
    .text((x) => fmt(x.v));
}

function placeholder(tbody, n, status) {
  d3.select(tbody).selectAll('tr').remove();
  d3.select(tbody).append('tr').append('td').attr('colspan', n).attr('class', 'dt-hint')
    .text(status === 'error' ? 'Gagal dimuat' : (status === 'ok' ? 'Tidak ada' : '—'));
}

// ---------- bagian upload ----------
dash.draw('info-file', (el) => {
  const om = dash.data('order_master');
  const hl = dash.data('hari_list');
  el.replaceChildren();
  if (om.status === 'loading' || hl.status === 'loading') { el.textContent = 'Memuat data…'; return; }
  if (om.status !== 'ok' || !Array.isArray(om.data) || !om.data.length) { el.textContent = 'Belum ada data. Klik "Upload CSV order master".'; return; }
  const meta = Array.isArray(om.meta) ? om.meta : [];
  const ambil = (lbl) => (meta.find((m) => m && m.label === lbl) || {}).value || '';
  const b1 = document.createElement('div'); b1.className = 'dt-file-nama';
  b1.textContent = ambil('File') || 'File order master';
  const b2 = document.createElement('div'); b2.className = 'dt-hint';
  b2.textContent = [ambil('Diupload') ? `Diupload ${ambil('Diupload')}` : '', `${om.data.length} order di file`].filter(Boolean).join(' · ');
  el.append(b1, b2);
  if (hl.status === 'ok') {
    const days = hl.data;
    const b3 = document.createElement('div'); b3.className = 'dt-file-hari';
    b3.textContent = days.length === 1
      ? `Hari operasional: ${days[0].label} (order dibuat ${days[0].pertama} – ${days[0].terakhir})`
      : `${days.length} hari operasional: ${days.map((d) => d.label.replace(/ \d{4}$/, '')).join(', ')}`;
    el.append(b3);
  }
});

dash.draw('pilih-hari', (sel) => {
  const d = dash.data('hari_list');
  const days = d.status === 'ok' ? d.data : [];
  const opts = [new Option(days.length > 1 ? `Semua hari di file (${days.length})` : 'Semua', '')];
  for (const h of days) opts.push(new Option(`${h.label} · ${h.order} order`, h.hari));
  sel.replaceChildren(...opts);
  const cur = dash.params().hari || '';
  sel.value = days.some((h) => h.hari === cur) ? cur : '';
  sel.onchange = () => dash.setParams({hari: sel.value || ''});
});

dash.draw('info-luar', (el) => {
  const d = dash.data('luar_jam');
  const n = d.status === 'ok' ? d.data.length : 0;
  el.textContent = n ? `⚠ ${n} order dibuat di luar jam hari operasional, jadi tidak ikut dihitung. Daftarnya ada di "Cara baca" paling bawah.` : '';
});

dash.draw('status-upload', (el) => {
  const s = window.DT_UP || {};
  el.className = 'dt-msg' + (s.state === 'gagal' ? ' dt-bad' : (s.state === 'ok' ? ' dt-ok' : ''));
  el.textContent = s.msg || '';
});

dash.draw('status-aturan', (el) => {
  const s = window.DT_AT || {};
  el.className = 'dt-msg' + (s.state === 'gagal' ? ' dt-bad' : (s.state === 'ok' ? ' dt-ok' : ''));
  el.textContent = s.msg || '';
});

// ---------- tabel ----------
dash.draw('tabel-driver', (tb) => {
  const d = dash.data('per_driver');
  if (d.status !== 'ok' || !d.data.length) return placeholder(tb, 6, d.status);
  rows(tb, d.data, [{f: 'driver'}, {f: 'outlet'}, {f: 'berangkat', n: 1}, {f: 'telat', n: 1}, {f: 'terlama', n: 1}, {f: 'menit_kebuang', n: 1}], 'driver');
});

dash.draw('tabel-nyantai', (tb) => {
  const d = dash.data('nyantai_lewat');
  if (d.status !== 'ok' || !d.data.length) return placeholder(tb, 7, d.status);
  rows(tb, d.data, [{f: 'order'}, {f: 'outlet'}, {f: 'customer'}, {f: 'hp'}, {f: 'menit_dibuat_ke_batch', n: 1}, {f: 'sebab'}, {f: 'driver_nganggur'}], 'order');
});

dash.draw('tabel-nganggur', (tb) => {
  const d = dash.data('nganggur');
  if (d.status !== 'ok' || !d.data.length) return placeholder(tb, 13, d.status);
  rows(tb, d.data, [{f: 'order'}, {f: 'outlet'}, {f: 'jenis'}, {f: 'customer'}, {f: 'hp'}, {f: 'dibuat'}, {f: 'packing'}, {f: 'masuk_batch'},
    {f: 'menit_dibuat_ke_packing', n: 1}, {f: 'menit_packing_ke_batch', n: 1}, {f: 'menit_dibuat_ke_batch', n: 1}, {f: 'sebab'}, {f: 'driver_nganggur'}], 'order');
});

dash.draw('tabel-dikeluarkan', (tb) => {
  const d = dash.data('tidak_dihitung');
  if (d.status !== 'ok' || !d.data.length) return placeholder(tb, 4, d.status);
  rows(tb, d.data, [{f: 'order'}, {f: 'batch'}, {f: 'dibuat'}, {f: 'alasan'}], 'order');
});

dash.draw('tabel-luar', (tb) => {
  const d = dash.data('luar_jam');
  if (d.status !== 'ok' || !d.data.length) return placeholder(tb, 5, d.status);
  rows(tb, d.data, [{f: 'order'}, {f: 'outlet'}, {f: 'jenis'}, {f: 'dibuat'}, {f: 'status'}], 'order');
});

dash.draw('tabel-sampai', (tb) => {
  const d = dash.data('sampai_mepet');
  if (d.status !== 'ok' || !d.data.length) return placeholder(tb, 14, d.status);
  rows(tb, d.data, [{f: 'status', cls: (r) => 'dt-st-' + r.status.toLowerCase()}, {f: 'order'}, {f: 'outlet'}, {f: 'driver'}, {f: 'jenis'},
    {f: 'customer'}, {f: 'hp'}, {f: 'estimasi'}, {f: 'sampai'}, {f: 'sisa_menit', n: 1, cls: (r) => (r.sisa_menit < 0 ? 'dt-bad' : null)},
    {f: 'lewat_menit', n: 1}, {f: 'jika_tepat', n: 1}, {f: 'sebab'}, {f: 'batch'}], 'order');
});

dash.draw('tabel-sampai-tidak', (tb) => {
  const d = dash.data('sampai_tidak');
  if (d.status !== 'ok' || !d.data.length) return placeholder(tb, 3, d.status);
  rows(tb, d.data, [{f: 'order'}, {f: 'batch'}, {f: 'alasan'}], 'order');
});

dash.draw('chart-outlet', (el) => {
  const d = dash.data('per_outlet');
  if (d.status !== 'ok' || !d.data.length) {
    el.replaceChildren();
    const p = document.createElement('p'); p.className = 'dt-hint';
    p.textContent = d.status === 'error' ? 'Gagal dimuat' : (d.status === 'ok' ? 'Tidak ada keberangkatan' : '—');
    el.append(p);
    return;
  }
  const data = d.data;
  const W = Math.max(280, el.clientWidth || 600), rowH = 34, H = data.length * rowH + 8;
  el.replaceChildren();
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'img').attr('aria-label', 'Persen keberangkatan telat per outlet');
  const lab = svg.append('g').selectAll('text').data(data).join('text')
    .attr('x', 0).attr('y', (r, i) => i * rowH + rowH / 2 + 4).text((r) => r.outlet)
    .style('fill', 'var(--color-fg)').style('font-size', '13px');
  let labW = 0; lab.each(function () { labW = Math.max(labW, this.getComputedTextLength()); });
  labW = Math.max(labW, 70) + 12;
  const endW = 120;
  const x = d3.scaleLinear().domain([0, 100]).range([0, Math.max(40, W - labW - endW)]);
  const tip = d3.select(el).append('div').attr('class', 'dt-tip').style('opacity', 0);
  svg.append('g').selectAll('rect').data(data).join('rect')
    .attr('x', labW).attr('y', (r, i) => i * rowH + 7).attr('height', rowH - 14)
    .attr('width', (r) => Math.max(1, x(r.persen))).attr('rx', 3)
    .style('fill', dash.colors[0])
    .on('mousemove', (ev, r) => {
      const [mx, my] = d3.pointer(ev, el);
      tip.style('opacity', 1).style('left', Math.min(mx + 12, W - 200) + 'px').style('top', (my - 10) + 'px')
        .text(`${r.outlet}: ${r.telat} dari ${r.berangkat} kali berangkat telat (${r.persen}%)`);
    })
    .on('mouseleave', () => tip.style('opacity', 0));
  svg.append('g').selectAll('text').data(data).join('text')
    .attr('x', (r) => labW + x(r.persen) + 8).attr('y', (r, i) => i * rowH + rowH / 2 + 4)
    .text((r) => `${r.persen}% · ${r.telat} dari ${r.berangkat}`)
    .style('fill', 'var(--cds-text-secondary)').style('font-size', '12px');
});

// ---------- daftar keberangkatan ----------
dash.draw('pilih-outlet', (sel) => {
  const d = dash.data('audit');
  const outlets = d.status === 'ok' ? [...new Set(d.data.map((a) => a.outlet))].sort() : [];
  sel.replaceChildren(new Option('Semua outlet', ''), ...outlets.map((o) => new Option(o, o)));
  sel.value = outlets.includes(window.DT.outlet) ? window.DT.outlet : '';
  sel.onchange = () => { window.DT.outlet = sel.value; window.DT.driver = ''; dash.draw('pilih-driver'); dash.draw('tabel-kasus'); dash.draw('jumlah-kasus'); };
});

dash.draw('pilih-driver', (sel) => {
  const d = dash.data('audit');
  const src = d.status === 'ok' ? d.data.filter((a) => !window.DT.outlet || a.outlet === window.DT.outlet) : [];
  const drivers = [...new Set(src.map((a) => a.driver))].sort();
  sel.replaceChildren(new Option('Semua driver', ''), ...drivers.map((o) => new Option(o, o)));
  sel.value = drivers.includes(window.DT.driver) ? window.DT.driver : '';
  sel.onchange = () => { window.DT.driver = sel.value; dash.draw('tabel-kasus'); dash.draw('jumlah-kasus'); };
});

document.querySelectorAll('#pilih-tampil').forEach((sel) => {
  sel.addEventListener('change', () => { window.DT.tampil = sel.value; dash.draw('tabel-kasus'); dash.draw('jumlah-kasus'); });
});

function kasusTerpilih() {
  const d = dash.data('audit');
  if (d.status !== 'ok') return null;
  const F = window.DT;
  return d.data.filter((a) => (F.tampil === 'semua' || a.telat === 'Ya') && (!F.outlet || a.outlet === F.outlet) && (!F.driver || a.driver === F.driver))
    .sort((a, b) => b.lewat_menit - a.lewat_menit);
}

dash.draw('jumlah-kasus', (el) => {
  const r = kasusTerpilih();
  el.textContent = r ? `${r.length} keberangkatan ditampilkan` : '—';
});

dash.draw('tabel-kasus', (tb) => {
  const list = kasusTerpilih();
  const od = dash.data('order');
  if (!list) return placeholder(tb, 10, dash.data('audit').status);
  if (!list.length) return placeholder(tb, 10, 'ok');
  const orders = od.status === 'ok' ? d3.group(od.data, (o) => o.batch) : new Map();
  const dp = dash.data('dampak_trip');
  const dampak = dp.status === 'ok' ? new Map(dp.data.map((x) => [x.batch, x.dampak])) : new Map();
  tb.replaceChildren();
  for (const a of list) {
    const tr = document.createElement('tr');
    tr.className = 'dt-row' + (window.DT.open.has(a.batch) ? ' dt-open' : '');
    tr.dataset.key = a.batch;
    const cells = [
      [a.driver], [a.outlet], [a.masuk_batch], [a.berangkat], [fmt(a.tunggu_menit), 1],
      [fmt(a.lewat_menit), 1], [fmt(a.jumlah_order), 1], 'dampak', null, [a.batch],
    ];
    cells.forEach((c, i) => {
      const td = document.createElement('td');
      if (c === 'dampak') {
        const v = dampak.get(a.batch) || '';
        if (v) {
          const s = document.createElement('span');
          s.className = 'dt-pill ' + (v.includes('telat sampai') ? 'dt-telat' : (v.includes('nyaris') ? 'dt-nyaris' : 'dt-aman'));
          s.textContent = v;
          td.append(s);
        }
      } else if (c === null) {
        td.className = 'dt-cat';
        const parts = a.catatan ? a.catatan.split(' | ') : ['Tidak ada catatan — murni nunggu'];
        for (const p of parts) { const dv = document.createElement('div'); dv.textContent = p; td.append(dv); }
      } else {
        if (c[1]) td.className = 'dt-n';
        if (i === 5) {
          const s = document.createElement('span');
          s.textContent = c[0];
          if (a.telat === 'Ya') s.className = 'dt-bad';
          td.append(s);
        } else td.textContent = c[0];
      }
      tr.append(td);
    });
    tr.addEventListener('click', () => {
      if (window.DT.open.has(a.batch)) window.DT.open.delete(a.batch); else window.DT.open.add(a.batch);
      dash.draw('tabel-kasus');
    });
    tb.append(tr);
    if (window.DT.open.has(a.batch)) {
      const dtr = document.createElement('tr');
      dtr.className = 'dt-detail';
      const td = document.createElement('td');
      td.colSpan = 10;
      const os = (orders.get(a.batch) || []).slice().sort((x, y) => x.urutan - y.urutan);
      const t = document.createElement('table');
      t.className = 'dt-table dt-sub-table';
      t.dataset.source = 'order';
      t.dataset.rowKey = 'order';
      const head = ['urutan', 'order', 'customer', 'hp', 'jenis', 'dibuat', 'packing', 'masuk_batch', 'masuk_menit_ke', 'urutan_antar', 'estimasi', 'sampai', 'sisa_menit', 'jarak_km', 'alamat', 'catatan_tele'];
      const names = ['Ke-', 'Order', 'Customer', 'HP', 'Jenis', 'Dibuat', 'Selesai packing', 'Masuk batch', 'Masuk di menit ke-', 'Diantar ke-', 'Estimasi', 'Sampai', 'Sisa ke estimasi (menit)', 'Jarak (km)', 'Alamat', 'Catatan tele'];
      const NUM = new Set(['urutan', 'masuk_menit_ke', 'urutan_antar', 'sisa_menit', 'jarak_km']);
      const th = document.createElement('thead'); const hr = document.createElement('tr');
      head.forEach((h, i) => { const c = document.createElement('th'); c.dataset.field = h; c.textContent = names[i]; if (NUM.has(h)) c.className = 'dt-n'; hr.append(c); });
      th.append(hr); t.append(th);
      const bd = document.createElement('tbody');
      for (const o of os) {
        const r = document.createElement('tr'); r.dataset.key = o.order;
        head.forEach((h) => {
          const c = document.createElement('td');
          c.textContent = fmt(o[h]) || (h === 'catatan_tele' || h === 'sisa_menit' ? '—' : '');
          const cls = [NUM.has(h) ? 'dt-n' : '', h === 'sisa_menit' && o.sisa_menit < 0 ? 'dt-bad' : '', h === 'alamat' ? 'dt-wrapcell' : ''].join(' ').trim();
          if (cls) c.className = cls;
          r.append(c);
        });
        bd.append(r);
      }
      t.append(bd);
      const wrap = document.createElement('div'); wrap.className = 'dt-scroll'; wrap.append(t);
      td.append(wrap); dtr.append(td); tb.append(dtr);
    }
  }
});

// Kartu hasil: klik = loncat ke bagiannya.
document.querySelectorAll('[data-ke]').forEach((b) => {
  b.addEventListener('click', () => {
    const t = document.getElementById(b.dataset.ke);
    if (t) t.scrollIntoView({behavior: 'smooth', block: 'start'});
  });
});
