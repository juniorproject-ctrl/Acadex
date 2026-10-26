import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config';
import { ApiError } from '../errors';
import {MAX_LISTING_PHOTOS,MAX_LISTING_PHOTO_BYTES,LISTING_PHOTO_TYPES} from '../../src/lib/listingUploadRules';

fs.mkdirSync(config.uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: config.uploadDirectory,
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});

export const listingUpload = multer({
  storage,
  limits: { fileSize: MAX_LISTING_PHOTO_BYTES, files: MAX_LISTING_PHOTOS },
  fileFilter: (_req, file, callback) => {
    if (!LISTING_PHOTO_TYPES.includes(file.mimetype)) return callback(new ApiError(400, 'Images must be JPG, PNG, or WebP files.'));
    callback(null, true);
  },
});
