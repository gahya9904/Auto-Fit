import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DietIcon from '@/assets/icons/feature/navigator/Diet.svg';
import ExerciseIcon from '@/assets/icons/feature/navigator/Exercise.svg';
import HomeIcon from '@/assets/icons/feature/navigator/Home.svg';
import MyIcon from '@/assets/icons/feature/navigator/My.svg';
import { colors, radius, shadows, spacing, typography } from '@/src/theme';

const tabMeta = {
  home: { label: '홈', Icon: HomeIcon },
  diet: { label: '식단', Icon: DietIcon },
  exercise: { label: '운동', Icon: ExerciseIcon },
  my: { label: '마이', Icon: MyIcon },
} as const;

type TabsProps = ComponentProps<typeof Tabs>;
type BottomNavigationProps = Parameters<NonNullable<TabsProps['tabBar']>>[0];

export function BottomNavigation({ state, descriptors, navigation }: BottomNavigationProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeArea, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={[styles.bar, shadows.card]}>
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
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
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
  safeArea: { backgroundColor: colors.transparent, paddingHorizontal: 6 },
  bar: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    flexDirection: 'row',
    height: 80,
  },
  item: { alignItems: 'center', flex: 1, gap: spacing.xs, justifyContent: 'center', minWidth: 64 },
  label: { ...typography.body, lineHeight: 18 },
  pressed: { backgroundColor: colors.primaryLight },
});
