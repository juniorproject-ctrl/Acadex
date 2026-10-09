import { useEffect,useRef,useState } from 'react';
import { Link,useLocation,useNavigate } from 'react-router-dom';
import { Accessibility,Bell,ChevronDown,CreditCard,GraduationCap,LayoutDashboard,LogOut,Settings,User } from 'lucide-react';
import { clearSession,getCurrentUser } from '../lib/auth';

export default function AccountMenu() {
  const [open,setOpen]=useState(false),[,refresh]=useState(0);
  const container=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const location=useLocation(),navigate=useNavigate(),user=getCurrentUser();
  useEffect(()=>{setOpen(false);},[location.pathname,location.hash]);
  useEffect(()=>{
    const update=()=>refresh(n=>n+1);
    const outside=(e:PointerEvent)=>{if(!container.current?.contains(e.target as Node))setOpen(false);};
    window.addEventListener('acadex-session',update);document.addEventListener('pointerdown',outside);
    return()=>{window.removeEventListener('acadex-session',update);document.removeEventListener('pointerdown',outside);};
  },[]);
  useEffect(()=>{if(open)container.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();},[open]);
  if(!user)return null;
  return <div className="account-menu" ref={container} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}} onKeyDown={e=>{
    if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
      e.preventDefault();if(!open){setOpen(true);return;}
      const items=Array.from(container.current!.querySelectorAll<HTMLElement>('[role="menuitem"]'));
      const index=items.indexOf(document.activeElement as HTMLElement);
      items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();
    }
  }}>
    <button ref={trigger} className="account-trigger" aria-label="Account menu" aria-haspopup="menu" aria-expanded={open} aria-controls="account-options" onClick={()=>setOpen(!open)}>
      <span className="hidden xl:block account-name">{user.name}</span><User size={23}/><ChevronDown size={15}/>
    </button>
    {open&&<div id="account-options" className="account-options" role="menu" aria-label="Account">
      <p className="account-caption">{user.name}</p>
      <Link role="menuitem" to="/dashboard"><LayoutDashboard size={18}/>{user.role==='admin'?'Admin dashboard':user.role==='tutor'?'Tutor dashboard':user.role==='student'?'My Learning':'Dashboard'}</Link>
      <Link role="menuitem" to="/notifications"><Bell size={18}/>Notifications</Link>
      <Link role="menuitem" to="/payments"><CreditCard size={18}/>My payments</Link>
      <Link role="menuitem" to="/settings"><Settings size={18}/>Account settings</Link>
      <Link role="menuitem" to="/report"><Bell size={18}/>Report a problem</Link>
      {user.role==='admin'?<Link role="menuitem" to="/admin/tutor-applications"><GraduationCap size={18}/>Tutor applications</Link>:<Link role="menuitem" to="/apply-tutor"><GraduationCap size={18}/>{user.role==='tutor'?'Tutor application':'Apply to tutor'}</Link>}
      <Link role="menuitem" to="/accessibility"><Accessibility size={18}/>Accessibility</Link>
      <button role="menuitem" onClick={()=>{clearSession();navigate('/');}}><LogOut size={18}/>Sign out</button>
    </div>}
  </div>;
}
