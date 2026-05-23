import { LoadScript } from "@react-google-maps/api";
import type { ReactNode } from "react";

const LIBRARIES: ("places" | "geometry")[] = ["places"];

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

interface MapsProviderProps {
  children: ReactNode;
}

export function MapsProvider({ children }: MapsProviderProps) {
  if (!apiKey) {
    return <>{children}</>;
  }

  return (
    <LoadScript googleMapsApiKey={apiKey} libraries={LIBRARIES}>
      {children}
    </LoadScript>
  );
}
