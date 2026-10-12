import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import '../core/api.dart';
import '../core/models.dart';

final sessionProvider = Provider<Session>((ref) => throw UnimplementedError());

final apiProvider = Provider<Api>((ref) => Api(ref.watch(sessionProvider), onUnauthorized: () => ref.read(authProvider.notifier).expire()));

sealed class AuthState {
  const AuthState();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class SignedOut extends AuthState {
  const SignedOut({this.expired = false});
  final bool expired;
}

class SignedIn extends AuthState {
  const SignedIn(this.user);
  final AppUser user;
}

class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() {
    _restore();
    return const AuthLoading();
  }

  Future<void> _restore() async {
    final s = ref.read(sessionProvider);
    if (await s.token == null) {
      state = const SignedOut();
      return;
    }
    try {
      state = SignedIn(await ref.read(apiProvider).me());
    } on ApiException catch (e) {
      // Sunucu yanıt veriyorsa ve oturum geçersizse çıkış; ağ hatasında da girişe düş (çevrimdışı mod yok)
      if (e.status == 401) await s.clearToken();
      if (state is AuthLoading) state = const SignedOut();
    }
  }

  Future<void> login(String email, String password) async {
    final u = await ref.read(apiProvider).login(email.trim().toLowerCase(), password);
    state = SignedIn(u);
  }

  Future<void> logout() async {
    await ref.read(apiProvider).logout();
    state = const SignedOut();
  }

  void expire() {
    if (state is SignedIn) {
      ref.read(sessionProvider).clearToken();
      state = const SignedOut(expired: true);
    }
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

AppUser? currentUser(WidgetRef ref) => switch (ref.watch(authProvider)) { SignedIn(:final user) => user, _ => null };

// ───── Veri sağlayıcıları (oturum kapanınca yeniden oluşturulur)
final myDevicesProvider = FutureProvider.autoDispose<List<Device>>((ref) => ref.watch(apiProvider).myDevices());
final totalsProvider = FutureProvider.autoDispose<DashboardTotals>((ref) => ref.watch(apiProvider).totals());
final deviceDetailProvider = FutureProvider.autoDispose.family<DeviceDetailData, String>((ref, id) => ref.watch(apiProvider).deviceDetail(id));
final notificationsProvider = FutureProvider.autoDispose<({List<NotificationItem> items, int unread})>((ref) => ref.watch(apiProvider).notifications());

class InventoryQuery {
  const InventoryQuery({this.search = '', this.status});
  final String search;
  final String? status;
  @override
  bool operator ==(Object o) => o is InventoryQuery && o.search == search && o.status == status;
  @override
  int get hashCode => Object.hash(search, status);
}

final inventoryProvider = FutureProvider.autoDispose.family<Paged<Device>, InventoryQuery>((ref, q) => ref.watch(apiProvider).devices(search: q.search, status: q.status));

// ───── Tema
final themeModeProvider = StateProvider<ThemeMode>((ref) {
  return switch (ref.read(sessionProvider).themeMode) { 'dark' => ThemeMode.dark, 'light' => ThemeMode.light, _ => ThemeMode.system };
});
