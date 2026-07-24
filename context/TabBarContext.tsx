import React, { createContext, useContext, useState } from 'react';

// TAB_BAR_HEIGHT_FALLBACK: a safe default used before the tab bar has measured
// itself on first render. Derived from the navOuter layout:
//   paddingTop(4) + navInner(12) + navItem(16) + content(32) + paddingBottom(8)
//   = 72 fixed + insets.bottom. 80 covers most no-safe-area devices.
export const TAB_BAR_HEIGHT_FALLBACK = 80;

type TabBarContextType = {
  visible: boolean;
  setVisible: (v: boolean) => void;
  /** Full rendered height of the tab bar (navOuter), including safe-area bottom.
   *  Use this as paddingBottom for any sheet/card anchored at bottom: 0 inside
   *  the tab navigator so content never hides behind the bar. */
  tabBarHeight: number;
  setTabBarHeight: (h: number) => void;
};

const TabBarContext = createContext<TabBarContextType>({
  visible: true,
  setVisible: () => {},
  tabBarHeight: TAB_BAR_HEIGHT_FALLBACK,
  setTabBarHeight: () => {},
});

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [tabBarHeight, setTabBarHeight] = useState(TAB_BAR_HEIGHT_FALLBACK);
  return (
    <TabBarContext.Provider value={{ visible, setVisible, tabBarHeight, setTabBarHeight }}>
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar() {
  return useContext(TabBarContext);
}
