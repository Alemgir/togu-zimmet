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

  testWidgets('yönetici akışı', (t) async {
    await app.main();
    await wait(t, 2500);
    if (find.text('Profil').evaluate().isNotEmpty) {
      await t.tap(find.text('Profil'));
      await wait(t, 800);
      await t.tap(find.text('Çıkış yap'));
      await wait(t, 1500);
    }
    await shot(t, '01-giris');

    await t.tap(find.text('Yönetici'));
    await wait(t, 300);
    await t.tap(find.text('Giriş yap').last);
    await wait(t, 3000);
    expect(find.text('ÜZERİMDEKİ CİHAZLAR'), findsOneWidget);
    await shot(t, '02-ana-yonetici');

    await t.tap(find.text('Envanter'));
    await wait(t, 2500);
    await shot(t, '03-envanter');

    // Boşta (depoda) bir cihaza gir
    await t.tap(find.text('Depoda').first);
    await wait(t, 2000);
    await t.tap(find.textContaining('TOGU-').first);
    await wait(t, 2500);
    await shot(t, '04-cihaz-detay-depoda');
    expect(find.text('Personele teslim et'), findsOneWidget);

    await t.tap(find.text('Personele teslim et'));
    await wait(t, 2500);
    await shot(t, '05-teslim-sheet');
    await t.tap(find.text('Ayşe Yılmaz').last);
    await wait(t, 700);
    await shot(t, '06-teslim-secili');
    await t.tap(find.textContaining('adına zimmetle'));
    await wait(t, 3000);
    await shot(t, '07-teslim-sonrasi');
    expect(find.text('Cihazı geri kabul et'), findsOneWidget);

    // Geri kabul (veriyi eski haline getir)
    await t.tap(find.text('Cihazı geri kabul et'));
    await wait(t, 1200);
    await shot(t, '08-geri-kabul-sheet');
    await t.tap(find.text('Geri kabul et').last);
    await wait(t, 3000);
    expect(find.text('Personele teslim et'), findsOneWidget);
    await shot(t, '09-geri-kabul-sonrasi');
  });
}
