# TODO: Iyzico SDK Entegrasyonu ve Güncellemeler

## Tasks
- [x] src/services/iyzicoService.js'i iyzipay SDK'sı ile yeniden yaz
- [x] createIyzicoPayment fonksiyonunu SDK ile implement et
- [x] verifyPayment fonksiyonunu SDK ile implement et
- [x] Hata yönetimini ve loglamayı geliştir
- [x] Payments tablosuna iyzico_token ve payment_url sütunlarını kullan
- [x] Controllers'ları SDK yanıtlarına göre güncelle
- [x] Yıllık abonelik modeline geçiş (30 gün trial + ₺144.000 yıllık)
- [x] Trial sonrası ödeme ile aktifleşme mantığı
- [x] 12 taksit (vade farkı olmadan yıllık)
- [x] Sandbox testlerini çalıştır ve doğrula
- [x] Veritabanı işlemlerini yeni şemaya göre güncelle

## Notes
- iyzipay SDK'sı package.json'da mevcut (v2.0.64)
- Payments tablosunda iyzico_token ve payment_url sütunları eklendi
- Mevcut manuel fetch implementasyonu SDK ile değiştirilecek
- Hata mesajları Türkçe olacak
- Veritabanı şeması güncel: UserPackages, UserAuditLog, Users, Payments tablolarında yeni sütunlar var
