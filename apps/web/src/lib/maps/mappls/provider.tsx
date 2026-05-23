import { useState, useEffect, type ReactNode } from "react";
import { MapplsContext } from "./context";

const apiKey = import.meta.env.VITE_MAPPLS_API_KEY as string | undefined;

interface MapsProviderProps {
  children: ReactNode;
}

export function MapsProvider({ children }: MapsProviderProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!apiKey) return;

    // Avoid injecting the script more than once (e.g. HMR)
    if (document.getElementById("mappls-sdk-script")) {
      if ((window as any).mappls) setIsLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.id = "mappls-sdk-script";
    script.src = `https://apis.mappls.com/advancedmaps/api/${apiKey}/map_sdk?layer=vector&v=3.0`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    script.onerror = () => console.warn("[Mappls] Failed to load map SDK. Check VITE_MAPPLS_API_KEY.");
    document.head.appendChild(script);
  }, []);

  return (
    <MapplsContext.Provider value={{ isLoaded }}>
      {children}
    </MapplsContext.Provider>
  );
}
