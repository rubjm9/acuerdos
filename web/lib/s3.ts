import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Almacenamiento de objetos autoalojado (MinIO, UE). */
export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: "eu-central-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "",
  },
});

export const BUCKET_ACTAS = process.env.S3_BUCKET_ACTAS ?? "actas";
export const BUCKET_EXPORTS = process.env.S3_BUCKET_EXPORTS ?? "exports";

export async function uploadObject(
  bucket: string,
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
) {
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
  );
}

export async function getObjectStream(bucket: string, key: string) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return res;
}

/** URL firmada de corta duración para descargas (se audita cada emisión). */
export async function presignDownload(bucket: string, key: string, filename?: string) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: filename ? `attachment; filename="${filename}"` : undefined,
    }),
    { expiresIn: 300 }
  );
}
