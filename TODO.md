# TODO: Veritabanı Sütunlarını Doldurma Görevleri

## 1. UserAuditLog Tablosu
- [x] authController.js'de kayıt sırasında "USER_REGISTERED" logu ekle
- [x] paymentsController.js'de ödeme sırasında "PAYMENT_INITIATED" logu ekle
- [x] subscriptionController.js'de callback'de "PAYMENT_COMPLETED" logu ekle
- [x] subscriptionController.js'de createSubscription'da "SUBSCRIPTION_INITIATED" logu ekle

## 2. UserPackages Tablosu
- [x] authController.js'de UserPackages eklerken start_date ve end_date'yi doldur (zaten var ama emin ol)
- [x] Status için is_trial_active kullan (1=trial, 0=active)

## 3. Payments Tablosu
- [x] authController.js'de Payments eklerken transaction_id (iyzico token) ve branch_id (user.branch_id) ekle
- [x] paymentsController.js'de createPayment'de transaction_id ve branch_id ekle
- [x] subscriptionController.js'de createSubscription'da branch_id ekle

## 4. Users Tablosu
- [x] authController.js'de kayıt sırasında updatedAt=createdAt, created_by=null, branch_count=totalBranches ekle
- [x] authController.js'de login sırasında last_login_at güncelle
- [x] deactivated_at için şimdilik null bırak (gerektiğinde eklenir)

## 5. Test Etme
- [ ] Kayıt işlemi test et
- [ ] Ödeme işlemi test et
- [ ] Login işlemi test et
