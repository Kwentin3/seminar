import { useContext } from "react";
import { AppContext } from "./AppProviders";

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used inside AppProviders.");
  }

  return context;
}