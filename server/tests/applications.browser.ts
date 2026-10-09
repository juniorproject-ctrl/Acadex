import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium,expect } from '@playwright/test';
import { query,pool } from '../db';
import { createAccessToken } from '../auth';

async function main(){
  const base=process.env.TEST_BASE_URL||'http://localhost:3001',browser=await chromium.launch({channel:'msedge',headless:true});
  const users=['student','admin'].map(role=>({id:randomUUID(),name:'Browser '+role+' '+randomUUID().slice(0,6),email:randomUUID()+'@example.test',role}));
  const errors:string[]=[];const documents:string[]=[];
  try{
    const pages=[];
    for(const user of users){
      await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)',[user.id,user.name,user.email,'disabled-test-account',user.role]);
      const context=await browser.newContext({viewport:{width:1440,height:1000}});
      await context.addInitScript(({token,user})=>{if(!localStorage.getItem('acadex_access_token')){localStorage.setItem('acadex_access_token',token);localStorage.setItem('acadex_session_user',JSON.stringify(user));}},{token:createAccessToken(user),user});
      const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));pages.push(page);
    }
    const [student,admin]=pages;
    await student.goto(base+'/signup');await expect(student.locator('select')).toHaveCount(0);await expect(student.getByText('Role',{exact:true})).toHaveCount(0);
    await student.goto(base+'/past-papers');
    const major=student.getByRole('combobox',{name:'Major',exact:true});await major.fill('Computer Sci');
    await expect(student.getByRole('option').filter({hasText:'Computer Science'}).first()).toBeVisible();
    await major.press('Enter');
    const course=student.getByRole('combobox',{name:'Course',exact:true});await course.fill('1501371');await expect(student.getByRole('option')).toHaveCount(1);
    await student.screenshot({path:'test-results/searchable-course-desktop.png',fullPage:true});await course.press('Enter');await expect(student).toHaveURL(/course=uos-1501371/);
    await student.goto(base+'/settings');await expect(student.getByLabel('Name',{exact:true})).toBeVisible();await expect(student.getByLabel('Larger text')).toHaveCount(0);
    await student.getByRole('button',{name:'Account menu'}).click();await student.getByRole('menuitem',{name:'Accessibility',exact:true}).click();
    await expect(student).toHaveURL(/\/accessibility$/);await expect(student.getByLabel('Larger text')).toBeVisible();await expect(student.getByLabel('Name',{exact:true})).toHaveCount(0);
    async function fillApplication(){
      await student.getByRole('combobox',{name:'University',exact:true}).fill('Sharjah');await student.getByRole('option',{name:'University of Sharjah',exact:true}).click();
      await student.getByLabel('Subjects / course codes').fill('Algorithms 1501371');await student.getByLabel('Academic role').selectOption('senior_student');
      await student.getByLabel('Academic position / study year').fill('Final-year computing student');
      await student.getByLabel('Qualifications and teaching experience').fill('Demonstration application for testing administrator review and role updates.');
      await student.getByRole('checkbox').check();await student.getByRole('button',{name:'Submit application'}).click();await expect(student.locator('.status-badge')).toHaveText('pending');
    }
    await student.goto(base+'/apply-tutor');await student.setViewportSize({width:390,height:844});
    await student.getByRole('combobox',{name:'University',exact:true}).waitFor();
    expect(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await student.screenshot({path:'test-results/application-form-mobile.png',fullPage:true});
    await fillApplication();await student.setViewportSize({width:1440,height:1000});
    await student.screenshot({path:'test-results/tutor-application-desktop.png',fullPage:true});
    await admin.goto(base+'/admin/tutor-applications');
    let review=admin.locator('section.detail-section').filter({has:admin.getByRole('heading',{name:users[0].name,exact:true})});
    await expect(review).toBeVisible();await expect(admin.getByText('Permit PDF',{exact:true})).toHaveCount(0);
    await review.getByLabel('Decision').selectOption('declined');await review.getByLabel('Review notes for applicant').fill('Please explain your teaching experience.');await review.getByRole('checkbox').check();await review.getByRole('button',{name:'Save decision'}).click();await expect(review).toHaveCount(0);
    await student.reload();await expect(student.locator('.status-badge')).toHaveText('declined');await fillApplication();
    await admin.reload();review=admin.locator('section.detail-section').filter({has:admin.getByRole('heading',{name:users[0].name,exact:true})});
    await review.getByLabel('Review notes for applicant').fill('Test application approved for browser verification only.');await review.getByRole('checkbox').check();
    await admin.screenshot({path:'test-results/tutor-review-desktop.png',fullPage:true});await review.getByRole('button',{name:'Save decision'}).click();await expect(review).toHaveCount(0);
    await student.reload();await expect(student.locator('.status-badge')).toHaveText('approved');await student.getByRole('link',{name:'Open your tutor dashboard'}).click();await expect(student.getByRole('heading',{name:'Tutor Dashboard',exact:true})).toBeVisible();
    await student.goto(base+'/report');await student.getByLabel('Subject',{exact:true}).fill('Browser test complaint');await student.getByLabel('Details',{exact:true}).fill('An example complaint to verify the admin queue.');await student.getByRole('button',{name:'Send report'}).click();await expect(student.getByText('Your report has been sent to the administrator.')).toBeVisible();
    await admin.goto(base+'/dashboard');await expect(admin.getByRole('heading',{name:'Admin Dashboard',exact:true})).toBeVisible();const complaint=admin.locator('article.detail-section').filter({has:admin.getByRole('heading',{name:'Browser test complaint',exact:true})});await expect(complaint).toBeVisible();await complaint.getByLabel('Status',{exact:true}).selectOption('resolved');await complaint.getByLabel('Review notes',{exact:true}).fill('Checked the sample complaint.');await complaint.getByRole('button',{name:'Save review'}).click();await expect(complaint).toHaveCount(0);
    await student.goto(base+'/dashboard');await student.getByRole('button',{name:'Profile and availability',exact:true}).click();await expect(student.getByRole('heading',{name:'Public profile',exact:true})).toBeVisible();
    await student.goto(base+'/browse');await student.getByRole('link',{name:'Buy item',exact:true}).first().click();await expect(student.getByRole('heading',{name:'Checkout',exact:true})).toBeVisible();
    await expect(student.getByRole('button',{name:'Continue to test checkout'})).toBeDisabled();await expect(student.getByText(/awaiting administrator setup/)).toBeVisible();await student.screenshot({path:'test-results/checkout-desktop.png',fullPage:true});
    await student.setViewportSize({width:390,height:844});
    for(const route of ['/apply-tutor','/settings','/accessibility','/payments','/past-papers']){
      await student.goto(base+route);await student.waitForLoadState('networkidle');
      if(route==='/past-papers'){await student.getByRole('combobox',{name:'Course',exact:true}).fill('calculus');await expect(student.getByRole('option').first()).toBeVisible();}
      expect(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await student.screenshot({path:'test-results/new-mobile-'+route.slice(1)+'.png',fullPage:true});
    }
    expect(errors).toEqual([]);console.log('PASS: searchable course selection, distinct settings/accessibility, student-only signup, academic applications, decline/resubmit/approve, tutor role refresh, unconfigured checkout and five mobile views.');
  }finally{
    await browser.close();
    await query('DELETE FROM tutor_applications WHERE user_id=?',[users[0].id]);
    for(const user of users){await query('DELETE FROM reports WHERE reporter_id=?',[user.id]);await query('DELETE FROM users WHERE id=?',[user.id]);}
    for(const file of documents)await fs.unlink(path.resolve('private-tutor-documents',file)).catch(()=>{});
    await pool.end();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
