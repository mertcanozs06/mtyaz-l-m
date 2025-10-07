import { useState, useRef, useEffect, useContext } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { AuthContext } from '../../../context/AuthContext';

const DigitalMenu = () => {
  const { restaurantId, branchId } = useParams();
  const { user, selectedBranch, package_type, token, logout, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('all');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const qrRef = useRef(null);

  // Masa verilerini çek
  useEffect(() => {
    const fetchTables = async () => {
      if (!user || !selectedBranch || !token) {
        setErrorMessage('Kullanıcı, şube veya token bilgisi eksik.');
        setLoading(false);
        return;
      }

      if (user.restaurant_id !== parseInt(restaurantId)) {
        setErrorMessage('Bu restorana erişim yetkiniz yok.');
        setLoading(false);
        return;
      }

      if (branchId !== selectedBranch) {
        console.log('Branch ID mismatch:', { branchId, selectedBranch });
        navigate(`/dashboard/${restaurantId}/${selectedBranch}/qrmenu`);
        return;
      }

      try {
        const res = await fetch(`http://localhost:5000/api/tables/${restaurantId}/${selectedBranch}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const errorData = await res.json();
          if (res.status === 401) {
            setErrorMessage('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
            logout();
            navigate('/login');
            return;
          }
          if (res.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
          if (res.status === 404) throw new Error('Bu şubeye ait masa bulunamadı. Lütfen masa ekleyin.');
          throw new Error(errorData.message || 'Masalar yüklenemedi.');
        }
        const data = await res.json();
        setTables(data);
        // X-New-Token kontrolü
        const newToken = res.headers.get('X-New-Token');
        if (newToken) {
          localStorage.setItem('token', newToken);
          updateUser();
        }
        setLoading(false);
      } catch (err) {
        setErrorMessage(err.message);
        setLoading(false);
      }
    };

    console.log('Fetching tables:', { restaurantId, branchId, selectedBranch });
    fetchTables();
  }, [user, restaurantId, branchId, selectedBranch, token, logout, navigate, updateUser]);

  // Paket kontrolü
  if (!['package2', 'premium'].includes(package_type)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          Bu özellik yalnızca package2 ve premium paketlerde kullanılabilir.
        </div>
      </div>
    );
  }

  // Yetkisiz erişim
  if (!user || user.restaurant_id !== parseInt(restaurantId) || branchId !== selectedBranch) {
    return <Navigate to="/login" replace />;
  }

  // Yükleme durumu
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  // Hata mesajı
  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          {errorMessage}
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => {
              setErrorMessage('');
              if (errorMessage.includes('Oturumunuz sona erdi')) {
                logout();
                navigate('/login');
              } else if (errorMessage.includes('masa bulunamadı')) {
                navigate(`/dashboard/${restaurantId}/${selectedBranch}/branchadd`);
              }
            }}
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

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

  // İndir fonksiyonu
  const handleDownload = () => {
    if (!qrRef.current) return;

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

  const displayedTables = selectedTable === 'all' ? tables.map((t) => t.table_number) : [Number(selectedTable)];

  return (
    <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-6">
        QR Menü Oluştur – <span className="text-blue-600">Restoran {restaurantId}, Şube {selectedBranch}</span>
      </h1>

      {tables.length === 0 ? (
        <div className="text-gray-600">Bu şubede tanımlı masa bulunmamaktadır.</div>
      ) : (
        <>
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
              {tables.map((table) => (
                <option key={table.id} value={table.table_number}>
                  Masa {table.table_number} {table.region ? `(${table.region})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div
            className={`grid gap-6 ${
              selectedTable === 'all' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 justify-center'
            }`}
          >
            {displayedTables.map((tableNumber) => {
              const qrUrl = `http://localhost:5173/qrmenu/${restaurantId}/${selectedBranch}/${tableNumber}`;
              const size = selectedTable === 'all' ? 128 : 256;

              return (
                <div
                  key={tableNumber}
                  className="bg-white shadow p-4 flex flex-col items-center rounded"
                  ref={tableNumber === Number(selectedTable) ? qrRef : null}
                >
                  <QRCode value={qrUrl} size={size} />
                  <p className="mt-2 font-semibold">
                    Masa {tableNumber}
                    {tables.find((t) => t.table_number === tableNumber)?.region
                      ? ` (${tables.find((t) => t.table_number === tableNumber).region})`
                      : ''}
                  </p>
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
        </>
      )}
    </div>
  );
};

export default DigitalMenu;
