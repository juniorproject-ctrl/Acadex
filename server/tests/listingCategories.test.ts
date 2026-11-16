import test from 'node:test';
import assert from 'node:assert/strict';
import {listingCategories} from '../../shared/listingCategories';
import {listingCategories as postingCategories} from '../../src/lib/demoListings';
import {searchCategories,searchDestination} from '../../src/lib/search';

test('marketplace categories are shared by posting, browsing and home search',()=>{
  assert.equal(postingCategories,listingCategories);
  assert.equal(new Set(listingCategories).size,listingCategories.length);
  for(const category of ['Sports & Fitness','Art & Design','Musical Instruments','Clothing & Accessories','Home Essentials']){
    assert.ok(searchCategories.includes(category));
    const url=new URL(searchDestination('',category),'https://example.test');
    assert.equal(url.pathname,'/browse');assert.equal(url.searchParams.get('category'),category);
    const typed=new URL(searchDestination(category),'https://example.test');
    assert.equal(typed.pathname,'/browse');assert.equal(typed.searchParams.get('category'),category);
  }
  assert.ok(!listingCategories.some(category=>/dorm/i.test(category)));
  assert.ok(listingCategories.every(category=>category.length<=50));
});
