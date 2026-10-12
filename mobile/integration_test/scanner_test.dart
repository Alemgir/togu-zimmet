import 'package:flutter/material.dart';
import 'dart:io';

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
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // Ekran görüntüsü: test bir işaret dosyası bırakır, bilgisayardaki döngü (tool/shots.sh) simülatörden görüntüyü alır.
  Future<void> shot(WidgetTester t, String name) async {
    await wait(t, 900);
    const dir = String.fromEnvironment('SHOTS_DIR');
    if (dir.isNotEmpty) File('$dir/$name.req').writeAsStringSync('');
    await wait(t, 1700);
  }

  testWidgets('tarayıcı ekranı ve geçersiz QR', (t) async {
    await app.main();
    await wait(t, 2500);
    if (find.text('Profil').evaluate().isEmpty) {
      await t.tap(find.text('Personel'));
      await wait(t, 300);
      await t.tap(find.text('Giriş yap').last);
      await wait(t, 3000);
    }
    // Tarayıcı (simülatörde kamera yok → elle giriş yedeği)
    await t.tap(find.byIcon(Icons.qr_code_scanner_rounded).last);
    await wait(t, 2000);
    await shot(t, 's09-tarayici');
    await t.tap(find.text('Kodu elle gir').first);
    await wait(t, 1000);
    await shot(t, 's10-elle-giris');
    await t.enterText(
      find.byType(TextField).last,
      'http://localhost:8080/scan/yok-boyle-bir-token-12345',
    );
    await t.tap(find.text('Cihazı bul'));
    await wait(t, 2000);
    await shot(t, 's11-gecersiz-qr');
  });
}
