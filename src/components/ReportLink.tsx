import {Link} from 'react-router-dom';
import {Flag} from 'lucide-react';
import {getCurrentUser} from '../lib/auth';
export type ReportKind='listing'|'group'|'tutor'|'event'|'paper';
export function reportLink(kind:ReportKind,id:string,title:string){
  return '/report?'+new URLSearchParams({targetType:kind,targetId:id,subject:('Report '+kind+': '+title).slice(0,160),context:title});
}
export default function ReportLink({kind,id,title,ownerId}:{kind:ReportKind;id:string;title:string;ownerId?:string}){
  const user=getCurrentUser();
  if(!user||user.id===ownerId)return null;
  return <Link className="text-link" to={reportLink(kind,id,title)}><Flag size={16}/>Report {kind==='group'?'group':kind}</Link>;
}
