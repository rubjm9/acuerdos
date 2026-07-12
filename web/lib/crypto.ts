import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado a nivel de campo (AES-256-GCM) para el texto de acuerdos y tareas
 * de las áreas restringidas (Art. 9 RGPD). El contenido cifrado NUNCA entra
 * en índices de búsqueda (FTS ni vectorial).
 *
 * Formato: [iv 12B][tag 16B][ciphertext] en un único bytea.
 */

function key(): Buffer {
  const k = process.env.FIELD_ENCRYPTION_KEY;
  if (!k) throw new Error("FIELD_ENCRYPTION_KEY no configurada");
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY debe ser 32 bytes en base64");
  return buf;
}

export function encryptField(plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}

export function decryptField(data: Buffer): string {
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const enc = data.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
