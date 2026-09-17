import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import TrendUpIcon from '@/assets/icons/graph/TrendUp.svg';
import { AppCard } from '@/src/components/common';
import { colors, fontFamilies } from '@/src/theme';

interface WeeklyProgressCardProps {
  change: number | null;
  message: string | null;
  style?: StyleProp<ViewStyle>;
}

export function WeeklyProgressCard({ change, message, style }: WeeklyProgressCardProps) {
  const changeText = change === null ? '-' : `${change > 0 ? '+' : ''}${change}`;
  const comparisonResult =
    change === null
      ? '비교 데이터가 없어요!'
      : change === 0
        ? '변화 없어요!'
        : change > 0
          ? '상승했어요!'
          : '하락했어요!';
  const messageText = message ?? '-';

  return (
    <AppCard
      accessibilityLabel={`지난주보다 ${changeText}점 상승`}
      padding="none"
      shadow
      style={[styles.card, style]}
    >
      <View style={styles.icon}>
        <TrendUpIcon color={colors.primary} fill={colors.primary} height={50} width={50} />
      </View>
      <Text numberOfLines={1} style={styles.title}>
        이전 평가 대비 <Text style={styles.change}>{changeText}</Text>점 {comparisonResult}
      </Text>
      <Text numberOfLines={1} style={styles.message}>
        {messageText}
      </Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 70,
    width: 300,
  },
  icon: {
    left: 10,
    position: 'absolute',
    top: 10,
  },
  title: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    includeFontPadding: false,
    left: 66,
    letterSpacing: 0.26,
    lineHeight: 17,
    position: 'absolute',
    right: 8,
    top: 14,
  },
  change: {
    color: colors.primary,
    letterSpacing: 0.26,
  },
  message: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 13,
    includeFontPadding: false,
    left: 66,
    lineHeight: 17,
    position: 'absolute',
    right: 8,
    top: 36,
  },
});
