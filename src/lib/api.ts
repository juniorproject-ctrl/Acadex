export type SessionUser = { id: string; name: string; email: string; role: string };
export type ApiListing = {
  id: string; ownerId: string; title: string; subtitle: string; description: string; price: number;
  category: string; condition: string; location: string; status: 'draft' | 'active' | 'sold'; seller: string;
  image: string; images: string[]; createdAt: string; updatedAt: string;
  pickupAvailable: boolean; sellerDelivery: boolean;
  hidden?: boolean;
};

const TOKEN_KEY = 'acadex_access_token';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(token: string) { localStorage.setItem(TOKEN_KEY, token); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

export async function downloadPdf(path:string,title:string) {
  const token=getToken();
  const response=await fetch('/api'+path,{headers:token?{Authorization:'Bearer '+token}:{},cache:'no-store'});
  if(!response.ok){
    if(response.status===401)clearToken();
    const data=await response.json().catch(()=>null);
    throw new Error(data?.error||'The PDF could not be downloaded. Please try again.');
  }
  if(!response.headers.get('content-type')?.toLowerCase().startsWith('application/pdf'))throw new Error('The server did not return a PDF.');
  const file=await response.blob();
  if(await file.slice(0,5).text()!=='%PDF-')throw new Error('The downloaded file is not a valid PDF.');
  const url=URL.createObjectURL(file),link=document.createElement('a');
  link.href=url;link.download=(title.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'').trim().slice(0,100)||'Past paper')+'.pdf';
  document.body.appendChild(link);link.click();link.remove();
  // Give mobile browsers time to open their download/share UI before releasing the file.
  window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    if (response.status === 401) clearToken();
    throw new Error(data?.error || 'The request could not be completed.');
  }
  return data as T;
}

export const api = {
  register: (input: { name: string; email: string; password: string; role: string }) => request<{ message: string; email: string }>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  resendOtp: (email: string) => request<{ message: string }>('/auth/resend-otp', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyOtp: (email: string, code: string) => request<{ token: string; user: SessionUser }>('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, code }) }),
  login: (email: string, password: string) => request<{ token: string; user: SessionUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: SessionUser }>('/auth/me'),
  listings: (params: URLSearchParams) => request<{ listings: ApiListing[]; total: number; page: number; limit: number }>(`/listings?${params.toString()}`),
  myListings: () => request<{ listings: ApiListing[] }>('/listings/mine'),
  createListing: (body: FormData) => request<{ listing: ApiListing }>('/listings', { method: 'POST', body }),
  updateListing: (id: string, body: FormData) => request<{ listing: ApiListing }>(`/listings/${id}`, { method: 'PATCH', body }),
  deleteListing: (id: string) => request<void>(`/listings/${id}`, { method: 'DELETE' }),
};
