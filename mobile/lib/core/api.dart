import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

/// Varsayılan: Railway'deki canlı demo (nginx /api'yi backend'e yönlendirir).
/// Derleme sırasında değiştirmek için: --dart-define=API_URL=http://10.0.2.2:3000/api
const defaultApiUrl = String.fromEnvironment('API_URL', defaultValue: 'https://frontend-production-819d.up.railway.app/api');

class ApiException implements Exception {
  ApiException(this.message, {this.status, this.code});
  final String message;
  final int? status;
  final String? code;
  @override
  String toString() => message;
}

class Session {
  Session({required this.prefs, required this.secure});
  final SharedPreferences prefs;
  final FlutterSecureStorage secure;

  String get baseUrl => prefs.getString('apiUrl') ?? defaultApiUrl;
  Future<void> setBaseUrl(String v) => prefs.setString('apiUrl', v.trim().replaceAll(RegExp(r'/+$'), ''));
  Future<void> resetBaseUrl() => prefs.remove('apiUrl');

  Future<String?> get token => secure.read(key: 'token');
  Future<void> saveToken(String t) => secure.write(key: 'token', value: t);
  Future<void> clearToken() => secure.delete(key: 'token');

  String? get themeMode => prefs.getString('theme');
  Future<void> setThemeMode(String v) => prefs.setString('theme', v);
}

class Api {
  Api(this.session, {required this.onUnauthorized}) {
    dio = Dio(BaseOptions(connectTimeout: const Duration(seconds: 12), receiveTimeout: const Duration(seconds: 20)));
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) async {
      o.baseUrl = session.baseUrl;
      final t = await session.token;
      if (t != null) o.headers['Authorization'] = 'Bearer $t';
      h.next(o);
    }));
  }

  final Session session;
  final void Function() onUnauthorized;
  late final Dio dio;

  Future<T> _run<T>(Future<Response<dynamic>> Function() call, T Function(dynamic data) map, {bool authCall = false}) async {
    try {
      final r = await call();
      return map(r.data);
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      final err = e.response?.data is Map ? (e.response!.data as Map)['error'] : null;
      if (status == 401 && !authCall) onUnauthorized();
      if (err is Map) throw ApiException(err['message'] ?? 'Bir hata oluştu', status: status, code: err['code']);
      if (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.receiveTimeout || e.type == DioExceptionType.connectionError) {
        throw ApiException('Sunucuya ulaşılamadı. Bağlantınızı veya sunucu adresini kontrol edin.');
      }
      throw ApiException('Beklenmeyen bir hata oluştu');
    }
  }

  // ───── Auth
  Future<AppUser> login(String email, String password) => _run(
        () => dio.post('/auth/login', data: {'email': email, 'password': password}),
        (d) {
          session.saveToken(d['token']);
          return AppUser.fromJson(d['user']);
        },
        authCall: true,
      );

  Future<AppUser> me() => _run(() => dio.get('/auth/me'), (d) => AppUser.fromJson(d['user']));
  Future<void> logout() async {
    try {
      await dio.post('/auth/logout');
    } catch (_) {}
    await session.clearToken();
  }

  Future<void> changePassword(String current, String next) => _run(
        () => dio.patch('/auth/me/password', data: {'currentPassword': current, 'newPassword': next}),
        (d) => session.saveToken(d['token']),
      );

  // ───── Cihazlar
  Future<List<Device>> myDevices() => _run(() => dio.get('/devices/mine'), (d) => (d['data'] as List).map((e) => Device.fromJson(e)).toList());

  Future<Device> deviceByQr(String token) => _run(() => dio.get('/devices/by-qr/$token'), (d) => Device.fromJson(d['device']));

  Future<DeviceDetailData> deviceDetail(String id) => _run(
        () => dio.get('/devices/$id'),
        (d) => DeviceDetailData(Device.fromJson(d['device']), (d['events'] as List).map((e) => DeviceEvent.fromJson(e)).toList()),
      );

  Future<Paged<Device>> devices({String? search, String? status, int page = 1}) => _run(
        () => dio.get('/devices', queryParameters: {'page': page, 'pageSize': 20, if (search != null && search.isNotEmpty) 'search': search, if (status != null) 'status': status}),
        (d) => Paged((d['data'] as List).map((e) => Device.fromJson(e)).toList(), d['meta']['total']),
      );

  Future<void> reportFault(String deviceId, String? note) =>
      _run(() => dio.post('/devices/$deviceId/report-fault', data: {if (note != null && note.isNotEmpty) 'note': note}), (_) {});

  Future<void> returnDevice(String deviceId, {required bool faulty, String? note}) => _run(
        () => dio.post('/devices/$deviceId/return', data: {'condition': faulty ? 'FAULTY' : 'OK', if (note != null && note.isNotEmpty) 'note': note}),
        (_) {},
      );

  Future<void> assign({required String deviceId, required String userId, String? note, DateTime? dueAt, bool transfer = false}) => _run(
        () => dio.post('/assignments', data: {
          'deviceId': deviceId,
          'userId': userId,
          'transfer': transfer,
          if (note != null && note.isNotEmpty) 'note': note,
          if (dueAt != null) 'dueAt': dueAt.toUtc().toIso8601String(),
        }),
        (_) {},
      );

  // ───── Kullanıcılar (yönetici / birim sorumlusu)
  Future<List<AppUser>> users(String search) => _run(
        () => dio.get('/users', queryParameters: {'pageSize': 30, 'isActive': 'true', if (search.isNotEmpty) 'search': search}),
        (d) => (d['data'] as List).map((e) => AppUser.fromJson(e)).toList(),
      );

  // ───── Panel ve bildirimler
  Future<DashboardTotals> totals() => _run(() => dio.get('/dashboard'), (d) => DashboardTotals.fromJson(d['totals']));

  Future<({List<NotificationItem> items, int unread})> notifications() => _run(
        () => dio.get('/notifications', queryParameters: {'limit': 50}),
        (d) => (items: (d['data'] as List).map((e) => NotificationItem.fromJson(e)).toList(), unread: d['unread'] as int),
      );
  Future<void> readAll() => _run(() => dio.post('/notifications/read-all'), (_) {});
  Future<void> readOne(String id) => _run(() => dio.post('/notifications/$id/read'), (_) {});
}

/// QR içeriğinden cihaz token'ını çıkarır: tam link (…/scan/<token>) veya çıplak token.
String? extractToken(String text) {
  final t = text.trim();
  if (t.isEmpty) return null;
  final m = RegExp(r'/scan/([A-Za-z0-9_-]+)/?(?:[?#].*)?$').firstMatch(t);
  if (m != null) return m.group(1);
  return RegExp(r'^[A-Za-z0-9_-]{10,}$').hasMatch(t) ? t : null;
}
