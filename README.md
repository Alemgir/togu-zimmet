# Zimmet · IT Demirbaş ve Zimmet Yönetim Sistemi

TOGÜ Yapay Zeka ve Dijital Dönüşüm Koordinatörlüğü aday mühendis değerlendirme projesi.

Kurumdaki bilgisayar, sunucu, monitör gibi donanımları envantere kaydeden, durumlarını takip eden ve personele zimmetleyen bir web uygulaması. Her cihaza otomatik bir QR kod üretiliyor. Zimmet, iade ve arıza işlemleri birbirini tutarlı tutacak şekilde çalışıyor (örneğin arıza bildirilen cihaz zimmetten kendiliğinden düşüyor). Web uygulamasına ek olarak aynı API'yi kullanan bir Flutter mobil uygulaması da var.

- **Canlı demo (web):** https://frontend-production-819d.up.railway.app
- **Canlı demo (mobil, tarayıcıda):** https://frontend-production-819d.up.railway.app/mobil/

Canlı adresler geçici bir yayın. Asıl teslim biçimi aşağıdaki Docker kurulumu. Demo hesaplar giriş ekranındaki butonlarla da doldurulabiliyor.

![Panel](docs/screenshots/02-panel.png)

## İçindekiler
- [Teknolojiler](#teknolojiler)
- [Kurulum](#kurulum)
- [Özellikler](#özellikler)
- [Ekran görüntüleri](#ekran-görüntüleri)
- [Mobil uygulama](#mobil-uygulama)
- [Otomatik tutarlılık kuralları](#otomatik-tutarlılık-kuralları)
- [Roller](#roller)
- [Testler](#testler)
- [Ortam değişkenleri](#ortam-değişkenleri)
- [Yerel geliştirme](#yerel-geliştirme)
- [Proje yapısı](#proje-yapısı)
- [Tasarım](#tasarım)

## Teknolojiler

| Katman | Kullanılanlar |
|---|---|
| Backend | Node.js, Fastify 5, TypeScript, Prisma 6, PostgreSQL 16, JWT, Zod, Swagger |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4, TanStack Query, Radix UI, Framer Motion, Recharts |
| Mobil | Flutter 3, Riverpod, go_router, Dio, mobile_scanner |
| Altyapı | Docker, docker-compose, nginx |
| Test | Vitest, Playwright, axe-core, Flutter test |

## Kurulum

Gereken tek şey Docker ve Docker Compose.

```bash
git clone https://github.com/Alemgir/togu-zimmet.git
cd togu-zimmet
docker compose up --build
```

İlk açılışta migration'lar uygulanıyor, yönetici hesabı ve örnek veriler oluşturuluyor. Birkaç dakika sürebilir.

| Adres | |
|---|---|
| http://localhost:8080 | Web uygulaması |
| http://localhost:8080/mobil/ | Mobil uygulamanın tarayıcı önizlemesi |
| http://localhost:8080/docs | Swagger (API dokümantasyonu) |

Demo hesaplar:

| Rol | E-posta | Şifre |
|---|---|---|
| Yönetici | `admin@gop.edu.tr` | `Admin123!` |
| Birim sorumlusu | `mehmet.kaya@gop.edu.tr` | `Demo1234` |
| Personel | `ayse.yilmaz@gop.edu.tr` | `Demo1234` |

Sıfırdan başlamak için: `docker compose down -v && docker compose up --build`

Portlar doluysa `.env` dosyasında `WEB_PORT`, `API_PORT` ve `DB_PORT` değiştirilebilir (aşağıda).

## Özellikler

**Envanter ve zimmet**
- Cihaz ekleme, silme, güncelleme (marka, model, seri no, alım tarihi, garanti, konum, not). Demirbaş numarası otomatik veriliyor (`TOGU-000001`). Cihaz türü listeden seçilebiliyor ya da serbest yazılabiliyor.
- Durum, tür, marka ve birime göre filtre, arama, sayfalama. Filtreler adres çubuğunda tutulduğu için link olarak paylaşılabiliyor.
- Zimmetleme, iade alma ve başka personele devretme. İsteğe bağlı planlı iade tarihi var; tarihi yaklaşan veya geçen zimmetler için hatırlatma gidiyor.
- Bütün zimmet geçmişi ve cihazın olay kaydı (kim, ne zaman, ne yaptı) tutuluyor.
- Zimmet teslim tutanağı ve kişi başına zimmet föyü yazdırılabiliyor.
- Her cihaz için QR kod (PNG olarak indirilebilir), toplu etiket yazdırma sayfası. QR içindeki bağlantı (`/scan/:token`) telefon kamerasıyla da açılıyor.
- Birden çok cihazda toplu durum değiştirme ve zimmetleme.

**Arıza ve sayım**
- Arıza kayıtları kanban panosunda (Açık, İnceleniyor, Çözüldü). Personel kendi cihazı için arıza bildirebiliyor.
- Sayım modu: sayım oturumu açılıyor, cihazlar QR ile okutuluyor, bulunan ve bulunamayan cihazlar canlı görünüyor, sonunda CSV alınabiliyor.

**Panel, rapor, bildirim**
- Panelde toplam, zimmetli, boşta ve arızalı sayıları, dikkat gerektirenler (arıza, geciken iade, biten garanti), birim ve durum dağılımı, son hareketler var. Cihaz türü kartına tıklayınca diğer grafikler o türe göre süzülüyor.
- Raporlar sayfası ve cihaz, zimmet, arıza CSV dışa aktarması.
- Uygulama içi bildirimler (arıza, iade, garanti vb.).

**Kullanım**
- Ctrl+K / ⌘K ile komut paleti, kamerayla QR tarama, açık/koyu tema, telefon ekranına uyumlu arayüz.
- JWT ile oturum. Şifre değişince veya kullanıcı pasife alınınca eski oturumlar geçersiz oluyor. Girişte hız sınırı ve `helmet` başlıkları var.

## Ekran görüntüleri

| | |
|---|---|
| ![Giriş](docs/screenshots/01-giris.png) | ![Envanter](docs/screenshots/03-envanter.png) |
| Giriş | Envanter |
| ![Cihaz detay](docs/screenshots/04-cihaz-detay.png) | ![Zimmetler](docs/screenshots/05-zimmetler.png) |
| Cihaz detayı | Zimmetler |
| ![Arızalar](docs/screenshots/06-arizalar.png) | ![Sayım](docs/screenshots/07-sayim.png) |
| Arıza panosu | Sayım |
| ![Sayım detay](docs/screenshots/08-sayim-detay.png) | ![Raporlar](docs/screenshots/09-raporlar.png) |
| Sayım detayı | Raporlar |
| ![Kullanıcılar](docs/screenshots/10-kullanicilar.png) | ![Etiketler](docs/screenshots/11-etiketler.png) |
| Kullanıcılar | QR etiketleri |
| ![Komut paleti](docs/screenshots/12-komut-paleti.png) | ![Koyu tema](docs/screenshots/13-koyu-tema.png) |
| Komut paleti | Koyu tema |

Web arayüzünün telefon görünümü:

<p>
  <img src="docs/screenshots/14-mobil-envanter.png" width="240" alt="Telefonda envanter" />
  <img src="docs/screenshots/15-mobil-personel.png" width="240" alt="Telefonda personel ekranı" />
</p>

## Mobil uygulama

`mobile/` klasöründe, aynı API'yi kullanan bir Flutter uygulaması var. Okulun istediği dört şeyi karşılıyor:

- **Giriş:** e-posta ve şifreyle. Token cihazın güvenli deposunda (iOS Keychain / Android Keystore) tutuluyor.
- **QR okutma:** Kamerayla okutunca cihazın garantisi, alım tarihi, kimde olduğu ve geçmişi görünüyor. Kamera yoksa kodu elle yazmak mümkün.
- **Sahada işlem:** Personele teslim et, geri kabul et, arıza bildir. Hangi butonun görüneceği kullanıcının rolüne ve cihazın durumuna göre değişiyor, yetkiyi yine sunucu denetliyor.
- **Kişisel zimmet ekranı:** Kullanıcının üzerindeki cihazlar ve her birinin ayrıntısı.

Bunlara ek olarak bildirimler, yönetici ve birim sorumluları için envanter arama, şifre değiştirme, koyu tema ve ayarlanabilir sunucu adresi var.

Uygulamayı denemenin üç yolu var:
1. Tarayıcıda: canlı demo ya da yerelde `http://localhost:8080/mobil/` (Docker ile birlikte geliyor).
2. Simülatör veya telefon: `cd mobile && flutter run` ([mobile/README.md](mobile/README.md)).
3. Testler: `cd mobile && flutter test`.

Not: Android tarafını bu ortamda derleyip deneyemedim (Android SDK kurulu değildi). iOS simülatöründe çalıştırıp test ettim.

| ![Giriş](docs/screenshots/mobil/01-giris.png) | ![Ana sayfa](docs/screenshots/mobil/02-ana-yonetici.png) | ![Cihaz detayı](docs/screenshots/mobil/03-cihaz-detay.png) | ![Teslim et](docs/screenshots/mobil/04-teslim-et.png) |
|:-:|:-:|:-:|:-:|
| Giriş | Ana sayfa (yönetici) | Cihaz detayı | Personele teslim |

| ![Geri kabul](docs/screenshots/mobil/05-geri-kabul.png) | ![Personel](docs/screenshots/mobil/06-ana-personel.png) | ![Arıza](docs/screenshots/mobil/07-ariza-bildir.png) | ![Koyu](docs/screenshots/mobil/09-koyu-tema.png) |
|:-:|:-:|:-:|:-:|
| Geri kabul | Ana sayfa (personel) | Arıza bildirimi | Koyu tema |

## Otomatik tutarlılık kuralları

Zimmet ve durum değişiklikleri tek bir veritabanı transaction'ında ve cihaz satırı kilitlenerek yapılıyor:

| Olay | Sonuç |
|---|---|
| Zimmetli cihaz arızalı yapılır ya da personel arıza bildirir | Zimmet düşer, cihaz arızalı olur |
| Zimmetli cihaz hizmet dışı bırakılır | Zimmet düşer |
| İade alınır (sağlam) | Zimmet kapanır, cihaz depoya döner |
| İade alınır (arızalı) | Zimmet kapanır, cihaz arızalı olur |
| Başkasında olan cihaz yeni kişiye zimmetlenir | Eski zimmet düşer (devir) |
| Kullanıcı pasife alınır ya da silinir | Üzerindeki cihazlar depoya döner |
| Zimmet geçmişi olan kullanıcı silinmek istenir | Kayıt silinmez, pasife alınır |
| Arızalı ya da hizmet dışı cihaza zimmet verilmek istenir | Reddedilir |
| Aynı cihaza aynı anda iki zimmet isteği gelir | Yalnızca biri başarılı olur |

Son kural için uygulama koduna güvenmedik: `Assignment` tablosunda kısmi unique index (`WHERE "returnedAt" IS NULL`) var, yani bir cihazın aynı anda tek aktif zimmeti olabilmesi veritabanı seviyesinde garanti.

## Roller

| Rol | Yetkisi |
|---|---|
| Yönetici | Her şey: envanter, zimmet, arıza, sayım, rapor, kullanıcı yönetimi. Son aktif yönetici silinemiyor. |
| Birim sorumlusu | Yalnızca kendi biriminin cihaz, zimmet ve arızalarını görür ve yönetir. |
| Personel | Kendi zimmetlerini görür, arıza bildirir, föyünü açar. |

Yetki kontrolleri sunucuda yapılıyor ve testlerle doğrulanıyor.

## Testler

```bash
docker compose up -d db

cd backend  && npm test             # 180 entegrasyon testi (ayrı zimmet_test veritabanı)
cd frontend && npm test             # 98 bileşen/birim testi
cd e2e      && npx playwright test  # 151 uçtan uca test (masaüstü + mobil görünüm, erişilebilirlik dahil)
cd mobile   && flutter test         # mobil birim testleri
```

Backend testleri gerçek PostgreSQL'e karşı çalışıyor. Yetkilendirmeyi, doğrulamayı, filtreleri, otomatik zimmet düşme senaryolarını, eşzamanlı zimmet yarışını ve veritabanı kısıtlarını kapsıyor. Uçtan uca testler ayrı bir veritabanı (`zimmet_e2e`) ve portlar kullanıyor, geliştirme verisine dokunmuyor.

Mobil uygulamanın simülatörde gerçek API'ye karşı çalışan entegrasyon testleri de `mobile/integration_test/` altında.

## Ortam değişkenleri

Docker için kök dizindeki `.env.example` dosyasını `.env` olarak kopyalayıp düzenleyebilirsiniz. Hiçbiri zorunlu değil, varsayılanlarla çalışıyor.

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `zimmet` | Veritabanı bilgileri |
| `JWT_SECRET` | örnek değer | Yayında mutlaka değiştirilmeli, en az 32 karakter |
| `JWT_EXPIRES_IN` | `8h` | Oturum süresi |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@gop.edu.tr` / `Admin123!` | İlk yönetici hesabı |
| `SEED_DEMO` | `true` | İlk açılışta örnek kullanıcı ve cihazları yükler |
| `VITE_DEMO_LOGIN` | `true` | Giriş ekranında demo hesap butonlarını gösterir |
| `WEB_PORT` / `API_PORT` / `DB_PORT` | `8080` / `3000` / `5440` | Dışarı açılan portlar |
| `APP_URL` | `http://localhost:8080` | QR kodların işaret ettiği adres. Telefonla okutulunca bu adres açılır, yayında gerçek alan adı olmalı |
| `CORS_ORIGIN` | `http://localhost:8080` | İzin verilen web adresi (virgülle birden fazla yazılabilir) |

Yerel geliştirmede backend ayarları `backend/.env` içinde (şablon: `backend/.env.example`).

## Yerel geliştirme

```bash
docker compose up -d db                    # sadece PostgreSQL (localhost:5440)

cd backend
npm install
cp .env.example .env
npx prisma migrate deploy
npm run seed -- --demo                     # yönetici + örnek veri
npm run dev                                # http://localhost:3000

cd ../frontend                             # ayrı terminalde
npm install
npm run dev                                # http://localhost:5173 (/api isteklerini 3000'e yönlendirir)
```

Mobil uygulama için: `cd mobile && flutter pub get && flutter run`. Sunucu adresi ve Android/iOS ayrıntıları `mobile/README.md` içinde. Mobil web önizlemesini yeniden derlemek için `mobile/tool/build_web.sh`.

## Proje yapısı

```
backend/
  prisma/            şema, migration'lar (kısmi unique index dahil), seed
  src/
    routes/          auth, users, devices, assignments, faults, counts, dashboard, notifications, exports
    services/        zimmet/iade/durum kuralları, arıza, sayım, rapor, bildirim, olay kaydı
    plugins/         JWT ve rol kontrolü
  test/              entegrasyon testleri
frontend/
  src/
    pages/           Dashboard, Devices, DeviceDetail, Assignments, Faults, Counts, Reports, Users...
    components/      ui (ortak bileşenler), layout, charts, devices, brand
    api/hooks.ts     TanStack Query hook'ları
  public/mobil/      mobil uygulamanın derlenmiş web önizlemesi
mobile/              Flutter uygulaması
e2e/                 Playwright testleri
docker-compose.yml   db + backend + frontend (nginx)
```

API uç noktaları `/api` altında ve Bearer JWT istiyor. Şemalar için `/docs` (Swagger). Başlıca gruplar: auth, kullanıcılar, envanter (QR ve toplu etiket dahil), zimmet, arızalar, sayım, dashboard/raporlar, CSV dışa aktarma, bildirimler.

## Tasarım

Arayüz Tokat Gaziosmanpaşa Üniversitesi Kurumsal Kimlik Kılavuzu'na göre yapıldı. Renkler kılavuzdaki logo renkleri: mor `#462B55`, firuze `#0098C0`, bordo `#910C32`. Kenar çubuğu için üniversite sitelerinin alt bilgisindeki kömür tonu (`#21252B`) kullanıldı. Firuze açık zeminde yazı için yeterince kontrastlı olmadığından ana renk mor, firuze ise vurgu ve odak rengi. Durum renkleri AA kontrast oranını sağlıyor.

Resmî logo kılavuzdaki kurallara uygun kullanılıyor, renk ve oranı değiştirilmedi. Koyu zeminde orijinal renkleri bozulmasın diye beyaz bir plaka üzerinde duruyor.

Logo ve kurumsal kimlik öğeleri Tokat Gaziosmanpaşa Üniversitesi'ne ait, burada yalnızca bu başvuru projesi için kullanıldı.
