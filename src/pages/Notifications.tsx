import { Link } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import { dateTime,mutate,useResource,type NotificationData } from '../lib/community';
import { ActionStatus,CommunityPage,Empty,ErrorBox,useAction } from '../components/CommunityUI';
export default function Notifications() {
  const result=useResource<NotificationData>('/account/notifications',30000),action=useAction();
  return <CommunityPage title="Notifications" action={<button className="secondary-button" disabled={action.busy||!result.data?.unread} onClick={()=>void action.run(async()=>{await mutate('/account/notifications/read',undefined,'PATCH');result.reload();window.dispatchEvent(new Event('acadex-notifications'));},'Notifications marked as read.')}><CheckCheck size={18}/>Mark all read</button>}><ErrorBox error={result.error}/><ActionStatus action={action}/>{result.loading?<Empty>Loading notifications...</Empty>:!result.data?.items.length?<Empty>No notifications yet.</Empty>:<div>{result.data.items.map(n=><Link key={n.id} to={n.href} className={'notification-row '+(!n.isRead?'unread':'')}><strong>{n.title}</strong><time className="muted">{dateTime(n.createdAt)}</time></Link>)}</div>}</CommunityPage>;
}
