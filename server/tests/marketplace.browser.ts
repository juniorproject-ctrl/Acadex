import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { query, pool } from '../db';
import { createAccessToken } from '../auth';

async function main() {
  const base=process.env.TEST_BASE_URL || 'http://localhost:3002';
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const user={id:randomUUID(),name:'Marketplace browser test',email:randomUUID()+'@example.test',role:'student'};
  const errors:string[]=[];
  try {
    await mkdir('test-results',{recursive:true});
    const guest=await browser.newPage();
    guest.on('pageerror',error=>errors.push(error.message));
    await guest.goto(base+'/feedback');
    await expect(guest.getByRole('heading',{name:'Share your feedback'})).toBeVisible();
    await expect(guest.locator('nav')).toHaveCount(0);await expect(guest.locator('footer')).toHaveCount(0);
    await expect(guest.getByRole('link',{name:'Back to sign in'})).toHaveAttribute('href','/');
    await guest.screenshot({path:'test-results/feedback-standalone.png',fullPage:true});
    for(const path of ['/home','/browse','/community','/past-papers','/messages']) {
      await guest.goto(base+path);await expect(guest.getByRole('heading',{name:'Welcome Back!'})).toBeVisible();
    }
    await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)',[user.id,user.name,user.email,'disabled-browser-test-login',user.role]);
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.addInitScript(({token,user})=>{localStorage.setItem('acadex_access_token',token);localStorage.setItem('acadex_session_user',JSON.stringify(user));},{token:createAccessToken(user),user});
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      for(const path of ['/home','/browse','/past-papers','/post','/messages']) {
        await page.goto(base+path);await page.waitForLoadState('networkidle');
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        if(path==='/past-papers') {
          const university=page.getByRole('combobox',{name:'University',exact:true});await university.fill('Higher Colleges');
          await page.getByRole('option',{name:'Higher Colleges of Technology',exact:true}).click();
          const major=page.getByRole('combobox',{name:'Major',exact:true});await major.fill('Software Engineering');
          await page.getByRole('option',{name:'Software Engineering',exact:true}).click();
          const course=page.getByRole('combobox',{name:'Course',exact:true});await course.fill('Software Design');
          await expect(page.getByRole('option').filter({hasText:'Software Design'})).toBeVisible();
          await page.keyboard.press('Escape');
          await page.getByRole('textbox',{name:'Search',exact:true}).focus();
          const style=await page.locator('.search-control').evaluate(el=>({border:getComputedStyle(el).borderColor,shadow:getComputedStyle(el).boxShadow}));
          expect(style.border).toBe('rgb(45, 75, 105)');expect(style.shadow).toContain('inset');
        }
        if(path==='/post') {await expect(page.getByLabel('Buyer can pick up')).toBeChecked();await expect(page.getByLabel('I can deliver the item myself')).not.toBeChecked();}
        await page.screenshot({path:'test-results/marketplace-'+path.slice(1)+'-'+viewport.width+'.png',fullPage:true});
      }
    }
    expect(errors).toEqual([]);console.log('PASS: standalone feedback, protected pages, university/major/course filters, navy focus, handover inputs, and desktop/mobile overflow checks.');
  } finally {
    await browser.close();await query('DELETE FROM users WHERE id=?',[user.id]);await pool.end();
  }
}
main().catch(async error=>{console.error(error);await pool.end().catch(()=>{});process.exitCode=1;});
