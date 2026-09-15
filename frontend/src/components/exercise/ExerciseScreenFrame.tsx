import type { ReactNode } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CustomScrollIndicator,
  useCustomScrollIndicator,
} from '@/src/components/common/CustomScrollIndicator';
import {
  BOTTOM_NAVIGATION_MIN_BOTTOM_GAP,
  getBottomNavigationVisualHeight,
} from '@/src/components/navigation/BottomNavigation';
import { colors } from '@/src/theme';

const referenceWidth = 412;

interface ExerciseScreenFrameProps {
  background?: ImageSourcePropType;
  children: ReactNode;
  contentHeight: number;
  hasBottomNavigation?: boolean;
}

export function ExerciseScreenFrame({
  background,
  children,
  contentHeight,
  hasBottomNavigation = false,
}: ExerciseScreenFrameProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const widthScale = Math.min(1, width / referenceWidth);
  const bottomReserved = hasBottomNavigation
    ? getBottomNavigationVisualHeight(height) +
      Math.max(insets.bottom, BOTTOM_NAVIGATION_MIN_BOTTOM_GAP) +
      8
    : Math.max(insets.bottom, 12);
  const viewportHeight = height - bottomReserved;
  const visualContentHeight = contentHeight * widthScale;
  const needsScroll = visualContentHeight > viewportHeight + 1;
  const indicator = useCustomScrollIndicator({ enabled: needsScroll, showInitially: true });
  const backgroundScale = Math.min(1, Math.max(widthScale, height / 917));

  return (
    <View style={styles.root}>
      {background ? (
        <Image
          resizeMode="cover"
          source={background}
          style={[
            styles.background,
            {
              height: 917 * backgroundScale,
              left: (width - referenceWidth * backgroundScale) / 2,
              top: (height - 917 * backgroundScale) / 2,
              width: referenceWidth * backgroundScale,
            },
          ]}
        />
      ) : null}
      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.scrollContent,
          { minHeight: viewportHeight, paddingBottom: needsScroll ? bottomReserved : 0 },
        ]}
        scrollEnabled={needsScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: hasBottomNavigation ? viewportHeight : height }}
        onContentSizeChange={indicator.onContentSizeChange}
        onLayout={indicator.onLayout}
        onMomentumScrollBegin={indicator.onMomentumScrollBegin}
        onMomentumScrollEnd={indicator.onMomentumScrollEnd}
        onScroll={indicator.onScroll}
        onScrollBeginDrag={indicator.onScrollBeginDrag}
        onScrollEndDrag={indicator.onScrollEndDrag}
      >
        <View style={{ height: visualContentHeight, width }}>
          <View
            style={[
              styles.canvas,
              {
                height: contentHeight,
                left: (width - referenceWidth * widthScale) / 2,
                transform: [{ scale: widthScale }],
              },
            ]}
          >
            {children}
          </View>
        </View>
      </ScrollView>
      <CustomScrollIndicator
        {...indicator.indicatorProps}
        bottomInset={Math.max(insets.bottom, 8)}
        rightInset={5}
        topInset={12}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  background: { pointerEvents: 'none', position: 'absolute' },
  root: { backgroundColor: colors.background, flex: 1, overflow: 'hidden' },
  scrollContent: { alignItems: 'center' },
  canvas: { position: 'absolute', top: 0, transformOrigin: 'top left', width: referenceWidth },
});
