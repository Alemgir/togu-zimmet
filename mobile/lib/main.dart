import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/api.dart';
import 'core/theme.dart';
import 'screens/device_detail.dart';
import 'screens/login.dart';
import 'screens/scan.dart';
import 'screens/shell.dart';
import 'state/providers.dart';
import 'widgets/ui.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('tr');
  final prefs = await SharedPreferences.getInstance();
  final session = Session(prefs: prefs, secure: const FlutterSecureStorage());
  runApp(ProviderScope(overrides: [sessionProvider.overrideWithValue(session)], child: const ZimmetApp()));
}

class _RouterRefresh extends ChangeNotifier {
  _RouterRefresh(Ref ref) {
    ref.listen(authProvider, (_, __) => notifyListeners());
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _RouterRefresh(ref);
  return GoRouter(
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final loggingIn = state.matchedLocation == '/login';
      if (auth is AuthLoading) return state.matchedLocation == '/splash' ? null : '/splash';
      if (auth is SignedOut) return loggingIn ? null : '/login';
      return (loggingIn || state.matchedLocation == '/splash') ? '/' : null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const _Splash()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/', builder: (_, __) => const MainShell()),
      GoRoute(path: '/scan', pageBuilder: (_, s) => CustomTransitionPage(key: s.pageKey, child: const ScanScreen(), transitionsBuilder: (_, a, __, c) => FadeTransition(opacity: a, child: ScaleTransition(scale: Tween(begin: .96, end: 1.0).animate(CurvedAnimation(parent: a, curve: Curves.easeOutCubic)), child: c)))),
      GoRoute(path: '/device/:id', builder: (_, s) => DeviceDetailScreen(id: s.pathParameters['id']!)),
    ],
  );
});

class ZimmetApp extends ConsumerWidget {
  const ZimmetApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    return MaterialApp.router(
      title: 'TOGÜ Zimmet',
      debugShowCheckedModeBanner: false,
      routerConfig: ref.watch(routerProvider),
      themeMode: mode,
      theme: buildTheme(Tokens.light),
      darkTheme: buildTheme(Tokens.darkTheme),
      locale: const Locale('tr'),
      supportedLocales: const [Locale('tr')],
      localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
      builder: (context, child) {
        final dark = Theme.of(context).brightness == Brightness.dark;
        var body = child!;
        // Web önizlemede telefon çerçevesi (çentik + ana ekran çubuğu) için güvenli alan payı bırak
        if (kIsWeb && Uri.base.queryParameters.containsKey('cerceve')) {
          final m = MediaQuery.of(context);
          body = MediaQuery(data: m.copyWith(padding: m.padding.copyWith(top: 38, bottom: 18)), child: body);
        }
        return AnnotatedRegion<SystemUiOverlayStyle>(value: dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark, child: body);
      },
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();
  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: context.t.sb,
        body: const Center(child: LogoSpinner(size: 64)),
      );
}
