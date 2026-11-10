import type {RequestHandler} from 'express';

export function securityHeaders(production:boolean):RequestHandler {
  return (_req,res,next)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
    next();
  };
}
