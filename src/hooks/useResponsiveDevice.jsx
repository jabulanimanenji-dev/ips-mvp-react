import { useEffect, useState } from 'react';
import { deviceForWidth } from '../../shared/responsiveDevices.js';

const detectDevice = () => {
  if (typeof window === 'undefined') return 'desktop';
  return deviceForWidth(window.innerWidth);
};

export default function useResponsiveDevice(forcedDevice) {
  const [detectedDevice, setDetectedDevice] = useState(detectDevice);

  useEffect(() => {
    if (forcedDevice) return undefined;
    const update = () => setDetectedDevice(detectDevice());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [forcedDevice]);

  return forcedDevice || detectedDevice;
}
