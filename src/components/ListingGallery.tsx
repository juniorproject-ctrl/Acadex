import {useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,ImageOff} from 'lucide-react';

export default function ListingGallery({images,title}:{images:string[];title:string}) {
  const [index,setIndex]=useState(0),[failed,setFailed]=useState<string[]>([]);
  const touch=useRef<{x:number;y:number}|null>(null);
  const selected=Math.min(index,Math.max(0,images.length-1)),src=images[selected];
  const move=(step:number)=>setIndex(current=>(current+step+images.length)%images.length);
  return <section className="listing-gallery" aria-label="Listing photos" tabIndex={images.length>1?0:undefined} onKeyDown={e=>{if(images.length>1&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();move(e.key==='ArrowLeft'?-1:1);}}}>
    <div className="listing-gallery-main" onTouchStart={e=>{const p=e.touches[0];touch.current={x:p.clientX,y:p.clientY};}} onTouchEnd={e=>{const start=touch.current;touch.current=null;if(!start||images.length<2)return;const end=e.changedTouches[0],dx=end.clientX-start.x,dy=end.clientY-start.y;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy))move(dx<0?1:-1);}}>
      {src&&!failed.includes(src)?<img src={src} alt={title+' photo '+(selected+1)} onError={()=>setFailed(old=>[...old,src])}/>:<div className="listing-gallery-placeholder"><ImageOff size={36}/><span>Photo unavailable</span></div>}
      {images.length>1&&<><button type="button" className="icon-button gallery-previous" title="Previous photo" aria-label="Previous photo" onClick={()=>move(-1)}><ChevronLeft size={24}/></button><button type="button" className="icon-button gallery-next" title="Next photo" aria-label="Next photo" onClick={()=>move(1)}><ChevronRight size={24}/></button></>}
    </div>
    {!!images.length&&<p className="gallery-counter" role="status" aria-live="polite">Photo {selected+1} of {images.length}</p>}
    {images.length>1&&<div className="listing-gallery-thumbnails">{images.map((image,i)=><button key={image+i} type="button" aria-label={'View photo '+(i+1)} aria-pressed={i===selected} title={'View photo '+(i+1)} onClick={()=>setIndex(i)}>{failed.includes(image)?<ImageOff size={24}/>:<img src={image} alt="" loading="lazy"/>}</button>)}</div>}
  </section>;
}
