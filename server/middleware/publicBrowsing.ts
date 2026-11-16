import type {RequestHandler} from 'express';
import {requireAuth} from './auth';
import {verified} from '../community/shared';

export function isPublicBrowseRequest(base:string,path:string,method:string) {
  if(!['GET','HEAD'].includes(method))return false;
  const section=base.toLowerCase(),pathname=path.replace(/\/+$/,'')||'/';
  if(!['/api/listings','/api/catalog','/api/papers','/api/groups','/api/tutors','/api/events'].includes(section))return false;
  if(pathname==='/')return true;
  return ['/api/listings','/api/groups','/api/tutors','/api/events'].includes(section)&&/^\/[^/]+$/.test(pathname)&&!(section==='/api/listings'&&pathname.toLowerCase()==='/mine');
}

export const publicBrowsing:RequestHandler=(req,res,next)=>{
  if(isPublicBrowseRequest(req.baseUrl,req.path,req.method))return next();
  void requireAuth(req,res,error=>{if(error)return next(error);void verified(req,res,next);});
};
