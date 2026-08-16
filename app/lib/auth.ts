import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Contraseñas: se guardan con HASH (bcrypt), no cifradas. La diferencia con
// lib/crypto.ts (que cifra los tokens de Meta) es que un hash no se puede revertir:
// ni nosotros mismos podemos "recuperar" la contraseña original, solo comparar si una
// contraseña ingresada produce el mismo hash. bcrypt además es intencionalmente lento,
// para dificultar que alguien pruebe millones de contraseñas por segundo.
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

const SESSION_DURATION_DAYS = 30;
const SESSION_RENEWAL_THRESHOLD_DAYS = 15;

// El token que recibe el navegador (en la cookie) es un valor aleatorio grande.
// En la base de datos NO se guarda ese token, sino su hash SHA-256: así, si alguien
// llegara a leer la tabla `sessions`, no podría usar esos valores para iniciar sesión
// como otro usuario (a diferencia de un hash de contraseña, esto no necesita ser lento,
// porque el token ya es imposible de adivinar por fuerza bruta).
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(token: string, userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { id: hashToken(token), userId, expiresAt },
  });
  return expiresAt;
}

export async function validateSessionToken(token: string) {
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { include: { organization: true } } },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  // Renovación deslizante: si a la sesión le queda poco tiempo pero se sigue usando,
  // se le da otra ventana completa en vez de forzar un nuevo login.
  const daysLeft = (session.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  if (daysLeft < SESSION_RENEWAL_THRESHOLD_DAYS) {
    const newExpiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
    await prisma.session.update({ where: { id: session.id }, data: { expiresAt: newExpiresAt } });
  }

  return session.user;
}

export async function invalidateSessionToken(token: string) {
  await prisma.session.deleteMany({ where: { id: hashToken(token) } });
}
