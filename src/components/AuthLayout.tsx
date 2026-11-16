import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useOutlet } from 'react-router-dom';
import { useReducedMotion } from 'motion/react';

export default function AuthLayout() {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const latestOutlet = useRef(outlet);
  latestOutlet.current = outlet;
  const shownPath = useRef(pathname);
  const [shown, setShown] = useState({ pathname, outlet });
  const [phase, setPhase] = useState<'idle'|'exit'|'enter'>('idle');
  const reducedMotion = useReducedMotion();
  const formView = useRef<HTMLDivElement>(null);
  const signup = shown.pathname === '/signup';

  // Keep the outgoing form mounted until it has left its clipped half-screen.
  useEffect(() => {
    if (shownPath.current === pathname) { setPhase('idle'); return; }
    const nextOutlet = latestOutlet.current;
    const showNext = () => {
      shownPath.current = pathname;
      setShown({ pathname, outlet: nextOutlet });
      setPhase(reducedMotion ? 'idle' : 'enter');
    };
    if (reducedMotion || document.documentElement.classList.contains('reduced-motion')) { showNext(); setPhase('idle'); return; }
    setPhase('exit');
    const swap = window.setTimeout(showNext, 230);
    const finish = window.setTimeout(() => {
      setPhase('idle');
      const heading = formView.current?.querySelector('h2');
      heading?.setAttribute('tabindex', '-1');
      heading?.focus({ preventScroll: true });
    }, 1230);
    return () => { window.clearTimeout(swap); window.clearTimeout(finish); };
  }, [pathname, reducedMotion]);

  return <div className="auth-split-page">
    <main className={'auth-split-shell' + (signup ? ' is-signup' : '')}>
      <aside className="auth-split-art">
        <div className="auth-art-copy"><h1>ACADEX</h1><h2>Your campus.<br/>Your next chapter.</h2><span/><p>A little curiosity goes a long way.</p></div>
        <div className="auth-art-lines"><span/><span/><span/></div>
      </aside>
      <div className="auth-split-content">
        <div className={'auth-form-window phase-' + phase} aria-busy={phase !== 'idle'}>
          <div ref={formView} className="auth-form-view" inert={phase !== 'idle'}>{shown.outlet}<div className="auth-continue-browsing"><Link className="text-link" to="/home">Continue browsing</Link></div></div>
        </div>
        <footer className="auth-split-footer"><Link to="/feedback">Share feedback</Link><Link to="/contact">Contact us</Link><Link to="/terms-of-service">Terms</Link><Link to="/privacy-policy">Privacy</Link></footer>
      </div>
    </main>
  </div>;
}
