import {chromium,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {query,pool} from '../db';
import {createAccessToken} from '../auth';
import {simpleAcademicOptions} from '../../src/lib/academicTopics';

const base=process.env.TEST_BASE_URL||'http://localhost:3007';
const user={id:randomUUID(),name:'Catalogue QA',email:randomUUID()+'@example.test',role:'student'};
const token=createAccessToken(user),headers={Authorization:'Bearer '+token},prefix='Catalogue QA '+randomUUID().slice(0,8);
const browser=await chromium.launch({headless:true});
try{
  await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)',[user.id,user.name,user.email,'disabled-qa-login',user.role]);
  const response=await fetch(base+'/api/catalog',{headers});expect(response.status).toBe(200);const data=await response.json();
  expect(data.universities.find(u=>u.id==='ajman').name).toBe('Ajman University');
  const arabicMajor=simpleAcademicOptions(data,'uos').majors.find(m=>m.ids.includes('uos-foundations-of-religion'))!;
  for(const [university,major,courseName] of [['aus','topic:cs','Operating Systems'],['ajman','topic:nursing',''],['aus','major:architecture',''],['uos',arabicMajor.id,'@arabic']]){
    const options=simpleAcademicOptions(data,university,major),course=courseName==='@arabic'?options.courses.find(c=>/[\u0600-\u06ff]/.test(c.name))!:courseName?options.courses.find(c=>c.name===courseName)!:options.courses[0];
    expect(course).toBeTruthy();
    await query('INSERT INTO study_groups (id,owner_id,university_id,course_id,title,description) VALUES (?,?,?,?,?,?)',[randomUUID(),user.id,university,course.ids[0],prefix+' '+major,'Temporary linked-catalogue filter test group.']);
    const params=new URLSearchParams({q:prefix,university,major,course:course.id});
    const result=await fetch(base+'/api/groups?'+params,{headers});expect(result.status).toBe(200);const matches=await result.json();
    expect(matches.total).toBe(1);expect(matches.items[0].universityId).toBe(university);expect(matches.items[0].courseId).toBe(course.ids[0]);
  }
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600});
    await context.addInitScript(({token,user})=>{localStorage.setItem('acadex_access_token',token);localStorage.setItem('acadex_session_user',JSON.stringify(user));},{token,user});
    const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    const choose=async(scope:any,label:string,name:string)=>{const input=scope.getByRole('combobox',{name:label,exact:true});await input.fill(name);await page.getByRole('option',{name,exact:true}).click();};
    await page.goto(base+'/past-papers');
    const filters=page.locator('.filter-bar');
    await choose(filters,'University','American University of Sharjah');
    await filters.getByRole('combobox',{name:'Major',exact:true}).fill('Nursing');
    await expect(page.getByRole('option',{name:'Nursing',exact:true})).toHaveCount(0);
    await choose(filters,'Major','Computer Science');await choose(filters,'Course','Operating Systems');
    await expect(page).toHaveURL(/course=topic%3AOperating\+Systems/);
    await choose(filters,'University','Ajman University');
    await expect(filters.getByRole('combobox',{name:'Major',exact:true})).toHaveValue('All majors');
    await expect(filters.getByRole('combobox',{name:'Course',exact:true})).toHaveValue('All courses');
    await choose(filters,'Major','Nursing');
    await filters.getByRole('combobox',{name:'Course',exact:true}).fill('Nurs');
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.screenshot({path:`test-results/catalog/filters-${width}.png`,fullPage:true});
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'Upload paper',exact:true}).click();
    const form=page.locator('.editor-form');
    await choose(form,'University','American University of Sharjah');await choose(form,'Major','Computer Science');await choose(form,'Course','Operating Systems');
    const courseId=await form.locator('[name=courseId]').inputValue();
    expect(data.courses.find(c=>c.id===courseId)?.universityId).toBe('aus');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    expect(errors).toEqual([]);await context.close();console.log('Passed linked filters and upload form at '+width+'px');
  }
}finally{
  await browser.close();await query('DELETE FROM study_groups WHERE owner_id=?',[user.id]);await query('DELETE FROM users WHERE id=?',[user.id]);await pool.end();
}
