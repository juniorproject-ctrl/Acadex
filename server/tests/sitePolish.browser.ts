import {chromium,expect,type Page} from '@playwright/test';
import fs from 'node:fs/promises';

const base=process.env.TEST_BASE_URL||'http://localhost:3002';
const publicRoutes=['/','/browse','/community','/past-papers','/study-groups','/tutors','/events','/advertise','/login','/signup','/forgot-password','/verify','/feedback','/help','/contact','/pricing-guide','/safety-tips','/terms-of-service','/privacy-policy'];
for(const [api,route] of [['listings?limit=1','listings'],['groups?limit=1','study-groups'],['tutors?limit=1','tutors'],['events?limit=1&period=all','events']]){
  const data=await fetch(base+'/api/'+api).then(r=>r.json());const item=(data.listings||data.items||[])[0];if(item)publicRoutes.push('/'+route+'/'+item.id);
}
const catalog=await fetch(base+'/api/catalog').then(r=>r.json());
const browser=await chromium.launch({headless:true});
const fit=async(page:Page,label:string)=>{
  await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' overflows').toBe(true);
};

async function mockSession(role:string,width:number){
  const user={id:'preview-'+role,name:'Preview '+role,email:role+'@university.ac.ae',role};
  const context=await browser.newContext({viewport:{width,height:1000}});
  await context.addInitScript(u=>{localStorage.setItem('acadex_access_token','preview-only');localStorage.setItem('acadex_session_user',JSON.stringify(u));},user);
  const page=await context.newPage();let submitted:any=null;
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname.slice(4);let data:any={items:[],total:0,page:1,pages:1,unread:0};
    if(route.request().method()!=='GET')submitted={path,body:route.request().postDataJSON()};
    if(path==='/auth/me')data={user};
    if(path==='/catalog')data=catalog;
    if(path==='/listings/mine')data={listings:[]};
    if(path==='/account/dashboard')data={bookings:[],groups:[],profile:null,slots:[],events:[]};
    if(path==='/tutor-applications/mine')data={application:null};
    if(path==='/payments/config')data={configured:false,mode:'test',methods:[]};
    if(path==='/payments/offer')data={title:'Preview campus essential',amount:50,currency:'AED',pickupAvailable:true,sellerDelivery:true};
    if(path.startsWith('/account/bookings/'))data={booking:{id:'preview-booking',studentId:user.id,student:user.name,tutorId:'preview-tutor',tutor:'Preview Tutor',status:'pending',price:50,startsAt:'2027-01-12T10:00:00Z',endsAt:'2027-01-12T11:00:00Z',createdAt:'2026-11-16T10:00:00Z',note:'Preview booking',meetingUrl:null}};
    if(path==='/admin/users')data={items:[{id:'preview-other',name:'Preview account',email:'preview@university.ac.ae',role:'student',verified:true,suspended:false}]};
    return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  return {context,page,getSubmitted:()=>submitted,clearSubmitted:()=>{submitted=null;}};
}

try{
  await fs.mkdir('test-results/site-polish',{recursive:true});
  for(const width of [1440,768,390,320]){
    const page=await browser.newPage({viewport:{width,height:1000}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    for(const route of publicRoutes){
      await page.goto(base+route);await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.locator('.loading-indicator')).toHaveCount(0,{timeout:10000});
      await fit(page,route+' '+width);
      if([1440,390].includes(width)&&['/community','/past-papers','/tutors','/events','/study-groups','/'].includes(route))await page.screenshot({path:`test-results/site-polish/${route.slice(1)||'home'}-${width}.png`,fullPage:false});
    }
    expect(errors).toEqual([]);await page.close();console.log(`PASS public pages and available listing/group/tutor/event details at ${width}px`);
  }

  for(const width of [1440,390,320])for(const role of ['student','tutor','admin']){
    const mock=await mockSession(role,width),page=mock.page,errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    const routes=['/dashboard','/settings','/accessibility','/my-listings','/my-reports','/notifications','/messages','/post','/report','/payments','/checkout?kind=listing&reference=preview','/bookings/preview-booking','/feedback','/contact'];
    if(role!=='admin')routes.push('/apply-tutor');
    if(role!=='student')routes.push('/catalog');
    if(role==='admin')routes.push('/admin','/admin/tutor-applications');
    for(const route of routes){
      await page.goto(base+route);await expect(page.locator('h1').first()).toBeVisible();await expect(page.locator('.loading-indicator')).toHaveCount(0);await fit(page,role+route+' '+width);
      if([1440,390].includes(width)&&['/dashboard','/settings','/messages','/post','/admin'].includes(route))await page.screenshot({path:`test-results/site-polish/${role}-${route.slice(1)}-${width}.png`,fullPage:false});
      if(route==='/dashboard'&&role==='tutor'){await page.getByRole('button',{name:'Profile and availability',exact:true}).click();await expect(page.getByRole('heading',{name:'Public profile',exact:true})).toBeVisible();await fit(page,'tutor profile '+width);}
      if(route==='/admin')for(const tab of ['Accounts','Study groups','Events','Past papers','Contact requests','Test accounts','Activity log']){await page.getByRole('tab',{name:tab,exact:true}).click();await expect(page.locator('.loading-indicator')).toHaveCount(0);await fit(page,'admin '+tab+' '+width);}
    }
    expect(errors).toEqual([]);await mock.context.close();console.log(`PASS ${role} pages, forms and management views at ${width}px (API fixtures only)`);
  }

  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:1000}});let submissions=0;
    await page.route('**/api/auth/login',route=>{submissions++;return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Invalid email or password.'})});});
    for(const route of ['/login','/signup']){
      await page.goto(base+route);const input=page.getByLabel('Password',{exact:true});await input.fill('Example!123');
      await expect(input).toHaveAttribute('type','password');await page.getByRole('button',{name:'Show password',exact:true}).click();await expect(input).toHaveAttribute('type','text');await expect(input).toHaveValue('Example!123');
      await page.getByRole('button',{name:'Hide password',exact:true}).focus();await page.keyboard.press('Space');await expect(input).toHaveAttribute('type','password');await fit(page,route+' toggle');
      expect(submissions).toBe(0);
    }
    await page.goto(base+'/forgot-password');await page.route('**/api/auth/forgot-password',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({message:'A reset code will be sent if the account exists.'})}));
    await page.getByLabel('Email',{exact:true}).fill('preview@university.ac.ae');await page.getByRole('button',{name:'Send reset code',exact:true}).click();
    await expect(page.locator('.password-control')).toHaveCount(2);for(const control of await page.locator('.password-control').all()){await control.locator('input').fill('Example!123');await control.getByRole('button').click();await expect(control.locator('input')).toHaveAttribute('type','text');}
    await fit(page,'password recovery '+width);await page.close();
    const mock=await mockSession('admin',width);await mock.page.goto(base+'/settings');await mock.page.getByText('Delete my account permanently',{exact:true}).click();
    await expect(mock.page.locator('.password-control')).toHaveCount(5);
    for(const control of await mock.page.locator('.password-control').all()){await control.locator('input').fill('Example!123');await control.getByRole('button').click();await expect(control.locator('input')).toHaveAttribute('type','text');await expect(control.locator('input')).toHaveValue('Example!123');}
    expect(mock.getSubmitted()).toBeNull();await fit(mock.page,'settings password controls '+width);
    await mock.page.goto(base+'/admin');await mock.page.getByRole('tab',{name:'Accounts',exact:true}).click();await mock.page.getByLabel('Your admin password',{exact:true}).fill('Example!123');await mock.page.getByRole('button',{name:'Show administrator password',exact:true}).click();await mock.page.getByLabel('Reason for access change',{exact:true}).fill('Local UI verification only');await mock.page.getByRole('button',{name:'Save access',exact:true}).click();
    await expect(mock.page.getByLabel('Your admin password',{exact:true})).toHaveValue('');expect(mock.getSubmitted().body.currentPassword).toBe('Example!123');
    await mock.page.getByRole('tab',{name:'Test accounts',exact:true}).click();await mock.page.getByLabel('Your real administrator password',{exact:true}).fill('Example!123');await mock.page.getByRole('button',{name:'Show administrator password',exact:true}).click();await expect(mock.page.getByLabel('Your real administrator password',{exact:true})).toHaveAttribute('type','text');
    await mock.context.close();console.log(`PASS password visibility, keyboard toggle, no accidental submissions, reset/settings/admin fields and visible-password clearing at ${width}px`);
  }
}finally{await browser.close();}
