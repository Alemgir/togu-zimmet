import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:togu_zimmet/main.dart' as app;

Future<void> wait(WidgetTester t, [int ms = 1500]) async {
  final end = DateTime.now().add(Duration(milliseconds: ms));
  while (DateTime.now().isBefore(end)) {
    await t.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  Future<void> shot(WidgetTester t, String name) async {
    await wait(t, 900);
    await binding.takeScreenshot(name);
  }

  testWidgets('personel akışı + koyu tema', (t) async {
    await app.main();
    await wait(t, 2500);
    if (find.text('Profil').evaluate().isNotEmpty) {
      await t.tap(find.text('Profil'));
      await wait(t, 800);
      await t.tap(find.text('Çıkış yap'));
      await wait(t, 1500);
    }
    // Hatalı şifre → toast
    await t.tap(find.text('Personel'));
    await wait(t, 300);
    await t.enterText(find.byType(TextField).last, 'yanlis123');
    await t.tap(find.text('Giriş yap').last);
    await wait(t, 1500);
    await shot(t, 's01-hatali-giris');
    await wait(t, 3000);

    await t.tap(find.text('Personel'));
    await wait(t, 300);
    await t.tap(find.text('Giriş yap').last);
    await wait(t, 3000);
    expect(find.text('ÜZERİMDEKİ CİHAZLAR'), findsOneWidget);
    expect(find.text('Envanter'), findsNothing); // personelde envanter sekmesi yok
    await shot(t, 's02-ana-personel');

    await t.tap(find.textContaining('TOGU-').first);
    await wait(t, 2500);
    await shot(t, 's03-cihaz-detay-personel');
    expect(find.text('Personele teslim et'), findsNothing); // yönetici işlemi
    expect(find.text('Arıza bildir'), findsOneWidget);
    await t.tap(find.text('Arıza bildir'));
    await wait(t, 1200);
    await shot(t, 's04-ariza-sheet');
    await t.tapAt(const Offset(200, 120)); // sheet'i kapat
    await wait(t, 800);
    await t.tap(find.byIcon(Icons.arrow_back_rounded));
    await wait(t, 1000);

    await t.tap(find.text('Bildirim'));
    await wait(t, 2000);
    await shot(t, 's05-bildirimler');

    await t.tap(find.text('Profil'));
    await wait(t, 1000);
    await t.tap(find.text('Koyu'));
    await wait(t, 800);
    await shot(t, 's06-profil-koyu');

    await t.tap(find.text('Ana sayfa'));
    await wait(t, 1500);
    await shot(t, 's07-ana-koyu');
    await t.tap(find.textContaining('TOGU-').first);
    await wait(t, 2500);
    await shot(t, 's08-detay-koyu');
    await t.tap(find.byIcon(Icons.arrow_back_rounded));
    await wait(t, 800);

    // Tarayıcı (simülatörde kamera yok → elle giriş yedeği)
    await t.tap(find.byIcon(Icons.qr_code_scanner_rounded).last);
    await wait(t, 2000);
    await shot(t, 's09-tarayici');
    await t.tap(find.text('Kodu elle gir').first);
    await wait(t, 1000);
    await shot(t, 's10-elle-giris');
    await t.enterText(find.byType(TextField).last, 'http://localhost:8080/scan/yok-boyle-bir-token-12345');
    await t.tap(find.text('Cihazı bul'));
    await wait(t, 2000);
    await shot(t, 's11-gecersiz-qr');

    // Temayı sıfırla
    await t.tap(find.byIcon(Icons.close_rounded).first);
    await wait(t, 800);
    await t.tap(find.text('Profil'));
    await wait(t, 800);
    await t.tap(find.text('Sistem'));
    await wait(t, 500);
  });
}
