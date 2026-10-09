import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';

export default function Footer() {
  return (
    <footer className="bg-gray-100 py-16 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-1">
            <div className="mb-6">
              <BrandLogo linked size="sm" />
            </div>
            <p className="text-sm text-brand-light-navy mb-6">
              The trusted marketplace for students to buy and sell educational materials, electronics, and supplies.
            </p>
            <div className="flex space-x-4">
              <div className="w-6 h-6 bg-brand-navy rounded-full"></div>
              <div className="w-6 h-6 bg-brand-navy rounded-full"></div>
              <div className="w-6 h-6 bg-brand-navy rounded-full"></div>
              <div className="w-6 h-6 bg-brand-navy rounded-full"></div>
            </div>
          </div>

          <div>
            <h4 className="text-brand-navy mb-6">Marketplace</h4>
            <ul className="space-y-4 text-sm text-brand-light-navy">
              <li><Link to="/browse">Browse Listings</Link></li>
              <li><Link to="/post">Sell an Item</Link></li>
              <li><Link to="/browse">Categories</Link></li>
              <li><Link to="/">Pricing Guide</Link></li>
              <li><Link to="/">Safety Tips</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-brand-navy mb-6">Community</h4>
            <ul className="space-y-4 text-sm text-brand-light-navy">
              <li><Link to="/past-papers">Past Papers</Link></li>
              <li><Link to="/study-groups">Study Groups</Link></li>
              <li><Link to="/events">Campus Events</Link></li>
              <li><Link to="/tutors">Tutors</Link></li>
              <li><Link to="/dashboard">My Learning</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-brand-navy mb-6">Support</h4>
            <ul className="space-y-4 text-sm text-brand-light-navy">
              <li><Link to="/">Help Center</Link></li>
              <li><Link to="/">Contact Us</Link></li>
              <li><Link to="/">Report an Issue</Link></li>
              <li><Link to="/">Terms of Service</Link></li>
              <li><Link to="/">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-200 mt-16 pt-8 text-center text-xs text-brand-light-navy">
          © 2026 Acadex. All rights reserved. Made for UAE students.
        </div>
      </div>
    </footer>
  );
}
