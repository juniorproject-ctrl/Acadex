import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import InformationPage from '../../src/pages/InformationPage';

test('support and policy pages render publicly without a marketplace session',()=>{
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});
 try{
  for(const [page,title] of [['help','Help center'],['contact','Contact us'],['pricing-guide','Pricing guide'],['safety-tips','Safety tips'],['terms-of-service','Terms of service'],['privacy-policy','Privacy policy']]){
   const html=renderToStaticMarkup(createElement(MemoryRouter,null,createElement(InformationPage,{page})));
   assert.ok(html.includes('>'+title+'</h1>'),page);
   assert.ok(html.includes('href="/contact"'),page);
   assert.ok(!html.includes('href="/browse"'),page);
   if(page==='contact'){assert.ok(html.includes('name="email"'));assert.ok(html.includes('name="message"'));}
  }
 }finally{delete (globalThis as any).localStorage;}
});
