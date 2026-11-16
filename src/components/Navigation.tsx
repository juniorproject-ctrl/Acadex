import { Link, NavLink, useLocation } from 'react-router-dom';
import { Bell, Menu, X, MessageCircle } from 'lucide-react';
import type { Inbox } from '../pages/Messages';
import { useEffect, useState } from 'react';
import { useResource, type NotificationData } from '../lib/community';
import BrandLogo from './BrandLogo';
import AccountMenu from './AccountMenu';
import { getCurrentUser,updateSessionUser } from '../lib/auth';
import { api } from '../lib/api';
import {loginUrl} from '../lib/loginRedirect';

export default function Navigation() {
  const location = useLocation();
  const isAuthPage = ['/login', '/signup', '/verify','/forgot-password'].includes(location.pathname);
  const [currentUser,setCurrentUser] = useState(getCurrentUser);
  useEffect(()=>{const update=()=>setCurrentUser(getCurrentUser());window.addEventListener('acadex-session',update);return()=>window.removeEventListener('acadex-session',update);},[]);
  useEffect(()=>{if(!getCurrentUser())return;let active=true;api.me().then(({user})=>{if(active){setCurrentUser(user);updateSessionUser(user);}}).catch(()=>{});return()=>{active=false;};},[location.pathname]);
  const [menu,setMenu] = useState(false);
  const notifications = useResource<NotificationData>(currentUser ? '/account/notifications' : null, 30000);
  const inbox = useResource<Inbox>(currentUser ? '/messages' : null, 10000);
  const unread = inbox.data?.items.reduce((sum,item)=>sum+Number(item.unread),0) || 0;
  useEffect(()=>{setMenu(false);},[location.pathname]);
  useEffect(()=>{const reload=notifications.reload;window.addEventListener('acadex-notifications',reload);return()=>window.removeEventListener('acadex-notifications',reload);},[notifications.reload]);

  if (isAuthPage) return null;

  return (
    <nav className="site-navigation bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="site-nav-row flex justify-between h-20 items-center">
          <div className="shrink-0">
            <BrandLogo linked size="sm" />
          </div>
            
            <div className="site-nav-links hidden xl:flex gap-5">
              <NavLink to="/home" className={'nav-link'+(location.pathname==='/'?' active':'')}>Home</NavLink>
              <NavLink to="/browse" className="nav-link">Browse Listings</NavLink>
              <NavLink to="/post" className="nav-link">Post a Listing</NavLink>
              <NavLink to="/community" className="nav-link">Community</NavLink>
              <NavLink to="/feedback" className="nav-link">Feedback</NavLink>
              {currentUser&&<NavLink to="/dashboard" className="nav-link">{['tutor','leader','admin'].includes(currentUser.role)?'Dashboard':'My Learning'}</NavLink>}
            </div>

          <div className="site-nav-actions flex items-center gap-2">
            {currentUser&&<Link to="/messages" className="icon-button relative" title="Messages" aria-label={`Messages, ${unread} unread`}><MessageCircle size={21}/>{unread>0&&<span className="notification-count">{unread>99?'99+':unread}</span>}</Link>}
            {currentUser&&<Link to="/notifications" className="icon-button relative" title="Notifications" aria-label={`Notifications, ${notifications.data?.unread||0} unread`}><Bell size={21}/>{!!notifications.data?.unread&&<span className="notification-count">{notifications.data.unread>99?'99+':notifications.data.unread}</span>}</Link>}
            <button className="icon-button mobile-menu-button" aria-label="Toggle navigation" aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X size={21}/>:<Menu size={21}/>}</button>
            {currentUser&&<AccountMenu/>}
            {!currentUser&&<Link to={loginUrl(location.pathname+location.search)} className="secondary-button guest-sign-in">Sign in</Link>}
          </div>
        </div>
        {menu&&<div className="mobile-navigation"><Link to="/home">Home</Link><Link to="/browse">Browse Listings</Link><Link to="/post">Post a Listing</Link><Link to="/community">Community</Link><Link to="/feedback">Feedback</Link>{currentUser&&<Link to="/dashboard">Dashboard / My Learning</Link>}</div>}
      </div>
    </nav>
  );
}
