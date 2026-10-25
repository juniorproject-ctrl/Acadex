import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { type ApiListing } from '../lib/api';
import { useResource } from '../lib/community';
import { Empty, ErrorBox } from '../components/CommunityUI';
import ListingActions from '../components/ListingActions';

export default function MyListings(){
  const result=useResource<{listings:ApiListing[]}>('/listings/mine');
  useEffect(()=>{window.addEventListener('acadex-listings',result.reload);return()=>window.removeEventListener('acadex-listings',result.reload);},[result.reload]);
  return <div className="community-page"><header className="community-heading"><h1>My listings</h1><Link className="action-button" to="/post"><Plus size={18}/>New listing</Link></header><ErrorBox error={result.error}/>
    {result.loading?<Empty>Loading your listings...</Empty>:result.data?.listings.length?<div className="community-grid">{result.data.listings.map(listing=><article key={listing.id} className="community-card">
      {listing.image&&<img src={listing.image} alt={listing.title} className="w-full h-48 object-cover rounded"/>}
      <h2>{listing.status==='active'?<Link to={'/listings/'+listing.id}>{listing.title}</Link>:listing.title}</h2><p>AED {listing.price.toFixed(2)}</p><span className="status-badge">{listing.status}</span>
      <ListingActions listing={listing}/>
    </article>)}</div>:!result.error&&<Empty>You have no listings yet.</Empty>}
  </div>;
}
