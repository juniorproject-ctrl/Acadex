import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import { request } from '../lib/api';
import { getCurrentUser } from '../lib/auth';
import { dateTime, mutate, useResource } from '../lib/community';
import { ActionStatus, Empty, ErrorBox, Field, useAction } from '../components/CommunityUI';

type Message = {id: string; senderId: string; author: string; body: string; createdAt: string};
type Conversation = {id: string; listingId: string | null; title: string; otherName: string; messages: Message[]; hasMore: boolean};
export type Inbox = {items: {id: string; title: string; otherName: string; preview: string | null; unread: number}[]};
function Thread({id, refreshInbox}: {id: string; refreshInbox: () => void}) {
  const result = useResource<Conversation>('/messages/'+id, 4000), action = useAction();
  const [history, setHistory] = useState<Message[]>([]), [older, setOlder] = useState<boolean | null>(null), [draft, setDraft] = useState('');
  const scroll = useRef<HTMLDivElement>(null), stick = useRef(true);
  useEffect(() => { if (result.data) setHistory(previous => {
    const unique = new Map([...previous, ...result.data!.messages].map(message => [message.id, message]));
    return [...unique.values()].sort((a,b) => BigInt(a.id)<BigInt(b.id)?-1:BigInt(a.id)>BigInt(b.id)?1:0);
  }); }, [result.data]);
  const lastId = history.at(-1)?.id;
  useEffect(() => {
    if (stick.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
    if (lastId) void mutate('/messages/'+id+'/read', {lastId}).then(refreshInbox).catch(() => {});
  }, [id, lastId, refreshInbox]);
  return <section className="marketplace-chat"><ErrorBox error={result.error}/>{result.loading && !history.length && <Empty>Loading conversation...</Empty>}
    {result.data && <header><h2>{result.data.otherName}</h2><p>{result.data.title}</p><div className="flex flex-wrap gap-4 mt-2">
      {result.data.listingId && <Link className="text-link" to={'/listings/'+result.data.listingId}>View listing</Link>}
      <Link className="text-link" to={'/report?subject='+encodeURIComponent('Marketplace conversation')+'&context='+encodeURIComponent('Conversation: '+id+'\n')}>Report a problem</Link>
    </div></header>}
    <div className="message-list" ref={scroll} onScroll={() => {if (scroll.current) stick.current = scroll.current.scrollHeight-scroll.current.scrollTop-scroll.current.clientHeight<80;}} role="log" aria-label="Conversation messages" aria-live="polite">
      {(older ?? result.data?.hasMore) && <button className="secondary-button" disabled={action.busy} onClick={() => void action.run(async () => {
        const page = await request<Conversation>('/messages/'+id+'?before='+history[0].id);
        setHistory(previous => [...page.messages, ...previous]); setOlder(page.hasMore);
      }, '')}>Load older messages</button>}
      {history.map(message => <article key={message.id} className={'message '+(message.senderId === getCurrentUser()?.id ? 'own-message' : '')}><header><strong>{message.author}</strong><time>{dateTime(message.createdAt)}</time></header><p>{message.body}</p></article>)}
      {!history.length && !result.loading && !result.error && <Empty>No messages yet.</Empty>}
    </div>
    <form className="editor-form" onSubmit={e => {e.preventDefault();const sent=draft;void action.run(async () => {
      await mutate('/messages/'+id+'/messages', {body: sent}); setDraft(''); stick.current=true; result.reload(); refreshInbox();
    }, '');}}><Field label="Message"><textarea value={draft} onChange={e => setDraft(e.target.value)} required maxLength={2000} rows={3} disabled={action.busy}/></Field>
      <button className="action-button" disabled={action.busy || !draft.trim()}><Send size={18}/>{action.busy?'Sending...':'Send'}</button><ActionStatus action={action}/>
    </form>
  </section>;
}
export default function Messages() {
  const {id} = useParams(), inbox = useResource<Inbox>('/messages', 5000);
  return <div className="community-page"><header className="community-heading"><h1>Messages</h1></header><ErrorBox error={inbox.error}/><div className="inbox-layout">
    <aside className="inbox-list" aria-label="Conversations">{inbox.loading && <Empty>Loading conversations...</Empty>}{inbox.data?.items.map(item => <Link key={item.id} to={'/messages/'+item.id} className={'inbox-thread '+(item.id===id?'active':'')}><strong>{item.otherName}</strong>{Number(item.unread)>0 && <span className="status-badge ml-2">{item.unread} unread</span>}<p>{item.title}</p><p className="muted line-clamp-2">{item.preview || 'Start a conversation'}</p></Link>)}{inbox.data?.items.length===0 && <Empty>No conversations yet. Open a listing to chat with its seller.</Empty>}</aside>
    {id ? <Thread key={id} id={id} refreshInbox={inbox.reload}/> : <Empty>Select a conversation.</Empty>}
  </div></div>;
}
