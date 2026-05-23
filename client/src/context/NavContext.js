import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Navigation context for app-wide nav behavior.
 * Used to hide bottom nav during: Auth, Payment, Live Match, Create Tournament flow.
 * @see docs/NAVIGATION.md
 */
const NavContext = createContext(null);

export function NavProvider({ children }) {
  const [hideBottomNav, setHideBottomNavState] = useState(false);

  const setHideBottomNav = useCallback((value) => {
    setHideBottomNavState(Boolean(value));
  }, []);

  return (
    <NavContext.Provider value={{ hideBottomNav, setHideBottomNav }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) return { hideBottomNav: false, setHideBottomNav: () => {} };
  return ctx;
}
