import {createHash,randomBytes} from 'node:crypto';
import bcrypt from 'bcrypt';
import type {PoolConnection} from 'mysql2/promise';
import {seedListings} from '../src/lib/demoListings';
import {ApiError} from './errors';
import {rows} from './community/shared';

function presentationId(key:string){
  const hex=createHash('sha256').update('acadex-presentation-listings-v1:'+key).digest('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

export const presentationListings=seedListings.map(item=>({
  ...item,
  id:presentationId('listing:'+item.id),
  ownerId:presentationId('seller:'+item.id),
  email:`presentation-${item.id}@acadex.example`,
  imageId:presentationId('image:'+item.id),
}));

export async function presentationListingStatus(connection:PoolConnection){
  const records=await rows(connection,'SELECT l.id,l.owner_id,l.status,l.is_hidden,u.email FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id IN ('+presentationListings.map(()=>'?').join(',')+')',presentationListings.map(item=>item.id));
  const owned=records.filter(row=>presentationListings.some(item=>item.id===row.id&&item.ownerId===row.owner_id&&item.email===row.email));
  return {available:presentationListings.length,imported:owned.length,visible:owned.filter(row=>row.status==='ACTIVE'&&!row.is_hidden).length};
}

export async function setPresentationListings(connection:PoolConnection,mode:'restore'|'hide'){
  // Reserved identities have no usable credentials and can never sign in.
  const passwordHash=mode==='restore'?await bcrypt.hash(randomBytes(48).toString('hex'),12):'';
  for(const item of presentationListings){
    const [owner]=await rows(connection,'SELECT id,email FROM users WHERE id=? OR email=? FOR UPDATE',[item.ownerId,item.email]);
    if(owner&&(owner.id!==item.ownerId||owner.email!==item.email))throw new ApiError(409,'A presentation identity conflicts with an existing account. No changes were saved.');
    const [existing]=await rows(connection,'SELECT owner_id FROM listings WHERE id=? FOR UPDATE',[item.id]);
    if(existing&&existing.owner_id!==item.ownerId)throw new ApiError(409,'A presentation listing conflicts with existing content. No changes were saved.');
    if(mode==='hide'){
      if(owner&&existing)await connection.execute('UPDATE listings SET is_hidden=TRUE WHERE id=? AND owner_id=?',[item.id,item.ownerId]);
      continue;
    }
    if(!owner)await connection.execute('INSERT INTO users (id,name,email,password_hash,role,is_verified,is_suspended) VALUES (?,?,?,?,\'student\',FALSE,TRUE)',[item.ownerId,item.seller,item.email,passwordHash]);
    if(!existing){
      await connection.execute('INSERT INTO listings (id,owner_id,title,description,price,category,item_condition,location,status,pickup_available,seller_delivery,created_at) VALUES (?,?,?,?,?,?,?,?,\'ACTIVE\',TRUE,FALSE,?)',[item.id,item.ownerId,item.title,item.description||`${item.title}. ${item.subtitle}. Condition: ${item.condition}. Available for collection in ${item.location}.`,item.price,item.category,item.condition,item.location,new Date(item.createdAt)]);
      await connection.execute('INSERT INTO listing_images (id,listing_id,image_url,position) VALUES (?,?,?,0)',[item.imageId,item.id,item.image]);
    }else{
      await connection.execute('UPDATE listings SET is_hidden=FALSE WHERE id=? AND owner_id=?',[item.id,item.ownerId]);
    }
  }
  return presentationListingStatus(connection);
}
