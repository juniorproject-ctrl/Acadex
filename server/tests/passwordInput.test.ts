import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import PasswordInput from '../../src/components/PasswordInput';
import {Field} from '../../src/components/CommunityUI';

test('password inputs start masked and visibility buttons never submit a form',()=>{
  const html=renderToStaticMarkup(createElement(PasswordInput,{name:'currentPassword',autoComplete:'current-password',required:true}));
  assert.ok(html.includes('type="password"'));assert.ok(html.includes('type="button"'));
  assert.ok(html.includes('aria-label="Show password"'));assert.ok(html.includes('aria-pressed="false"'));
  assert.ok(html.includes('name="currentPassword"'));assert.ok(html.includes('autoComplete="current-password"'));
});
test('password labels and validation attributes reach the input through shared fields',()=>{
  const html=renderToStaticMarkup(createElement(Field,{label:'New password',children:createElement(PasswordInput,{visibilityLabel:'new password',minLength:8,required:true,disabled:true,'aria-describedby':'requirements'})}));
  assert.ok(html.includes('aria-label="Show new password"'));assert.ok(html.includes('aria-labelledby='));
  assert.ok(html.includes('aria-describedby="requirements"'));assert.ok(html.includes('minLength="8"'));
  assert.equal((html.match(/disabled=""/g)||[]).length,2);
});
