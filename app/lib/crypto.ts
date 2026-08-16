import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

// Cifra/descifra secretos (tokens de Meta) antes de guardarlos en la base de datos.
// Algoritmo: AES-256-GCM (ver ARQUITECTURA.md, sección "Cifrado de secretos").
// La llave (ENCRYPTION_KEY) vive solo en .env.local / el gestor de secretos, nunca en el repo.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recomendado para GCM

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("Falta la variable de entorno ENCRYPTION_KEY (ver .env.local).");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY debe ser una clave de 32 bytes codificada en base64.");
  }
  return key;
}

// Devuelve un string codificado en base64 con el formato: iv + authTag + ciphertext.
export function encrypt(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decrypt(encrypted: string): string {
  const data = Buffer.from(encrypted, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = data.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
