import { useParams } from 'react-router-dom';
import { useResource } from '../lib/community';
import { type ApiListing } from '../lib/api';
import { Empty, ErrorBox } from '../components/CommunityUI';
import ListingActions from '../components/ListingActions';
import ListingGallery from '../components/ListingGallery';

export default function ListingDetail() {
  const {id} = useParams();
  const result = useResource<{listing: ApiListing}>('/listings/'+id);
  const listing = result.data?.listing;
  return <div className="community-page"><ErrorBox error={result.error}/>{result.loading && <Empty>Loading listing...</Empty>}{listing && <>
    <header className="community-heading"><h1>{listing.title}</h1></header>
    <div className="event-detail"><ListingGallery key={listing.id} images={listing.images.length?listing.images:listing.image?[listing.image]:[]} title={listing.title}/>
    <div><h2>AED {listing.price.toFixed(2)}</h2><p>{listing.condition} | {listing.location}</p><p className="preserve-lines">{listing.description}</p>
      <p>Seller: {listing.seller}</p><h3>Handover</h3><p>{[listing.pickupAvailable && 'Buyer pickup', listing.sellerDelivery && 'Seller delivers personally'].filter(Boolean).join(' or ')}</p>
      <p className="muted">Agree on a place and time in chat. Acadex does not provide courier delivery.</p><ListingActions listing={listing}/>
    </div></div>
  </>}</div>;
}
