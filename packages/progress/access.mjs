import { createRemoteJWKSet, jwtVerify } from 'jose';

// Only public signing keys are cached; no user identity or request data.
const resolvers = new Map();
export async function accessIdentity(request, env, resolveKeys) {
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER || '') ||
      !env.ACCESS_AUD || !env.OWNER_EMAIL) return null;
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return null;
  try {
    let keys = resolveKeys;
    if (!keys) {
      if (!resolvers.has(env.ACCESS_ISSUER)) resolvers.set(env.ACCESS_ISSUER,
        createRemoteJWKSet(new URL(env.ACCESS_ISSUER + '/cdn-cgi/access/certs')));
      keys = resolvers.get(env.ACCESS_ISSUER);
    }
    const { payload } = await jwtVerify(token, keys, {
      issuer: env.ACCESS_ISSUER, audience: env.ACCESS_AUD,
      algorithms: ['RS256'], requiredClaims: ['exp', 'sub', 'email'],
    });
    if (typeof payload.email !== 'string' || payload.email.toLowerCase() !== env.OWNER_EMAIL.toLowerCase()) return null;
    return { email: payload.email.toLowerCase() };
  } catch { return null; }
}
