import fs from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import { pool } from '../db';
import { starterSubjects, starterUniversities } from '../data/starter-catalog';
import { academicTopics } from '../../src/lib/academicTopics';
import {importPublishedUniversity,type PublishedUniversity} from '../catalogImport';

type Major = {id:string;name:string;sourceUrl:string;courses:{code:string;name:string;isShared:boolean}[]};
const snapshotPath = path.resolve('server/data/sharjah-catalog.json');
const commonCodes = new Set(['0101100','0201102','0202112','0204102','0302200']);
const clean = (value:string) => value.replace(/\s+/g,' ').trim();
async function fetchText(url:string) {
  const response = await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`Could not fetch ${url}: ${response.status}`);
  return response.text();
}
async function refresh() {
  const sitemap = load(await fetchText('https://www.sharjah.ac.ae/sitemap.xml'),{xml:true});
  const urls = [...new Set(sitemap('loc').map((_,el)=>sitemap(el).text()).get().filter(url=>/^https:\/\/www\.sharjah\.ac\.ae\/academics\/degree\/undergraduate\/[^/]+$/i.test(url)&&!url.includes('/Minor-in-')))];
  const majors:Major[] = [];
  for(const sourceUrl of urls) {
    const $ = load(await fetchText(sourceUrl));
    const name = clean($('h1').first().text());
    if(!name)throw new Error(`Missing programme title: ${sourceUrl}`);
    const courses = new Map<string,Major['courses'][number]>();
    $('table tr').each((_,row)=>{
      const cells = $(row).children('td,th').map((_,cell)=>clean($(cell).text())).get();
      const codeIndex = cells.findIndex(cell=>/^\d{6,8}$/.test(cell));
      if(codeIndex<0)return;
      const code=cells[codeIndex];
      const titleCell=$(row).children('td,th').eq(codeIndex+1);
      const title=clean(titleCell.find('p').first().text())||cells[codeIndex+1];
      if(!title||!/[a-zA-Z\u0600-\u06ff]/.test(title)||title.length>240||courses.has(code))return;
      courses.set(code,{code,name:title,isShared:commonCodes.has(code)});
    });
    const slug=sourceUrl.split('/').pop()!.toLowerCase();
    majors.push({id:'uos-'+slug,name,sourceUrl,courses:[...courses.values()]});
    console.log(name+': '+courses.size+' courses');
  }
  if(majors.length<20)throw new Error('Incomplete catalogue response; existing snapshot was not replaced.');
  await fs.mkdir(path.dirname(snapshotPath),{recursive:true});
  await fs.writeFile(snapshotPath,JSON.stringify({retrievedAt:new Date().toISOString(),university:'University of Sharjah',majors},null,2)+'\n');
}
async function main() {
  if(process.argv.includes('--refresh')||process.argv.includes('--refresh-only'))await refresh();
  if(process.argv.includes('--refresh-only')){await pool.end();return;}
  const snapshot=JSON.parse(await fs.readFile(snapshotPath,'utf8')) as {majors:Major[]};
  const supplement=JSON.parse(await fs.readFile('server/data/sharjah-supplement.json','utf8')) as {majors:Pick<Major,'id'|'courses'>[]};
  for(const major of snapshot.majors){
    const fallback=supplement.majors.find(m=>m.id===major.id);
    if(fallback&&major.courses.length<=1)major.courses=[...new Map([...fallback.courses,...major.courses].map(c=>[c.code,c])).values()];
  }
  const partners=JSON.parse(await fs.readFile('server/data/partner-catalog.json','utf8')) as {universities:PublishedUniversity[]};
  const officialUniversities=new Set(['uos',...partners.universities.map(u=>u.id)]);
  const connection=await pool.getConnection();
  try {
    await connection.beginTransaction();
    await importPublishedUniversity(connection,{id:'uos',name:'University of Sharjah',website:'https://www.sharjah.ac.ae',majors:snapshot.majors});
    for(const institution of partners.universities)await importPublishedUniversity(connection,institution);
    for (const institution of starterUniversities) {
      await connection.execute('INSERT INTO universities (id,name,website) VALUES (?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),website=VALUES(website)', [institution.id,institution.name,institution.website]);
      if(officialUniversities.has(institution.id))continue;
      for (const [slug,name,topics] of starterSubjects) {
        if (!institution.areas.includes(slug)) continue;
        // Existing published Sharjah programmes stay intact; starter topics have separate IDs.
        const majorId = institution.id+'-basic-'+slug;
        await connection.execute('INSERT IGNORE INTO majors (id,university_id,name,source_url) VALUES (?,?,?,?)', [majorId,institution.id,name,'']);
        for (const [index,topic] of topics.entries()) {
          const code = 'BASIC-'+slug.toUpperCase()+(index+1);
          const courseId = institution.id+'-'+code;
          await connection.execute('INSERT IGNORE INTO courses (id,university_id,code,name,is_shared,source_url) VALUES (?,?,?,?,FALSE,?)', [courseId,institution.id,code,topic,'']);
          await connection.execute('INSERT IGNORE INTO course_majors (course_id,major_id) VALUES (?,?)', [courseId,majorId]);
        }
      }
    }
    for(const institution of starterUniversities){
      if(officialUniversities.has(institution.id))continue;
      for(const topic of academicTopics){
        const majorId=institution.id+'-basic-'+topic.id;
        await connection.execute('INSERT IGNORE INTO majors (id,university_id,name,source_url) VALUES (?,?,?,?)',[majorId,institution.id,topic.name,'']);
        for(const [index,name] of topic.courses.entries()){
          const code='TOPIC-'+topic.id.toUpperCase()+'-'+(index+1),id=institution.id+'-'+code;
          await connection.execute('INSERT IGNORE INTO courses (id,university_id,code,name,is_shared,source_url) VALUES (?,?,?,?,FALSE,?)',[id,institution.id,code,name,'']);
          await connection.execute('INSERT IGNORE INTO course_majors (course_id,major_id) VALUES (?,?)',[id,majorId]);
        }
      }
    }
    await connection.commit();
    console.log(`Imported published programmes for University of Sharjah, American University of Sharjah and Ajman University; retained starter topics for HCT and City University Ajman. Existing papers, groups and accounts were preserved.`);
  } catch(error) {await connection.rollback();throw error;}
  finally {connection.release();await pool.end();}
}
main().catch(error=>{console.error('Catalogue import failed:',error.message);process.exitCode=1;void pool.end();});
