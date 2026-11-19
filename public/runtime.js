// Mesin kecil console: menghitung ulang semua angka dan menggambar ulang halaman setiap data / aturan berubah.
window.dash = (() => {
  const calcs = [], draws = {}, onDataFns = [], store = {}, meta = {};
  let params = {hari: ''};
  const run = (name) => document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => {
    try { draws[name](el); } catch (e) { console.error('gambar ' + name, e); }
  });
  const recompute = () => {
    for (const [id, o] of calcs) {
      try { store[id] = o.fn(...o.inputs.map((i) => store[i] ?? [])); } catch (e) { console.error('hitung ' + id, e); store[id] = []; }
    }
  };
  const refresh = () => { recompute(); onDataFns.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); Object.keys(draws).forEach(run); };
  return {
    calc: (id, o) => { calcs.push([id, o]); },
    draw: (name, f) => { if (typeof f === 'function') draws[name] = f; else run(name); },
    data: (id) => (id in store ? {status: 'ok', data: store[id], meta: meta[id]} : {status: 'loading', data: []}),
    params: () => params,
    setParams: (p) => { params = {...params, ...p}; refresh(); },
    onData: (f) => { onDataFns.push(f); },
    colors: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'],
    set: (id, data, m) => { store[id] = data; meta[id] = m; },
    refresh,
  };
})();
