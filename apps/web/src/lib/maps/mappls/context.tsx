import { createContext, useContext } from "react";

interface MapplsContextValue {
  isLoaded: boolean;
}

export const MapplsContext = createContext<MapplsContextValue>({ isLoaded: false });

export function useMappls() {
  return useContext(MapplsContext);
}
