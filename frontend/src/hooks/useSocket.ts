import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const URL = import.meta.env.VITE_WS_URL || window.location.origin;

export function useSocket(handlers: Record<string, (payload: any) => void>, enabled = true) {
  const socketRef = useRef<Socket | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const socket = io(URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    Object.entries(handlers).forEach(([ev, fn]) => socket.on(ev, fn));
    return () => {
      Object.entries(handlers).forEach(([ev, fn]) => socket.off(ev, fn));
      socket.disconnect();
    };
  }, [enabled]);
  return socketRef;
}