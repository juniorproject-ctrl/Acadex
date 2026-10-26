import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import VerifyOTP from '../../src/pages/VerifyOTP';

test('verification opens directly without signup or a saved email',()=>{
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=>null}});
  try{
    const html=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:['/verify']},createElement(VerifyOTP)));
    assert.ok(html.includes('name="email"'));assert.ok(html.includes('name="code"'));
    assert.ok(html.includes('Send / resend code'));assert.ok(html.includes('href="/"'));assert.ok(!html.includes('/signup'));
  }finally{delete (globalThis as any).sessionStorage;}
});
test('administrator Gmail address can be passed to the code screen',()=>{
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=>null}});
  try{
    const html=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:[{pathname:'/verify',state:{email:'acadexcampus@gmail.com'}}]},createElement(VerifyOTP)));
    assert.ok(html.includes('value="acadexcampus@gmail.com"'));assert.match(html,/autocomplete="one-time-code"/i);
  }finally{delete (globalThis as any).sessionStorage;}
});
