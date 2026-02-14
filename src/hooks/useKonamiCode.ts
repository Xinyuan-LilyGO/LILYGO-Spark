import { useEffect, useRef } from 'react';

// Use e.code for physical keys (KeyB/KeyA); e.key for arrows (ArrowUp etc. same in both)
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

function getKeyForIndex(e: KeyboardEvent, index: number): string {
  return index >= 8 ? e.code : e.key; // B,A use code; arrows use key
}

export function useKonamiCode(onTrigger: () => void) {
  const cbRef = useRef(onTrigger);
  cbRef.current = onTrigger;

  useEffect(() => {
    let index = 0;
    console.log('[Konami] listener attached, sequence:', KONAMI.join(' '));

    const handler = (e: KeyboardEvent) => {
      const expected = KONAMI[index];
      const actual = getKeyForIndex(e, index);
      console.log('[Konami]', {
        key: e.key,
        code: e.code,
        index,
        expected,
        actual,
        match: actual === expected,
      });
      if (actual === expected) {
        index++;
        if (index === KONAMI.length) {
          console.log('[Konami] ✓ TRIGGERED');
          cbRef.current();
          index = 0;
        }
      } else {
        if (index > 0) console.log('[Konami] ✗ reset to 0');
        index = 0;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
