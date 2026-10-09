import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Upload, Trash2, FileText } from 'lucide-react';
import { getCurrentUser } from '../lib/auth';
import { formValues, mutate, useResource, type PageData, type Paper } from '../lib/community';
import { ActionStatus, CatalogSelect, CommunityPage, Empty, ErrorBox, Field, Pagination, SearchFilters, Submit, useAction } from '../components/CommunityUI';

export default function PastPapers() {
  const [params]=useSearchParams();
  const result=useResource<PageData<Paper>>('/papers?'+params.toString());
  const [upload,setUpload]=useState(false),[,setCourse]=useState('');
  const user=getCurrentUser(), action=useAction();
  return <CommunityPage title="Past Papers" action={user?<button className="action-button" onClick={()=>setUpload(!upload)}><Upload size={17}/>{upload?'Close upload':'Upload paper'}</button>:<Link className="text-link" to="/">Sign in to upload</Link>}>
    {upload&&<form className="editor-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const body=new FormData(form);body.set('permission',body.has('permission')?'true':'false');if(await action.run(async()=>{await mutate('/papers',body);result.reload();},'Paper uploaded.')){form.reset();setUpload(false);}}}>
      <h2>Share a past paper</h2><div className="form-grid"><CatalogSelect onCourse={setCourse}/><Field label="Paper title"><input name="title" required maxLength={160}/></Field><Field label="Academic year"><input type="number" name="academicYear" min="1990" max={new Date().getFullYear()+1} defaultValue={new Date().getFullYear()} required/></Field><Field label="Assessment"><select name="examType"><option>Midterm</option><option>Final</option><option>Quiz</option><option>Practice</option></select></Field><Field label="PDF (maximum 10 MB)"><input name="file" type="file" accept="application/pdf" required/></Field></div><label className="checkbox-label"><input type="checkbox" name="permission" required/>I have permission to share this paper and it contains no personal student information.</label><Submit busy={action.busy}>Upload PDF</Submit>
    </form>}
    <ActionStatus action={action}/><SearchFilters academic/><ErrorBox error={result.error}/>
    {result.loading?<Empty>Loading papers...</Empty>:result.data?.items.length?<div className="paper-list">{result.data.items.map(p=><article className="paper-row" key={p.id}><FileText size={28}/><div className="min-w-0 flex-1"><h2>{p.title}</h2><p>{p.code} - {p.course}</p><p className="muted">{p.university} · {p.academicYear} · {p.examType}</p></div><a className="icon-button" href={`/api/papers/${p.id}/download`} title="Download PDF" aria-label={`Download ${p.title}`}><Download size={20}/></a>{p.ownerId===user?.id&&<button className="icon-button" title="Delete paper" disabled={action.busy} onClick={()=>{if(window.confirm('Delete this paper?'))void action.run(async()=>{await mutate('/papers/'+p.id,undefined,'DELETE');result.reload();},'Paper deleted.');}}><Trash2 size={18}/></button>}</article>)}</div>:!result.error&&<Empty>No papers match these filters yet.</Empty>}
    {result.data&&<Pagination {...result.data}/>}
  </CommunityPage>;
}
