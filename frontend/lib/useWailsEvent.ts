import { useEffect } from "react";
import { EventsOn, EventsOff } from "../wailsjs/runtime/runtime";

export function useWailsEvent(event: string, handler: (data: unknown) => void) {
  useEffect(() => {
    EventsOn(event, handler);
    return () => EventsOff(event);
  }, [event, handler]);
}