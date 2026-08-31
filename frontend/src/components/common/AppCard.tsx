import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { colors, radius, shadows, spacing } from '@/src/theme';

type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface AppCardProps extends PropsWithChildren<ViewProps> {
  padding?: CardPadding;
  soft?: boolean;
  bordered?: boolean;
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
}

const paddingStyles: Record<CardPadding, ViewStyle> = {
  none: { padding: 0 },
  sm: { padding: spacing.sm },
  md: { padding: spacing.lg },
  lg: { padding: spacing.xl },
};

export function AppCard({
  children,
  padding = 'md',
  soft = false,
  bordered = false,
  shadow = false,
  style,
  ...viewProps
}: AppCardProps) {
  return (
    <View
      style={[
        styles.base,
        soft && styles.soft,
        bordered && styles.bordered,
        shadow && shadows.card,
        paddingStyles[padding],
        style,
      ]}
      {...viewProps}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.card, borderRadius: radius.xl },
  soft: { backgroundColor: colors.surfaceSoft },
  bordered: { borderColor: colors.border, borderWidth: 1 },
});
