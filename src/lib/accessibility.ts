export type Accessibility = { largeText:boolean; highContrast:boolean; reducedMotion:boolean };
export const defaults: Accessibility = {largeText:false,highContrast:false,reducedMotion:false};
const key = 'acadex_accessibility';
export function readAccessibility(): Accessibility {
  try {
    const value=JSON.parse(localStorage.getItem(key)||'{}');
    return {largeText:value.largeText===true,highContrast:value.highContrast===true,reducedMotion:value.reducedMotion===true};
  } catch { return {...defaults}; }
}
export function applyAccessibility(value=readAccessibility()) {
  document.documentElement.classList.toggle('large-text',value.largeText);
  document.documentElement.classList.toggle('high-contrast',value.highContrast);
  document.documentElement.classList.toggle('reduced-motion',value.reducedMotion);
}
export function saveAccessibility(value: Accessibility) {
  localStorage.setItem(key,JSON.stringify(value));
  applyAccessibility(value);
}
