import {useState} from 'react';
import {Archive,RotateCcw} from 'lucide-react';
import {mutate,useResource} from '../lib/community';
import {ActionStatus,ErrorBox,Field,useAction} from './CommunityUI';
import PasswordInput from './PasswordInput';

export default function PresentationListingSetup({reload}:{reload:()=>void}){
  const status=useResource<{available:number;imported:number;visible:number}>('/admin/presentation-listings',15000);
  const action=useAction(),[password,setPassword]=useState('');
  const change=(mode:'restore'|'hide')=>void action.run(async()=>{
    await mutate('/admin/presentation-listings',{mode,currentPassword:password});
    setPassword('');status.reload();reload();
  },mode==='restore'?'Presentation listings restored.':'Presentation listings hidden.');
  return <section className="detail-section"><h2>Presentation listings</h2>
    <p>The original collection uses fictional seller names and the old item photos. Seller accounts cannot sign in. These are presentation items, not real offers.</p>
    {status.data&&<p>{status.data.visible} visible / {status.data.available} available</p>}
    <ErrorBox error={status.error}/>
    <Field label="Your admin password"><PasswordInput visibilityLabel="administrator password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></Field>
    <div className="flex flex-wrap gap-3 mt-3"><button className="action-button" disabled={!password||action.busy||status.loading} onClick={()=>change('restore')}><RotateCcw size={16}/>Restore old listings</button><button className="secondary-button" disabled={!password||action.busy||!status.data?.visible} onClick={()=>change('hide')}><Archive size={16}/>Hide presentation listings</button></div>
    <ActionStatus action={action}/>
  </section>;
}
