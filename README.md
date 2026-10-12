# Zimmet · IT Demirbaş ve Zimmet Yönetim Sistemi

TOGÜ Yapay Zeka ve Dijital Dönüşüm Koordinatörlüğü **Aday Mühendis Değerlendirme Projesi**.

Kurumdaki bilgisayar, sunucu, monitör gibi donanımların envantere kaydedildiği, durumlarının takip edildiği ve personele **zimmetlendiği** full-stack bir web uygulaması. Her cihaza otomatik benzersiz bir **QR kod** üretilir; zimmet, iade, arıza ve sayım süreçleri **otomatik tutarlılık kurallarıyla** yönetilir.

**Canlı demo:** https://frontend-production-819d.up.railway.app
*(Geçici bir yayındır; giriş ekranındaki "Yönetici" ve "Personel" butonlarıyla demo hesapla girebilirsiniz. Asıl teslim biçimi aşağıdaki Docker kurulumudur.)*

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Fastify_5-000000?logo=fastify&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![Tests](https://img.shields.io/badge/test-180_backend_·_98_frontend_·_150%2B_e2e-17694a)

![Panel](docs/screenshots/02-panel.png)

## İçindekiler
- [Teknolojiler](#teknolojiler)
- [Hızlı başlangıç (tek komut)](#hızlı-başlangıç-tek-komut)
- [Özellikler](#özellikler)
- [Ekran görüntüleri](#ekran-görüntüleri)
- [Mobil uygulama](#mobil-uygulama-flutter)
- [Otomatik tutarlılık kuralları](#otomatik-tutarlılık-kuralları)
- [Roller ve yetkiler](#roller-ve-yetkiler)
- [Testler](#testler)
- [Ortam değişkenleri](#ortam-değişkenleri)
- [Yerel geliştirme](#yerel-geliştirme)
- [Mimari](#mimari)
- [Kurumsal kimlik ve tasarım](#kurumsal-kimlik-ve-tasarım)
- [Yol haritası](#yol-haritası)

## Teknolojiler

| Katman | Teknolojiler |
|---|---|
| **Backend** | Node.js · Fastify 5 · TypeScript · Prisma 6 · PostgreSQL 16 · JWT · Zod · Swagger/OpenAPI |
| **Frontend** | React 19 · Vite · TypeScript · Tailwind CSS 4 · TanStack Query · Radix UI · Framer Motion · Recharts |
| **Mobil** | Flutter 3 · Riverpod · go_router · Dio · mobile_scanner (QR) · flutter_secure_storage |
| **Altyapı** | Docker · docker-compose · nginx |
| **Test** | Vitest (backend entegrasyon + frontend bileşen) · Playwright (uçtan uca) · axe-core (erişilebilirlik) |

## Hızlı başlangıç (tek komut)

Gereksinim: Docker ve Docker Compose.

```bash
git clone https://github.com/Alemgir/togu-zimmet.git
cd togu-zimmet
docker compose up --build
```

İlk açılışta veritabanı migration'ları uygulanır, yönetici hesabı ve örnek veriler oluşturulur.

| Adres | Açıklama |
|---|---|
| http://localhost:8080 | Uygulama |
| http://localhost:8080/docs | Swagger / OpenAPI dokümantasyonu |

**Demo hesaplar** (giriş ekranındaki butonlarla da doldurulabilir)

| Rol | E-posta | Şifre |
|---|---|---|
| Yönetici | `admin@gop.edu.tr` | `Admin123!` |
| Birim sorumlusu | `mehmet.kaya@gop.edu.tr` | `Demo1234` |
| Personel | `ayse.yilmaz@gop.edu.tr` | `Demo1234` |

> Temiz bir başlangıç için: `docker compose down -v && docker compose up --build`

## Özellikler

### Envanter ve zimmet
- **Envanter:** Cihaz ekle/sil/güncelle (marka, model, seri no, alım tarihi, garanti, konum, not). Otomatik **demirbaş no** (`TOGU-000001`), serbest **özel cihaz türleri**, durum/tür/marka/birim filtreleri ve arama. Filtreler URL'de saklanır (paylaşılabilir).
- **Zimmet:** Atama, iade alma, devretme; **planlı iade tarihi**, süresi yaklaşan/geçen zimmetler için hatırlatma ve süre uzatma. Tüm geçmiş kayıtlarda ve cihaz zaman çizelgesinde (denetim izi) tutulur.
- **Tutanak ve föy:** Zimmet teslim/iade **tutanağı** ve kişi başına **zimmet föyü**, yazdırılabilir.
- **QR etiketleri:** Her cihaz için QR (PNG indir), toplu **etiket yazdırma** sayfası. QR bağlantısı (`/scan/:token`) telefonun kamerasıyla da çalışır.
- **Toplu işlemler:** Birden çok cihaz üzerinde durum değiştirme ve zimmetleme.

### Arıza ve sayım
- **Arıza kayıtları:** Kanban panosu (Açık → İnceleniyor → Çözüldü). Personel kendi cihazı için arıza bildirir; zimmet otomatik düşer.
- **Sayım modu:** Sayım oturumu açılır, cihazlar QR ile okutulur, beklenen/bulunan/bulunamayan listesi canlı izlenir, sayım kapatılınca rapor dışa aktarılır.

### Panel, rapor ve bildirimler
- **Komuta merkezi (panel):** Toplam / zimmetli / boşta / arızalı sayıları ve eğilim çizgileri, **dikkat gerektirenler** (arıza, gecikme, garanti, hareketsizlik), durum ve birim dağılımı, canlı hareket akışı. Cihaz türü kartlarına tıklayınca diğer grafikler o türe göre süzülür.
- **Raporlar:** Birim ve duruma göre dağılım grafikleri, **CSV dışa aktarma** (cihaz, zimmet, arıza).
- **Bildirimler:** Uygulama içi bildirim zili (arıza, iade, garanti vb.).

### Kullanıcı deneyimi
- **⌘K / Ctrl+K komut paleti:** cihaz, kişi veya sayfaya anında git.
- **QR tarama (web):** kameradan cihaz etiketini okut.
- **Mobil uyumlu** arayüz, alt gezinme çubuğu ve personel ekranı.
- **Açık / koyu / sistem teması**, klavye ile kullanım, erişilebilirlik testleri (axe-core).
- **Giriş güvenliği:** JWT, şifre değişince/kullanıcı pasife alınınca eski oturumların geçersizleşmesi, girişte hız sınırı, `helmet` güvenlik başlıkları.

## Ekran görüntüleri

| | |
|---|---|
| ![Giriş](docs/screenshots/01-giris.png) | ![Envanter](docs/screenshots/03-envanter.png) |
| **Giriş** · çini kafes arka plan, kurumsal logo | **Envanter** · filtre, arama, durum rozetleri |
| ![Cihaz detay](docs/screenshots/04-cihaz-detay.png) | ![Zimmetler](docs/screenshots/05-zimmetler.png) |
| **Cihaz detayı** · QR, zaman çizelgesi | **Zimmetler** · aktif, geciken, geçmiş |
| ![Arızalar](docs/screenshots/06-arizalar.png) | ![Sayım](docs/screenshots/07-sayim.png) |
| **Arıza panosu** · kanban | **Sayım** · oturumlar |
| ![Sayım detay](docs/screenshots/08-sayim-detay.png) | ![Raporlar](docs/screenshots/09-raporlar.png) |
| **Sayım detayı** · bulundu / bulunamadı | **Raporlar** · dağılımlar ve CSV |
| ![Kullanıcılar](docs/screenshots/10-kullanicilar.png) | ![Etiketler](docs/screenshots/11-etiketler.png) |
| **Kullanıcılar** · roller ve birimler | **QR etiketleri** · toplu yazdırma |
| ![Komut paleti](docs/screenshots/12-komut-paleti.png) | ![Koyu tema](docs/screenshots/13-koyu-tema.png) |
| **Komut paleti** · ⌘K | **Koyu tema** · envanter |

<p>
  <img src="docs/screenshots/14-mobil-envanter.png" width="260" alt="Mobil envanter" />
  <img src="docs/screenshots/15-mobil-personel.png" width="260" alt="Mobil personel ekranı" />
</p>

## Mobil uygulama (Flutter)

Aynı API'ye bağlanan saha uygulaması (`mobile/`): güvenli giriş, **kamerayla QR okutup** cihaz bilgisini (garanti, alım tarihi, kimde olduğu) görme, sahada **teslim et · geri kabul et · arıza bildir** ve kişisel zimmet ekranı. İşlemler role göre açılır; yetkileri sunucu zorlar. Kurulum ve çalıştırma: [`mobile/README.md`](mobile/README.md).

| ![Giriş](docs/screenshots/mobil/01-giris.png) | ![Ana sayfa](docs/screenshots/mobil/02-ana-yonetici.png) | ![Cihaz detayı](docs/screenshots/mobil/03-cihaz-detay.png) | ![Teslim et](docs/screenshots/mobil/04-teslim-et.png) |
|:-:|:-:|:-:|:-:|
| **Giriş** | **Ana sayfa** (yönetici) | **Cihaz detayı** | **Personele teslim et** |

| ![Geri kabul](docs/screenshots/mobil/05-geri-kabul.png) | ![Personel](docs/screenshots/mobil/06-ana-personel.png) | ![Arıza](docs/screenshots/mobil/07-ariza-bildir.png) | ![Koyu](docs/screenshots/mobil/09-koyu-tema.png) |
|:-:|:-:|:-:|:-:|
| **Geri kabul** | **Kişisel zimmet** (personel) | **Arıza bildir** | **Koyu tema** |

## Otomatik tutarlılık kuralları

Bu kuralların hepsi **tek bir veritabanı transaction'ında** ve cihaz satırı kilitlenerek çalışır:

| Olay | Sonuç |
|---|---|
| Zimmetli cihaz **Arızalı** yapılır / personel **arıza bildirir** | Zimmet **otomatik düşer**, cihaz Arızalı olur |
| Zimmetli cihaz **Hizmet dışı** yapılır | Zimmet otomatik düşer |
| **İade al** (sağlam) | Zimmet kapanır, cihaz **Depoda** |
| **İade al** (arızalı) | Zimmet kapanır, cihaz **Arızalı** |
| Cihaz başkasındayken yeni kişiye zimmetlenir | Önceki zimmet otomatik düşer (**devir**) |
| Kullanıcı **pasife alınır / silinir** | Üzerindeki tüm cihazlar otomatik **Depoya** döner |
| Zimmet geçmişi olan kullanıcı silinir | Denetim izi korunur: kayıt silinmez, pasife alınır |
| Arızalı / hizmet dışı cihaza zimmet | Reddedilir |
| Aynı cihaza eşzamanlı iki zimmet isteği | Yalnızca biri başarılı olur |

**Veritabanı güvencesi:** `Assignment` tablosunda *"bir cihazın aynı anda yalnızca bir aktif zimmeti olabilir"* kuralı kısmi unique index ile (`WHERE "returnedAt" IS NULL`) uygulama kodundan bağımsız olarak garanti edilir.

## Roller ve yetkiler

| Rol | Yetki |
|---|---|
| **Yönetici** | Tüm envanter, zimmet, arıza, sayım, rapor ve kullanıcı yönetimi. Son aktif yönetici korunur. |
| **Birim sorumlusu** | Yalnızca **kendi biriminin** cihaz, zimmet ve arızalarını görür ve yönetir. |
| **Personel** | Yalnızca kendi zimmetlerini görür; arıza bildirir, föyünü açar. |

Yetki kontrolleri sunucu tarafında (RBAC) uygulanır ve testlerle doğrulanır.

## Testler

```bash
docker compose up -d db

cd backend  && npm test            # 180 entegrasyon testi (ayrı zimmet_test veritabanı)
cd frontend && npm test            # 98 bileşen/birim testi
cd e2e      && npx playwright test # 150'den fazla uçtan uca test (masaüstü + mobil, erişilebilirlik dahil)
```

Backend testleri gerçek PostgreSQL üzerinde çalışır; yetkilendirme (RBAC), doğrulama, sayfalama/arama/filtre, **otomatik zimmet düşme senaryolarının tamamı**, **eşzamanlı zimmet yarışı** ve veritabanı seviyesindeki kısıtları doğrular. Uçtan uca testler ayrı bir veritabanı (`zimmet_e2e`) ve portlar kullanır, geliştirme verisine dokunmaz.

## Ortam değişkenleri

Docker için kök dizindeki `.env.example` dosyasını `.env` olarak kopyalayıp düzenleyebilirsiniz. **Hiçbiri zorunlu değildir**, varsayılanlar çalışır.

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `zimmet` … | Veritabanı bilgileri |
| `JWT_SECRET` | örnek değer | **Üretimde değiştirin**, en az 32 karakter |
| `JWT_EXPIRES_IN` | `8h` | Oturum süresi |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@gop.edu.tr` / `Admin123!` | İlk yönetici hesabı |
| `SEED_DEMO` | `true` | İlk açılışta örnek kullanıcı ve cihaz yükle |
| `VITE_DEMO_LOGIN` | `true` | Giriş ekranında demo hesap butonlarını göster |
| `WEB_PORT` / `API_PORT` / `DB_PORT` | `8080` / `3000` / `5440` | Yayınlanan portlar |
| `APP_URL` | `http://localhost:8080` | **QR kodların işaret ettiği adres.** Telefonla okutulunca açılacak site; yayında gerçek alan adınız olmalı |
| `CORS_ORIGIN` | `http://localhost:8080` | İzin verilen web adresi (virgülle birden çok) |

Yerel geliştirme için backend ayarları `backend/.env` içindedir (`backend/.env.example` şablon).

## Yerel geliştirme

```bash
docker compose up -d db                    # yalnızca PostgreSQL (localhost:5440)

cd backend
npm install
cp .env.example .env
npx prisma migrate deploy
npm run seed -- --demo                     # yönetici + örnek veri
npm run dev                                # http://localhost:3000

cd ../frontend                             # ayrı bir terminalde
npm install
npm run dev                                # http://localhost:5173  (/api → 3000'e yönlenir)
```

## Mimari

```
backend/
  prisma/            schema.prisma, migrations (kısmi unique index dahil), seed.ts
  src/
    routes/          auth, users, devices, assignments, faults, counts, dashboard, notifications, exports
    services/        assignmentService (zimmet/iade/durum kuralları), deviceService, faultService,
                     countService, reportService, notificationService, eventLog…
    plugins/         JWT + rol kontrolü
  test/              Vitest entegrasyon testleri
frontend/
  src/
    pages/           Dashboard, Devices, DeviceDetail, Assignments, Faults, Counts, Reports, Users, Labels…
    components/      ui/ (tasarım sistemi), layout/, charts/, devices/, brand/
    api/hooks.ts     TanStack Query hook'ları
e2e/                 Playwright uçtan uca ve erişilebilirlik testleri
docker-compose.yml   db + backend + frontend (nginx)
```

### API özeti
Tüm uç noktalar `/api` altındadır ve Bearer JWT ister; ayrıntılı şema için `/docs` (Swagger).

| Alan | Kapsam |
|---|---|
| Auth | giriş, çıkış, profil, şifre değiştirme |
| Kullanıcılar | listeleme, ekleme, düzenleme, silme, şifre sıfırlama (yönetici) |
| Envanter | cihaz CRUD, QR üretimi ve toplu etiket, QR ile arama, durum değiştirme, iade, arıza bildirimi, "benim cihazlarım" |
| Zimmet | atama, devir, planlı iade, hatırlatma, süre uzatma |
| Arızalar | kanban panosu, kayıt detayı ve durum geçişleri |
| Sayım | oturum aç, QR ile okut, kapat, dışa aktar |
| Dashboard / Raporlar | özet sayılar, dağılımlar |
| Dışa aktarma | cihaz, zimmet ve arıza CSV'leri |
| Bildirimler | listeleme, okundu işaretleme |

## Kurumsal kimlik ve tasarım

Arayüz, **Tokat Gaziosmanpaşa Üniversitesi Kurumsal Kimlik Kılavuzu**na göre tasarlanmıştır; üniversitenin web sitelerinin renk ve yapısı da incelenerek karar verilmiştir.

- **Renkler:** Kılavuzdaki resmî logo renkleri: mor `#462B55`, firuze `#0098C0`, bordo `#910C32`. Kenar çubuğu, üniversite sitelerinin footer'ında kullanılan **kömür tonudur** (`#21252B`). Resmî firuze açık zeminde metin için yetersiz kontrasta sahip olduğundan **birincil renk mor**, firuze ise vurgu ve odak halkası olarak kullanılır; bilgi metinleri için koyulaştırılmış tonu kullanılır. Durum renkleri (başarı, uyarı, tehlike, bilgi) AA kontrast oranını sağlar.
- **Logo:** Resmî vektör logo, kılavuz kurallarına uygun kullanılır: renk, oran ve biçim değiştirilmez. Koyu zeminlerde logo orijinal renklerini korumak için beyaz plaka üzerinde durur.
- **Giriş ekranı ("Çini kafes"):** Logonun birim şeklinden esinlenen çini deseni imleçle birlikte döner; kartın üstünde logonun 4 birimi birleşerek belirir. Giriş yapılırken düğmede logo sembolü döner.
- **Karşılama:** Girişten sonra oturum başına bir kez, logo birleşir ve kenar çubuğundaki yerine uçar. `Esc`/`Enter`/"Atla" ile geçilebilir; işletim sistemi "hareketi azalt" tercihinde animasyon atlanır.

> Logo ve kurumsal kimlik öğeleri Tokat Gaziosmanpaşa Üniversitesi'ne aittir; yalnızca üniversite projesi kapsamında kullanılmıştır.

## Yol haritası
- [x] **Flutter mobil uygulama** (`mobile/`): giriş, QR okutma, saha işlemleri ve kişisel zimmet ekranı.
- [ ] **Mobil:** push bildirimleri ve çevrimdışı önbellek.
- [ ] **Kurumsal kimlik doğrulama:** AD/LDAP veya SSO entegrasyonu.
- [ ] **Kullanıcı eylemleri için denetim kaydı** (giriş denemeleri, rol değişiklikleri).
