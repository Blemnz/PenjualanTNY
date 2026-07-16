import { useState, useEffect, useRef } from 'react';

interface CartItem {
  name: string;
  harga: number;
  qty: number;
}

interface Product {
  name: string;
  harga: number;
}

interface Settings {
  depot: string;
  addr: string;
}

interface CounterMap {
  [key: string]: number;
}

interface NotaData {
  no: string;
  tgl: string;
  sales: string;
  toko: string;
  items: CartItem[];
  total: number;
}

function safeGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}

function safeSet<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    /* ignore */
  }
}

const DEFAULT_SALES = ["Ardiana", "Cahya", "Fauziah", "Riykan", "Sugiana"];

const DEFAULT_PRODUCTS: Product[] = [
  { name: 'Rice Crackers', harga: 1700 },
  { name: 'Custard Cake', harga: 1700 },
  { name: 'Strawberry Cake', harga: 1700 },
  { name: 'Cake Coklat', harga: 2500 },
  { name: 'Sachima', harga: 1700 },
  { name: 'Shaqima Brown Sugar', harga: 1700 },
  { name: 'Go-Bread Rasa Coklat', harga: 2600 },
  { name: 'Go-Bread Rasa Stroberi', harga: 2600 },
  { name: 'Go-Bread Rasa Custard', harga: 2600 },
  { name: 'Jeli Anggur', harga: 2500 },
  { name: 'Jeli Stroberi', harga: 2500 },
  { name: 'Jeli Mangga', harga: 2500 },
  { name: 'Jelly Milk Tea', harga: 2500 },
  { name: 'Crispy Rice Rasa Pedas', harga: 2100 },
  { name: 'Crispy Rice Rasa Ayam Pedas', harga: 2100 }
];

export default function App() {
  // State variables
  const [cart, setCart] = useState<CartItem[]>([]);
  const [settings, setSettings] = useState<Settings>(() => safeGet<Settings>('nota_settings', { depot: 'Depo MDJ', addr: '' }));
  const [counterMap, setCounterMap] = useState<CounterMap>(() => safeGet<CounterMap>('nota_counters', {}));

  // Screen routing state
  const [screen, setScreen] = useState<'input' | 'nota'>('input');

  // Input states
  const [fName, setFName] = useState('');
  const [fHarga, setFHarga] = useState('');
  const [fQty, setFQty] = useState(1);
  const [fToko, setFToko] = useState('');
  const [fSales, setFSales] = useState('');
  const [fSalesCustom, setFSalesCustom] = useState('');

  // Settings states
  const [showSettings, setShowSettings] = useState(false);
  const [sDepot, setSDepot] = useState('Depo MDJ');
  const [sDepotCustom, setSDepotCustom] = useState('');
  const [sAddr, setSAddr] = useState('');

  // Note data state
  const [notaData, setNotaData] = useState<NotaData | null>(null);

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '' });
  const toastTimeoutRef = useRef<number | null>(null);

  // Refs for element focus
  const nameInputRef = useRef<HTMLSelectElement>(null);
  const hargaInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const tokoInputRef = useRef<HTMLInputElement>(null);

  // Date format for the Topbar brand
  const [brandDate, setBrandDate] = useState('-');

  useEffect(() => {
    const d = new Date();
    const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    setBrandDate(d.toLocaleDateString('id-ID', opts));
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Utility helpers
  const rupiah = (n: number) => {
    const rounded = Math.round(Number(n) || 0);
    return 'Rp ' + rounded.toLocaleString('id-ID');
  };

  const todayKey = () => {
    const d = new Date();
    return d.getFullYear().toString() + 
           String(d.getMonth() + 1).padStart(2, '0') + 
           String(d.getDate()).padStart(2, '0');
  };

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ show: true, message });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 1600);
  };

  // Quantity control
  const stepQty = (delta: number) => {
    setFQty((prev) => {
      const next = prev + delta;
      return next < 1 ? 1 : next;
    });
  };

  const handleNameChange = (val: string) => {
    setFName(val);
    const match = DEFAULT_PRODUCTS.find((p) => p.name.toLowerCase() === val.trim().toLowerCase());
    if (match) {
      setFHarga(String(match.harga));
    } else {
      setFHarga('');
    }
  };

  // Cart operations
  const addItem = () => {
    const name = fName.trim();
    const harga = parseFloat(fHarga);
    const qty = fQty;

    if (!name) {
      showToast('Nama produk belum diisi');
      nameInputRef.current?.focus();
      return;
    }
    if (isNaN(harga) || harga <= 0) {
      showToast('Harga belum diisi');
      hargaInputRef.current?.focus();
      return;
    }
    if (qty <= 0) {
      showToast('Qty tidak valid');
      return;
    }

    // Add to cart
    setCart((prev) => [...prev, { name, harga, qty }]);

    // Clear inputs and refocus
    setFName('');
    setFHarga('');
    setFQty(1);
    showToast('Item ditambahkan');
    nameInputRef.current?.focus();
  };

  const removeItem = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const cartTotal = () => {
    return cart.reduce((s, item) => s + item.harga * item.qty, 0);
  };



  // Generate Receipt
  const generateNota = () => {
    if (cart.length === 0) {
      showToast('Keranjang masih kosong');
      return;
    }
    const toko = fToko.trim();
    let salesName = fSales;
    if (fSales === '__custom') {
      salesName = fSalesCustom.trim();
    }

    if (!toko) {
      showToast('Nama toko belum diisi');
      tokoInputRef.current?.focus();
      return;
    }
    if (!salesName) {
      showToast('Pilih atau isi nama sales');
      return;
    }

    // Generate receipt number
    const key = todayKey();
    const nextNum = (counterMap[key] || 0) + 1;
    const updatedCounters = { ...counterMap, [key]: nextNum };
    setCounterMap(updatedCounters);
    safeSet('nota_counters', updatedCounters);

    const prefixCode = (settings.depot || 'DEPO')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .slice(0, 4) || 'DEPO';
    const notaNo = `${prefixCode}-${key}-${String(nextNum).padStart(3, '0')}`;

    const now = new Date();
    const tglStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) +
      ' · ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const total = cartTotal();

    setNotaData({
      no: notaNo,
      tgl: tglStr,
      sales: salesName,
      toko: toko,
      items: cart,
      total: total
    });

    setScreen('nota');
    window.scrollTo(0, 0);
  };

  // Settings operations
  const openSettings = () => {
    setSAddr(settings.addr || '');
    const knownDepots = ['Depo MDJ', 'Depo KOPO', 'Depo AK', 'Depo Padalarang'];
    if (knownDepots.includes(settings.depot)) {
      setSDepot(settings.depot);
      setSDepotCustom('');
    } else {
      setSDepot('__custom');
      setSDepotCustom(settings.depot || '');
    }
    setShowSettings(true);
  };

  const saveSettings = () => {
    const depot = sDepot === '__custom' ? (sDepotCustom.trim() || 'Depo') : sDepot;
    const newSettings = {
      depot,
      addr: sAddr.trim()
    };
    setSettings(newSettings);
    safeSet('nota_settings', newSettings);
    setShowSettings(false);
    showToast('Pengaturan disimpan');
  };

  const newNota = () => {
    setCart([]);
    setFToko('');
    setFSales('');
    setFSalesCustom('');
    setNotaData(null);
    setScreen('input');
  };

  return (
    <div className="app">
      {/* Top Header */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-badge">:)</div>
          <div className="brand-text">
            <div className="name">{settings.depot || 'Depo MDJ'}</div>
            <div className="sub">{brandDate}</div>
          </div>
        </div>
        <button className="icon-btn" onClick={openSettings} title="Pengaturan">⚙</button>
      </header>

      {/* Screen Router */}
      {screen === 'input' ? (
        <div className="input-screen-wrap">
          {/* Add Item Form */}
          <div className="card">
            <h3>➕ Tambah item</h3>
            <div className="field">
              <label>Nama produk</label>
              <select
                ref={nameInputRef}
                value={fName}
                onChange={(e) => handleNameChange(e.target.value)}
              >
                <option value="">Pilih produk…</option>
                {DEFAULT_PRODUCTS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="row2">
              <div className="field">
                <label>Harga satuan</label>
                <input
                  type="number"
                  ref={hargaInputRef}
                  value={fHarga}
                  onChange={(e) => setFHarga(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                />
              </div>
              <div className="field">
                <label>Qty</label>
                <div className="qty-stepper">
                  <button type="button" onClick={() => stepQty(-1)}>−</button>
                  <input
                    type="number"
                    ref={qtyInputRef}
                    id="fQty"
                    value={fQty}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setFQty(isNaN(v) || v < 1 ? 1 : v);
                    }}
                    min="1"
                    inputMode="numeric"
                  />
                  <button type="button" onClick={() => stepQty(1)}>+</button>
                </div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={addItem}>
              + Tambah ke Nota
            </button>
          </div>

          {/* Cart List */}
          <div className="card">
            <h3>
              🧾 Keranjang{' '}
              {cart.length > 0 && (
                <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>
                  ({cart.length})
                </span>
              )}
            </h3>
            <div className="cart-list">
              {cart.length === 0 ? (
                <div className="cart-empty">
                  <span className="big">🛒</span>
                  Belum ada item. Tambahkan produk di atas.
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div key={idx} className="cart-item">
                    <div className="info">
                      <div className="pname">{item.name}</div>
                      <div className="pmeta">
                        {item.qty} x {rupiah(item.harga)}
                      </div>
                    </div>
                    <div className="psub">{rupiah(item.qty * item.harga)}</div>
                    <button className="del" onClick={() => removeItem(idx)}>✕</button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Customer / Store Details */}
          <div className="card">
            <h3>🏪 Tujuan</h3>
            <div className="field">
              <label>Nama toko / pembeli</label>
              <input
                type="text"
                ref={tokoInputRef}
                value={fToko}
                onChange={(e) => setFToko(e.target.value)}
                placeholder="Nama toko tujuan"
              />
            </div>
            <div className="field">
              <label>Sales</label>
              <select value={fSales} onChange={(e) => setFSales(e.target.value)}>
                <option value="">Pilih sales…</option>
                {DEFAULT_SALES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value="__custom">Lainnya…</option>
              </select>
            </div>
            {fSales === '__custom' && (
              <div className="field">
                <label>Nama sales lainnya</label>
                <input
                  type="text"
                  value={fSalesCustom}
                  onChange={(e) => setFSalesCustom(e.target.value)}
                  placeholder="Tulis nama sales"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Nota screen view */
        notaData && (
          <div className="nota-screen-wrap">
            <div className="nota-card">
              <div className="zig-top"></div>
              <div className="nota-head">
                <div className="store">{settings.depot || 'Depo MDJ'}</div>
                {settings.addr && <div className="addr">{settings.addr}</div>}
              </div>
              <div className="nota-meta">
                <div className="r">
                  <span>No. Nota</span>
                  <span className="mono">{notaData.no}</span>
                </div>
                <div className="r">
                  <span>Tanggal</span>
                  <span className="mono">{notaData.tgl}</span>
                </div>
                <div className="r">
                  <span>Sales</span>
                  <span>{notaData.sales}</span>
                </div>
                <div className="r">
                  <span>Toko</span>
                  <span>{notaData.toko}</span>
                </div>
              </div>
              <div className="dashed"></div>
              <div className="nota-items">
                {notaData.items.map((item, i) => (
                  <div key={i} className="li">
                    <div className="l">
                      {item.name}
                      <span className="qtyline">
                        {item.qty} x {rupiah(item.harga)}
                      </span>
                    </div>
                    <div className="mono">{rupiah(item.qty * item.harga)}</div>
                  </div>
                ))}
              </div>
              <div className="dashed"></div>
              <div className="nota-total">
                <div className="lbl">TOTAL</div>
                <div className="val mono">{rupiah(notaData.total)}</div>
              </div>
              <div className="nota-foot">
                Terima kasih atas pesanan Anda
                <div className="smile">:)</div>
              </div>
              <div className="zig-bottom"></div>
            </div>
            <div className="nota-actions">
              <button className="btn btn-ghost" onClick={() => setScreen('input')}>
                ← Edit
              </button>
              <button className="btn btn-dark" onClick={() => window.print()}>
                🖨 Cetak
              </button>
              <button className="btn btn-primary" onClick={newNota}>
                Nota Baru
              </button>
            </div>
          </div>
        )
      )}

      {/* Sticky Bottom Bar for input screen */}
      {screen === 'input' && (
        <div className="stickybar">
          <div className="stickybar-inner">
            <div className="total-block">
              <div className="lbl">Total</div>
              <div className="val">{rupiah(cartTotal())}</div>
            </div>
            <button
              className="btn btn-dark"
              onClick={generateNota}
              disabled={cart.length === 0}
            >
              Buat Nota →
            </button>
          </div>
        </div>
      )}

      {/* Toast popup */}
      <div className={`toast ${toast.show ? 'show' : ''}`}>{toast.message}</div>

      {/* Settings Modal Sheet */}
      {showSettings && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSettings(false);
          }}
        >
          <div className="sheet">
            <h3>Pengaturan Gudang</h3>
            <div className="field">
              <label>Nama gudang / depo</label>
              <select value={sDepot} onChange={(e) => setSDepot(e.target.value)}>
                <option value="Depo MDJ">Depo MDJ</option>
                <option value="Depo KOPO">Depo KOPO</option>
                <option value="Depo AK">Depo AK</option>
                <option value="Depo Padalarang">Depo Padalarang</option>
                <option value="__custom">Lainnya…</option>
              </select>
            </div>
            {sDepot === '__custom' && (
              <div className="field">
                <input
                  type="text"
                  value={sDepotCustom}
                  onChange={(e) => setSDepotCustom(e.target.value)}
                  placeholder="Nama gudang"
                />
              </div>
            )}
            <div className="field">
              <label>Alamat / keterangan (opsional, muncul di nota)</label>
              <input
                type="text"
                value={sAddr}
                onChange={(e) => setSAddr(e.target.value)}
                placeholder="Contoh: Jl. Raya ... , Bandung"
              />
            </div>
            <div className="sheet-actions">
              <button className="btn btn-ghost" onClick={() => setShowSettings(false)}>
                Batal
              </button>
              <button className="btn btn-primary" onClick={saveSettings}>
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
