import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'react-qr-code';

const DigitalMenu= () => {
  const { restaurantId } = useParams();
  const [tableCount, setTableCount] = useState('');
  const [qrReady, setQrReady] = useState(false);
  const [selectedTable, setSelectedTable] = useState('all');

  // QR kodu içeren divi refere etmek için
  const qrRef = useRef(null);

  const handleGenerate = () => {
    const count = parseInt(tableCount, 10);
    if (!isNaN(count) && count > 0) {
      setQrReady(true);
      setSelectedTable('all');
    } else {
      alert('Lütfen geçerli bir sayı girin.');
    }
  };

  const tables = [...Array(Number(tableCount)).keys()].map(i => i + 1);
  const displayedTables = selectedTable === 'all' ? tables : [Number(selectedTable)];

  // Yazdırma fonksiyonu
  const handlePrint = () => {
    if (!qrRef.current) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>QR Kod Yazdır</title></head><body style="text-align:center; margin-top:50px;">');
    printWindow.document.write(qrRef.current.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  // İndir butonu için canvas'a dönüştürüp indir
  const handleDownload = () => {
    if (!qrRef.current) return;

    // react-qr-code svg render ediyor, bunu canvas'a çevirmek için:
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return alert('QR kod bulunamadı.');

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const pngLink = document.createElement('a');
      pngLink.download = `masa-${selectedTable}-qrcode.png`;
      pngLink.href = canvas.toDataURL('image/png');
      pngLink.click();
    };

    img.src = url;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-6">
        QR Menü Oluştur – <span className="text-blue-600">{restaurantId}</span>
      </h1>

      <div className="mb-6 flex items-center gap-3">
        <input
          type="number"
          placeholder="Masa sayısı"
          className="border px-4 py-2 rounded w-40"
          value={tableCount}
          onChange={(e) => setTableCount(e.target.value)}
        />
        <button
          onClick={handleGenerate}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Oluştur
        </button>
      </div>

      {qrReady && (
        <div className="mb-6">
          <label className="mr-2 font-semibold" htmlFor="tableSelect">
            Masa Seç:
          </label>
          <select
            id="tableSelect"
            className="border px-3 py-2 rounded"
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
          >
            <option value="all">Tüm Masalar</option>
            {tables.map((tableNum) => (
              <option key={tableNum} value={tableNum}>
                Masa {tableNum}
              </option>
            ))}
          </select>
        </div>
      )}

      {qrReady && (
        <div
          className={`grid gap-6 ${
            selectedTable === 'all' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 justify-center'
          }`}
        >
          {displayedTables.map((tableNumber) => {
            const qrUrl = `http://localhost:5173/qrmenu/${restaurantId}/${tableNumber}`;
            const size = selectedTable === 'all' ? 128 : 256;

            return (
              <div
                key={tableNumber}
                className="bg-white shadow p-4 flex flex-col items-center rounded"
                ref={tableNumber === Number(selectedTable) ? qrRef : null}
              >
                <QRCode value={qrUrl} size={size} />
                <p className="mt-2 font-semibold">Masa {tableNumber}</p>
                <a
                  href={qrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline text-sm mt-1"
                >
                  Menüyü Aç
                </a>
                {selectedTable !== 'all' && (
                  <div className="mt-4 flex gap-4">
                    <button
                      onClick={handlePrint}
                      className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                    >
                      Yazdır
                    </button>
                    <button
                      onClick={handleDownload}
                      className="bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600"
                    >
                      İndir
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DigitalMenu;
