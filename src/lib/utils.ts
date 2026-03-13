import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhone(value: string) {
  if (!value) return '';
  value = value.replace(/\D/g, '');
  if (value.length > 11) value = value.slice(0, 11);
  
  if (value.length > 2) {
    value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
  }
  if (value.length > 10) {
    value = `${value.slice(0, 10)}-${value.slice(10)}`;
  }
  return value;
}
