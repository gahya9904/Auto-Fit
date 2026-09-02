import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  View,
} from 'react-native';

const edgeInset = 8;
const minimumThumbHeight = 28;
const hideDelay = 500;
const fadeDuration = 180;

interface CustomScrollIndicatorProps {
  color?: string;
  contentHeight: number;
  opacity: Animated.Value;
  rightInset?: number;
  scrollOffset: Animated.Value;
  viewportHeight: number;
  viewportY: number;
}

export function CustomScrollIndicator({
  color = 'rgba(73, 205, 177, 0.45)',
  contentHeight,
  opacity,
  rightInset = 4,
  scrollOffset,
  viewportHeight,
  viewportY,
}: CustomScrollIndicatorProps) {
  const trackHeight = Math.max(0, viewportHeight - edgeInset * 2);
  const scrollRange = Math.max(0, contentHeight - viewportHeight);
  const isScrollable = scrollRange > 1 && trackHeight > 0;

  const thumbHeight = isScrollable
    ? Math.min(
        trackHeight,
        Math.max(minimumThumbHeight, trackHeight * (viewportHeight / contentHeight)),
      )
    : 0;
  const thumbTravel = Math.max(0, trackHeight - thumbHeight);
  const translateY = useMemo(
    () =>
      scrollOffset.interpolate({
        extrapolate: 'clamp',
        inputRange: [0, Math.max(1, scrollRange)],
        outputRange: [0, thumbTravel],
      }),
    [scrollOffset, scrollRange, thumbTravel],
  );

  if (!isScrollable) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.indicatorArea,
        {
          height: trackHeight,
          right: rightInset,
          top: viewportY + edgeInset,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: color,
            height: thumbHeight,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      />
    </View>
  );
}

interface CustomScrollIndicatorOptions {
  showOnScroll?: boolean;
}

export function useCustomScrollIndicator({
  showOnScroll = true,
}: CustomScrollIndicatorOptions = {}) {
  const [contentHeight, setContentHeight] = useState(0);
  const [viewport, setViewport] = useState({ height: 0, y: 0 });
  const [opacity] = useState(() => new Animated.Value(0));
  const [scrollOffset] = useState(() => new Animated.Value(0));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);
  const isScrollable = contentHeight > viewport.height + 1 && viewport.height > 0;

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleFadeOut = useCallback(() => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      Animated.timing(opacity, {
        duration: fadeDuration,
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }, hideDelay);
  }, [clearHideTimer, opacity]);

  const show = useCallback(() => {
    if (!isScrollable) return;
    opacity.stopAnimation();
    opacity.setValue(1);
    scheduleFadeOut();
  }, [isScrollable, opacity, scheduleFadeOut]);

  useEffect(() => {
    if (!isScrollable) {
      clearHideTimer();
      opacity.setValue(0);
      scrollOffset.setValue(0);
    }

    return clearHideTimer;
  }, [clearHideTimer, isScrollable, opacity, scrollOffset]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, y } = event.nativeEvent.layout;
    setViewport({ height, y });
  }, []);

  const onContentSizeChange = useCallback((_width: number, height: number) => {
    setContentHeight(height);
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.setValue(Math.max(0, event.nativeEvent.contentOffset.y));
      if (showOnScroll || isDragging.current) show();
    },
    [scrollOffset, show, showOnScroll],
  );

  const onScrollBeginDrag = useCallback(() => {
    isDragging.current = true;
    show();
  }, [show]);

  const onScrollEndDrag = useCallback(() => {
    isDragging.current = false;
    scheduleFadeOut();
  }, [scheduleFadeOut]);

  return {
    indicatorProps: {
      contentHeight,
      opacity,
      scrollOffset,
      viewportHeight: viewport.height,
      viewportY: viewport.y,
    },
    onContentSizeChange,
    onLayout,
    onMomentumScrollBegin: show,
    onMomentumScrollEnd: scheduleFadeOut,
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    show,
  };
}

const styles = StyleSheet.create({
  indicatorArea: {
    position: 'absolute',
    width: 4,
    zIndex: 20,
  },
  thumb: {
    borderRadius: 999,
    width: 4,
  },
});
