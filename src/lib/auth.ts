import { clearToken, getToken, setToken, type SessionUser } from './api';
import { useEffect,useState } from 'react';

const USER_KEY = 'acadex_session_user';

export function updateSessionUser(user: SessionUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event('acadex-session'));
}

export function setSession(token: string, user: SessionUser) {
  setToken(token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  clearToken();
  localStorage.removeItem(USER_KEY);
}

export function getCurrentUser(): SessionUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    clearSession();
    return null;
  }
}

export function hasSession() {
  return Boolean(getToken());
}

export function useCurrentUser(){
  const [user,setUser]=useState(getCurrentUser);
  useEffect(()=>{const update=()=>setUser(getCurrentUser());window.addEventListener('acadex-session',update);return()=>window.removeEventListener('acadex-session',update);},[]);
  return user;
}
