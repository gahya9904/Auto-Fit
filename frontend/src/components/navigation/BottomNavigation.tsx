import { useCallback, useRef, type ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DietIcon from '@/assets/icons/feature/navigator/Diet.svg';
import ExerciseIcon from '@/assets/icons/feature/navigator/Exercise.svg';
import HomeIcon from '@/assets/icons/feature/navigator/Home.svg';
import MyIcon from '@/assets/icons/feature/navigator/My.svg';
import { colors, radius, shadows, spacing, typography } from '@/src/theme';

export const BOTTOM_NAVIGATION_VISUAL_HEIGHT = 80;
export const BOTTOM_NAVIGATION_MIN_BOTTOM_GAP = spacing.sm;
const minimumBottomNavigationVisualHeight = 68;
const referenceScreenHeight = 917;
const visualHeightReductionRatio = 0.12;

export function getBottomNavigationVisualHeight(windowHeight: number) {
  return Math.max(
    minimumBottomNavigationVisualHeight,
    BOTTOM_NAVIGATION_VISUAL_HEIGHT -
      Math.max(0, referenceScreenHeight - windowHeight) * visualHeightReductionRatio,
  );
}

const bottomNavigationShadow: ViewStyle =
  Platform.OS === 'android'
    ? {
        elevation: 1,
        shadowColor: 'rgba(0, 0, 0, 0.12)',
      }
    : shadows.card;

const tabMeta = {
  home: { label: '홈', Icon: HomeIcon },
  diet: { label: '식단', Icon: DietIcon },
  exercise: { label: '운동', Icon: ExerciseIcon },
  my: { label: '마이', Icon: MyIcon },
} as const;

type TabsProps = ComponentProps<typeof Tabs>;
type NativeTabsProps = Parameters<NonNullable<TabsProps['tabBar']>>[0];

export interface BottomNavigationLayout {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface BottomNavigationProps extends NativeTabsProps {
  onNavigationLayout?: (layout: BottomNavigationLayout) => void;
}

export function BottomNavigation({
  state,
  descriptors,
  navigation,
  onNavigationLayout,
}: BottomNavigationProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const navigationRef = useRef<View>(null);
  const visualHeight = getBottomNavigationVisualHeight(windowHeight);
  const itemGap = Math.max(3, spacing.xs - (BOTTOM_NAVIGATION_VISUAL_HEIGHT - visualHeight) / 8);
  const measureNavigation = useCallback(() => {
    navigationRef.current?.measureInWindow((x, y, width, height) => {
      onNavigationLayout?.({ height, width, x, y });
    });
  }, [onNavigationLayout]);

  return (
    <View
      ref={navigationRef}
      onLayout={measureNavigation}
      style={[
        styles.safeArea,
        { paddingBottom: Math.max(insets.bottom, BOTTOM_NAVIGATION_MIN_BOTTOM_GAP) },
      ]}
    >
      <View style={[styles.bar, bottomNavigationShadow, { height: visualHeight }]}>
        {state.routes.map((route, index) => {
          const meta = tabMeta[route.name as keyof typeof tabMeta];
          if (!meta) return null;
          const isFocused = state.index === index;
          const color = isFocused ? colors.primary : colors.textNavigator;
          const { Icon } = meta;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented)
              navigation.navigate(route.name, route.params);
          };

          return (
            <Pressable
              key={route.key}
              accessibilityLabel={
                descriptors[route.key].options.tabBarAccessibilityLabel ?? meta.label
              }
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              onPress={onPress}
              style={({ pressed }) => [styles.item, { gap: itemGap }, pressed && styles.pressed]}
            >
              <Icon color={color} height={32} width={32} />
              <Text style={[styles.label, { color }]}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.transparent,
    bottom: 0,
    left: 0,
    paddingHorizontal: 6,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 0,
    zIndex: 10,
  },
  bar: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    flexDirection: 'row',
  },
  item: { alignItems: 'center', flex: 1, justifyContent: 'center', minWidth: 64 },
  label: { ...typography.body, includeFontPadding: false, lineHeight: 18 },
  pressed: { backgroundColor: colors.primaryLight },
});
