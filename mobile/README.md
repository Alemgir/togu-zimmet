# TOGÜ Zimmet · Mobil uygulama

Web sistemiyle aynı API'ye bağlanan Flutter uygulaması. Amaç sahada kullanmak: cihazın QR kodunu okut, bilgilerine bak, yerinde teslim et, geri al ya da arıza bildir.

Okulun mobil için istediği dört madde ve karşılıkları:

| İster | Uygulamada |
|---|---|
| Kullanıcı adı/şifre ile güvenli giriş | JWT. Token `flutter_secure_storage` ile saklanıyor (iOS Keychain / Android Keystore). Oturum geçersizse otomatik çıkış yapılıyor. |
| QR okuma ve cihaz tanıma | `mobile_scanner` ile kamera. Garanti, alım tarihi, kimde olduğu, konum ve geçmiş gösteriliyor. Kamera yoksa ya da izin verilmediyse kodu elle girmek için bir ekran var. |
| Personele teslim, geri kabul, arıza bildirme | Cihaz detayında, kullanıcının rolüne ve cihazın durumuna göre görünen butonlar. |
| Kişisel zimmet ekranı | Ana sayfada "Üzerimdeki cihazlar", her birinin ayrıntı sayfası. |

Ayrıca bildirimler, yönetici ve birim sorumluları için envanter arama/filtre, şifre değiştirme, açık/koyu tema ve ayarlanabilir sunucu adresi var.

## Yetkiler

Kurallar webdekiyle aynı, sunucu denetliyor. Uygulama sadece yetkisiz butonları göstermiyor.

| İşlem | Yönetici | Birim sorumlusu | Personel |
|---|:-:|:-:|:-:|
| QR okutup cihaz bilgisini görme | evet | evet | evet |
| Personele teslim, geri kabul | evet | hayır | hayır |
| Arıza bildirme | her cihaz | biriminin cihazı | kendi cihazı |
| Envanter sekmesi | evet | evet (kendi birimi) | yok |

## Çalıştırma

Flutter 3.38 ve üstü gerekiyor. Android için Android SDK, iOS için Xcode lazım.

```bash
cd mobile
flutter pub get
flutter run
```

Varsayılan olarak canlı demo sunucusuna bağlanır. Başka bir sunucu için:

```bash
# iOS simülatörü + bilgisayarda çalışan Docker
flutter run --dart-define=API_URL=http://localhost:3000/api

# Android emülatörü + bilgisayarda çalışan Docker
flutter run --dart-define=API_URL=http://10.0.2.2:3000/api
```

Adres uygulama içinden de değiştirilebiliyor (giriş ekranının altındaki "Sunucu" ya da Profil > Sunucu adresi). Gerçek telefonda bilgisayarın yerel ağ adresi girilmeli, örneğin `http://192.168.1.20:3000/api`.

Demo hesap butonlarını gizlemek için `--dart-define=DEMO_LOGIN=false`.

QR kodların içindeki adres sunucudaki `APP_URL` ayarından geliyor. Uygulama hem tam bağlantıyı (`.../scan/<token>`) hem de sadece token'ı tanıyor.

## Tarayıcıda deneme

Uygulamanın web derlemesi ana sitenin içinde `/mobil/` adresinde duruyor (`frontend/public/mobil`). Docker ile `http://localhost:8080/mobil/`, canlı demoda ise sitenin `/mobil/` yolu. Geniş ekranda telefon çerçevesinin içinde, telefonda tam ekran açılıyor. Kamera izni tarayıcıdan isteniyor.

Kodda değişiklik yaparsanız önizlemeyi şu komutla yeniden derleyin:

```bash
mobile/tool/build_web.sh
```

## Testler

```bash
flutter test    # birim testleri (QR bağlantısı ayrıştırma, biçimlendirme)
```

Simülatörde gerçek API'ye karşı çalışan entegrasyon testleri de var (yerel Docker ayakta olmalı):

```bash
flutter drive --driver=test_driver/driver.dart \
  --target=integration_test/app_test.dart -d <simülatör-id> \
  --dart-define=API_URL=http://localhost:3000/api
```

`app_test.dart` yönetici akışını (giriş, envanter, teslim etme, geri kabul), `staff_test.dart` personel akışını (yetkiler, arıza sayfası, bildirimler, koyu tema), `scanner_test.dart` tarayıcı ekranını dener. Ekran görüntüsü almak için `tool/shots.sh` testle birlikte arka planda çalıştırılıyor.

## Klasörler

```
lib/
  core/      API istemcisi (Dio), modeller, tema, logo
  state/     Riverpod: oturum, veri sağlayıcıları, tema
  screens/   giriş, ana sayfa, envanter, cihaz detayı, işlem sayfaları, tarayıcı, bildirimler, profil
  widgets/   ortak bileşenler
```
