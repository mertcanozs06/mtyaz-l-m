// src/pages/dashboard/settings/MenuSettings.jsx
import { useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';

const MenuSettings = () => {
  const { restaurantId } = useParams();
  const { selectedBranch } = useOutletContext();
  const [themeColor, setThemeColor] = useState('#ffffff');
  const [logoUrl, setLogoUrl] = useState('');
  const [fontStyle, setFontStyle] = useState('Arial');
  const [fontSize, setFontSize] = useState(16);
  const [newLogo, setNewLogo] = useState(null);
  const [workingHours, setWorkingHours] = useState([]);
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Menü ayarları ve çalışma saatlerini çek
  useEffect(() => {
    if (!selectedBranch) return;
    setIsLoading(true);

    // Menü ayarlarını çek
    fetch(`http://localhost:5000/api/settings/menu/${restaurantId}/${selectedBranch}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Ayarlar alınamadı.');
        return res.json();
      })
      .then((data) => {
        setThemeColor(data.theme_color || '#ffffff');
        setLogoUrl(data.logo_url || '');
        setFontStyle(data.font_style || 'Arial');
        setFontSize(data.font_size || 16);
      })
      .catch((err) => setError(err.message));

    // Çalışma saatlerini çek
    fetch(`http://localhost:5000/api/settings/working-hours/${restaurantId}/${selectedBranch}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Çalışma saatleri alınamadı.');
        return res.json();
      })
      .then((data) => {
        setWorkingHours(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [restaurantId, selectedBranch]);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    setNewLogo(file);
    setLogoUrl(URL.createObjectURL(file));
  };

  const handleMenuSettingsSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBranch) {
      setError('Lütfen bir şube seçin.');
      return;
    }
    try {
      setIsLoading(true);
      let logoUrlToSend = logoUrl;
      if (newLogo) {
        // Gerçek projede logo dosyasını bir dosya yükleme servisine (örn. AWS S3) yükleyip URL alırsınız.
        logoUrlToSend = '/path/to/uploaded-logo.png';
      }

      const res = await fetch(`http://localhost:5000/api/settings/menu/${restaurantId}/${selectedBranch}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ theme_color: themeColor, logo_url: logoUrlToSend, font_style: fontStyle, font_size: fontSize }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Ayarlar güncellenemedi.');
      setSuccessMessage('Menü ayarları güncellendi!');
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorkingHoursSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBranch || !dayOfWeek || !openTime || !closeTime) {
      setError('Lütfen tüm çalışma saati alanlarını doldurun.');
      return;
    }
    try {
      setIsLoading(true);
      const res = await fetch(`http://localhost:5000/api/settings/working-hours/${restaurantId}/${selectedBranch}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ day_of_week: dayOfWeek, open_time: openTime, close_time: closeTime }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Çalışma saati eklenemedi.');
      setWorkingHours([...workingHours, { id: Date.now(), day_of_week: dayOfWeek, open_time: openTime, close_time: closeTime }]);
      setDayOfWeek('');
      setOpenTime('');
      setCloseTime('');
      setSuccessMessage('Çalışma saati eklendi!');
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWorkingHours = async (id) => {
    if (!window.confirm('Bu çalışma saatini silmek istediğinizden emin misiniz?')) return;
    try {
      setIsLoading(true);
      const res = await fetch(`http://localhost:5000/api/settings/working-hours/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Çalışma saati silinemedi.');
      setWorkingHours(workingHours.filter((wh) => wh.id !== id));
      setSuccessMessage('Çalışma saati silindi!');
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center">Yükleniyor...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 text-red-600 p-4 rounded-md max-w-md mx-auto text-center">
        {error}
        <button
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          onClick={() => setError(null)}
        >
          Kapat
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      {successMessage && (
        <div className="bg-green-100 text-green-600 p-4 rounded-md mb-4 max-w-md text-center">
          {successMessage}
          <button
            className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => setSuccessMessage(null)}
          >
            Kapat
          </button>
        </div>
      )}
      <h3 className="text-xl font-semibold mb-4">Menü Ayarları (Şube: {selectedBranch})</h3>
      <form onSubmit={handleMenuSettingsSubmit} className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium">Tema Rengi</label>
          <input
            type="color"
            value={themeColor}
            onChange={(e) => setThemeColor(e.target.value)}
            className="w-20 h-10 border rounded-md"
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Restoran Logosu</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="p-2 border rounded-md"
            disabled={isLoading}
          />
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="mt-2 w-32 h-32 object-contain" />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium">Font Stili</label>
          <select
            value={fontStyle}
            onChange={(e) => setFontStyle(e.target.value)}
            className="w-full p-2 border rounded-md"
            disabled={isLoading}
          >
            <option value="Arial">Arial</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Roboto">Roboto</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Font Boyutu</label>
          <input
            type="number"
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            className="w-full p-2 border rounded-md"
            min="10"
            max="24"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          disabled={isLoading}
        >
          Kaydet
        </button>
      </form>

      <h3 className="text-xl font-semibold mb-4">Çalışma Saatleri</h3>
      <form onSubmit={handleWorkingHoursSubmit} className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium">Haftanın Günü</label>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value)}
            className="w-full p-2 border rounded-md"
            disabled={isLoading}
          >
            <option value="">Seçiniz</option>
            <option value="Pazartesi">Pazartesi</option>
            <option value="Salı">Salı</option>
            <option value="Çarşamba">Çarşamba</option>
            <option value="Perşembe">Perşembe</option>
            <option value="Cuma">Cuma</option>
            <option value="Cumartesi">Cumartesi</option>
            <option value="Pazar">Pazar</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Açılış Saati</label>
          <input
            type="time"
            value={openTime}
            onChange={(e) => setOpenTime(e.target.value)}
            className="w-full p-2 border rounded-md"
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Kapanış Saati</label>
          <input
            type="time"
            value={closeTime}
            onChange={(e) => setCloseTime(e.target.value)}
            className="w-full p-2 border rounded-md"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          disabled={isLoading}
        >
          Çalışma Saati Ekle
        </button>
      </form>

      <h4 className="text-lg font-semibold mb-4">Mevcut Çalışma Saatleri</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {workingHours.map((wh) => (
          <div key={wh.id} className="p-4 bg-white shadow-md rounded-md flex justify-between items-center">
            <div>
              <p><strong>Gün:</strong> {wh.day_of_week}</p>
              <p><strong>Açılış:</strong> {wh.open_time}</p>
              <p><strong>Kapanış:</strong> {wh.close_time}</p>
            </div>
            <button
              onClick={() => handleDeleteWorkingHours(wh.id)}
              className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
              disabled={isLoading}
            >
              Sil
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MenuSettings;
