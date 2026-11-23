import { ArrowLeft, LogIn, MessageSquare, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import {getCurrentUser} from '../lib/auth';
import {loginUrl} from '../lib/loginRedirect';
import { ActionStatus, Empty, ErrorBox, Field, useAction } from '../components/CommunityUI';
import { formValues, mutate, useResource } from '../lib/community';

export default function Feedback() {
  const action = useAction();
  const user = getCurrentUser();
  return <div className="feedback-page">
    <header className="feedback-topbar"><BrandLogo size="sm" /><Link to="/" className="text-link"><ArrowLeft size={16} aria-hidden="true"/>Back to Acadex</Link></header>
    <main className="feedback-content">
    <header className="feedback-heading"><MessageSquare size={30} aria-hidden="true"/><h1>Share your feedback</h1><p>Your ideas help shape Acadex.</p></header>
    {user?<form className="editor-form" onSubmit={e => {
      e.preventDefault();
      const form = e.currentTarget;
      void action.run(async () => { await mutate('/feedback', formValues(form)); form.reset(); }, 'Thank you! Your feedback has been sent to the Acadex team.');
    }}>
      <Field label="Name (optional)"><input name="name" maxLength={100} autoComplete="name" /></Field>
      <Field label="Feedback type"><select name="category"><option value="suggestion">Suggestion</option><option value="problem">Something is not working</option><option value="comment">General comment</option></select></Field>
      <Field label="Your comments"><textarea name="message" required minLength={10} maxLength={3000} rows={6} /></Field>
      <p className="muted">Only the Acadex team can see your feedback. Please do not include passwords or sensitive information.</p>
      <button type="submit" className="action-button" disabled={action.busy}><Send size={18} />{action.busy ? 'Sending...' : 'Send feedback'}</button>
      <ActionStatus action={action} />
    </form>:<section className="feedback-guest"><h2>We would love to hear from you</h2><p>Sign in to send your suggestions, comments or anything that is not working.</p><Link className="action-button" to={loginUrl('/feedback')}><LogIn size={18} aria-hidden="true"/>Sign in to share feedback</Link><Link to="/" className="text-link">Continue browsing</Link></section>}
    </main>
  </div>;
}

type Entry = { id: string; name: string; category: string; message: string; status: string; created_at: string };
export function FeedbackReviews() {
  const result = useResource<{ items: Entry[] }>('/feedback', 15000);
  const action = useAction();
  return <section className="detail-section"><h2>User feedback</h2><ErrorBox error={result.error} />
    {result.loading && <Empty>Loading feedback...</Empty>}
    {result.data?.items.length === 0 && <Empty>No feedback yet.</Empty>}
    {result.data?.items.map(entry => <article className="py-5 border-b border-gray-200" key={entry.id}>
      <strong>{entry.category === 'problem' ? 'Problem' : entry.category === 'suggestion' ? 'Suggestion' : 'Comment'} | {entry.name || 'Anonymous'}</strong>
      <p className="muted">{new Date(entry.created_at).toLocaleString()} | {entry.status}</p>
      <p className="preserve-lines">{entry.message}</p>
      <button className="secondary-button" disabled={action.busy} onClick={() => void action.run(async () => {
        await mutate('/feedback/' + entry.id, { status: entry.status === 'new' ? 'reviewed' : 'new' }, 'PATCH'); result.reload();
      }, 'Feedback status updated.')}>{entry.status === 'new' ? 'Mark reviewed' : 'Reopen'}</button>
    </article>)}<ActionStatus action={action} />
  </section>;
}
