import { useState, useEffect, useRef } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface CartItem {
  name: string;
  namaCn?: string;
  harga: number;
  qty: number;
}

interface Product {
  name: string;
  namaCn?: string;
  harga: number;
}

interface Settings {
  depot: string;
  addr: string;
  printerName?: string;
  printerAddress?: string;
}

interface CounterMap {
  [key: string]: number;
}

interface NotaData {
  id: string;
  no: string;
  depot?: string;
  address?: string;
  tgl: string;
  sales: string;
  idToko: string;
  toko: string;
  items: CartItem[];
  total: number;
}

interface ReceiptDownloaderPlugin {
  savePng(options: { fileName: string; data: string }): Promise<{ uri: string }>;
}

interface ThermalPrinterPlugin {
  requestBluetoothPermissions(): Promise<void>;
  listPairedDevices(): Promise<{ devices: Array<{ name: string; address: string }> }>;
  print(options: { address: string; text: string }): Promise<void>;
}

const ReceiptDownloader = registerPlugin<ReceiptDownloaderPlugin>('ReceiptDownloader');
const ThermalPrinter = registerPlugin<ThermalPrinterPlugin>('ThermalPrinter');

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
  { name: 'Rice Crackers', namaCn: '雪米饼', harga: 1700 },
  { name: 'Custard Cake', namaCn: '蛋黄派', harga: 1700 },
  { name: 'Strawberry Cake', namaCn: '草莓派', harga: 1700 },
  { name: 'Cake Coklat', namaCn: '巧克力派', harga: 2500 },
  { name: 'Sachima', namaCn: '沙琪玛', harga: 1700 },
  { name: 'Shaqima Brown Sugar', namaCn: '黑糖沙琪玛', harga: 1700 },
  { name: 'Go-Bread Rasa Coklat', namaCn: '巧克力面包', harga: 2600 },
  { name: 'Go-Bread Rasa Stroberi', namaCn: '草莓面包', harga: 2600 },
  { name: 'Go-Bread Rasa Custard', namaCn: '香草面包', harga: 2600 },
  { name: 'Jeli Anggur', namaCn: '葡萄味吸吸果冻', harga: 2500 },
  { name: 'Jeli Stroberi', namaCn: '草莓味吸吸果冻', harga: 2500 },
  { name: 'Jeli Mangga', namaCn: '芒果味吸吸果冻', harga: 2500 },
  { name: 'Jelly Milk Tea', namaCn: '奶茶味吸吸果冻', harga: 2500 },
  { name: 'Crispy Rice Rasa Pedas', harga: 2100 },
  { name: 'Crispy Rice Rasa Ayam Pedas', harga: 2100 },
  { name: 'Senbei', namaCn: '仙贝', harga: 850 }
];

export default function App() {
  // State variables
  const [cart, setCart] = useState<CartItem[]>([]);
  const [settings, setSettings] = useState<Settings>(() => safeGet<Settings>('nota_settings', { depot: 'Depo MDJ', addr: '', printerName: '', printerAddress: '' }));
  const [counterMap, setCounterMap] = useState<CounterMap>(() => safeGet<CounterMap>('nota_counters', {}));
  const [history, setHistory] = useState<NotaData[]>(() => safeGet<NotaData[]>('nota_history', []));

  // Screen routing state
  const [screen, setScreen] = useState<'input' | 'nota' | 'history'>('input');

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
  const [sPrinterName, setSPrinterName] = useState('');
  const [sPrinterAddress, setSPrinterAddress] = useState('');
  const [pairedPrinters, setPairedPrinters] = useState<Array<{ name: string; address: string }>>([]);
  const [isSearchingPrinter, setIsSearchingPrinter] = useState(false);

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

  const wrapTextForPrinter = (text: string, maxWidth: number): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';
    words.forEach((word) => {
      if (currentLine.length === 0) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const centerLine = (text: string, width: number): string => {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(pad) + text;
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
    lines.push(`No. Nota     : ${notaData.no || '-'}`);
    lines.push(`Tanggal      : ${notaData.tgl || '-'}`);
    lines.push(`Sales        : ${notaData.sales || '-'}`);
    lines.push(`ID Toko      : ${notaData.idToko || '-'}`);
    lines.push(`Toko         : ${notaData.toko || '-'}`);
    lines.push('--------------------------------');
    
    notaData.items.forEach((item) => {
      const displayName = item.namaCn ? `${item.namaCn} ${item.name}` : (item.name || '-');
      lines.push(displayName);
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

  const downloadNotaImage = async () => {
    if (!notaData) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scale = 2;
    const width = 520;
    const padding = 32;
    const contentWidth = width - padding * 2;
    const lineHeight = 24;
    const wrapText = (text: string, maxWidth: number, font: string) => {
      ctx.font = font;
      const words = (text || '-').split(/\s+/);
      const lines: string[] = [];
      let line = '';
      words.forEach((word) => {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      });
      if (line) lines.push(line);
      return lines;
    };
    const depotAddress = notaData.address || getDepoAddress(notaData.depot || settings.depot) || '-';
    const addressLines = wrapText(depotAddress, contentWidth, '15px Arial');
    const itemNames = notaData.items.map((item) => {
      const displayName = item.namaCn ? `${item.namaCn} ${item.name}` : (item.name || '-');
      return wrapText(displayName, contentWidth, '17px Arial');
    });
    const itemHeight = itemNames.reduce((total, lines) => total + lines.length * lineHeight + 31, 0);
    const height = 32 + 30 + addressLines.length * 20 + 27 + 14 + 20 + 5 * lineHeight + 16 + itemHeight + 18 + 34 + 18 + 24 + 24 + 32;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#241812';
    ctx.textBaseline = 'top';
    let y = 32;
    const center = (text: string, font: string) => {
      ctx.font = font;
      ctx.fillText(text, (width - ctx.measureText(text).width) / 2, y);
      y += lineHeight;
    };
    const divider = () => {
      ctx.strokeStyle = '#6f625c';
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(padding, y + 8); ctx.lineTo(width - padding, y + 8); ctx.stroke();
      ctx.setLineDash([]);
      y += 24;
    };
    center('PT TNY FOOD Indonesia', 'bold 21px Arial');
    addressLines.forEach((line) => { center(line, '15px Arial'); y -= 4; });
    y += 3;
    center('Telp: 0811-2233-7772', '15px Arial');
    y -= 4;
    center('TikTok: @tny_goday_bdg', '15px Arial');
    y += 10;
    divider();
    const detailRows = [
      ['No. Nota', notaData.no || '-'], ['Tanggal', notaData.tgl || '-'], ['Sales', notaData.sales || '-'],
      ['ID Toko', notaData.idToko || '-'], ['Toko', notaData.toko || '-']
    ];
    ctx.font = '16px Arial';
    detailRows.forEach(([label, value]) => { ctx.fillText(`${label} : ${value}`, padding, y); y += lineHeight; });
    divider();
    notaData.items.forEach((item, index) => {
      ctx.font = 'bold 17px Arial';
      itemNames[index].forEach((line) => { ctx.fillText(line, padding, y); y += lineHeight; });
      ctx.font = '16px Arial';
      const quantity = `${item.qty || 0} x ${formatNum(item.harga || 0)}`;
      const subtotal = formatNum((item.qty || 0) * (item.harga || 0));
      ctx.fillText(quantity, padding, y);
      ctx.fillText(subtotal, width - padding - ctx.measureText(subtotal).width, y);
      y += 31;
    });
    divider();
    ctx.font = 'bold 19px Arial';
    ctx.fillText('TOTAL', padding, y);
    const totalText = `Rp ${formatNum(notaData.total || 0)}`;
    ctx.fillText(totalText, width - padding - ctx.measureText(totalText).width, y);
    y += 34;
    divider();
    center('Terima kasih', '16px Arial');
    const fileName = `nota-${notaData.no}.png`;
    const imageData = canvas.toDataURL('image/png');
    if (Capacitor.isNativePlatform()) {
      try {
        await ReceiptDownloader.savePng({ fileName, data: imageData });
        showToast('Gambar disimpan ke folder Download');
      } catch {
        showToast('Gagal menyimpan gambar');
      }
      return;
    }
    const link = document.createElement('a');
    link.download = fileName;
    link.href = imageData;
    link.click();
    showToast('Gambar nota diunduh');
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
    const matchedProduct = DEFAULT_PRODUCTS.find((p) => p.name.toLowerCase() === name.toLowerCase());
    const namaCn = matchedProduct?.namaCn;
    setCart((prev) => [...prev, { name, namaCn, harga, qty }]);

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

    const newNotaData: NotaData = {
      id: `${notaNo}-${Date.now()}`,
      no: notaNo,
      depot: settings.depot,
      address: getDepoAddress(settings.depot),
      tgl: tglStr,
      sales: salesName,
      idToko: fIdToko.trim(),
      toko: toko,
      items: cart,
      total: total
    };
    setNotaData(newNotaData);
    const updatedHistory = [newNotaData, ...history];
    setHistory(updatedHistory);
    safeSet('nota_history', updatedHistory);

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
    setSPrinterName(settings.printerName || '');
    setSPrinterAddress(settings.printerAddress || '');
    setPairedPrinters([]);
    setShowSettings(true);
  };

  const findPairedPrinters = async () => {
    if (!Capacitor.isNativePlatform()) {
      showToast('Koneksi Bluetooth tersedia pada aplikasi Android');
      return;
    }
    setIsSearchingPrinter(true);
    try {
      await ThermalPrinter.requestBluetoothPermissions();
      const result = await ThermalPrinter.listPairedDevices();
      setPairedPrinters(result.devices || []);
      if ((result.devices || []).length === 0) showToast('Belum ada printer yang dipasangkan');
    } catch {
      showToast('Bluetooth belum diizinkan atau tidak tersedia');
    } finally {
      setIsSearchingPrinter(false);
    }
  };

  const printThermalReceipt = async () => {
    if (!notaData) return;
    if (!Capacitor.isNativePlatform()) {
      window.print();
      return;
    }
    if (!settings.printerAddress) {
      showToast('Pilih printer thermal di Pengaturan');
      return;
    }
    try {
      await ThermalPrinter.requestBluetoothPermissions();
      const PW = 32; // printer width in chars
      const headerLines: string[] = [];
      headerLines.push(centerLine('PT TNY FOOD Indonesia', PW));
      const address = notaData.address || getDepoAddress(notaData.depot || settings.depot);
      const addrWrapped = wrapTextForPrinter(address, PW);
      addrWrapped.forEach((line) => headerLines.push(centerLine(line, PW)));
      headerLines.push(centerLine('Telp: 0811-2233-7772', PW));
      headerLines.push(centerLine('TikTok: @tny_goday_bdg', PW));
      const headerText = headerLines.join('\n');
      await ThermalPrinter.print({
        address: settings.printerAddress,
        text: `${headerText}\n${generateReceiptBodyText()}`
      });
      showToast(`Nota terkirim ke ${settings.printerName || 'printer thermal'}`);
    } catch {
      showToast('Gagal terhubung ke printer thermal');
    }
  };

  const testThermalPrinter = async () => {
    if (!sPrinterAddress) {
      showToast('Pilih printer terlebih dahulu');
      return;
    }
    try {
      await ThermalPrinter.requestBluetoothPermissions();
      await ThermalPrinter.print({ address: sPrinterAddress, text: 'PT TNY FOOD Indonesia\n\nTes koneksi printer berhasil.\n\n' });
      showToast('Tes cetak berhasil dikirim');
    } catch {
      showToast('Tes cetak gagal');
    }
  };

  const saveSettings = () => {
    const depot = sDepot === '__custom' ? (sDepotCustom.trim() || 'Depo') : sDepot;
    const newSettings = {
      depot,
      addr: '',
      printerName: sPrinterName,
      printerAddress: sPrinterAddress
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

  const openHistoryNota = (nota: NotaData) => {
    setNotaData(nota);
    setScreen('nota');
    window.scrollTo(0, 0);
  };

  const deleteHistoryNota = (id: string) => {
    const updatedHistory = history.filter((nota) => nota.id !== id);
    setHistory(updatedHistory);
    safeSet('nota_history', updatedHistory);
    showToast('Riwayat dihapus');
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
        <div className="topbar-actions">
          <button className="icon-btn" onClick={() => setScreen('history')} title="Riwayat">◷</button>
          <button className="icon-btn" onClick={openSettings} title="Pengaturan">⚙</button>
        </div>
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
                {/* Crispy Rice products have no Chinese name */}
                {DEFAULT_PRODUCTS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.namaCn ? `${p.namaCn} ${p.name}` : p.name}
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
                      <div className="pname">{item.namaCn ? `${item.namaCn} ${item.name}` : item.name}</div>
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
      ) : screen === 'history' ? (
        <div className="history-wrap">
          <div className="history-heading">
            <button className="back-btn" onClick={() => setScreen('input')}>Kembali</button>
            <h2>Riwayat Transaksi</h2>
          </div>
          {history.length === 0 ? (
            <div className="card history-empty">Belum ada transaksi tersimpan.</div>
          ) : (
            history.map((nota) => (
              <div className="card history-item" key={nota.id}>
                <button className="history-main" onClick={() => openHistoryNota(nota)}>
                  <span className="history-store">{nota.toko}</span>
                  <span className="history-meta">{nota.no}<br />{nota.tgl}</span>
                </button>
                <div className="history-side">
                  <strong>{rupiah(nota.total)}</strong>
                  <button className="history-delete" onClick={() => deleteHistoryNota(nota.id)} aria-label="Hapus riwayat">x</button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Nota screen view */
        notaData && (
          <div className="nota-screen-wrap">
            <div className="nota-card" style={{ padding: '24px 20px' }}>
              <div className="zig-top"></div>
              <div className="receipt-header">
                <div className="receipt-title">PT TNY FOOD Indonesia</div>
                <div className="receipt-address">{notaData.address || getDepoAddress(notaData.depot || settings.depot) || '-'}</div>
                <div className="receipt-phone">Telp: 0811-2233-7772</div>
                <div className="receipt-tiktok">TikTok: @tny_goday_bdg</div>
              </div>
              <pre className="receipt-text" style={{ marginTop: '0' }}>{generateReceiptBodyText()}</pre>
              <div className="zig-bottom"></div>
            </div>
            <div className="nota-actions">
              <button className="btn btn-ghost" onClick={() => setScreen('input')}>
                ← Edit
              </button>
              <button className="btn btn-dark" onClick={printThermalReceipt}>
                🖨 Cetak
              </button>
              <button className="btn btn-ghost" onClick={downloadNotaImage}>
                Gambar
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
            <div className="printer-settings">
              <div className="printer-heading">
                <div>
                  <label>Printer thermal Bluetooth</label>
                  <p>Pasangkan printer terlebih dahulu melalui Pengaturan Bluetooth Android.</p>
                </div>
                <button className="btn btn-ghost btn-compact" onClick={findPairedPrinters} disabled={isSearchingPrinter}>
                  {isSearchingPrinter ? 'Mencari...' : 'Cari printer'}
                </button>
              </div>
              {sPrinterAddress && <div className="selected-printer">Terpilih: {sPrinterName || sPrinterAddress}</div>}
              {pairedPrinters.length > 0 && (
                <div className="printer-list">
                  {pairedPrinters.map((printer) => (
                    <button type="button" className={`printer-option ${sPrinterAddress === printer.address ? 'selected' : ''}`} key={printer.address} onClick={() => {
                      setSPrinterName(printer.name);
                      setSPrinterAddress(printer.address);
                    }}>
                      <span>{printer.name}</span><small>{printer.address}</small>
                    </button>
                  ))}
                </div>
              )}
              {sPrinterAddress && <button className="btn btn-ghost test-printer" onClick={testThermalPrinter}>Tes cetak</button>}
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
