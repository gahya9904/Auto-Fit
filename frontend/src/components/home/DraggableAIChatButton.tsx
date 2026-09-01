import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BOTTOM_NAVIGATION_MIN_BOTTOM_GAP,
  getBottomNavigationVisualHeight,
  type BottomNavigationLayout,
} from '@/src/components/navigation';

import { AI_CHAT_BUTTON_SIZE, AIChatButton } from './AIChatButton';

const snapNavigationGap = 15;
const snapHiddenAmount = 28;
const dragThreshold = 6;
const snapContentOffset = 7.5;
const centerDeadZone = AI_CHAT_BUTTON_SIZE / 2;

type SnapSide = 'left' | 'right';

interface DraggableAIChatButtonProps {
  navigationLayout?: BottomNavigationLayout;
  onPress: () => void;
  visible?: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface SettledPosition extends Point {
  side: SnapSide;
}

interface FloatingLayerFrame {
  height: number;
  width: number;
  x: number;
  y: number;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

const webDragStyle: ViewStyle | undefined =
  Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none' } as ViewStyle) : undefined;

const webDragProps =
  Platform.OS === 'web'
    ? {
        draggable: false,
        onDragStart: (event: { preventDefault: () => void }) => event.preventDefault(),
      }
    : {};

export function DraggableAIChatButton({
  navigationLayout,
  onPress,
  visible = true,
}: DraggableAIChatButtonProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const layerRef = useRef<View>(null);
  const [containerSize, setContainerSize] = useState({
    height: windowHeight,
    width: windowWidth,
  });
  const [layerFrame, setLayerFrame] = useState<FloatingLayerFrame>({
    height: windowHeight,
    width: windowWidth,
    x: 0,
    y: 0,
  });
  const navigationHeight = getBottomNavigationVisualHeight(windowHeight);
  const bottomClearance = Math.max(insets.bottom, BOTTOM_NAVIGATION_MIN_BOTTOM_GAP);
  const estimatedNavigationTop = containerSize.height - bottomClearance - navigationHeight;
  const navigationTop = navigationLayout
    ? navigationLayout.y - layerFrame.y
    : estimatedNavigationTop;

  const minimumX = insets.left;
  const maximumX = Math.max(minimumX, containerSize.width - insets.right - AI_CHAT_BUTTON_SIZE);
  const minimumY = Math.max(0, insets.top - layerFrame.y);
  const maximumY = Math.max(minimumY, navigationTop - snapNavigationGap - AI_CHAT_BUTTON_SIZE);
  const leftSnapX = insets.left - snapHiddenAmount;
  const rightSnapX = containerSize.width - insets.right - snapHiddenAmount;

  const [position] = useState(() => new Animated.ValueXY({ x: rightSnapX, y: maximumY }));
  const [settledPosition, setSettledPosition] = useState<SettledPosition>({
    side: 'right',
    x: rightSnapX,
    y: maximumY,
  });
  const centerButtonX = (containerSize.width - AI_CHAT_BUTTON_SIZE) / 2;
  const contentOffsetX = position.x.interpolate({
    extrapolate: 'clamp',
    inputRange: [
      leftSnapX,
      centerButtonX - centerDeadZone,
      centerButtonX + centerDeadZone,
      rightSnapX,
    ],
    outputRange: [snapContentOffset, 0, 0, -snapContentOffset],
  });

  useEffect(() => {
    const nextX = settledPosition.side === 'left' ? leftSnapX : rightSnapX;
    const nextY = clamp(settledPosition.y, minimumY, maximumY);
    const changed = nextX !== settledPosition.x || nextY !== settledPosition.y;

    if (changed) {
      const nextPosition = { ...settledPosition, x: nextX, y: nextY };
      const resizeAnimation = Animated.timing(position, {
        duration: 0,
        toValue: { x: nextPosition.x, y: nextPosition.y },
        useNativeDriver: true,
      });

      resizeAnimation.start(({ finished }) => {
        if (finished) setSettledPosition(nextPosition);
      });

      return () => resizeAnimation.stop();
    }
  }, [leftSnapX, maximumY, minimumY, position, rightSnapX, settledPosition]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setContainerSize((current) =>
      current.height === height && current.width === width ? current : { height, width },
    );
    layerRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      setLayerFrame((current) =>
        current.height === measuredHeight &&
        current.width === measuredWidth &&
        current.x === x &&
        current.y === y
          ? current
          : { height: measuredHeight, width: measuredWidth, x, y },
      );
    });
  };

  const snapToNearestEdge = useCallback(
    (point: Point) => {
      const nextSide: SnapSide =
        Math.abs(point.x - leftSnapX) <= Math.abs(point.x - rightSnapX) ? 'left' : 'right';
      const nextPoint: SettledPosition = {
        side: nextSide,
        x: nextSide === 'left' ? leftSnapX : rightSnapX,
        y: clamp(point.y, minimumY, maximumY),
      };

      setSettledPosition(nextPoint);

      Animated.spring(position, {
        bounciness: 4,
        speed: 24,
        toValue: { x: nextPoint.x, y: nextPoint.y },
        useNativeDriver: true,
      }).start();
    },
    [leftSnapX, maximumY, minimumY, position, rightSnapX],
  );

  const panResponder = useMemo(() => {
    const dragOrigin: Point = { x: 0, y: 0 };

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.hypot(gestureState.dx, gestureState.dy) >= dragThreshold,
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        Math.hypot(gestureState.dx, gestureState.dy) >= dragThreshold,
      onPanResponderGrant: () => {
        position.stopAnimation((currentPosition) => {
          dragOrigin.x = currentPosition.x;
          dragOrigin.y = currentPosition.y;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const nextPoint = {
          x: clamp(dragOrigin.x + gestureState.dx, minimumX, maximumX),
          y: clamp(dragOrigin.y + gestureState.dy, minimumY, maximumY),
        };

        position.setValue(nextPoint);
      },
      onPanResponderRelease: (_, gestureState) => {
        snapToNearestEdge({
          x: clamp(dragOrigin.x + gestureState.dx, minimumX, maximumX),
          y: clamp(dragOrigin.y + gestureState.dy, minimumY, maximumY),
        });
      },
      onPanResponderTerminate: (_, gestureState) => {
        snapToNearestEdge({
          x: clamp(dragOrigin.x + gestureState.dx, minimumX, maximumX),
          y: clamp(dragOrigin.y + gestureState.dy, minimumY, maximumY),
        });
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, [maximumX, maximumY, minimumX, minimumY, position, snapToNearestEdge]);

  return (
    <View
      ref={layerRef}
      onLayout={handleLayout}
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[styles.layer, !visible && styles.hidden]}
    >
      <Animated.View
        {...webDragProps}
        {...panResponder.panHandlers}
        style={[styles.container, webDragStyle, { transform: position.getTranslateTransform() }]}
      >
        <AIChatButton contentOffsetX={contentOffsetX} onPress={onPress} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 20,
  },
  hidden: {
    opacity: 0,
  },
  container: {
    height: AI_CHAT_BUTTON_SIZE,
    left: 0,
    position: 'absolute',
    top: 0,
    width: AI_CHAT_BUTTON_SIZE,
    zIndex: 1,
  },
});
