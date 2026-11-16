import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {securityHeaders} from '../middleware/securityHeaders';

for(const production of [false,true])test('security headers on normal and error responses, production='+production,async()=>{
  const app=express();app.use(securityHeaders(production));app.get('/',(_req,res)=>res.send('ok'));app.get('/private',(_req,res)=>res.status(401).json({error:'Authentication required.'}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  try{for(const path of ['/','/private','/missing']){
    const response=await fetch('http://127.0.0.1:'+(server.address() as any).port+path);
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.equal(response.headers.get('x-frame-options'),'DENY');
    assert.equal(response.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
    assert.equal(response.headers.get('strict-transport-security'),production?'max-age=31536000':null);
  }}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
