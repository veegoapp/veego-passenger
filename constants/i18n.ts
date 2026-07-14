import { en } from './i18n/en';
import { ar } from './i18n/ar';

export type LangKey = keyof typeof en;
export type Lang = 'en' | 'ar';

export const translations: Record<Lang, typeof en> = { en, ar };
