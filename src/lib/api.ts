export type SessionUser = { id: string; name: string; email: string; role: string };
export type ApiListing = {
  id: string; ownerId: string; title: string; subtitle: string; description: string; price: number;
  category: string; condition: string; location: string; status: 'draft' | 'active' | 'sold'; seller: string;
  image: string; images: string[]; createdAt: string; updatedAt: string;
};

const TOKEN_KEY = 'acadex_access_token';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(token: string) { localStorage.setItem(TOKEN_KEY, token); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

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
