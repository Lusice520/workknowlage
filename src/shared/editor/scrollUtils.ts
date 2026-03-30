export const getCursorScrollDelta = ({
  scrollerTop,
  scrollerBottom,
  blockBottom,
  visibleZoneRatio,
  minDelta = 1,
}: {
  scrollerTop: number;
  scrollerBottom: number;
  blockBottom: number;
  visibleZoneRatio: number;
  minDelta?: number;
}) => {
  const scrollerHeight = Math.max(0, scrollerBottom - scrollerTop);
  if (scrollerHeight <= 0) return 0;
  const safeBottom = scrollerBottom - scrollerHeight * visibleZoneRatio;
  const delta = blockBottom - safeBottom;
  return Math.max(minDelta, Math.ceil(delta));
};
