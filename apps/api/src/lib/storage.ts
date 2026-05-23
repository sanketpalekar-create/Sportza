import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";
import path from "path";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || undefined,
  region: process.env.S3_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET || "sportza-uploads";

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return `${process.env.S3_ENDPOINT || "https://s3.amazonaws.com"}/${BUCKET}/${key}`;
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

export async function getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
});

export function generateFileKey(folder: string, filename: string): string {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  const timestamp = Date.now();
  return `${folder}/${name}-${timestamp}${ext}`;
}
