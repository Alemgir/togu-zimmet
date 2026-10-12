# TOGÜ Zimmet · Mobil uygulama (Flutter)

Web sistemiyle aynı API'ye bağlanan saha uygulaması: cihazın QR kodunu okut, bilgilerini gör, yerinde teslim et / geri kabul et / arıza bildir.

| Okulun mobil isteri | Uygulamada |
|---|---|
| Kullanıcı adı/şifre ile güvenli giriş | JWT, token `flutter_secure_storage` (iOS Keychain / Android Keystore) içinde; 401'de otomatik çıkış |
| QR okuma ve cihaz tanıma | `mobile_scanner` ile kamera; garanti, alım tarihi, **kimde olduğu**, konum, geçmiş. Simülatör/izin yoksa "kodu elle gir" yedeği |
| Personele teslim et · geri kabul · arıza bildir | Cihaz detayında, **role ve cihaz durumuna göre** görünen işlem butonları |
| Kişisel zimmet ekranı | Ana sayfada "Üzerimdeki cihazlar" ve her cihaz için ayrıntı sayfası |

Ek olarak: bildirimler (okunmamış rozeti), yönetici/birim sorumlusu için envanter arama + durum filtresi ve özet sayaçlar, şifre değiştirme, açık/koyu/sistem teması, ayarlanabilir sunucu adresi.

## Yetkiler (web ile aynı kurallar, sunucu zorlar)

| İşlem | Yönetici | Birim sorumlusu | Personel |
|---|:-:|:-:|:-:|
| QR okut, cihaz bilgisini gör | ✅ | ✅ | ✅ |
| Personele teslim et / geri kabul et | ✅ | – | – |
| Arıza bildir | her cihaz | biriminin cihazı | kendi cihazı |
| Envanter sekmesi | ✅ | ✅ (kendi birimi) | – |

## Çalıştırma

Gereksinim: Flutter 3.38+ (Dart 3.10+). Android için Android SDK, iOS için Xcode.

```bash
cd mobile
flutter pub get
flutter run                                   # varsayılan: canlı demo sunucusu
```

Sunucu adresi (API) üç şekilde verilebilir:

```bash
# 1) Derleme zamanı
flutter run --dart-define=API_URL=http://localhost:3000/api          # iOS simülatör + yerel Docker
flutter run --dart-define=API_URL=http://10.0.2.2:3000/api           # Android emülatör + yerel Docker
# 2) Uygulama içinden: giriş ekranı altındaki "Sunucu" ya da Profil → Sunucu adresi
#    (gerçek telefonda bilgisayarın ağ adresi: http://192.168.x.x:3000/api)
```

Demo hesap butonlarını gizlemek için: `--dart-define=DEMO_LOGIN=false`.

> Gerçek cihazda QR okutmak için sunucudaki `APP_URL`, ürettiği QR kodların işaret ettiği adrestir; uygulama hem tam bağlantıyı (`…/scan/<token>`) hem de çıplak token'ı tanır.

## Testler

```bash
flutter test                                                       # birim testleri (QR ayrıştırma, biçimleme)

# Uçtan uca (simülatörde gerçek API ile; yerel docker stack ayakta olmalı)
flutter drive --driver=test_driver/driver.dart \
  --target=integration_test/app_test.dart -d <simulator-id> \
  --dart-define=API_URL=http://localhost:3000/api                  # yönetici: giriş → envanter → teslim → geri kabul
flutter drive --driver=test_driver/driver.dart \
  --target=integration_test/staff_test.dart -d <simulator-id> \
  --dart-define=API_URL=http://localhost:3000/api                  # personel: yetkiler, arıza, bildirim, koyu tema, QR
```

## Yapı

```
lib/
  core/      api (Dio), modeller, tema (web ile aynı tasarım belirteçleri), resmî logo
  state/     Riverpod: oturum, veri sağlayıcıları, tema
  screens/   giriş · ana sayfa · envanter · cihaz detayı · işlem sayfaları · tarayıcı · bildirim · profil
  widgets/   ortak bileşenler (kart, düğme, toast, iskelet yükleme, logo animasyonu)
```

Teknolojiler: Flutter · Riverpod · go_router · Dio · mobile_scanner · flutter_secure_storage.
