import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const URL = import.meta.env.VITE_WS_URL || window.location.origin;

/**
 * Mantém o socket único por `enabled`, mas sempre chama o handler mais recente.
 * Antes, os handlers eram "congelados" no primeiro render (closure antiga):
 * qualquer handler que dependesse de estado/props ficava desatualizado.
 */
export function useSocket(handlers: Record<string, (payload: any) => void>, enabled = true) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const socket = io(URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    const wrappers: Record<string, (payload: any) => void> = {};
    Object.keys(handlersRef.current).forEach((ev) => {
      wrappers[ev] = (payload: any) => handlersRef.current[ev]?.(payload);
      socket.on(ev, wrappers[ev]);
    });

    return () => {
      Object.keys(wrappers).forEach((ev) => socket.off(ev, wrappers[ev]));
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  return socketRef;
}
