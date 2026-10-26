export const MAX_LISTING_PHOTOS=5;
export const MAX_LISTING_PHOTO_BYTES=5*1024*1024;
export const LISTING_PHOTO_TYPES=['image/jpeg','image/png','image/webp'];
export const LISTING_PHOTO_HINT='Up to 5 photos, maximum 5 MB each. JPG, PNG or WebP. The first photo is the cover.';
export function listingPhotoError(files:{name:string;size:number;type:string}[],existing=0){
  if(existing+files.length>MAX_LISTING_PHOTOS)return 'You can upload up to 5 photos. Remove a photo before adding more.';
  for(const file of files){
    if(!LISTING_PHOTO_TYPES.includes(file.type))return file.name+': choose a JPG, PNG or WebP image.';
    if(file.size>MAX_LISTING_PHOTO_BYTES)return file.name+': this photo exceeds 5 MB. Choose a smaller image.';
  }
  return '';
}
