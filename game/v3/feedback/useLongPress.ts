import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";

const LONG_PRESS_MS = 550;
const MOVE_CANCEL_PX = 14;

export function useLongPress(onLongPress: () => void, disabled: boolean) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
  };

  const onPointerDown = (event: ReactPointerEvent) => {
    if (disabled) return;
    clear();
    start.current = { x: event.clientX, y: event.clientY };
    timer.current = window.setTimeout(() => {
      timer.current = null;
      onLongPress();
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clear();
  };

  return { onPointerDown, onPointerMove, onPointerUp: clear, onPointerCancel: clear };
}
