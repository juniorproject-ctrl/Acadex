import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Route not found.' });
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? (req.originalUrl.includes('/listings')?'Each listing photo must be 5 MB or smaller.':'The file exceeds the size limit shown on the upload field.') : ['LIMIT_FILE_COUNT','LIMIT_UNEXPECTED_FILE'].includes(error.code)&&req.originalUrl.includes('/listings')?'Upload up to 5 listing photos.':'Invalid file upload.' });
  if (error instanceof ApiError) return res.status(error.status).json({ error: error.message });
  console.error(error);
  const code=(error as {code?:string})?.code;
  if(code==='ER_NO_SUCH_TABLE'||code==='ER_BAD_FIELD_ERROR')return res.status(503).json({error:'Database setup is incomplete. Please apply the database migrations on the server.'});
  if(error instanceof Error&&error.message==='Missing required environment variable: JWT_SECRET')return res.status(503).json({error:'Sign-in is not configured. The server needs JWT_SECRET.'});
  return res.status(500).json({ error: 'An unexpected server error occurred.' });
}
