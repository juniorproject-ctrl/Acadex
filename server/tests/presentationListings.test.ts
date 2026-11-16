import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {presentationListings,setPresentationListings} from '../presentationListings';

test('presentation collection preserves the original 50 items and adds 11 approved listings',()=>{
  assert.equal(presentationListings.length,61);
  assert.equal(presentationListings.filter(item=>item.email.startsWith('presentation-seed-')).length,50);
  const ids=presentationListings.flatMap(item=>[item.id,item.ownerId,...item.imageIds]);
  assert.equal(new Set(ids).size,184);
  for(const item of presentationListings){
    assert.match(item.email,/^presentation-(seed-\d+|extra-[a-z-]+)@acadex\.example$/);
    assert.ok(item.seller.includes(' '));
    assert.equal(item.image,item.images[0]);
    assert.equal(item.imageId,item.imageIds[0]);
    for(const image of item.images)assert.ok(fs.existsSync(path.join(process.cwd(),'public',image)),image);
    assert.ok(!/demo|sample/i.test(item.title));
  }
});

test('new category collection has one boxing listing with both supplied photos',()=>{
  const extras=presentationListings.filter(item=>item.email.startsWith('presentation-extra-'));
  assert.equal(extras.filter(item=>item.category==='Sports & Fitness').length,4);
  assert.equal(extras.filter(item=>item.category==='Art & Design').length,3);
  assert.equal(extras.filter(item=>item.category==='Musical Instruments').length,1);
  assert.equal(extras.filter(item=>item.category==='Home Essentials').length,3);
  assert.equal(extras.filter(item=>item.category==='Clothing & Accessories').length,0);
  const boxing=extras.filter(item=>item.title.includes('Boxing'));
  assert.equal(boxing.length,1);assert.equal(boxing[0].images.length,2);
  assert.notEqual(boxing[0].imageIds[0],boxing[0].imageIds[1]);
});

test('presentation restore is idempotent and hide affects only its reserved collection',async()=>{
  const users=new Map<string,any>(),listings=new Map<string,any>();let images=0;
  listings.set('real-user-listing',{id:'real-user-listing',owner_id:'real-user',status:'ACTIVE',is_hidden:0});
  const c:any={execute:async(sql:string,p:any[])=>{
    if(sql.startsWith('SELECT id,email FROM users'))return [[...users.values()].filter(u=>u.id===p[0]||u.email===p[1])];
    if(sql.startsWith('SELECT owner_id FROM listings'))return [listings.has(p[0])?[listings.get(p[0])]:[]];
    if(sql.startsWith('INSERT INTO users')){assert.ok(sql.includes('FALSE,TRUE'));users.set(p[0],{id:p[0],email:p[2]});return [[]];}
    if(sql.startsWith('INSERT INTO listings')){listings.set(p[0],{id:p[0],owner_id:p[1],status:'ACTIVE',is_hidden:0});return [[]];}
    if(sql.startsWith('INSERT INTO listing_images')){images++;return [[]];}
    if(sql.startsWith('UPDATE listings')){const item=listings.get(p[0]);assert.equal(item.owner_id,p[1]);item.is_hidden=sql.includes('=TRUE')?1:0;return [[]];}
    if(sql.startsWith('SELECT l.id'))return [[...listings.values()].filter(l=>users.has(l.owner_id)).map(l=>({...l,email:users.get(l.owner_id).email}))];
    throw new Error('Unexpected query: '+sql);
  }};
  assert.equal((await setPresentationListings(c,'restore')).visible,61);
  assert.equal((await setPresentationListings(c,'restore')).visible,61);
  assert.equal(users.size,61);assert.equal(listings.size,62);assert.equal(images,62);
  assert.equal((await setPresentationListings(c,'hide')).visible,0);
  assert.equal(listings.get('real-user-listing').is_hidden,0);
  assert.equal((await setPresentationListings(c,'restore')).visible,61);
  assert.equal(images,62);
});

test('presentation import refuses to take over an unrelated identity',async()=>{
  const c:any={execute:async()=>[[{id:'unrelated-account',email:presentationListings[0].email}]]};
  await assert.rejects(setPresentationListings(c,'restore'),/conflicts with an existing account/);
});
