import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

// 🌍 Ortam türü
const isProduction = process.env.NODE_ENV === 'production';

// 🧩 Ortam değişkenlerini kontrol et
const requiredEnvVars = ['DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_NAME'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`❌ Eksik .env değişkenleri: ${missingVars.join(', ')}`);
  process.exit(1);
}

// 💾 MSSQL yapılandırması
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: !isProduction, // Sadece development'ta sertifika doğrulamasını kapat
    enableArithAbort: true,
  },
  pool: {
    max: 20,
    min: 1,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
  },
};

// 🔁 Exponential Backoff Retry ile bağlantı fonksiyonu
async function connectWithRetry(retryCount = 0) {
  const pool = new sql.ConnectionPool(dbConfig);

  try {
    await pool.connect();
    console.log('✅ MSSQL bağlantısı başarılı');

    // Bağlantıyı test et
    await pool.request().query('SELECT 1 AS test');
    console.log('✅ Veritabanı bağlantısı doğrulandı');

    // Pool hata olayını dinle
    pool.on('error', err => {
      console.error('💥 Veritabanı Havuzu Hatası:', err.message);
      console.log('🔁 Yeniden bağlanma deneniyor...');
      connectWithRetry(0); // Sıfırdan tekrar başlat
    });

    return pool;
  } catch (err) {
    const delay = Math.min(5000 * Math.pow(2, retryCount), 60000); // Maks 60 sn bekle
    console.error(`❌ Veritabanı bağlantı hatası (deneme ${retryCount + 1}):`, err.message);
    console.log(`⏳ ${delay / 1000} saniye sonra tekrar deneniyor...`);

    await new Promise(res => setTimeout(res, delay));
    return connectWithRetry(retryCount + 1); // Recursive retry
  }
}

// 📦 Pool Promise (her yerde kullanılabilir)
const poolPromise = connectWithRetry();

// 🔒 Kapanışta bağlantıyı temizle
process.on('SIGINT', async () => {
  try {
    const pool = await poolPromise;
    await pool.close();
    console.log('🧹 Connection pool kapatıldı');
    process.exit(0);
  } catch (err) {
    console.error('❌ Connection pool kapatılamadı:', err.message);
    process.exit(1);
  }
});

export { sql, poolPromise };
