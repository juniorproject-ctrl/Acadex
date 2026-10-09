import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config';
import { ApiError } from '../errors';

fs.mkdirSync(config.uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: config.uploadDirectory,
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});

export const listingUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(new ApiError(400, 'Images must be JPG, PNG, or WebP files.'));
    callback(null, true);
  },
});
