// src/utils/platform.ts
import { Capacitor } from '@capacitor/core';

export const isMobile = Capacitor.isNativePlatform();
export const isAndroid = Capacitor.getPlatform() === 'android';
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isWeb = !isMobile;

export const getPlatform = () => {
    if (isAndroid) return 'android';
    if (isIOS) return 'ios';
    return 'web';
};
