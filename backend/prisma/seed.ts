import bcrypt from 'bcryptjs';
import { config } from '../src/config.js';
import { prisma } from '../src/db.js';
import { assignDevice, changeStatus, returnDevice } from '../src/services/assignmentService.js';
import { updateFault } from '../src/services/faultService.js';
import { createDevice } from '../src/services/deviceService.js';

const demo = process.argv.includes('--demo');
const extrasOnly = process.argv.includes('--extras');


/** Yeni özellikleri gösteren demo verisi: birim sorumlusu, planlı iadeler, farklı durumda arıza kayıtları. Tekrar çalıştırılabilir. */
async function demoExtras(actor: { id: string; name: string; email: string; role: 'ADMIN' | 'UNIT_MANAGER' | 'STAFF'; department: string | null }) {
  await prisma.user.updateMany({ where: { email: 'mehmet.kaya@gop.edu.tr', role: 'STAFF' }, data: { role: 'UNIT_MANAGER' } });

  // Planlı iade tarihleri: biri gecikmiş, biri yaklaşıyor, biri uzak
  const active = await prisma.assignment.findMany({ where: { returnedAt: null, dueAt: null }, orderBy: { assignedAt: 'desc' }, take: 3 });
  const offsets = [-6, 2, 21];
  for (const [i, a] of active.entries()) await prisma.assignment.update({ where: { id: a.id }, data: { dueAt: new Date(Date.now() + offsets[i]! * 864e5) } });

  // Arıza kayıtları: biri incelemede, biri çözülmüş
  const open = await prisma.faultTicket.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' }, take: 2 });
  if (open[0]) await updateFault(open[0].id, { status: 'IN_PROGRESS' }, actor);
  if (open[1]) await updateFault(open[1].id, { status: 'RESOLVED', resolution: 'Parça değiştirildi, test edildi' }, actor);
  console.log('✔ Demo ek verileri: birim sorumlusu, planlı iadeler, arıza kayıtları');
}

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: config.ADMIN_EMAIL },
    update: {},
    create: {
      name: 'Sistem Yöneticisi',
      email: config.ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(config.ADMIN_PASSWORD, 10),
      role: 'ADMIN',
      department: 'Yapay Zeka ve Dijital Dönüşüm Koordinatörlüğü',
      title: 'Sistem Yöneticisi',
    },
  });
  console.log(`✔ Yönetici hazır: ${admin.email}`);
  const actorUser = { id: admin.id, name: admin.name, email: admin.email, role: admin.role, department: admin.department };
  if (extrasOnly) return demoExtras(actorUser);
  if (!demo) return;
  if ((await prisma.device.count()) > 0) return console.log('ℹ Demo veri zaten var, atlandı');

  const actor = { id: admin.id, name: admin.name, email: admin.email, role: admin.role, department: admin.department };
  const pw = await bcrypt.hash('Demo1234', 10);
  const people: [string, string, string][] = [
    ['Ayşe Yılmaz', 'Bilgi İşlem', 'Sistem Uzmanı'],
    ['Mehmet Kaya', 'Bilgi İşlem', 'Ağ Uzmanı'],
    ['Zeynep Demir', 'Mühendislik Fakültesi', 'Dr. Öğr. Üyesi'],
    ['Ali Çelik', 'Mühendislik Fakültesi', 'Araştırma Görevlisi'],
    ['Elif Şahin', 'Öğrenci İşleri', 'Şef'],
    ['Burak Aydın', 'Öğrenci İşleri', 'Memur'],
    ['Selin Arslan', 'Kütüphane', 'Kütüphaneci'],
    ['Emre Koç', 'İdari ve Mali İşler', 'Mali Uzman'],
    ['Deniz Öztürk', 'Yapay Zeka ve Dijital Dönüşüm Koordinatörlüğü', 'Yazılım Mühendisi'],
    ['Fatma Güneş', 'Sağlık Kültür ve Spor', 'Teknisyen'],
  ];
  const users = [];
  for (const [i, [name, department, title]] of people.entries()) {
    const email = `${name.toLowerCase().replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/\s+/g, '.')}@gop.edu.tr`;
    users.push(await prisma.user.create({ data: { name, email, passwordHash: pw, department, title, role: 'STAFF' }, }));
    void i;
  }

  const catalog: [string, string, string[]][] = [
    ['LAPTOP', 'Lenovo', ['ThinkPad T14', 'ThinkPad X1 Carbon', 'IdeaPad 5']],
    ['LAPTOP', 'Dell', ['Latitude 5440', 'XPS 13']],
    ['LAPTOP', 'HP', ['EliteBook 840', 'ProBook 450']],
    ['DESKTOP', 'Dell', ['OptiPlex 7010', 'OptiPlex 3000']],
    ['DESKTOP', 'HP', ['ProDesk 400 G9']],
    ['MONITOR', 'Dell', ['U2723QE', 'P2422H']],
    ['MONITOR', 'LG', ['27UP850', '24MK430H']],
    ['SERVER', 'HPE', ['ProLiant DL380 Gen10', 'ProLiant DL360 Gen11']],
    ['SERVER', 'Dell', ['PowerEdge R750']],
    ['PRINTER', 'HP', ['LaserJet Pro M404dn']],
    ['PRINTER', 'Canon', ['imageRUNNER 2625i']],
    ['NETWORK', 'Cisco', ['Catalyst 9200', 'Meraki MR46']],
    ['TABLET', 'Apple', ['iPad Air 5']],
    ['PHONE', 'Samsung', ['Galaxy S23']],
  ];
  const devices = [];
  let n = 0;
  for (const [type, brand, models] of catalog) {
    for (const model of models) {
      for (let k = 0; k < (type === 'LAPTOP' || type === 'MONITOR' ? 3 : 2); k++) {
        n++;
        const purchase = new Date(Date.now() - (30 + ((n * 53) % 1300)) * 864e5);
        const warranty = new Date(purchase.getTime() + (n % 4 === 0 ? 2 : 3) * 365 * 864e5);
        devices.push(
          await createDevice(
            {
              type,
              brand,
              model,
              serialNumber: `SN${brand.slice(0, 2).toUpperCase()}${String(100000 + n * 37)}`,
              purchaseDate: purchase,
              warrantyEnd: warranty,
              location: ['Merkez Kampüs', 'Erzurum Yerleşkesi', 'Sunucu Odası', 'Depo'][n % 4],
            },
            actor,
          ),
        );
      }
    }
  }

  // Zimmetler (kişisel olanları dağıt)
  const assignable = devices.filter((d) => ['LAPTOP', 'DESKTOP', 'MONITOR', 'TABLET', 'PHONE'].includes(d.type));
  for (const [i, d] of assignable.entries()) {
    if (i % 3 === 2) continue; // bir kısmı depoda kalsın
    await assignDevice({ deviceId: d.id, userId: users[i % users.length].id, actor, note: 'İlk zimmet' });
  }
  // Geçmiş: bazı cihazlar iade edilip tekrar verilsin
  for (const d of assignable.filter((_, i) => i % 3 !== 2).slice(0, 6)) {
    await returnDevice({ deviceId: d.id, actor, note: 'Görev değişikliği' });
    await assignDevice({ deviceId: d.id, userId: users[(d.assetTag.length + n) % users.length].id, actor }).catch(() => {});
  }
  // Arızalılar (zimmetli olan otomatik düşer)
  for (const d of [assignable[1], assignable[7], devices[devices.length - 3]]) {
    await changeStatus({ deviceId: d.id, status: 'FAULTY', actor, note: 'Ekran/disk arızası' });
  }
  await changeStatus({ deviceId: devices[devices.length - 1].id, status: 'RETIRED', actor, note: 'Ömrünü tamamladı' });

  // Cihaz kayıt tarihlerini son 3 aya yay (eğilim grafikleri anlamlı görünsün)
  for (const [i, d] of devices.entries()) {
    await prisma.device.update({ where: { id: d.id }, data: { createdAt: new Date(Date.now() - (5 + ((i * 37) % 85)) * 864e5) } });
  }

  // Etkinlik grafiği için tarihleri son 30 güne yay (iade tarihi asla gelecekte kalmaz)
  const all = await prisma.assignment.findMany();
  for (const [i, a] of all.entries()) {
    const daysAgo = a.returnedAt ? 2 + ((i * 7) % 26) : ((i * 7) % 28);
    const at = new Date(Date.now() - daysAgo * 864e5 - 3600e3);
    await prisma.assignment.update({
      where: { id: a.id },
      data: { assignedAt: at, ...(a.returnedAt && { returnedAt: new Date(at.getTime() + 24 * 3600e3) }) },
    });
  }
  await demoExtras(actor);
  console.log(`✔ Demo veri: ${users.length} kullanıcı, ${devices.length} cihaz (şifre: Demo1234)`);
}

main().finally(() => prisma.$disconnect());
