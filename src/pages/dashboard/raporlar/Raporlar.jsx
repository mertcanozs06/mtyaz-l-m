import { useEffect, useState, useContext } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';

const Raporlar = () => {
  const { restaurantId, branchId } = useParams();
  const { user, token, selectedBranch, package_type } = useContext(AuthContext);
  const [reports, setReports] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Rapor verilerini ve masaları çek
  useEffect(() => {
    const fetchData = async () => {
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
        setErrorMessage('Seçilen şube geçersiz.');
        setLoading(false);
        return;
      }

      try {
        // Masaları çek
        const tablesRes = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/tables`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!tablesRes.ok) {
          const errorData = await tablesRes.json();
          if (tablesRes.status === 401) throw new Error('Lütfen giriş yapın.');
          if (tablesRes.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
          throw new Error(errorData.message || 'Masalar yüklenemedi.');
        }
        const tablesData = await tablesRes.json();
        setTables(tablesData);

        // Siparişleri çek (rapor için tamamlanmış siparişler)
        const ordersRes = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/orders?status=completed`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!ordersRes.ok) {
          const errorData = await ordersRes.json();
          if (ordersRes.status === 401) throw new Error('Lütfen giriş yapın.');
          if (ordersRes.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
          throw new Error(errorData.message || 'Siparişler yüklenemedi.');
        }
        const ordersData = await ordersRes.json();

        // Rapor verilerini hazırla
        const reportSummary = ordersData.reduce((acc, order) => {
          const table = tablesData.find((t) => t.id === order.table_id);
          const tableNumber = table ? `${table.table_number}${table.region ? ` (${table.region})` : ''}` : `#${order.table_id}`;
          const existing = acc.find((r) => r.table_id === order.table_id);
          if (existing) {
            existing.total_price += order.total_price;
            existing.order_count += 1;
          } else {
            acc.push({
              table_id: order.table_id,
              table_number: tableNumber,
              total_price: order.total_price,
              order_count: 1,
            });
          }
          return acc;
        }, []);

        setReports(reportSummary);
        setLoading(false);
      } catch (err) {
        setErrorMessage(err.message);
        setLoading(false);
      }
    };

    if (restaurantId && branchId && token) fetchData();
  }, [restaurantId, branchId, token, user, selectedBranch]);

  // Paket kontrolü
  if (package_type !== 'premium') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          Raporlar özelliği yalnızca premium pakette kullanılabilir.
        </div>
      </div>
    );
  }

  // Yetkisiz erişim
  if (!user || user.role !== 'admin' || user.restaurant_id !== parseInt(restaurantId) || branchId !== selectedBranch) {
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
            onClick={() => setErrorMessage('')}
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">
          Raporlar – Restoran {restaurantId}, Şube {branchId}
        </h2>
        <button
          onClick={() => user.logout()}
          className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
        >
          Çıkış Yap
        </button>
      </div>

      {reports.length === 0 ? (
        <p className="text-gray-500">Bu şubede tamamlanmış sipariş bulunmamaktadır.</p>
      ) : (
        <div className="bg-white shadow-md rounded-md p-4">
          <h3 className="text-xl font-semibold mb-4">Satış Raporu (Tamamlanmış Siparişler)</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 text-left">Masa</th>
                <th className="p-2 text-left">Sipariş Sayısı</th>
                <th className="p-2 text-left">Toplam Gelir (TL)</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.table_id} className="border-b">
                  <td className="p-2">{report.table_number}</td>
                  <td className="p-2">{report.order_count}</td>
                  <td className="p-2">{report.total_price.toFixed(2)} TL</td>
                </tr>
              ))}
              <tr className="font-semibold bg-gray-100">
                <td className="p-2">Toplam</td>
                <td className="p-2">{reports.reduce((sum, r) => sum + r.order_count, 0)}</td>
                <td className="p-2">
                  {reports.reduce((sum, r) => sum + r.total_price, 0).toFixed(2)} TL
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Raporlar;
