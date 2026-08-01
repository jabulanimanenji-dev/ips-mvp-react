export const MOBILE_MAX_WIDTH = 767;
export const TABLET_MAX_WIDTH = 1024;

export const deviceForWidth = value => {
  const width = Number(value);
  if (!Number.isFinite(width)) return 'desktop';
  if (width <= MOBILE_MAX_WIDTH) return 'mobile';
  if (width <= TABLET_MAX_WIDTH) return 'tablet';
  return 'desktop';
};
