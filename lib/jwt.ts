export interface JWTPayload {
  id: string;
  email: string;
  role: 'admin' | 'kasir';
  name: string;
  exp: number;
}

export function generateJWT(user: { id: string; email: string; role: 'admin' | 'kasir'; name: string }): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: JWTPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Date.now() + 2 * 60 * 60 * 1000 // 2 hours expiration
  };

  const base64Header = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const base64Payload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signature = 'restoflow_sig_hash_pos_client';

  return `${base64Header}.${base64Payload}.${signature}`;
}

export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payloadJson) as JWTPayload;
  } catch (err) {
    return null;
  }
}

export function isJWTExpired(payload: JWTPayload): boolean {
  return payload.exp < Date.now();
}
