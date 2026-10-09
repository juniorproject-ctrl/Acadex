import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium,expect } from '@playwright/test';
import { query,pool } from '../db';
import { createAccessToken } from '../auth';

async function choose(scope:any,label:string,value:string){
  const searches:Record<string,string>={'uos':'University of Sharjah','uos-computer-science':'Computer Science','uos-1501371':'1501371'};
  const input=scope.getByRole('combobox',{name:label,exact:true});await input.fill(searches[value]||value);
  await scope.getByRole('option').filter({hasText:searches[value]||value}).first().click();
}
async function main() {
  const base=process.env.TEST_BASE_URL||'http://localhost:3001';
  const browser=await chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||'msedge',headless:true});
  const users=['leader','tutor','student'].map(role=>({id:randomUUID(),name:'QA '+role+' '+randomUUID().slice(0,6),email:randomUUID()+'@example.test',role}));
  const errors:string[]=[];
  const contexts=[];
  const pages=[];
  const ids={group:'',event:''};
  await fs.mkdir('test-results',{recursive:true});
  try {
    for(const user of users) {
      await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)',[user.id,user.name,user.email,'disabled-browser-test-account',user.role]);
      const context=await browser.newContext({viewport:{width:1440,height:1000}});
      await context.addInitScript(({token,user})=>{localStorage.setItem('acadex_access_token',token);localStorage.setItem('acadex_session_user',JSON.stringify(user));},{token:createAccessToken(user),user});
      const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
      contexts.push(context);pages.push(page);
    }
    const [leader,tutor,student]=pages;
    await student.goto(base+'/past-papers');
    await expect(student.getByLabel('Major',{exact:true})).toBeEnabled();
    await expect(student.getByLabel('Course',{exact:true})).toBeEnabled();
    await choose(student,'Major','uos-computer-science');
    await choose(student,'Course','uos-1501371');
    await expect(student).toHaveURL(/course=uos-1501371/);
    for(const path of ['/community','/dashboard']){
      await student.goto(base+path);
      await expect(student.getByRole('navigation',{name:'Community sections'})).toHaveCount(0);
    }
    await student.getByRole('button',{name:'Account menu'}).click();
    await student.getByRole('menuitem',{name:'Account settings'}).click();
    await student.getByLabel('Name',{exact:true}).fill(users[2].name+' Updated');
    await student.getByRole('button',{name:'Save changes'}).click();
    await expect(student.getByText('Account updated.')).toBeVisible();
    const [saved]=await query<any[]>('SELECT name,role,email FROM users WHERE id=?',[users[2].id]);
    expect(saved.name).toBe(users[2].name+' Updated');
    expect(saved.role).toBe('student');
    expect(saved.email).toBe(users[2].email);
    await student.goto(base+'/accessibility');
    for(const label of ['Larger text','High contrast','Reduce motion'])await student.getByLabel(label).check();
    await student.reload();
    for(const label of ['Larger text','High contrast','Reduce motion'])await expect(student.getByLabel(label)).toBeChecked();
    await student.setViewportSize({width:390,height:844});
    assertNoOverflow(await student.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'/settings enlarged');
    await student.getByRole('button',{name:'Account menu'}).click();
    await expect(student.getByRole('menuitem',{name:'Accessibility',exact:true})).toBeVisible();
    await student.screenshot({path:'test-results/account-menu-mobile.png',fullPage:true});
    await student.keyboard.press('Escape');
    await expect(student.getByRole('menu',{name:'Account',exact:true})).toHaveCount(0);
    await student.getByRole('button',{name:'Reset preferences'}).click();
    await student.setViewportSize({width:1440,height:1000});
    await student.goto(base+'/home');
    await student.getByRole('textbox',{name:'Search Acadex'}).fill('textbook');
    await student.getByRole('textbox',{name:'Search Acadex'}).press('Enter');
    await expect(student).toHaveURL(/browse\?category=Textbooks/);
    await student.goto(base+'/home');
    await expect(student.getByLabel('Search category').locator('option')).toHaveCount(10);
    await student.getByLabel('Search category').selectOption('Past Papers');
    await student.getByRole('textbox',{name:'Search Acadex'}).fill('1501371');
    await student.getByRole('button',{name:'Search',exact:true}).click();
    await expect(student).toHaveURL(/past-papers\?q=1501371/);
    await choose(student,'University','uos');
    await choose(student,'Major','uos-computer-science');
    await choose(student,'Course','uos-1501371');
    await expect(student.getByLabel('Course',{exact:true})).toHaveValue(/1501371/);
    await expect(student.getByRole('alert')).toHaveCount(0);
    await student.screenshot({path:'test-results/papers-desktop.png',fullPage:true});

    await leader.goto(base+'/study-groups');
    await leader.getByRole('button',{name:'Create group',exact:true}).click();
    const groupForm=leader.locator('form.editor-form');
    await choose(groupForm,'University','uos');
    await choose(groupForm,'Major','uos-computer-science');
    await choose(groupForm,'Course','uos-1501371');
    await groupForm.getByLabel('Group name').fill('QA Algorithm Masters');
    await groupForm.getByLabel('Course topics and group description').fill('Algorithm revision, practice problems and complexity analysis with classmates.');
    await groupForm.getByRole('button',{name:'Create group',exact:true}).click();
    await expect(leader).toHaveURL(/study-groups\/[a-f0-9-]+$/);
    ids.group=leader.url().split('/').pop()!;
    await expect(leader.getByRole('heading',{name:'Group chat'})).toBeVisible();
    await leader.getByRole('button',{name:'Add session',exact:true}).click();
    const date=(hours:number)=>{const d=new Date(Date.now()+hours*3600_000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
    const session=leader.locator('form.editor-form');
    await session.getByLabel('Session title').fill('Sorting algorithms review');
    await session.getByLabel('Starts (your local time)').fill(date(25));
    await session.getByLabel('Ends (your local time)').fill(date(26));
    await session.getByLabel('Teams / meeting link').fill('https://teams.microsoft.com/l/meetup-join/qa-session');
    await session.getByRole('button',{name:'Save session'}).click();
    await expect(leader.getByRole('heading',{name:'Sorting algorithms review'})).toBeVisible();
    await leader.getByRole('button',{name:'Add recording',exact:true}).click();
    const recording=leader.locator('form.editor-form');
    await recording.getByLabel('Recording title').fill('Recursion recap');
    await recording.getByLabel('Shared recording URL').fill('https://example.com/qa-recording');
    await recording.getByRole('button',{name:'Add recording',exact:true}).click();
    await expect(leader.getByRole('link',{name:'Recursion recap'})).toBeVisible();

    await student.goto(base+'/study-groups/'+ids.group);
    await student.getByRole('button',{name:'Join group',exact:true}).click();
    await expect(student.getByRole('link',{name:'Open meeting'})).toBeVisible();
    await student.getByRole('textbox',{name:'Message',exact:true}).fill('Could we review merge sort before the session?');
    await student.getByRole('button',{name:'Send message'}).click();
    await expect(leader.getByText('Could we review merge sort before the session?',{exact:true})).toBeVisible({timeout:10000});
    await leader.evaluate(()=>window.scrollTo(0,0));
    await leader.screenshot({path:'test-results/group-desktop.png',fullPage:true});

    await tutor.goto(base+'/dashboard');
    await expect(tutor.getByRole('button',{name:'Toggle navigation'})).toBeHidden();
    const profile=tutor.locator('form').filter({has:tutor.getByRole('heading',{name:'Public profile'})});
    await choose(profile,'University','uos');
    await profile.getByLabel('Subjects / course codes').fill('Algorithms and Data Structures');
    await profile.getByLabel('About your tutoring').fill('Patient, practical tutoring for algorithms, data structures and university exam preparation.');
    await profile.getByLabel('Hourly rate (AED)').fill('100');
    await profile.getByRole('button',{name:'Save profile'}).click();
    const availability=tutor.locator('form').filter({has:tutor.getByRole('heading',{name:'New availability'})});
    await availability.getByLabel('Starts (your local time)').fill(date(28));
    await availability.getByLabel('Ends (your local time)').fill(date(29));
    await availability.getByLabel('Total price for this session (AED)').fill('100');
    await availability.getByRole('button',{name:'Add slot'}).click();
    await expect(tutor.getByText('Availability added.')).toBeVisible();
    await student.goto(base+'/tutors/'+users[1].id);
    await student.locator('.slot-option').first().click();
    await student.getByLabel('What would you like to cover? (optional)').fill('Dynamic programming practice.');
    await student.getByRole('button',{name:'Request booking'}).click();
    await expect(student.getByText('Booking requested. Your tutor will accept or decline it.')).toBeVisible();
    await tutor.getByLabel('Teams / meeting link').fill('https://teams.microsoft.com/l/meetup-join/qa-tutor',{timeout:20000});
    await tutor.getByRole('button',{name:'Accept',exact:true}).click();
    await expect(tutor.locator('.booking-row .status-badge')).toHaveText('accepted');
    await tutor.screenshot({path:'test-results/tutor-desktop.png',fullPage:true});
    await student.goto(base+'/notifications');
    await expect(student.getByText('Tutoring booking accepted.',{exact:true})).toBeVisible();

    await leader.goto(base+'/events?create=1');
    const event=leader.locator('form.editor-form');
    await choose(event,'University','uos');
    await event.getByLabel('Event title').fill('QA Campus Research Day');
    await event.getByLabel('Venue / building / room').fill('University of Sharjah, Main Auditorium');
    await event.getByLabel('Starts (your local time)').fill(date(30));
    await event.getByLabel('Ends (your local time)').fill(date(32));
    await event.getByLabel('Event details and attendance information').fill('A test event for validating the campus information page. Open attendance.');
    await event.getByRole('button',{name:'Save event'}).click();
    await expect(leader).toHaveURL(/events\/[a-f0-9-]+$/);
    ids.event=leader.url().split('/').pop()!;
    await expect(leader.getByText('University of Sharjah, Main Auditorium',{exact:true})).toBeVisible();
    await expect(leader.getByRole('button',{name:/register/i})).toHaveCount(0);
    await leader.screenshot({path:'test-results/event-desktop.png',fullPage:true});

    await student.setViewportSize({width:390,height:844});
    for(const path of ['/home','/past-papers','/study-groups/'+ids.group,'/tutors/'+users[1].id,'/dashboard','/events/'+ids.event,'/notifications','/signup']) {
      await student.goto(base+path);await student.waitForLoadState('networkidle');
      const overflow=await student.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
      assertNoOverflow(overflow,path);
      await student.screenshot({path:'test-results/mobile-'+path.split('/')[1]+'.png',fullPage:true});
    }
    if(errors.length)throw new Error('Browser errors: '+errors.join('\n'));
    console.log('PASS: search, filters, leader group/session/recording, two-user chat, tutor profile/availability/request/accept/notification, event details, and eight mobile overflow checks.');
  } finally {
    await browser.close();
    if(ids.group)await query('DELETE FROM study_groups WHERE id=?',[ids.group]);
    if(ids.event)await query('DELETE FROM campus_events WHERE id=?',[ids.event]);
    for(const user of users)await query('DELETE b FROM tutor_bookings b JOIN tutor_slots s ON s.id=b.slot_id WHERE s.tutor_id=?',[user.id]);
    for(const user of users){await query('DELETE FROM tutor_slots WHERE tutor_id=?',[user.id]);await query('DELETE FROM tutor_profiles WHERE user_id=?',[user.id]);await query('DELETE FROM users WHERE id=?',[user.id]);}
    await pool.end();
  }
}
function assertNoOverflow(overflow:boolean,path:string){if(overflow)throw new Error('Horizontal overflow on mobile: '+path);}
main().catch(error=>{console.error(error);process.exitCode=1;});
