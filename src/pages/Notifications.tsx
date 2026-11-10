import { Link,useNavigate } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import { dateTime,mutate,useResource,type NotificationData } from '../lib/community';
import { ActionStatus,CommunityPage,Empty,ErrorBox,useAction } from '../components/CommunityUI';
export default function Notifications() {
  const result=useResource<NotificationData>('/account/notifications',30000),action=useAction(),navigate=useNavigate();
  const updated=()=>window.dispatchEvent(new Event('acadex-notifications'));
  return <CommunityPage title="Notifications" action={<button className="secondary-button" disabled={action.busy||!result.data?.unread} onClick={()=>void action.run(async()=>{await mutate('/account/notifications/read',undefined,'PATCH');result.reload();updated();},'Notifications marked as read.')}><CheckCheck size={18}/>Mark all read</button>}>
    <ErrorBox error={result.error}/><ActionStatus action={action}/>
    {result.loading?<Empty>Loading notifications...</Empty>:!result.data?.items.length?<Empty>No notifications yet.</Empty>:<div>{result.data.items.map(n=><Link key={n.id} to={n.href} className={'notification-row '+(!n.isRead?'unread':'read')} onClick={e=>{
      if(n.isRead)return;
      const newTab=e.ctrlKey||e.metaKey||e.shiftKey||e.altKey;
      if(!newTab)e.preventDefault();
      if(action.busy)return;
      void action.run(async()=>{await mutate('/account/notifications/'+n.id+'/read',undefined,'PATCH');updated();if(newTab)result.reload();else navigate(n.href);},'');
    }}><span className="notification-title"><strong>{n.title}</strong>{!n.isRead&&<span className="notification-unread-label">Unread</span>}</span><time className="muted">{dateTime(n.createdAt)}</time></Link>)}</div>}
  </CommunityPage>;
}
