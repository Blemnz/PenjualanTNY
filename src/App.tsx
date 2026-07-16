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
  idToko: string;
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

const SALES_BY_DEPOT: Record<string, string[]> = {
  MDJ: ['Sukmara', 'Gugum', 'Asep Aten', 'Amir', 'Fauziah', 'Jafar', 'Cahya', 'Wisnu', 'Dimas', 'Sugiana', 'Kelvin', 'Ryan'],
  AK: ['Anwar', 'Acep', 'Jajuri', 'Budi', 'Annisa', 'Dede', 'Rian', 'Miftahudin', 'Dendi', 'Febi', 'Irfan', 'Galih', 'Ade', 'Agung', 'Fauzan', 'Niraz'],
  KOPO: ['Ardiana', 'Albab', 'Riykan', 'Ahmad', 'Febi', 'Zaldi'],
};

const getSalesForDepot = (depotName: string): string[] => {
  const normalized = depotName.toUpperCase();
  if (normalized.includes('MDJ')) return SALES_BY_DEPOT.MDJ;
  if (normalized.includes('AK')) return SALES_BY_DEPOT.AK;
  if (normalized.includes('KOPO')) return SALES_BY_DEPOT.KOPO;
  return [];
};

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
  const [fIdToko, setFIdToko] = useState('');
  const [fSales, setFSales] = useState('');
  const [fSalesCustom, setFSalesCustom] = useState('');

  // Settings states
  const [showSettings, setShowSettings] = useState(false);
  const [sDepot, setSDepot] = useState('Depo MDJ');
  const [sDepotCustom, setSDepotCustom] = useState('');

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

  const getDepoAddress = (depotName: string) => {
    const normalized = depotName.toUpperCase();
    if (normalized.includes('MDJ')) {
      return 'Jl. AH. Nasution Jl. Raya Sindanglaya No.73, Karang Pamulang, Kec. Mandalajati, Kota Bandung, Jawa Barat 40195';
    }
    if (normalized.includes('AK')) {
      return 'Jl. Rancaekek Majalaya, Solokanjeruk, Kec. Solokanjeruk, Kabupaten Bandung, Jawa Barat 40376';
    }
    if (normalized.includes('KOPO')) {
      return 'Jl. Sadang Sari, Margahayu Tengah, Kec. Margahayu, Kabupaten Bandung, Jawa Barat 40225';
    }
    return settings.addr || '';
  };

  const formatNum = (n: number) => {
    return Math.round(n).toLocaleString('en-US');
  };

  const formatItemLine = (qty: number, price: number) => {
    const left = `${qty} x ${formatNum(price)}`;
    const right = formatNum(qty * price);
    const spacesNeeded = 32 - left.length - right.length;
    const spaces = ' '.repeat(spacesNeeded > 0 ? spacesNeeded : 1);
    return `${left}${spaces}${right}`;
  };

  const formatDateTime = (d: Date) => {
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${Y}-${M}-${D} ${h}:${m}:${s}`;
  };

  const generateReceiptBodyText = () => {
    if (!notaData) return '';
    
    const lines: string[] = [];
    lines.push('================================');
    lines.push(`Tanggal      : ${notaData.tgl}`);
    lines.push(`Sales        : ${notaData.sales}`);
    lines.push(`ID Toko      : ${notaData.idToko}`);
    lines.push(`Toko         : ${notaData.toko}`);
    lines.push('--------------------------------');
    
    notaData.items.forEach((item) => {
      lines.push(item.name);
      lines.push(formatItemLine(item.qty, item.harga));
    });
    
    lines.push('--------------------------------');
    
    const totalLabel = 'TOTAL';
    const totalVal = 'Rp ' + formatNum(notaData.total);
    const totalSpaces = ' '.repeat(Math.max(1, 32 - totalLabel.length - totalVal.length));
    lines.push(`${totalLabel}${totalSpaces}${totalVal}`);
    
    lines.push('--------------------------------');
    lines.push('Terima kasih');
    lines.push('================================');
    
    return lines.join('\n');
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
    const tglStr = formatDateTime(now);

    const total = cartTotal();

    setNotaData({
      no: notaNo,
      tgl: tglStr,
      sales: salesName,
      idToko: fIdToko.trim(),
      toko: toko,
      items: cart,
      total: total
    });

    setScreen('nota');
    window.scrollTo(0, 0);
  };

  // Settings operations
  const openSettings = () => {
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
      addr: ''
    };
    setSettings(newSettings);
    safeSet('nota_settings', newSettings);
    setFSales('');
    setFSalesCustom('');
    setShowSettings(false);
    showToast('Pengaturan disimpan');
  };

  const newNota = () => {
    setCart([]);
    setFToko('');
    setFIdToko('');
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
              <label>ID Toko</label>
              <input
                type="text"
                value={fIdToko}
                onChange={(e) => setFIdToko(e.target.value)}
                placeholder="Contoh: 1232"
              />
            </div>
            <div className="field">
              <label>Sales</label>
              <select value={fSales} onChange={(e) => setFSales(e.target.value)}>
                <option value="">Pilih sales…</option>
                {getSalesForDepot(settings.depot).map((name) => (
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
            <div className="nota-card" style={{ padding: '24px 20px' }}>
              <div className="zig-top"></div>
              <div className="receipt-header">
                <div className="receipt-title">PT TNY FOOD Indonesia</div>
                <div className="receipt-address">{getDepoAddress(settings.depot)}</div>
                <div className="receipt-phone">Telp: 0811-2233-7772</div>
              </div>
              <pre className="receipt-text" style={{ marginTop: '0' }}>{generateReceiptBodyText()}</pre>
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
