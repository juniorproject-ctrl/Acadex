import { useEffect, useMemo, useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { api, type ApiListing } from '../lib/api';
import { getBadgeClasses, listingCategories, listingConditions, type ListingCondition } from '../lib/demoListings';

import { getCurrentUser } from '../lib/auth';
const pageSize = 16;

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState<ApiListing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  const requestParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
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
    setLoading(true);
    setError('');
    api.listings(requestParams)
      .then((result) => { if (active) { setListings(result.listings); setTotal(result.total); } })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load listings.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestParams]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const setPage = (nextPage: number) => updateParams({ page: String(Math.min(totalPages, Math.max(1, nextPage))) }, false);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto flex space-x-4 mb-12">
        <div className="relative flex-1">
          <input type="text" placeholder="Search for textbooks, laptops, calculators, past quizzes..." className="w-full h-12 bg-gray-100 rounded-lg pl-10 pr-4 outline-none border-none" value={search} onChange={(event) => updateParams({ search: event.target.value || null })} />
          <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
        </div>
        <select className="bg-gray-100 rounded-lg px-4 border-none text-sm font-medium" value={category} onChange={(event) => updateParams({ category: event.target.value === 'All Items' ? null : event.target.value })}>
          <option>All Items</option>{listingCategories.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 space-y-4 md:space-y-0">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2"><span className="text-xs font-bold text-gray-500">Sort by:</span><select className="bg-white border border-gray-200 rounded px-2 py-1 text-xs" value={sortBy} onChange={(event) => updateParams({ sort: event.target.value === 'Newest First' ? null : event.target.value })}><option>Newest First</option><option>Price: Low to High</option><option>Price: High to Low</option></select></div>
          <div className="flex items-center space-x-2"><span className="text-xs font-bold text-gray-500">Condition:</span><select className="bg-white border border-gray-200 rounded px-2 py-1 text-xs" value={condition} onChange={(event) => updateParams({ condition: event.target.value === 'All Conditions' ? null : event.target.value })}><option>All Conditions</option>{listingConditions.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="flex items-center space-x-2"><span className="text-xs font-bold text-gray-500">Price Range:</span><select className="bg-white border border-gray-200 rounded px-2 py-1 text-xs" value={priceRange} onChange={(event) => updateParams({ price: event.target.value === 'Any Price' ? null : event.target.value })}><option>Any Price</option><option>0 - 100 AED</option><option>100 - 500 AED</option><option>500+ AED</option></select></div>
        </div>
        <div className="text-xs font-bold text-gray-400">Showing {total} results</div>
      </div>

      <div className="flex flex-wrap gap-3 mb-12">
        {['All Items', ...listingCategories].map((item) => <button key={item} onClick={() => updateParams({ category: item === 'All Items' ? null : item })} className={category === item ? 'px-6 py-2 rounded-full text-xs font-bold border bg-brand-navy text-white border-brand-navy' : 'px-6 py-2 rounded-full text-xs font-bold border bg-white text-brand-navy border-gray-200 hover:border-brand-navy'}>{item}</button>)}
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-8 text-sm">{error}</div>}
      {loading ? <div className="py-20 text-center text-brand-light-navy">Loading listings...</div> : <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {listings.map((product) => <div key={product.id} className="bg-white rounded-lg overflow-hidden flex flex-col h-full group border border-gray-100 hover:border-brand-light-navy transition-colors">
            <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">{product.image && <img src={product.image} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />}<div className={'absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold ' + getBadgeClasses(product.condition as ListingCondition)}>{product.condition}</div></div>
            <div className="p-4 flex-1 flex flex-col"><h3 className="text-sm font-bold text-brand-navy line-clamp-1 mb-0.5">{product.title}</h3><p className="text-[10px] text-gray-400 mb-2 truncate">{product.subtitle}</p><p className="text-lg font-bold text-brand-navy mb-3">AED {product.price}</p>{product.ownerId!==getCurrentUser()?.id&&product.price>=2&&<Link to={'/checkout?kind=listing&reference='+product.id} className="text-link mb-3">Buy item</Link>}<div className="mt-auto pt-3 border-t border-gray-50 flex items-center"><div className="w-5 h-5 bg-gray-200 rounded-full mr-2" /><span className="text-[10px] text-gray-500">{product.seller} - {product.location}</span></div></div>
          </div>)}
        </div>
        {!listings.length && <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-brand-light-navy mb-16">No listings match the current filters yet.</div>}
      </>}
      <div className="flex justify-center items-center space-x-2"><button onClick={() => setPage(page - 1)} disabled={page === 1} className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>{Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((item) => <button key={item} onClick={() => setPage(item)} className={page === item ? 'w-8 h-8 text-sm rounded font-bold bg-brand-navy text-white' : 'w-8 h-8 text-sm rounded font-medium border border-gray-200 text-brand-navy'}>{item}</button>)}<button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button></div>
    </div>
  );
}
