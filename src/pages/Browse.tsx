import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, Dumbbell, FlaskConical, House, Images, LayoutGrid, List, MapPin, Monitor, Music, PackageOpen, Palette, PenTool, Search, Shirt, SlidersHorizontal, Sofa, UserRound, X } from 'lucide-react';
import { api, type ApiListing } from '../lib/api';
import { getBadgeClasses, listingCategories, listingConditions, type ListingCondition } from '../lib/demoListings';
import ListingActions from '../components/ListingActions';

const pageSize = 16;
const categoryIcons = { 'All Items': LayoutGrid, Textbooks: BookOpen, Electronics: Monitor, Supplies: PenTool, 'Study Setup': Sofa, 'Lab Equipment': FlaskConical, 'Sports & Fitness':Dumbbell, 'Art & Design':Palette, 'Musical Instruments':Music, 'Clothing & Accessories':Shirt, 'Home Essentials':House };

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState<ApiListing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'grid'|'list'>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterMenu = useRef<HTMLDivElement>(null);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const category = searchParams.get('category') || 'All Items';
  const search = searchParams.get('search') || '';
  const condition = searchParams.get('condition') || 'All Conditions';
  const priceRange = searchParams.get('price') || 'Any Price';
  const sortBy = searchParams.get('sort') || 'Newest First';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const updateParams = (changes: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    if (resetPage) next.delete('page');
    setSearchParams(next);
  };
  const clearFilters = () => updateParams({ search:null, category:null, condition:null, price:null });
  const filters = [
    { key:'search', label:search },
    { key:'category', label:category === 'All Items' ? '' : category },
    { key:'condition', label:condition === 'All Conditions' ? '' : condition },
    { key:'price', label:priceRange === 'Any Price' ? '' : priceRange },
  ].filter(filter => filter.label);
  const detailedFilterCount = filters.filter(filter => filter.key !== 'search').length;

  useEffect(() => {
    if (!filtersOpen) return;
    filterMenu.current?.querySelector('select')?.focus();
    const outside = (event:PointerEvent) => { if (!filterMenu.current?.contains(event.target as Node)) setFiltersOpen(false); };
    const escape = (event:KeyboardEvent) => { if (event.key === 'Escape') { setFiltersOpen(false); filterTrigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [filtersOpen]);
  const closeFilters = () => { setFiltersOpen(false); filterTrigger.current?.focus(); };

  const requestParams = useMemo(() => {
    const params = new URLSearchParams({ page:String(page), limit:String(pageSize) });
    if (category !== 'All Items') params.set('category', category);
    if (search) params.set('search', search);
    if (condition !== 'All Conditions') params.set('condition', condition);
    if (priceRange === '0 - 100 AED') params.set('maxPrice', '100');
    if (priceRange === '100 - 500 AED') { params.set('minPrice', '100.01'); params.set('maxPrice', '500'); }
    if (priceRange === '500+ AED') params.set('minPrice', '500.01');
    if (sortBy === 'Price: Low to High') params.set('sort', 'price_asc');
    if (sortBy === 'Price: High to Low') params.set('sort', 'price_desc');
    return params;
  }, [category, condition, page, priceRange, search, sortBy]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api.listings(requestParams)
      .then(result => { if (active) { setListings(result.listings); setTotal(result.total); } })
      .catch(requestError => { if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load listings.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestParams]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const setPage = (nextPage:number) => updateParams({ page:String(Math.min(totalPages, Math.max(1, nextPage))) }, false);
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length:Math.min(totalPages, 5) }, (_, index) => firstPage + index);
  const pageButton = (item:number) => <button key={item} aria-label={'Page ' + item} aria-current={page === item ? 'page' : undefined} onClick={() => setPage(item)}>{item}</button>;

  return <div className="browse-page">
    <section className="browse-intro">
      <div className="campus-inner">
        <div className="browse-heading"><div><h1>Browse Listings</h1><p className="browse-tagline">A new semester starts with a good find.</p></div></div>
        <div className="browse-search"><Search size={21} aria-hidden="true"/><input type="search" aria-label="Search listings" placeholder="Search campus essentials..." value={search} onChange={event => updateParams({ search:event.target.value || null })}/>{search && <button className="icon-button" title="Clear search" aria-label="Clear search" onClick={() => updateParams({ search:null })}><X size={18}/></button>}</div>
        <nav className="browse-category-tabs" aria-label="Listing categories">{(['All Items', ...listingCategories] as const).map(item => { const Icon = categoryIcons[item]; return <button key={item} aria-pressed={category === item} onClick={() => updateParams({ category:item === 'All Items' ? null : item })}><Icon size={20} aria-hidden="true"/>{item}</button>; })}</nav>
      </div>
    </section>

    <div className="campus-inner browse-content">
      <div className="browse-filter-menu" ref={filterMenu}>
        <button className="secondary-button browse-filter-trigger" ref={filterTrigger} aria-expanded={filtersOpen} aria-controls="browse-filter-panel" aria-haspopup="dialog" onClick={() => setFiltersOpen(open => !open)}><SlidersHorizontal size={17} aria-hidden="true"/>Refine your search{!!detailedFilterCount && <span className="browse-filter-count">{detailedFilterCount}</span>}<ChevronDown size={16} aria-hidden="true"/></button>
        {filtersOpen && <section id="browse-filter-panel" className="browse-filter-panel" role="dialog" aria-label="Refine listing filters">
        <div className="browse-filter-heading"><span>Detailed filters</span><button className="icon-button" aria-label="Close filters" title="Close filters" onClick={closeFilters}><X size={18}/></button></div>
        <div className="browse-filter-fields">
          <label>Category<select aria-label="Category" value={category} onChange={event => updateParams({ category:event.target.value === 'All Items' ? null : event.target.value })}><option>All Items</option>{listingCategories.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Condition<select aria-label="Condition" value={condition} onChange={event => updateParams({ condition:event.target.value === 'All Conditions' ? null : event.target.value })}><option>All Conditions</option>{listingConditions.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Price range<select aria-label="Price range" value={priceRange} onChange={event => updateParams({ price:event.target.value === 'Any Price' ? null : event.target.value })}><option>Any Price</option><option>0 - 100 AED</option><option>100 - 500 AED</option><option>500+ AED</option></select></label>
        </div>
        <div className="browse-filter-footer"><button className="browse-reset" onClick={clearFilters} disabled={!filters.length}><X size={14} aria-hidden="true"/>Reset filters</button><button className="action-button" onClick={closeFilters}>Show results</button></div>
      </section>}
      </div>
      {!!filters.length && <div className="browse-active-filters" aria-label="Active filters">{filters.map(filter => <button key={filter.key} onClick={() => updateParams({ [filter.key]:null })} aria-label={'Remove filter: ' + filter.label}><span>{filter.label}</span><X size={14} aria-hidden="true"/></button>)}</div>}

      <div className="browse-results-toolbar">
        <div className="browse-result-count" aria-live="polite">{loading ? 'Finding campus essentials...' : error ? 'Listings unavailable' : <><strong>{total}</strong> {total === 1 ? 'listing' : 'listings'}{total > 0 && <span>Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}</span>}</>}</div>
        <div className="browse-result-controls"><label>Sort by<select aria-label="Sort by" value={sortBy} onChange={event => updateParams({ sort:event.target.value === 'Newest First' ? null : event.target.value })}><option>Newest First</option><option>Price: Low to High</option><option>Price: High to Low</option></select></label><div className="browse-view-toggle" role="group" aria-label="Listing view"><button aria-label="Grid view" title="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={18}/></button><button aria-label="List view" title="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={20}/></button></div></div>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}
      {loading ? <div className="browse-listings-grid" aria-busy="true"><span className="sr-only" role="status">Loading listings...</span>{Array.from({ length:8 }, (_, index) => <div className="campus-listing-skeleton" key={index} aria-hidden="true"><div/><span/><span/></div>)}</div> : !error && <>
        <div className={'browse-listings-grid' + (view === 'list' ? ' browse-list-view' : '')}>
          {listings.map(product => <article key={product.id} className="listing-card browse-listing-card">
            <div className="browse-card-image">{product.image ? <img src={product.image} alt={product.title} loading="lazy"/> : <PackageOpen size={38} aria-hidden="true"/>}<span className={'browse-condition ' + getBadgeClasses(product.condition as ListingCondition)}>{product.condition}</span>{product.images?.length > 1 && <span className="browse-image-count" aria-label={product.images.length + ' photos'}><Images size={14} aria-hidden="true"/>{product.images.length}</span>}</div>
            <div className="browse-card-body"><div className="browse-card-main"><p className="browse-card-category">{product.category}</p><h2><Link className="listing-card-link" to={'/listings/' + product.id}>{product.title}</Link></h2>{product.subtitle && <p className="browse-card-subtitle">{product.subtitle}</p>}<p className="browse-card-price">AED {product.price}</p><p className="browse-handover">{[product.pickupAvailable && 'Pickup', product.sellerDelivery && 'Seller delivery'].filter(Boolean).join(' or ')}</p></div><div className="browse-card-actions"><ListingActions listing={product}/></div><div className="browse-card-seller"><span><UserRound size={14} aria-hidden="true"/>{product.seller}</span><span><MapPin size={13} aria-hidden="true"/>{product.location}</span></div></div>
          </article>)}
        </div>
        {!listings.length && <section className="browse-empty"><PackageOpen size={42} aria-hidden="true"/><h2>No campus finds just yet</h2><p>No listings match the current filters yet.</p>{filters.length > 0 && <button className="action-button" onClick={clearFilters}>Clear filters</button>}</section>}
      </>}
      {!error && !loading && total > 0 && <nav className="browse-pagination" aria-label="Listing pages"><button aria-label="Previous page" title="Previous page" onClick={() => setPage(page - 1)} disabled={page === 1}><ChevronLeft size={18}/></button>{firstPage > 1 && pageButton(1)}{firstPage > 2 && <span aria-hidden="true">...</span>}{pages.map(pageButton)}{pages[pages.length - 1] < totalPages - 1 && <span aria-hidden="true">...</span>}{pages[pages.length - 1] < totalPages && pageButton(totalPages)}<button aria-label="Next page" title="Next page" onClick={() => setPage(page + 1)} disabled={page >= totalPages}><ChevronRight size={18}/></button><span className="browse-page-label">Page {page} of {totalPages}</span></nav>}
    </div>
  </div>;
}
