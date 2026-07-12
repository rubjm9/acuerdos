import nodemailer from "nodemailer";

/**
 * Correo saliente por SMTP (proveedor en la UE). Si SMTP_URL no está
 * configurado, el envío se omite en silencio (dev).
 */
const transport = process.env.SMTP_URL
  ? nodemailer.createTransport(process.env.SMTP_URL)
  : null;

export async function sendMail(to: string, subject: string, text: string, href?: string) {
  if (!transport) return;
  const base = process.env.AUTH_URL ?? "";
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "plataforma@localhost",
    to,
    subject: `[Acuerdos] ${subject}`,
    text: href ? `${text}\n\nAbrir: ${base}${href}` : text,
  });
}
