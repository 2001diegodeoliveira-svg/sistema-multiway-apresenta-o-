import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const URL = import.meta.env.VITE_WS_URL || window.location.origin;

export function useSocket(handlers: Record<string, (payload: any) => void>) {
  const socketRef = useRef<Socket | null>(null);
  useEffect(() => {
    const socket = io(URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    Object.entries(handlers).forEach(([ev, fn]) => socket.on(ev, fn));
    return () => {
      Object.entries(handlers).forEach(([ev, fn]) => socket.off(ev, fn));
      socket.disconnect();
    };
  }, []);
  return socketRef;
}