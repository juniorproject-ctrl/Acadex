const KEY='acadex_return_to';

export function safeReturnTo(value:unknown,fallback='/home') {
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u001f]/.test(value))return fallback;
  try{
    const url=new URL(value,'https://acadex.invalid'),decoded=decodeURIComponent(url.pathname);
    if(url.origin!=='https://acadex.invalid'||decoded.startsWith('//')||/[\\\u0000-\u001f]/.test(decoded)||['/login','/signup','/verify','/forgot-password'].includes(url.pathname.replace(/\/+$/,'').toLowerCase()))return fallback;
    return url.pathname+url.search+url.hash;
  }catch{return fallback;}
}
export function loginUrl(destination:string){return '/login?'+new URLSearchParams({returnTo:safeReturnTo(destination)});}
export function rememberReturnTo(value:unknown){if(typeof value==='string')sessionStorage.setItem(KEY,safeReturnTo(value));}
export function consumeReturnTo(fallback='/home'){
  const destination=sessionStorage.getItem(KEY);sessionStorage.removeItem(KEY);return safeReturnTo(destination,fallback);
}
export function redirectToSignIn():never {
  const destination=window.location.pathname+window.location.search+window.location.hash;
  rememberReturnTo(destination);window.location.assign(loginUrl(destination));
  throw new Error('Please sign in to continue.');
}
