import {Link,useParams} from 'react-router-dom';
import {ArrowLeft} from 'lucide-react';
import {useCurrentUser} from '../lib/auth';
import {dateTime,useResource,type Booking} from '../lib/community';
import {CommunityPage,Empty,ErrorBox} from '../components/CommunityUI';
import BookingRow from '../components/BookingRow';

type Details=Booking&{university:string|null;subjects:string|null;createdAt:string};
export default function BookingDetail(){
  const {id}=useParams(),user=useCurrentUser();
  const result=useResource<{booking:Details}>(id?'/account/bookings/'+id:null,15000),b=result.data?.booking;
  const isTutor=b?.tutorId===user?.id;
  const messages=b?{
    pending:isTutor?`${b.student} requested this session. You can accept or decline the request below.`:`You requested a session with ${b.tutor}. Waiting for the tutor to respond.`,
    accepted:isTutor?`You accepted ${b.student}'s booking request.`:`${b.tutor} accepted your booking request.`,
    declined:isTutor?`You declined ${b.student}'s booking request.`:`${b.tutor} declined your booking request.`,
    cancelled:'This booking has been cancelled.'
  }:null;
  return <CommunityPage title="Booking details" showTabs={false} action={<Link className="text-link" to="/dashboard"><ArrowLeft size={16}/>My bookings</Link>}>
    <ErrorBox error={result.error}/>{result.loading?<Empty>Loading booking...</Empty>:b&&<div className="booking-detail">
      <p className="booking-message">{messages?.[b.status as keyof typeof messages]}</p>
      {b.university&&<p>{b.university}</p>}{b.subjects&&<p className="muted">Tutor subjects: {b.subjects}</p>}
      <p className="muted">Requested {dateTime(b.createdAt)}</p>
      <BookingRow key={b.id} booking={b} onChange={result.reload} showDetails={false}/>
    </div>}
  </CommunityPage>;
}
