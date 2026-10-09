export const searchCategories = ['Textbooks','Electronics','Supplies','Study Setup','Lab Equipment','Past Papers','Tutors','Study Groups','Campus Events'];
const targets:[string,string,RegExp][] = [
  ['Past Papers','/past-papers',/\b(past\s+(papers?|quizzes|exams?)|exam\s+papers?)\b/ig],
  ['Tutors','/tutors',/\b(tutors?|tutoring)\b/ig],
  ['Study Groups','/study-groups',/\b(study\s+groups?)\b/ig],
  ['Campus Events','/events',/\b((campus\s+)?events?)\b/ig],
  ['Textbooks','/browse',/\b(text\s*books?)\b/ig],
  ['Electronics','/browse',/\b(electronics)\b/ig],
  ['Supplies','/browse',/\b(supplies|stationery)\b/ig],
  ['Study Setup','/browse',/\b(study\s+setup)\b/ig],
  ['Lab Equipment','/browse',/\b(lab\s+equipment)\b/ig],
];
export function searchDestination(query:string,category='') {
  const clean=query.trim();
  const target=targets.find(([label,,pattern])=>category?label===category:new RegExp(pattern.source,'i').test(clean));
  if(!target)return clean?`/search?q=${encodeURIComponent(clean)}`:'/browse';
  const [label,path,pattern]=target;
  const term=clean.replace(pattern,' ').replace(/\s+/g,' ').trim();
  const params=new URLSearchParams();
  if(path==='/browse')params.set('category',label);
  if(term)params.set(path==='/browse'?'search':'q',term);
  return path+(params.size?'?'+params.toString():'');
}
