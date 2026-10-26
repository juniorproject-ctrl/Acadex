import { useNavigate, Link } from 'react-router-dom';
import { MessageCircle, ShoppingBag, Pencil, Trash2 } from 'lucide-react';
import { api, type ApiListing } from '../lib/api';
import { getCurrentUser } from '../lib/auth';
import { mutate } from '../lib/community';
import { ActionStatus, useAction } from './CommunityUI';
import ReportLink from './ReportLink';

export default function ListingActions({listing}: {listing: ApiListing}) {
  const navigate = useNavigate(), action = useAction();
  if (listing.ownerId === getCurrentUser()?.id) return <div className="my-3">
    <div className="flex flex-wrap gap-3">
      {listing.status!=='sold'&&<Link className="secondary-button" to={'/post?edit='+listing.id}><Pencil size={16}/>Edit</Link>}
      <button type="button" className="secondary-button" disabled={action.busy} onClick={()=>{
        if(window.confirm('Delete "'+listing.title+'"? This cannot be undone.'))void action.run(async()=>{
          await api.deleteListing(listing.id);navigate('/my-listings',{replace:true});window.dispatchEvent(new Event('acadex-listings'));
        },'');
      }}><Trash2 size={16}/>Delete</button>
    </div><ActionStatus action={action}/>
  </div>;
  return <div className="flex flex-col gap-3 my-3">
    <button className="secondary-button" disabled={action.busy} onClick={() => void action.run(async () => {
      const result = await mutate<{id: string}>('/messages', {listingId: listing.id});
      navigate('/messages/' + result.id);
    }, '')}><MessageCircle size={17}/>Chat with seller</button>
    {listing.price >= 2 && <Link to={'/checkout?kind=listing&reference='+listing.id} className="text-link"><ShoppingBag size={17}/>Buy item</Link>}
    <ActionStatus action={action}/>
    <ReportLink kind="listing" id={listing.id} title={listing.title} ownerId={listing.ownerId}/>
  </div>;
}
