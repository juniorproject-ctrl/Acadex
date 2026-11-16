import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import StudentOffers,{studentOffers} from '../../src/components/StudentOffers';
import InformationPage from '../../src/pages/InformationPage';

test('four demonstration offers and advertising destination render without a session',()=>{
  const html=renderToStaticMarkup(createElement(MemoryRouter,null,createElement(StudentOffers)));
  assert.equal(studentOffers.length,4);
  assert.equal((html.match(/Sponsored Example/g)||[]).length,4);
  for(const offer of studentOffers)assert.ok(html.includes(offer.description));
  assert.ok(html.includes('href="/advertise"'));
  assert.ok(html.includes('No official partnerships are implied.'));
});

test('advertising information is public and reuses contact without adding a submission form',()=>{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});
  try{
    const html=renderToStaticMarkup(createElement(MemoryRouter,null,createElement(InformationPage,{page:'advertise'})));
    for(const text of ['Who can advertise','Advertising formats','Advertising inquiries','sponsored cards','promotional banners','featured offers','href="/contact"','Back to home'])assert.ok(html.toLowerCase().includes(text.toLowerCase()),text);
    assert.ok(!html.includes('<form'));
  }finally{delete (globalThis as any).localStorage;}
});
