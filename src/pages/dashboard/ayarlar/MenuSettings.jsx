import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const MenuSettings = () => {
  const { restaurantid } = useParams();
  const [themeColor, setThemeColor] = useState('#ffffff');
  const [logoUrl, setLogoUrl] = useState('');
  const [newLogo, setNewLogo] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:5000/api/settings/menu/${restaurantid}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch settings');
        return res.json();
      })
      .then((data) => {
        setThemeColor(data.theme_color || '#ffffff');
        setLogoUrl(data.logo_url || '');
      })
      .catch((err) => alert('Ayarlar alınamadı: ' + err.message));
  }, [restaurantid]);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    setNewLogo(file);
    setLogoUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let logoUrlToSend = logoUrl;
      if (newLogo) {
        // Gerçek projede logo dosyasını bir dosya yükleme servisine (örn. AWS S3) yükleyip URL alırsınız.
        // Bu örnekte, logo URL'sini simüle ediyoruz.
        logoUrlToSend = '/path/to/uploaded-logo.png';
      }

      const res = await fetch(`http://localhost:5000/api/settings/menu/${restaurantid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ theme_color: themeColor, logo_url: logoUrlToSend }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      alert('Ayarlar güncellendi!');
    } catch (err) {
      alert('Ayarlar güncellenemedi: ' + err.message);
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-xl font-semibold mb-4">Menü Ayarları</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Tema Rengi</label>
          <input
            type="color"
            value={themeColor}
            onChange={(e) => setThemeColor(e.target.value)}
            className="w-20 h-10 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Restoran Logosu</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="p-2 border rounded-md"
          />
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="mt-2 w-32 h-32 object-contain" />
          )}
        </div>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          Kaydet
        </button>
      </form>
    </div>
  );
};

export default MenuSettings;
