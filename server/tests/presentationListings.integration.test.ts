import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {config} from '../config';
import {pool} from '../db';
import {rows} from '../community/shared';
import {presentationListings,setPresentationListings} from '../presentationListings';

const localDatabase=['localhost','127.0.0.1','[::1]'].includes(new URL(config.databaseUrl()).hostname);
test('presentation collection restores and hides in MySQL without altering unrelated listings',{skip:process.env.PRESENTATION_INTEGRATION!=='1'||!localDatabase},async()=>{
  const c=await pool.getConnection();
  try{
    await c.beginTransaction();
    const user=randomUUID(),listing=randomUUID();
    await c.execute('INSERT INTO users (id,name,email,password_hash) VALUES (?,?,?,?)',[user,'Unrelated QA',user+'@example.test','disabled-test-login']);
    await c.execute('INSERT INTO listings (id,owner_id,title,description,status) VALUES (?,?,?,?,\'ACTIVE\')',[listing,user,'Unrelated QA listing','Temporary unrelated listing, rolled back after this check.']);
    assert.equal((await setPresentationListings(c,'restore')).visible,61);
    assert.equal((await setPresentationListings(c,'restore')).imported,61);
    const accounts=await rows(c,'SELECT is_verified,is_suspended,email FROM users WHERE id IN ('+presentationListings.map(()=>'?').join(',')+')',presentationListings.map(item=>item.ownerId));
    assert.equal(accounts.length,61);
    assert.ok(accounts.every(u=>!u.is_verified&&u.is_suspended));
    const images=await rows(c,'SELECT id,listing_id,image_url,position FROM listing_images WHERE listing_id IN ('+presentationListings.map(()=>'?').join(',')+')',presentationListings.map(item=>item.id));
    assert.equal(images.length,62);
    const boxing=presentationListings.find(item=>item.title.includes('Boxing'))!;
    assert.deepEqual(images.filter(image=>image.listing_id===boxing.id).sort((a,b)=>a.position-b.position).map(image=>image.image_url),boxing.images);
    assert.equal((await setPresentationListings(c,'hide')).visible,0);
    const [unrelated]=await rows(c,'SELECT is_hidden,status FROM listings WHERE id=?',[listing]);
    assert.equal(unrelated.is_hidden,0);assert.equal(unrelated.status,'ACTIVE');
  }finally{await c.rollback();c.release();await pool.end();}
});
