import { useCallback, useEffect, useState } from 'react';
import { request } from './api';

export type Catalog = { universities: {id:string;name:string;website:string}[]; majors:{id:string;universityId:string;name:string;sourceUrl:string}[]; courses:{id:string;universityId:string;name:string;code:string;isShared:boolean;majorIds:string[];sourceUrl:string}[] };
export type PageData<T> = {items:T[];total:number;page:number;pages:number};
export type Paper = {id:string;ownerId:string;title:string;course:string;code:string;university:string;academicYear:number;examType:string};
export type Group = {id:string;ownerId:string;title:string;description:string;universityId:string;university:string;course:string;code:string;leader:string;members:number};
export type Slot = {id:string;startsAt:string;endsAt:string;price:number;cancelled?:boolean;reserved?:boolean};
export type Tutor = {id:string;name:string;universityId:string;university:string;subjects:string;bio:string;hourlyRate:number;slots:Slot[]};
export type CampusEvent = {id:string;ownerId:string;universityId:string;university:string;title:string;description:string;location:string;startsAt:string;endsAt:string;sourceUrl:string;imageKey:string;cancelled:boolean};
export type GroupSession = {id:string;title:string;startsAt:string;endsAt:string;meetingUrl:string;cancelled:boolean};
export type Recording = {id:string;title:string;url:string};
export type Room = {sessions:GroupSession[];recordings:Recording[]};
export type Message = {id:number;userId:string;author:string;body:string;createdAt:string};
export type Booking = {id:string;status:string;studentId:string;student:string;tutorId:string;tutor:string;note:string;startsAt:string;endsAt:string;price:number;meetingUrl:string|null;paymentStatus?:string|null};
export type DashboardData = {groups:Group[];profile:Pick<Tutor,'universityId'|'subjects'|'bio'|'hourlyRate'>|null;slots:Slot[];bookings:Booking[];events:CampusEvent[]};
export type NotificationData = {items:{id:string;title:string;href:string;isRead:boolean;createdAt:string}[];unread:number};

export function useResource<T>(url:string|null, interval=0) {
  const [data,setData] = useState<T|null>(null), [error,setError] = useState(''), [loading,setLoading] = useState(!!url);
  const [revision,setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value+1),[]);
  useEffect(() => {
    let active = true, running = false;
    setData(null); setError(''); setLoading(!!url);
    if (!url) return;
    const fetchData = async () => {
      if (running) return;
      running = true;
      try { const result = await request<T>(url); if (active) {setData(result);setError('');} }
      catch (error) {if (active) setError(error instanceof Error ? error.message : 'Unable to load this page.');}
      finally {running=false;if (active) setLoading(false);}
    };
    void fetchData();
    const timer = interval ? window.setInterval(fetchData,interval) : undefined;
    return () => {active=false;if(timer)clearInterval(timer);};
  },[url,revision,interval]);
  return {data,error,loading,reload};
}
export const mutate = <T = {ok:boolean;id?:string}>(url:string,body?:unknown,method='POST') => request<T>(url,{method,body:body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body)});
export function formValues(form:HTMLFormElement) {return Object.fromEntries(new FormData(form).entries());}
export function dateTime(value:string) {return new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Dubai'}).format(new Date(value)) + ' GST';}
export function localInput(value:string) {const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export function timedValues(form:HTMLFormElement) {const body=formValues(form);return {...body,startsAt:new Date(String(body.startsAt)).toISOString(),endsAt:new Date(String(body.endsAt)).toISOString()};}
export const eventImage = (key:string) => ({'global-day':'/events/global-day.jpg','career-day':'/events/career-day.jpg','dental-symposium':'/events/dental-symposium.jpg'}[key] || '/events/global-day.jpg');
export const isTeacher = (role?:string) => ['tutor','leader','admin'].includes(role||'');
