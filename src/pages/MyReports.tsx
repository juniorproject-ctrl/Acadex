import {Link} from 'react-router-dom';
import {useResource,dateTime} from '../lib/community';
import {CommunityPage,Empty,ErrorBox} from '../components/CommunityUI';
type Report={id:string;subject:string;details:string;status:string;replies:{id:string;body:string;author:string;createdAt:string}[]};
export default function MyReports(){
  const result=useResource<{items:Report[]}>('/reports/mine',15000);
  return <CommunityPage title="My reports" showTabs={false} action={<Link className="action-button" to="/report">New report</Link>}><ErrorBox error={result.error}/>
    {result.loading?<Empty>Loading reports...</Empty>:result.data?.items.length?result.data.items.map(item=><article className="detail-section" key={item.id}><h2>{item.subject}</h2><p className="status-badge">{item.status}</p><p className="preserve-lines my-4">{item.details}</p>{item.replies.map(reply=><div className="border-l-2 pl-4 my-4" key={reply.id}><strong>Acadex team</strong><p className="muted">{dateTime(reply.createdAt)}</p><p className="preserve-lines">{reply.body}</p></div>)}</article>):!result.error&&<Empty>No reports submitted yet.</Empty>}
  </CommunityPage>;
}
