import test from 'node:test';
import assert from 'node:assert/strict';
import {isPublicBrowseRequest} from '../middleware/publicBrowsing';
import {loginUrl,safeReturnTo} from '../../src/lib/loginRedirect';

test('public API allowlist is read-only and does not include private subresources',()=>{
  const roots=['listings','catalog','papers','groups','tutors','events'];
  for(const root of roots){
    for(const method of ['GET','HEAD'])assert.equal(isPublicBrowseRequest('/api/'+root,'/',method),true);
    for(const method of ['POST','PATCH','PUT','DELETE'])assert.equal(isPublicBrowseRequest('/api/'+root,'/',method),false);
  }
  for(const root of ['listings','groups','tutors','events'])assert.equal(isPublicBrowseRequest('/api/'+root,'/example-id','GET'),true);
  for(const [root,path] of [['listings','/mine'],['listings','/MINE/'],['papers','/id/download'],['groups','/id/room'],['groups','/id/messages'],['groups','/id/members'],['tutors','/bookings/id'],['account','/notifications'],['catalog','/entries']])assert.equal(isPublicBrowseRequest('/api/'+root,path,'GET'),false,root+path);
});

test('sign-in return addresses preserve local destinations and reject redirects off site',()=>{
  assert.equal(safeReturnTo('/post?edit=abc#photos'),'/post?edit=abc#photos');
  assert.equal(new URLSearchParams(loginUrl('/study-groups/abc').split('?')[1]).get('returnTo'),'/study-groups/abc');
  for(const value of [null,'https://evil.example','//evil.example','/\\evil.example','/%2f%2fevil.example','/%5cevil','/login?returnTo=/post','/LOGIN/','/signup','/verify','/%00bad'])assert.equal(safeReturnTo(value),'/home',String(value));
});
