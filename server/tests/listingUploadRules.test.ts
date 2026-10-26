import test from 'node:test';
import assert from 'node:assert/strict';
import {listingPhotoError,MAX_LISTING_PHOTO_BYTES} from '../../src/lib/listingUploadRules';
test('photo upload rules explain size, format and count limits',()=>{
 const image={name:'book.jpg',type:'image/jpeg',size:MAX_LISTING_PHOTO_BYTES};
 assert.equal(listingPhotoError([image]),'');
 assert.match(listingPhotoError([{...image,size:image.size+1}]),/5 MB/);
 assert.match(listingPhotoError([{...image,type:'image/heic'}]),/JPG, PNG or WebP/);
 assert.match(listingPhotoError([image],5),/up to 5 photos/);
});
