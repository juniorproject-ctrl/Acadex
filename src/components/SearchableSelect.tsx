import { Children,isValidElement,useEffect,useId,useRef,useState,type ReactNode } from 'react';
import { ChevronDown,Check } from 'lucide-react';

type Props={value:string;onChange:(event:{target:{value:string}})=>void;children:ReactNode;name?:string;required?:boolean;disabled?:boolean;'aria-labelledby'?:string};
export default function SearchableSelect(props:Props){
  const options=Children.toArray(props.children).filter(isValidElement).map(child=>{
    const p=child.props as {value:string;children:ReactNode};
    return {value:String(p.value),label:Children.toArray(p.children).join('')};
  });
  const selected=options.find(o=>o.value===props.value)?.label||'';
  const [query,setQuery]=useState(selected),[open,setOpen]=useState(false),[active,setActive]=useState(0);
  const input=useRef<HTMLInputElement>(null),container=useRef<HTMLDivElement>(null),id=useId();
  const matches=options.filter(o=>!query||query===selected||o.label.toLowerCase().includes(query.toLowerCase()));
  useEffect(()=>{setQuery(selected);setActive(0);},[selected]);
  useEffect(()=>{input.current?.setCustomValidity(query!==selected?'Choose an option from the list.':props.required&&!props.value?'Choose an option.':'');},[query,selected,props.value,props.required]);
  useEffect(()=>{if(open)document.getElementById(`${id}-${active}`)?.scrollIntoView({block:'nearest'});},[active,open,id]);
  const choose=(value:string)=>{props.onChange({target:{value}});setQuery(options.find(o=>o.value===value)?.label||'');setOpen(false);input.current?.focus();};
  return <div className="searchable-select" ref={container} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)){setOpen(false);setQuery(selected);}}}>
    {props.name&&<input type="hidden" name={props.name} value={props.value}/>}
    <div className="combobox-control"><input ref={input} role="combobox" aria-labelledby={props['aria-labelledby']} aria-expanded={open} aria-controls={id} aria-autocomplete="list" aria-activedescendant={open&&matches[active]?`${id}-${active}`:undefined} autoComplete="off" value={query} required={props.required} disabled={props.disabled}
      onFocus={()=>{setOpen(true);setActive(0);input.current?.select();}}
      onChange={e=>{setQuery(e.target.value);setActive(0);setOpen(true);}}
      onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);setQuery(selected);}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(n=>Math.max(0,Math.min(matches.length-1,n+(e.key==='ArrowDown'?1:-1))));}else if(e.key==='Enter'&&open){e.preventDefault();if(matches[active])choose(matches[active].value);}}}/>
      <button type="button" tabIndex={-1} disabled={props.disabled} aria-label="Show options" onMouseDown={e=>e.preventDefault()} onClick={()=>{if(open)setOpen(false);else{input.current?.focus();setOpen(true);}}}><ChevronDown size={18}/></button>
    </div>
    {open&&<div id={id} role="listbox" aria-labelledby={props['aria-labelledby']} className="combobox-options">{matches.length?matches.map((option,index)=><div role="option" id={`${id}-${index}`} key={option.value} aria-selected={option.value===props.value} className={index===active?'highlighted':''} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>choose(option.value)}><span>{option.label}</span>{option.value===props.value&&<Check size={15}/>}</div>):<p role="status">No matching options</p>}</div>}
  </div>;
}
