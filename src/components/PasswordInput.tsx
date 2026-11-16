import {useId,useState,type InputHTMLAttributes} from 'react';
import {Eye,EyeOff} from 'lucide-react';

type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'type'> & {visibilityLabel?:string};

export default function PasswordInput({visibilityLabel='password',...props}:Props){
  const [visible,setVisible]=useState(false);
  const generatedId=useId(),id=props.id||generatedId;
  const label=(visible?'Hide ':'Show ')+visibilityLabel;
  return <span className="password-control">
    <input {...props} id={id} type={visible?'text':'password'}/>
    <button type="button" className="password-toggle" aria-label={label} title={label} aria-pressed={visible} aria-controls={id} disabled={props.disabled} onMouseDown={event=>event.preventDefault()} onClick={event=>{event.preventDefault();setVisible(value=>!value);}}>{visible?<EyeOff size={19} aria-hidden="true"/>:<Eye size={19} aria-hidden="true"/>}</button>
  </span>;
}
