import { Link, useLocation } from 'react-router-dom';
import { Bell, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useResource, type NotificationData } from '../lib/community';
import BrandLogo from './BrandLogo';
import AccountMenu from './AccountMenu';
import { getCurrentUser,updateSessionUser } from '../lib/auth';
import { api } from '../lib/api';

export default function Navigation() {
  const location = useLocation();
  const isAuthPage = ['/', '/login', '/signup', '/verify'].includes(location.pathname);
  const [currentUser,setCurrentUser] = useState(getCurrentUser);
  useEffect(()=>{if(!getCurrentUser())return;let active=true;api.me().then(({user})=>{if(active){setCurrentUser(user);updateSessionUser(user);}}).catch(()=>{});return()=>{active=false;};},[location.pathname]);
  const [menu,setMenu] = useState(false);
  const notifications = useResource<NotificationData>(currentUser ? '/account/notifications' : null, 30000);
  useEffect(()=>{setMenu(false);},[location.pathname]);
  useEffect(()=>{const reload=notifications.reload;window.addEventListener('acadex-notifications',reload);return()=>window.removeEventListener('acadex-notifications',reload);},[notifications.reload]);

  if (isAuthPage) return null;

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center gap-5">
            <BrandLogo linked size="sm" />
            
            <div className="hidden xl:flex gap-5">
              <Link to="/home" className="nav-link">Home</Link>
              <Link to="/browse" className="nav-link">Browse Listings</Link>
              <Link to="/post" className="nav-link">Post a Listing</Link>
              <Link to="/community" className="nav-link">Community</Link>
              {currentUser&&<Link to="/dashboard" className="nav-link">{['tutor','leader','admin'].includes(currentUser.role)?'Dashboard':'My Learning'}</Link>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser&&<Link to="/notifications" className="icon-button relative" title="Notifications" aria-label={`Notifications, ${notifications.data?.unread||0} unread`}><Bell size={21}/>{!!notifications.data?.unread&&<span className="notification-count">{notifications.data.unread>99?'99+':notifications.data.unread}</span>}</Link>}
            <button className="icon-button mobile-menu-button" aria-label="Toggle navigation" aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X size={21}/>:<Menu size={21}/>}</button>
            {currentUser&&<AccountMenu/>}
            {!currentUser&&<Link to="/" className="text-link">Sign in</Link>}
          </div>
        </div>
        {menu&&<div className="mobile-navigation"><Link to="/home">Home</Link><Link to="/browse">Browse Listings</Link><Link to="/post">Post a Listing</Link><Link to="/community">Community</Link>{currentUser&&<Link to="/dashboard">Dashboard / My Learning</Link>}</div>}
      </div>
    </nav>
  );
}
