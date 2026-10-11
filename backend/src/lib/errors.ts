export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (m: string, d?: unknown) => new AppError(400, 'BAD_REQUEST', m, d);
export const unauthorized = (m = 'Oturum geçersiz veya süresi dolmuş') => new AppError(401, 'UNAUTHORIZED', m);
export const forbidden = (m = 'Bu işlem için yetkiniz yok') => new AppError(403, 'FORBIDDEN', m);
export const notFound = (m = 'Kayıt bulunamadı') => new AppError(404, 'NOT_FOUND', m);
export const conflict = (m: string, d?: unknown) => new AppError(409, 'CONFLICT', m, d);
