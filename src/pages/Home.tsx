import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, FileText, Users, Monitor, PenTool, Calendar, GraduationCap, Search, UserRound } from 'lucide-react';
import { api, type ApiListing } from '../lib/api';
import { searchCategories, searchDestination } from '../lib/search';
import StudentOffers from '../components/StudentOffers';

const categories = [
  { icon: BookOpen, name: 'Textbooks', tone: 'mint' },
  { icon: FileText, name: 'Past Papers', tone: 'sky' },
  { icon: Users, name: 'Study Groups', tone: 'mint' },
  { icon: Monitor, name: 'Electronics', tone: 'sky' },
  { icon: PenTool, name: 'Supplies', tone: 'peach' },
  { icon: Calendar, name: 'Campus Events', tone: 'peach' },
  { icon: GraduationCap, name: 'Tutors', tone: 'sun' },
];

export default function Home() {
  const navigate = useNavigate();
  const [featured, setFeatured] = useState<ApiListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    let active = true;
    api.listings(new URLSearchParams({ page: '1', limit: '4' }))
      .then(result => { if (active) setFeatured(result.listings); })
      .catch(() => { if (active) setFeatured([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <div className="campus-home">
    <section className="campus-hero" aria-labelledby="campus-title">
      <div className="campus-inner campus-hero-content">
        <p className="campus-eyebrow">Made for your campus life</p>
        <h1 id="campus-title">Your Campus<br/>Marketplace</h1>
        <span className="campus-accent" aria-hidden="true"/>
        <p className="campus-hero-copy">Buy, sell, and discover within your educational community.<br className="hidden sm:block"/> From textbooks to tutoring, find it all here.</p>
        <form className="campus-search" onSubmit={e => { e.preventDefault(); navigate(searchDestination(search, category)); }}>
          <div className="campus-search-input"><Search size={21} aria-hidden="true"/><input type="search" aria-label="Search Acadex" placeholder="Textbooks, laptops, courses..." value={search} onChange={e => setSearch(e.target.value)}/></div>
          <div className="campus-search-actions"><select aria-label="Search category" value={category} onChange={e => setCategory(e.target.value)}><option value="">All Categories</option>{searchCategories.map(name => <option key={name}>{name}</option>)}</select><button type="submit" className="action-button"><Search size={17} aria-hidden="true"/>Search</button></div>
        </form>
      </div>
    </section>

    <section className="campus-inner campus-categories" aria-labelledby="categories-title">
      <div className="campus-section-heading"><div><h2 id="categories-title">Browse Categories</h2><p>A little of everything for university life.</p></div></div>
      <div className="campus-category-grid">{categories.map(({ icon: Icon, name, tone }) => <Link key={name} to={searchDestination('', name)} className={'campus-category campus-tone-' + tone}><Icon size={26} aria-hidden="true"/><span>{name}</span></Link>)}</div>
    </section>

    <section className="campus-inner campus-featured" aria-labelledby="featured-title">
      <div className="campus-section-heading"><div><h2 id="featured-title">Featured Listings</h2><p>Recently posted on campus</p></div><Link className="text-link" to="/browse">Browse all listings <ArrowRight size={17} aria-hidden="true"/></Link></div>
      <div className="campus-listing-grid" aria-busy={loading}>
        {loading ? <><span className="sr-only" role="status">Loading featured listings</span>{[1,2,3,4].map(id => <div className="campus-listing-skeleton" key={id} aria-hidden="true"><div/><span/><span/></div>)}</> : featured.map(item => <article key={item.id} className="listing-card campus-listing">
          <div className="campus-listing-image">{item.image ? <img src={item.image} alt={item.title} loading="lazy"/> : <BookOpen size={40} aria-hidden="true"/>}<span className="campus-condition">{item.condition}</span></div>
          <div className="campus-listing-body"><h3><Link className="listing-card-link" to={'/listings/' + item.id}>{item.title}</Link></h3><p className="campus-location">{item.location}</p><p className="campus-price">AED {item.price}</p><div className="campus-seller"><UserRound size={16} aria-hidden="true"/><span>{item.seller}</span></div></div>
        </article>)}
      </div>
      {!loading && !featured.length && <div className="campus-empty"><BookOpen size={28} aria-hidden="true"/><p>No listings yet. Your next campus find could start here.</p><Link to="/post" className="text-link">Post a listing <ArrowRight size={16}/></Link></div>}
    </section>

    <section className="campus-inner campus-prompts" aria-label="Get involved">
      <div className="campus-prompt campus-sell"><div><h2>Have items to sell?</h2><p>Pass it on to someone on campus. Make room for what comes next.</p></div><Link to="/post" className="text-link">Start Selling <ArrowRight size={17} aria-hidden="true"/></Link></div>
    </section>
    <StudentOffers/>
    <section className="campus-inner campus-prompts campus-final-feedback" aria-label="Feedback">
      <div className="campus-prompt campus-feedback"><div><h2>Help shape Acadex</h2><p>Have a suggestion or spotted a problem? We'd love to hear from you.</p></div><Link to="/feedback" className="text-link">Share feedback <ArrowRight size={17} aria-hidden="true"/></Link></div>
    </section>
  </div>;
}
