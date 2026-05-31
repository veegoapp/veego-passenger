export type ThemeColors = {
  ink: string;
  inkSoft: string;
  silver: string;
  mist: string;
  snow: string;
  background: string;
  white: string;
  border: string;
  accentMint: string;
  badge: string;
  luxeGrad: readonly [string, string];
  luxeSoftGrad: readonly [string, string];
  isDark: boolean;
};

export const LIGHT: ThemeColors = {
  ink: '#1e1e28',
  inkSoft: '#5e5e72',
  silver: '#c3c3cc',
  mist: '#f2f2f5',
  snow: '#f8f8fb',
  background: '#fafafd',
  white: '#ffffff',
  border: '#e5e5ea',
  accentMint: '#55c49a',
  badge: '#d95c35',
  luxeGrad: ['#f4f4fb', '#ededf4'],
  luxeSoftGrad: ['#fafafa', '#f4f4f8'],
  isDark: false,
};

export const DARK: ThemeColors = {
  ink: '#e8e8f2',
  inkSoft: '#7878a0',
  silver: '#3a3a58',
  mist: '#1e1e32',
  snow: '#16162a',
  background: '#0f0f1e',
  white: '#1a1a2e',
  border: '#2c2c46',
  accentMint: '#55c49a',
  badge: '#e07055',
  luxeGrad: ['#1e1e32', '#0f0f1e'],
  luxeSoftGrad: ['#181828', '#0f0f1e'],
  isDark: true,
};

export function makeGlassStyle(c: ThemeColors) {
  return {
    backgroundColor: c.isDark ? 'rgba(28,30,54,0.94)' : 'rgba(255,255,255,0.78)',

    // 🛠️ التعديل هنا: تم إخفاء الخط تماماً بجعل السُمك 0 واللون شفاف
    borderWidth: 0,
    borderColor: 'transparent',

    shadowColor: c.isDark ? '#000' : '#1e1e28',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: c.isDark ? 0.5 : 0.08,
    shadowRadius: 18,
    elevation: 4,
  };
}

export const S = {
  luxe: {
    shadowColor: '#1e1e28',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  float: {
    shadowColor: '#1e1e28',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.13,
    shadowRadius: 30,
    elevation: 10,
  },
};

export const C = LIGHT;
export const glassStyle = makeGlassStyle(LIGHT);