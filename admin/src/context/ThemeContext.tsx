import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light';
export type BrandColor = 'indigo' | 'amber' | 'emerald' | 'rose' | 'purple' | 'cyan';

export interface BrandColorDef {
  key: BrandColor;
  label: string;
  subLabel: string;
  hex: string;
  shades: Record<string, string>;
}

export const BRAND_COLORS: Record<BrandColor, BrandColorDef> = {
  indigo: {
    key: 'indigo',
    label: '極致經典藍',
    subLabel: '穩健專業 / 預設',
    hex: '#4f46e5',
    shades: {
      '50': '238 242 255',
      '100': '224 231 255',
      '200': '199 210 254',
      '300': '165 180 252',
      '400': '129 140 248',
      '500': '99 102 241',
      '600': '79 70 229',
      '700': '67 56 202',
      '800': '55 48 163',
      '900': '49 46 129',
    },
  },
  amber: {
    key: 'amber',
    label: '皇家尊爵金',
    subLabel: '一番賞大獎 / 尊貴奢華',
    hex: '#d97706',
    shades: {
      '50': '255 251 235',
      '100': '254 243 199',
      '200': '253 230 138',
      '300': '252 211 77',
      '400': '251 191 36',
      '500': '245 158 11',
      '600': '217 119 6',
      '700': '180 83 9',
      '800': '146 64 14',
      '900': '120 53 15',
    },
  },
  emerald: {
    key: 'emerald',
    label: '潮玩翡翠綠',
    subLabel: '幸運開盒 / 活力生機',
    hex: '#059669',
    shades: {
      '50': '236 253 245',
      '100': '209 250 229',
      '200': '167 243 208',
      '300': '110 231 183',
      '400': '52 211 153',
      '500': '16 185 129',
      '600': '5 150 105',
      '700': '4 120 87',
      '800': '6 95 70',
      '900': '6 78 59',
    },
  },
  rose: {
    key: 'rose',
    label: '次元櫻花玫',
    subLabel: '動漫美學 / 潮流二次元',
    hex: '#e11d48',
    shades: {
      '50': '255 241 242',
      '100': '255 228 230',
      '200': '254 205 211',
      '300': '253 164 175',
      '400': '251 113 133',
      '500': '244 63 94',
      '600': '225 29 72',
      '700': '190 18 60',
      '800': '159 18 57',
      '900': '136 19 55',
    },
  },
  purple: {
    key: 'purple',
    label: '賽博極客紫',
    subLabel: '神秘盲盒 / 未來科技',
    hex: '#9333ea',
    shades: {
      '50': '250 245 255',
      '100': '243 232 255',
      '200': '233 213 255',
      '300': '216 180 254',
      '400': '192 132 252',
      '500': '168 85 247',
      '600': '147 51 234',
      '700': '126 34 206',
      '800': '107 33 168',
      '900': '88 28 135',
    },
  },
  cyan: {
    key: 'cyan',
    label: '未來機甲青',
    subLabel: '電玩潮流 / 銳利前衛',
    hex: '#0891b2',
    shades: {
      '50': '236 254 255',
      '100': '207 250 254',
      '200': '165 243 252',
      '300': '103 232 249',
      '400': '34 211 238',
      '500': '6 182 212',
      '600': '8 145 178',
      '700': '14 116 144',
      '800': '21 94 117',
      '900': '22 78 99',
    },
  },
};

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  brandColor: BrandColor;
  setBrandColor: (color: BrandColor) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
  brandColor: 'indigo',
  setBrandColor: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('onesoul_theme');
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'dark';
  });

  const [brandColor, setBrandColorState] = useState<BrandColor>(() => {
    try {
      const saved = localStorage.getItem('onesoul_brand_color');
      if (saved && saved in BRAND_COLORS) {
        return saved as BrandColor;
      }
    } catch {
      // fallback
    }
    return 'indigo';
  });

  // 監聽明亮/夜晚主題
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    }
    try {
      localStorage.setItem('onesoul_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // 監聽品牌識別主色 Token
  useEffect(() => {
    const root = document.documentElement;
    const def = BRAND_COLORS[brandColor] || BRAND_COLORS.indigo;
    Object.entries(def.shades).forEach(([shade, rgb]) => {
      root.style.setProperty(`--color-brand-${shade}`, rgb);
    });
    try {
      localStorage.setItem('onesoul_brand_color', brandColor);
    } catch {
      // ignore
    }
  }, [brandColor]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  const setBrandColor = (newColor: BrandColor) => {
    setBrandColorState(newColor);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, brandColor, setBrandColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
