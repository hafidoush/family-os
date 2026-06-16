import { useState, useEffect } from 'react';
import { useDebounce } from './useDebounce';

export type DeviceType = 'iphone' | 'ipad' | 'desktop';

function getDeviceType(width: number): DeviceType {
  if (width < 768) return 'iphone';
  if (width < 1024) return 'ipad';
  return 'desktop';
}

export function useDeviceType(): DeviceType {
  const [rawWidth, setRawWidth] = useState<number>(window.innerWidth);
  const width = useDebounce(rawWidth, 150);

  useEffect(() => {
    const handler = () => setRawWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return getDeviceType(width);
}
