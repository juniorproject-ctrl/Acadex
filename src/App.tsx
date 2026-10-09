import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import Home from './pages/Home';
import Browse from './pages/Browse';
import PostListing from './pages/PostListing';
import Community from './pages/Community';
import SignIn from './pages/SignIn';
import ForgotPassword from './pages/ForgotPassword';
import SignUp from './pages/SignUp';
import VerifyOTP from './pages/VerifyOTP';
import { hasSession } from './lib/auth';
import PastPapers from './pages/PastPapers';
import StudyGroups from './pages/StudyGroups';
import GroupDetail from './pages/GroupDetail';
import Tutors, { TutorDetail } from './pages/Tutors';
import Events, { EventDetail } from './pages/Events';
import Dashboard from './pages/Dashboard';
import ReportForm from './pages/Reports';
import Notifications from './pages/Notifications';
import CourseCatalog from './pages/CourseCatalog';
import Settings from './pages/Settings';
import TutorApplication,{TutorApplicationReviews} from './pages/TutorApplication';
import Payments,{Checkout} from './pages/Payments';
import { applyAccessibility } from './lib/accessibility';

// Layout wrapper for pages that show Nav and Footer
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background-soft">
      <Navigation />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  return hasSession() ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  useEffect(()=>{applyAccessibility();const sync=()=>applyAccessibility();window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<SignIn />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify" element={<VerifyOTP />} />

        {/* Main App Routes */}
        <Route path="/home" element={<Layout><Home /></Layout>} />
        <Route path="/browse" element={<Layout><Browse /></Layout>} />
        <Route path="/post" element={<Protected><Layout><PostListing /></Layout></Protected>} />
        <Route path="/community" element={<Layout><Community /></Layout>} />
        <Route path="/search" element={<Layout><Community search /></Layout>} />
        <Route path="/past-papers" element={<Layout><PastPapers /></Layout>} />
        <Route path="/study-groups" element={<Layout><StudyGroups /></Layout>} />
        <Route path="/study-groups/:id" element={<Layout><GroupDetail /></Layout>} />
        <Route path="/tutors" element={<Layout><Tutors /></Layout>} />
        <Route path="/tutors/:id" element={<Layout><TutorDetail /></Layout>} />
        <Route path="/events" element={<Layout><Events /></Layout>} />
        <Route path="/events/:id" element={<Layout><EventDetail /></Layout>} />
        <Route path="/dashboard" element={<Protected><Layout><Dashboard /></Layout></Protected>} />
        <Route path="/report" element={<Protected><Layout><ReportForm /></Layout></Protected>} />
        <Route path="/settings" element={<Protected><Layout><Settings /></Layout></Protected>} />
        <Route path="/accessibility" element={<Protected><Layout><Settings accessibilityOnly /></Layout></Protected>} />
        <Route path="/apply-tutor" element={<Protected><Layout><TutorApplication /></Layout></Protected>} />
        <Route path="/checkout" element={<Protected><Layout><Checkout /></Layout></Protected>} />
        <Route path="/payments" element={<Protected><Layout><Payments /></Layout></Protected>} />
        <Route path="/admin/tutor-applications" element={<Protected><Layout><TutorApplicationReviews /></Layout></Protected>} />
        <Route path="/notifications" element={<Protected><Layout><Notifications /></Layout></Protected>} />
        <Route path="/catalog" element={<Protected><Layout><CourseCatalog /></Layout></Protected>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
