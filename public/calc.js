// Console Audit Delivery — semua hitungan, dari file order master yang diupload.
window.DT = window.DT || {outlet: '', driver: '', tampil: 'telat', open: new Set()};
// Angka standar; yang diubah lewat "Ubah aturan" disimpan di data/aturan dan menang.
window.DT_DEFAULT = {BATAS: 8, SIAP: 7, NYARIS: 5, NY_MAX: 30, JAM_MULAI: 9, JAM_SELESAI: 7, PARAH: 10, TAHAN: 25, CEPAT: 15};
window.DT_FMT = new Intl.NumberFormat('id-ID', {maximumFractionDigits: 1});

// Alat bantu: jam di BAUS dibaca apa adanya (WIB, tanpa geser zona waktu).
window.DT_T = (() => {
  const RE = /^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)(?::(\d\d)(?:\.(\d+))?)?/;
  const ts = (s) => {
    const m = RE.exec(String(s || '').trim());
    if (!m) return null;
    const ms = m[7] ? Number((m[7] + '00').slice(0, 3)) : 0;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0), ms);
  };
  const p2 = (n) => String(n).padStart(2, '0');
  const jam = (t) => {
    if (t == null) return '';
    const d = new Date(t);
    return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)} ${p2(d.getUTCHours())}.${p2(d.getUTCMinutes())}`;
  };
  const hm = (t) => { const d = new Date(t); return `${p2(d.getUTCHours())}.${p2(d.getUTCMinutes())}`; };
  const hmc = (t) => { const d = new Date(t); return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; };
  // Pembulatan 1 desimal, sama dengan hitungan awal (round Python).
  const r1 = (x) => {
    if (x == null || !Number.isFinite(x)) return null;
    const q = x * 4;
    if (Number.isInteger(q) && q % 2 !== 0) { const t = x * 10; const f = Math.floor(t); return (f % 2 === 0 ? f : f + 1) / 10; }
    return Number(x.toFixed(1));
  };
  const menit = (a, b) => (a == null || b == null ? null : r1((b - a) / 60000));
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const hariKey = (t) => new Date(t).toISOString().slice(0, 10);
  const labelHari = (key) => { const d = new Date(key + 'T00:00:00Z'); return `${HARI[d.getUTCDay()]} ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  // Hari operasional: dari JAM_MULAI sampai JAM_SELESAI hari berikutnya, menurut jam order dibuat.
  const hari = (t, k) => {
    if (t == null) return '';
    const d = new Date(t);
    const h = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    const a = Number(k.JAM_MULAI), b = Number(k.JAM_SELESAI);
    const kemarin = () => hariKey(t - 86400000);
    if (a > b) return h >= a ? hariKey(t) : (h < b ? kemarin() : '');
    if (a === b) return h >= a ? hariKey(t) : kemarin();
    return h >= a && h < b ? hariKey(t) : '';
  };
  const EV = /\[(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+)\] (STAFF|DRIVER|CUSTOMER) \| ([^:]*): (.*?)(?= \| \[\d{4}-|$)/g;
  const events = (txt) => {
    const out = [];
    for (const m of String(txt || '').matchAll(EV)) {
      const t = ts(m[1]); const who = m[2]; const name = m[3].trim(); const body = m[4];
      const k = /\] (Hold|Unhold|Struk salah|Cancel|Selesaikan paksa): ?(.*)/.exec(body);
      if (k) out.push({t, kind: k[1], why: k[2].trim(), who: name});
      else if (/payment|qris|botol|plot/i.test(body) && who === 'STAFF') {
        const i = body.indexOf('] ');
        out.push({t, kind: 'Catatan', why: (i >= 0 ? body.slice(i + 2) : body).trim(), who: name});
      }
    }
    return out;
  };
  return {ts, jam, hm, hmc, r1, menit, hari, labelHari, events};
})();

const T = window.DT_T;

dash.calc('atur', {
  inputs: ['aturan'],
  title: 'Aturan yang dipakai',
  description: 'Angka aturan dari "Ubah aturan" di console. Yang belum pernah diisi memakai angka standar.',
  fn: (aturan) => {
    const s = (Array.isArray(aturan) && aturan[0]) || {};
    const out = {...window.DT_DEFAULT};
    for (const k of Object.keys(out)) {
      const v = Number(s[k]);
      if (s[k] !== undefined && s[k] !== null && s[k] !== '' && Number.isFinite(v)) out[k] = v;
    }
    return out;
  },
});

dash.calc('basis', {
  inputs: ['order_master', 'atur'],
  title: 'Order dari file + hari operasional',
  description: 'Tiap baris CSV order master: jam-jamnya dibaca, lalu dimasukkan ke hari operasional menurut jam order dibuat.',
  fn: (order_master, atur) => (Array.isArray(order_master) ? order_master : []).map((r, i) => {
    const dibuat = T.ts(r.created_at);
    return {
      i, order: r.order_no || '', status: r.status || '', jenis: r.delivery_type || '',
      outlet: String(r.outlet_name || '').replace('Babe Corner ', ''),
      customer: r.customer_name || '', hp: r.customer_phone || '', alamat: r.address_text || '',
      batch: String(r.selected_batch_id || ''), driver: r.selected_driver_name || '', cnw: r.selected_cnw_name || '',
      jarak_km: r.distance_from_outlet_km === '' || r.distance_from_outlet_km == null ? null : Number(r.distance_from_outlet_km),
      terjadwal: String(r.scheduled_delivery).toLowerCase() === 'true',
      dibuat, packing: T.ts(r.cnw_packed_at), masuk: T.ts(r.batch_assigned_at), berangkat: T.ts(r.batch_departed_at),
      kembali: T.ts(r.batch_return_at), estimasi: T.ts(r.estimated_arrived_at), sampai: T.ts(r.arrived_at),
      struk_diubah: T.ts(r.receipt_modified_at), notes: r.notes_entries || '',
      hari: T.hari(dibuat, atur),
    };
  }),
});

dash.calc('hari_list', {
  inputs: ['basis'],
  title: 'Hari operasional di file',
  description: 'Hari operasional yang ada di file, jumlah order, dan jam order pertama & terakhir dibuat.',
  fn: (basis) => d3.rollups(basis.filter((b) => b.hari), (v) => ({
    order: v.length, diantar: v.filter((b) => b.status === 'Delivered').length,
    pertama: T.jam(d3.min(v, (b) => b.dibuat)), terakhir: T.jam(d3.max(v, (b) => b.dibuat)),
  }), (b) => b.hari).sort((a, b) => d3.ascending(a[0], b[0]))
    .map(([hari, x]) => ({hari, label: T.labelHari(hari), ...x})),
});

dash.calc('luar_jam', {
  inputs: ['basis'],
  title: 'Order di luar jam hari operasional',
  description: 'Order yang jam dibuatnya di luar jam mulai–selesai hari operasional, jadi tidak ikut dihitung.',
  fn: (basis) => basis.filter((b) => !b.hari).map((b) => ({order: b.order, outlet: b.outlet, dibuat: T.jam(b.dibuat) || '(jam kosong)', status: b.status, jenis: b.jenis})),
});

dash.calc('basis_hari', {
  inputs: ['basis'],
  title: 'Order di hari yang dipilih',
  description: 'Order yang masuk hari operasional yang dipilih di atas, atau semua hari di file.',
  fn: (basis) => {
    const h = dash.params().hari || '';
    return basis.filter((b) => b.hari && (!h || b.hari === h));
  },
});

dash.calc('keberangkatan', {
  inputs: ['basis_hari'],
  title: 'Keberangkatan per batch',
  description: 'Satu baris per batch yang diantar: jam order pertama masuk batch, jam berangkat, lama nunggu di outlet, dan catatan hold / struk diubah di jendela itu.',
  fn: (basis_hari) => {
    const ok = basis_hari.filter((o) => o.status === 'Delivered' && o.batch && o.masuk != null && o.berangkat != null && !(o.dibuat > o.berangkat));
    const out = [];
    for (const [batch, g0] of d3.group(ok, (o) => o.batch)) {
      const g = g0.slice().sort((a, b) => a.masuk - b.masuk || a.dibuat - b.dibuat || a.i - b.i);
      const first = g[0].masuk, dep = g[0].berangkat;
      const hold = [], struk = [];
      for (const r of g) {
        const ujung = r.order.slice(-5);
        for (const e of T.events(r.notes)) {
          if (e.t == null || e.t < first || e.t > dep) continue;
          if (e.kind === 'Hold') hold.push(`Di-hold tele ${T.hm(e.t)} (order …${ujung}): ${e.why || '-'}`);
          else if (e.kind === 'Unhold') hold.push(`Hold dilepas tele ${T.hm(e.t)} (order …${ujung}): ${e.why || '-'}`);
          else if (e.kind === 'Struk salah') struk.push(`Struk salah ${T.hm(e.t)} (order …${ujung}): ${e.why || '-'}`);
        }
        if (r.struk_diubah != null && first <= r.struk_diubah && r.struk_diubah <= dep) struk.push(`Struk diubah ${T.hm(r.struk_diubah)} saat order sudah di batch (order …${ujung})`);
      }
      out.push({
        batch, outlet: g[0].outlet, driver: g[0].driver, cnw: g[0].cnw, hari: g[0].hari, jumlah_order: g.length,
        jenis: g.map((o) => o.jenis).join(' + '), masuk_batch: T.jam(first), berangkat: T.jam(dep),
        tunggu_menit: T.menit(first, dep),
        catatan_hold: [...new Set(hold)].join('; '), catatan_struk: [...new Set(struk)].join('; '),
        t_masuk: first, t_berangkat: dep, t_kembali: g[0].kembali,
      });
    }
    return out.sort((a, b) => a.t_masuk - b.t_masuk);
  },
});

dash.calc('order', {
  inputs: ['basis_hari', 'keberangkatan', 'atur'],
  title: 'Order per keberangkatan',
  description: 'Satu baris per order yang diantar: jam dibuat, selesai packing, masuk batch, estimasi, jam sampai, customer, sebab kalau lama masuk batch, dan driver yang kosong di outlet saat order menunggu.',
  fn: (basis_hari, keberangkatan, atur) => {
    const trip = new Map(keberangkatan.map((k) => [k.batch, k]));
    const gaps = [];
    for (const [drv, ts] of d3.group(keberangkatan, (k) => k.driver)) {
      const s = ts.slice().sort((a, b) => a.t_berangkat - b.t_berangkat);
      for (let i = 1; i < s.length; i++) {
        if (s[i].hari === s[i - 1].hari && s[i - 1].t_kembali != null) gaps.push({cnw: s[i].cnw, driver: drv, dari: s[i - 1].t_kembali, sampai: s[i].t_masuk});
      }
    }
    const nganggur = (o) => {
      if (o.terjadwal || o.packing == null || o.masuk == null) return '';
      const start = o.packing + (o.jenis === 'NYANTAI' ? atur.TAHAN * 60000 : 0), end = o.masuk;
      const names = gaps.filter((g) => g.cnw === o.cnw && g.driver !== o.driver && (Math.min(g.sampai, end) - Math.max(g.dari, start)) >= 120000).map((g) => g.driver);
      return [...new Set(names)].sort().join(', ');
    };
    const ok = basis_hari.filter((o) => o.status === 'Delivered' && trip.has(o.batch) && o.masuk != null && o.berangkat != null && !(o.dibuat > o.berangkat));
    const rows = [];
    for (const [batch, g0] of d3.group(ok, (o) => o.batch)) {
      const k = trip.get(batch);
      const g = g0.slice().sort((a, b) => a.masuk - b.masuk || a.dibuat - b.dibuat || a.i - b.i);
      // jam sampai yang dipakai (bukan Done Paksa, tidak sebelum berangkat) dan urutan antarnya
      const alasan = (o) => {
        if (o.sampai == null) return 'Jam sampai kosong';
        if (o.sampai < o.berangkat) return 'Jam sampai tercatat sebelum driver berangkat (data rusak)';
        if (o.notes.includes('Selesaikan paksa')) return 'Diselesaikan paksa oleh tele — jam sampai diketik manual, bukan dari driver';
        if (o.estimasi == null) return 'Estimasi kosong';
        return '';
      };
      const pakai = g.filter((o) => !alasan(o)).sort((a, b) => a.sampai - b.sampai || a.i - b.i);
      const antar = new Map(pakai.map((o, i) => [o.order, i + 1]));
      g.forEach((o, i) => {
        const ev = T.events(o.notes);
        const pack = T.menit(o.dibuat, o.packing), plot = T.menit(o.packing, o.masuk);
        const idle = nganggur(o);
        let sebab;
        if (o.terjadwal) sebab = 'Order terjadwal (dijadwalkan customer / masuk sebelum buka)';
        else {
          const s = [];
          if (ev.some((e) => e.kind === 'Hold')) s.push('Di-hold tele');
          if (o.jenis === 'NYANTAI') s.push('NYANTAI ditahan sistem');
          else if (pack >= plot) s.push('Paling lama di packing');
          else s.push('Paling lama nunggu diplot ke driver');
          if (idle) s.push('padahal ada driver di outlet belum dapat batch');
          sebab = s.join(' · ');
        }
        const al = alasan(o);
        rows.push({
          order: o.order, batch, urutan: i + 1, jenis: o.jenis, outlet: o.outlet, driver: o.driver,
          customer: o.customer, hp: o.hp, alamat: o.alamat,
          dibuat: T.jam(o.dibuat), packing: T.jam(o.packing), masuk_batch: T.jam(o.masuk),
          masuk_menit_ke: T.menit(k.t_masuk, o.masuk), menit_dibuat_ke_batch: T.menit(o.dibuat, o.masuk),
          menit_dibuat_ke_packing: pack, menit_packing_ke_batch: plot,
          terjadwal: o.terjadwal ? 'Ya' : 'Tidak', jarak_km: o.jarak_km, sebab, driver_nganggur: idle,
          catatan_tele: ev.map((e) => `${T.hmc(e.t)} ${e.kind}: ${e.why}`).join('; '),
          estimasi: T.jam(o.estimasi), sampai: T.jam(o.sampai),
          sisa_menit: al ? null : T.menit(o.sampai, o.estimasi), urutan_antar: antar.get(o.order) ?? null,
          sampai_tidak_dihitung: al,
        });
      });
    }
    return rows;
  },
});

dash.calc('tidak_dihitung', {
  inputs: ['basis_hari'],
  title: 'Order yang tidak dihitung',
  description: 'Order diantar yang punya batch tapi jam masuk batch / berangkatnya kosong, atau dibuat setelah batchnya berangkat.',
  fn: (basis_hari) => basis_hari
    .filter((o) => o.status === 'Delivered' && o.batch && (o.masuk == null || o.berangkat == null || o.dibuat > o.berangkat))
    .map((o) => ({batch: o.batch, order: o.order, dibuat: T.jam(o.dibuat),
      alasan: o.berangkat == null ? 'Tidak ada jam masuk batch & jam berangkat (Done Paksa besok paginya)'
        : (o.dibuat > o.berangkat ? "Order dibuat setelah batchnya berangkat — ditempel ke batch lama (Done Paksa 'salah cancel')"
          : 'Tidak ada jam masuk batch')})),
});

dash.calc('audit', {
  inputs: ['keberangkatan', 'order', 'atur'],
  title: 'Keberangkatan + status telat',
  description: 'Tiap keberangkatan: telat kalau nunggu lebih dari batas menit sejak order pertama masuk batch, lewat berapa menit, dan catatannya.',
  fn: (keberangkatan, order, atur) => {
    const tambahan = {};
    for (const o of order) {
      if (o.urutan > 1 && o.masuk_menit_ke > atur.BATAS) {
        (tambahan[o.batch] = tambahan[o.batch] || []).push(`Order ke-${o.urutan} (…${o.order.slice(-5)}) baru masuk di menit ke-${String(o.masuk_menit_ke).replace('.', ',')} → driver nunggu order tambahan (cek: minta plot manual?)`);
      }
    }
    return keberangkatan.map((k) => {
      const c = [];
      if (k.catatan_hold) c.push('Ada hold tele: ' + k.catatan_hold);
      if (k.catatan_struk) c.push(k.catatan_struk + ' → cek: QRIS pindah botol / ganti produk?');
      for (const t of (tambahan[k.batch] || [])) c.push(t);
      const lewat = Math.round((k.tunggu_menit - atur.BATAS) * 10) / 10;
      return {batch: k.batch, outlet: k.outlet, driver: k.driver, jumlah_order: k.jumlah_order, jenis: k.jenis,
        masuk_batch: k.masuk_batch, berangkat: k.berangkat, tunggu_menit: k.tunggu_menit,
        lewat_menit: lewat, telat: k.tunggu_menit > atur.BATAS ? 'Ya' : 'Tidak', catatan: c.join(' | ')};
    });
  },
});

dash.calc('ringkasan', {
  inputs: ['audit', 'atur'],
  title: 'Angka utama telat berangkat',
  description: 'Jumlah keberangkatan, yang telat, persen telat, driver yang pernah telat, menit kebuang dan telat parah.',
  fn: (audit, atur) => {
    const telat = audit.filter((a) => a.telat === 'Ya');
    return [{
      berangkat: audit.length,
      telat: telat.length,
      persen: audit.length ? Math.round(telat.length / audit.length * 100) : 0,
      driver_total: new Set(audit.map((a) => a.driver)).size,
      driver_telat: new Set(telat.map((a) => a.driver)).size,
      menit_kebuang: Math.round(telat.reduce((s, a) => s + a.lewat_menit, 0)),
      parah: telat.filter((a) => a.lewat_menit > atur.PARAH).length,
    }];
  },
});

dash.calc('per_outlet', {
  inputs: ['audit'],
  title: 'Telat per outlet',
  description: 'Jumlah keberangkatan dan yang telat di tiap outlet.',
  fn: (audit) => d3.rollups(audit, (v) => ({berangkat: v.length, telat: v.filter((a) => a.telat === 'Ya').length}), (a) => a.outlet)
    .map(([outlet, x]) => ({outlet, berangkat: x.berangkat, telat: x.telat, persen: Math.round(x.telat / x.berangkat * 100)}))
    .sort((a, b) => b.persen - a.persen),
});

dash.calc('per_driver', {
  inputs: ['audit'],
  title: 'Telat per driver',
  description: 'Per driver: berapa kali berangkat, berapa kali telat, nunggu paling lama, dan total menit kebuang.',
  fn: (audit) => d3.rollups(audit, (v) => {
    const t = v.filter((a) => a.telat === 'Ya');
    return {outlet: v[0].outlet, berangkat: v.length, telat: t.length,
      terlama: d3.max(v, (a) => a.tunggu_menit), menit_kebuang: Math.round(t.reduce((s, a) => s + a.lewat_menit, 0))};
  }, (a) => a.driver).map(([driver, x]) => ({driver, ...x})).sort((a, b) => b.telat - a.telat || b.menit_kebuang - a.menit_kebuang),
});

dash.calc('nyantai', {
  inputs: ['order', 'audit', 'atur'],
  title: 'Cek order NYANTAI',
  description: 'NYANTAI yang jadi order pertama (dan yang ditahan sistem setelah packing), yang barengan, keberangkatan bawa NYANTAI yang telat, dan yang lewat batas menit.',
  fn: (order, audit, atur) => {
    const ny = order.filter((o) => o.jenis === 'NYANTAI');
    const pertama = ny.filter((o) => o.urutan === 1);
    const bareng = ny.filter((o) => o.urutan > 1);
    const bawa = audit.filter((a) => a.jenis.includes('NYANTAI'));
    return [{
      pertama: pertama.length,
      ditahan: pertama.filter((o) => Math.abs(o.menit_packing_ke_batch - atur.TAHAN) <= 1).length,
      barengan: bareng.length,
      barengan_cepat: bareng.filter((o) => o.menit_dibuat_ke_batch < atur.CEPAT).length,
      trip_bawa: bawa.length,
      trip_telat: bawa.filter((a) => a.telat === 'Ya').length,
      lewat_tahan: ny.filter((o) => o.menit_dibuat_ke_batch > atur.NY_MAX).length,
    }];
  },
});

dash.calc('nyantai_lewat', {
  inputs: ['order', 'atur'],
  title: 'NYANTAI lewat batas',
  description: 'Order NYANTAI yang baru masuk batch lebih dari batas menit sejak dibuat.',
  fn: (order, atur) => order.filter((o) => o.jenis === 'NYANTAI' && o.menit_dibuat_ke_batch > atur.NY_MAX)
    .sort((a, b) => b.menit_dibuat_ke_batch - a.menit_dibuat_ke_batch)
    .map((o) => ({order: o.order, outlet: o.outlet, customer: o.customer, hp: o.hp, menit_dibuat_ke_batch: o.menit_dibuat_ke_batch, sebab: o.sebab, driver_nganggur: o.driver_nganggur})),
});

dash.calc('nganggur', {
  inputs: ['order', 'atur'],
  title: 'HEMAT & PRIORITAS nganggur',
  description: 'Order HEMAT dan PRIORITAS yang lebih dari batas menit sejak dibuat belum masuk batch.',
  fn: (order, atur) => order.filter((o) => o.jenis !== 'NYANTAI' && o.menit_dibuat_ke_batch > atur.SIAP)
    .sort((a, b) => b.menit_dibuat_ke_batch - a.menit_dibuat_ke_batch)
    .map((o) => ({order: o.order, outlet: o.outlet, jenis: o.jenis, customer: o.customer, hp: o.hp, dibuat: o.dibuat, packing: o.packing, masuk_batch: o.masuk_batch,
      menit_dibuat_ke_packing: o.menit_dibuat_ke_packing, menit_packing_ke_batch: o.menit_packing_ke_batch,
      menit_dibuat_ke_batch: o.menit_dibuat_ke_batch, sebab: o.sebab, driver_nganggur: o.driver_nganggur, terjadwal: o.terjadwal})),
});

dash.calc('nganggur_ringkas', {
  inputs: ['nganggur'],
  title: 'Ringkasan order nganggur',
  description: 'Jumlah order HEMAT/PRIORITAS nganggur, dipecah menurut sebabnya.',
  fn: (nganggur) => {
    const sisa = nganggur.filter((o) => o.terjadwal !== 'Ya');
    return [{
      total: nganggur.length,
      prioritas: nganggur.filter((o) => o.jenis === 'PRIORITAS').length,
      terjadwal: nganggur.length - sisa.length,
      sisa: sisa.length,
      packing: sisa.filter((o) => o.sebab.includes('di packing')).length,
      nunggu_driver: sisa.filter((o) => o.sebab.includes('nunggu diplot')).length,
      hold: sisa.filter((o) => o.sebab.includes('hold')).length,
      ada_driver_kosong: sisa.filter((o) => o.driver_nganggur).length,
    }];
  },
});

dash.calc('sampai', {
  inputs: ['order', 'audit', 'atur'],
  title: 'Order sampai vs estimasi',
  description: 'Tiap order yang jam sampainya dipakai: sisa waktu ke estimasi (minus = telat sampai), berapa menit driver lewat batas berangkat, sisa kalau driver jalan tepat waktu, dan kenapa.',
  fn: (order, audit, atur) => {
    const trip = new Map(audit.map((a) => [a.batch, a]));
    const pakai = order.filter((o) => typeof o.sisa_menit === 'number');
    const perTrip = d3.group(pakai, (o) => o.batch);
    const f = (v) => window.DT_FMT.format(v);
    return pakai.map((o) => {
      const a = trip.get(o.batch);
      const lewat = a ? Math.max(0, a.lewat_menit) : 0;
      const jika = Math.round((o.sisa_menit + lewat) * 10) / 10;
      const status = o.sisa_menit < 0 ? 'Telat' : (o.sisa_menit < atur.NYARIS ? 'Nyaris' : 'Aman');
      const c = [];
      if (status === 'Telat') {
        if (lewat > 0 && jika >= 0) c.push(`Driver telat berangkat ${f(lewat)} menit — kalau jalan di menit ke-${atur.BATAS} masih sempat`);
        else if (lewat > 0) c.push(`Driver telat berangkat ${f(lewat)} menit, tapi tetap telat walau jalan di menit ke-${atur.BATAS}`);
        else c.push('Berangkat tepat waktu — telatnya di perjalanan');
      } else if (status === 'Nyaris') {
        if (lewat > 0 && jika >= atur.NYARIS) c.push(`Mepet gara-gara driver telat berangkat ${f(lewat)} menit`);
        else if (lewat > 0) c.push(`Driver telat berangkat ${f(lewat)} menit, tapi tetap mepet walau jalan di menit ke-${atur.BATAS}`);
        else c.push('Berangkat tepat waktu, tetap mepet');
      }
      if (status !== 'Aman' && o.jenis === 'PRIORITAS' && (perTrip.get(o.batch) || []).some((x) => x.urutan_antar < o.urutan_antar && x.jenis !== 'PRIORITAS')) {
        c.push('PRIORITAS diantar setelah order HEMAT/NYANTAI');
      }
      return {order: o.order, batch: o.batch, outlet: o.outlet, driver: o.driver, jenis: o.jenis, customer: o.customer, hp: o.hp,
        estimasi: o.estimasi, sampai: o.sampai, sisa_menit: o.sisa_menit, lewat_menit: lewat, jika_tepat: jika, status, sebab: c.join(' · '),
        telat_berangkat: a && a.telat === 'Ya' ? 'Ya' : 'Tidak'};
    });
  },
});

dash.calc('sampai_mepet', {
  inputs: ['sampai'],
  title: 'Order telat & nyaris telat sampai',
  description: 'Order yang sampai lewat estimasi, atau mepet sebelum estimasi. Diurutkan dari yang paling telat.',
  fn: (sampai) => sampai.filter((s) => s.status !== 'Aman').sort((a, b) => a.sisa_menit - b.sisa_menit),
});

dash.calc('sampai_ringkas', {
  inputs: ['sampai', 'atur'],
  title: 'Ringkasan telat sampai',
  description: 'Berapa order telat, nyaris dan aman; dampak keberangkatan yang telat ke customer; dan per jenis order.',
  fn: (sampai, atur) => {
    const telat = sampai.filter((s) => s.status === 'Telat');
    const nyaris = sampai.filter((s) => s.status === 'Nyaris');
    const tripTelat = d3.rollups(sampai.filter((s) => s.telat_berangkat === 'Ya'), (v) => d3.min(v, (s) => s.sisa_menit), (s) => s.batch).map(([, m]) => m);
    const jenis = (j) => sampai.filter((s) => s.jenis === j);
    const kena = (j) => jenis(j).filter((s) => s.status !== 'Aman').length;
    return [{
      dihitung: sampai.length,
      telat: telat.length,
      persen_telat: sampai.length ? Math.round(telat.length / sampai.length * 1000) / 10 : 0,
      nyaris: nyaris.length,
      aman: sampai.length - telat.length - nyaris.length,
      telat_karena_berangkat: telat.filter((s) => s.lewat_menit > 0 && s.jika_tepat >= 0).length,
      trip_telat: tripTelat.length,
      trip_bikin_telat: tripTelat.filter((m) => m < 0).length,
      trip_bikin_nyaris: tripTelat.filter((m) => m >= 0 && m < atur.NYARIS).length,
      trip_aman: tripTelat.filter((m) => m >= atur.NYARIS).length,
      nyaris_trip_telat: nyaris.filter((s) => s.telat_berangkat === 'Ya').length,
      nyaris_selamat: nyaris.filter((s) => s.telat_berangkat === 'Ya' && s.jika_tepat >= atur.NYARIS).length,
      sisa_median: d3.median(sampai, (s) => s.sisa_menit) ?? null,
      prioritas_kena: kena('PRIORITAS'), prioritas_total: jenis('PRIORITAS').length,
      hemat_kena: kena('HEMAT'), hemat_total: jenis('HEMAT').length,
      nyantai_kena: kena('NYANTAI'), nyantai_total: jenis('NYANTAI').length,
    }];
  },
});

dash.calc('dampak_trip', {
  inputs: ['sampai'],
  title: 'Dampak tiap keberangkatan ke customer',
  description: 'Per keberangkatan: ada order yang telat sampai, nyaris telat, atau aman semua.',
  fn: (sampai) => d3.rollups(sampai, (v) => {
    const t = v.filter((s) => s.status === 'Telat').length;
    const n = v.filter((s) => s.status === 'Nyaris').length;
    return t ? `${t} order telat sampai` : (n ? `${n} order nyaris telat` : 'Aman');
  }, (s) => s.batch).map(([batch, dampak]) => ({batch, dampak})),
});

dash.calc('sampai_tidak', {
  inputs: ['order'],
  title: 'Order yang jam sampainya tidak dipakai',
  description: 'Order yang tidak ikut dihitung telat sampainya, dan alasannya.',
  fn: (order) => order.filter((o) => o.sampai_tidak_dihitung).map((o) => ({order: o.order, batch: o.batch, alasan: o.sampai_tidak_dihitung})),
});
