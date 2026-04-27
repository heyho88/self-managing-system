import { useEffect, useRef } from 'react';

type Props = {
  onDrag: (deltaX: number) => void;
  onEnd?: () => void;
};

/**
 * 4px 가로폭의 세로 리사이즈 핸들. 호버/드래그 시 강조.
 * 부모 flex row 사이에 두고, onDrag로 부모가 폭을 갱신한다.
 */
export function ResizeHandle({ onDrag, onEnd }: Props) {
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      const dx = e.clientX - lastXRef.current;
      lastXRef.current = e.clientX;
      if (dx !== 0) onDrag(dx);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onEnd?.();
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onDrag, onEnd]);

  return (
    <div
      className="shrink-0 group relative"
      style={{ width: 4, cursor: 'col-resize' }}
      onMouseDown={(e) => {
        e.preventDefault();
        draggingRef.current = true;
        lastXRef.current = e.clientX;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }}
    >
      <div
        className="absolute inset-y-0 left-0 right-0 bg-line group-hover:bg-ink transition-colors"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
}
