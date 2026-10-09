import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BookOpen, FileText, Users, Monitor, PenTool, Calendar, MoreHorizontal } from 'lucide-react';
import { motion } from 'motion/react';
import { api, type ApiListing } from '../lib/api';
import { searchCategories, searchDestination } from '../lib/search';

const categories = [
  { icon: <BookOpen />, name: 'Textbooks', count: '2,847 items' },
  { icon: <FileText />, name: 'Past Papers', count: '3,421 items' },
  { icon: <Users />, name: 'Study Groups', count: '1,089 items' },
  { icon: <Monitor />, name: 'Electronics', count: '1,567 items' },
  { icon: <PenTool />, name: 'Supplies', count: '4,231 items' },
  { icon: <Calendar />, name: 'Campus Events', count: '892 items' },
  { icon: <Users />, name: 'Tutors', count: '' }
];

export default function Home() {
  const navigate = useNavigate();
  const [featured, setFeatured] = useState<ApiListing[]>([]);
  const [search,setSearch] = useState('');
  const [category,setCategory] = useState('');

  useEffect(() => {
    api.listings(new URLSearchParams({ page: '1', limit: '4' }))
      .then((result) => setFeatured(result.listings))
      .catch(() => setFeatured([]));
  }, []);

  return (
    <div className="flex flex-col">
      <section className="bg-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h1 className="text-5xl text-brand-navy mb-4">Your Campus Marketplace</h1>
          <p className="text-brand-light-navy max-w-2xl mx-auto">
            Buy, sell, and discover within your educational community.<br/>
            From textbooks to tutoring, find it all here.
          </p>
        </div>

        <form onSubmit={e=>{e.preventDefault();navigate(searchDestination(search,category));}} className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Search for textbooks, laptops, calculators, past quizzes..."
            value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search Acadex"
            className="min-w-0 flex-1 h-14 bg-gray-100 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-brand-navy"
          />
          <div className="flex items-center h-14 gap-2">
            <select aria-label="Search category" value={category} onChange={e=>setCategory(e.target.value)} className="bg-gray-100 rounded-md min-w-0 h-full px-3 text-sm text-brand-navy cursor-pointer">
              <option value="">All Categories</option>{searchCategories.map(name=><option key={name}>{name}</option>)}
            </select>
            <button className="bg-brand-navy text-white px-6 h-full rounded-md font-bold hover:bg-brand-light-navy transition-colors">
              <span className="flex items-center gap-2"><Search size={18}/>Search</span>
            </button>
          </div>
        </form>
      </section>

      <section className="bg-[#EFE7D5] py-12 px-4 shadow-inner">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl text-brand-navy mb-1">Browse Categories</h2>
          <p className="text-xs text-brand-light-navy mb-8">Find what you need across campus</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
            {categories.map((cat, idx) => (
              <motion.button
                key={idx}
                whileHover={{ y: -5 }}
                onClick={() => navigate(searchDestination('',cat.name))}
                className="bg-white p-6 rounded-xl shadow-sm text-center cursor-pointer flex flex-col items-center justify-center min-h-[160px]"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-brand-navy">
                  {cat.icon}
                </div>
                <h3 className="text-sm font-bold text-brand-navy">{cat.name}</h3>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand-navy py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-brand-cream text-2xl mb-1 font-bold">Featured Listings</h2>
          <p className="text-brand-cream text-xs opacity-80 mb-10">Recently posted on campus</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {featured.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-xl flex h-full flex-col">
                <div className="relative h-72 w-full overflow-hidden bg-gray-100">
                  {item.image && <img src={item.image} alt={item.title} className="h-full w-full object-cover object-center" />}
                </div>
                <div className="flex min-h-[13rem] flex-1 flex-col p-5">
                  <h3 className="text-sm font-bold text-brand-navy line-clamp-2 mb-1">{item.title}</h3>
                  <p className="text-[10px] text-gray-500 mb-2">{item.condition} • {item.location}</p>
                  <p className="text-lg font-bold text-brand-navy mt-auto">AED {item.price}</p>
                  <div className="flex items-center mt-3 pt-3 border-t border-gray-100">
                    <div className="w-6 h-6 bg-gray-200 rounded-full mr-2"></div>
                    <span className="text-[10px] text-gray-600 truncate">{item.seller}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#EFE7D5] py-12 px-4 shadow-inner">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[#E2D6BB] p-10 rounded-2xl flex flex-col md:flex-row items-center justify-between">
            <div>
              <h2 className="text-2xl text-brand-navy mb-2 font-bold">Have items to sell?</h2>
              <p className="text-brand-light-navy">List your textbooks, electronics, and study materials. Reach thousands of students!</p>
            </div>
            <button
              onClick={() => navigate('/post')}
              className="mt-6 md:mt-0 bg-[#A6B1C2] text-white px-8 py-4 rounded-xl font-bold hover:bg-brand-navy transition-all transform hover:scale-105"
            >
              Start Selling
            </button>
          </div>
        </div>
      </section>
      <section className="bg-white px-4 py-10 border-t border-gray-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div><h2 className="text-2xl text-brand-navy mb-2">Help shape Acadex</h2><p className="text-brand-light-navy">Have a suggestion or spotted a problem? We'd love to hear from you.</p></div>
          <button onClick={() => navigate('/feedback')} className="action-button">Share feedback</button>
        </div>
      </section>
    </div>
  );
}
