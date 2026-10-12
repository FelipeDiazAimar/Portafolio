import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...entradas) { return twMerge(clsx(entradas)); }
