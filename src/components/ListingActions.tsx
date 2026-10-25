import { useNavigate, Link } from 'react-router-dom';
import { MessageCircle, ShoppingBag } from 'lucide-react';
import { type ApiListing } from '../lib/api';
import { getCurrentUser } from '../lib/auth';
import { mutate } from '../lib/community';
import { ActionStatus, useAction } from './CommunityUI';

export default function ListingActions({listing}: {listing: ApiListing}) {
  const navigate = useNavigate(), action = useAction();
  if (listing.ownerId === getCurrentUser()?.id) return null;
  return <div className="flex flex-col gap-3 my-3">
    <button className="secondary-button" disabled={action.busy} onClick={() => void action.run(async () => {
      const result = await mutate<{id: string}>('/messages', {listingId: listing.id});
      navigate('/messages/' + result.id);
    }, '')}><MessageCircle size={17}/>Chat with seller</button>
    {listing.price >= 2 && <Link to={'/checkout?kind=listing&reference='+listing.id} className="text-link"><ShoppingBag size={17}/>Buy item</Link>}
    <ActionStatus action={action}/>
  </div>;
}
