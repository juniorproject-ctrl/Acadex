import { ArrowUpRight, GraduationCap, HeartPulse, Landmark, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export const studentOffers = [
  { title: 'Student Banking', description: 'Explore banking solutions designed for university students.', category: 'Financial Services', icon: Landmark, tone: 'banking' },
  { title: 'Health & Wellness', description: 'Discover healthcare services and wellness opportunities for students.', category: 'Healthcare', icon: HeartPulse, tone: 'health' },
  { title: 'Courses & Certifications', description: 'Develop new skills through professional courses, workshops, and certifications.', category: 'Education', icon: GraduationCap, tone: 'education' },
  { title: 'Student Insurance', description: 'Explore insurance options for student life, health, and travel.', category: 'Insurance', icon: ShieldCheck, tone: 'insurance' },
];

export default function StudentOffers() {
  return <section className="student-offers" aria-labelledby="student-offers-title">
    <div className="max-w-7xl mx-auto">
      <header className="student-offers-heading">
        <h2 id="student-offers-title" className="text-2xl">Student Offers &amp; Partners</h2>
        <p>Discover exclusive services and opportunities designed for your academic journey.</p>
      </header>
      <div className="student-offers-grid">
        {studentOffers.map(({ title, description, category, icon: Icon, tone }) => <article className={'student-offer student-offer-' + tone} key={title}>
          <div className="student-offer-top"><span className="student-offer-icon"><Icon size={24} aria-hidden="true"/></span><span className="student-offer-label">Sponsored Example</span></div>
          <p className="student-offer-category">{category}</p>
          <h3>{title}</h3>
          <p className="student-offer-description">{description}</p>
        </article>)}
      </div>
      <p className="student-offers-disclaimer">Demonstration advertisements only. No official partnerships are implied.</p>
      <div className="student-offers-inquiry">
        <div><h3>Want to Reach the Academic Community?</h3><p>Acadex provides opportunities for businesses to connect with students and members of the academic community through relevant advertisements and sponsored offers.</p></div>
        <Link className="action-button" to="/advertise">Advertise With Us <ArrowUpRight size={17} aria-hidden="true"/></Link>
      </div>
    </div>
  </section>;
}
