import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { config } from './server/config';
import { pool } from './server/db';
import { errorHandler, notFound } from './server/errors';
import authRoutes from './server/routes/auth';
import listingRoutes from './server/routes/listings';
import catalogRoutes from './server/community/catalog';
import paperRoutes from './server/community/papers';
import groupRoutes from './server/community/groups';
import tutorRoutes from './server/community/tutors';
import eventRoutes from './server/community/events';
import accountRoutes from './server/community/account';
import applicationRoutes from './server/community/applications';
import reportRoutes from './server/community/reports';
import paymentRoutes,{paymentWebhook} from './server/community/payments';

async function startServer() {
  const app = express();
  const allowedOrigins = config.frontendOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);

  app.disable('x-powered-by');
  if(process.env.TRUST_PROXY==='1')app.set('trust proxy',1);
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed by CORS.'));
    },
  }));
  app.post('/api/payments/webhook',express.raw({type:'application/json',limit:'1mb'}),paymentWebhook());
  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(config.uploadDirectory));

  app.get('/api/health', async (_req, res, next) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch (error) {
      next(error);
    }
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/listings', listingRoutes);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/papers', paperRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/tutors', tutorRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/api/tutor-applications', applicationRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api', notFound);

  if (config.nodeEnv.trim() !== 'production' && !process.env.RAILWAY_ENVIRONMENT_ID) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });
}

startServer().catch((error) => {
  console.error('Server startup failed:', error.message);
  process.exit(1);
});
