import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}`.padStart(2, '0')
}

export function fmt(n: number): string {
  return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : `${n}`
}
