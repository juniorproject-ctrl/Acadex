import fs from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import { pool } from '../db';

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
      const title=cells[codeIndex+1];
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
  if(process.argv.includes('--refresh'))await refresh();
  const snapshot=JSON.parse(await fs.readFile(snapshotPath,'utf8')) as {majors:Major[]};
  const connection=await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('INSERT INTO universities (id,name,website) VALUES (?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),website=VALUES(website)',['uos','University of Sharjah','https://www.sharjah.ac.ae']);
    for(const major of snapshot.majors) {
      await connection.execute('INSERT INTO majors (id,university_id,name,source_url) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),source_url=VALUES(source_url)',[major.id,'uos',major.name,major.sourceUrl]);
      for(const course of major.courses) {
        const id='uos-'+course.code;
        await connection.execute('INSERT INTO courses (id,university_id,code,name,is_shared,source_url) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE is_shared=GREATEST(is_shared,VALUES(is_shared))',[id,'uos',course.code,course.name,course.isShared,major.sourceUrl]);
        await connection.execute('INSERT IGNORE INTO course_majors (course_id,major_id) VALUES (?,?)',[id,major.id]);
      }
    }
    await connection.commit();
    console.log(`Imported ${snapshot.majors.length} published programmes. No exam documents or accounts were created.`);
  } catch(error) {await connection.rollback();throw error;}
  finally {connection.release();await pool.end();}
}
main().catch(error=>{console.error('Catalogue import failed:',error.message);process.exitCode=1;void pool.end();});
