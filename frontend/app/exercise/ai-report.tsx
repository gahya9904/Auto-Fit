import { useCallback, useEffect } from 'react';
import { BackHandler, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BarbellIcon from '@/assets/icons/deco/Barbell.svg';
import FireIcon from '@/assets/icons/deco/Fire.svg';
import LightbulbIcon from '@/assets/icons/system/Lightbulb.svg';
import RefreshIcon from '@/assets/icons/system/Refresh.svg';
import SparkleIcon from '@/assets/icons/deco/Sparkle_Fill.svg';
import TargetIcon from '@/assets/icons/deco/Target.svg';
import UserIcon from '@/assets/icons/input/User.svg';
import CheckCircleOutIcon from '@/assets/icons/system/CheckCircleOut.svg';
import { BackButton } from '@/src/components/common/BackButton';
import { ExerciseActionButton } from '@/src/components/exercise/ExerciseActionButton';
import { ExerciseScreenFrame } from '@/src/components/exercise/ExerciseScreenFrame';
import { createMockExerciseAiReport } from '@/src/features/exercise/exerciseResultMocks';
import { useExerciseRoutine } from '@/src/features/exercise/ExerciseRoutineContext';
import { colors, fontFamilies } from '@/src/theme';

const contentHeight = 917;
const aiImage = require('@/assets/images/illustrations/exercise/AI.png');

const metricIcons = [TargetIcon, BarbellIcon, UserIcon, FireIcon];

export default function ExerciseAiReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { latestSession, resultRecordCompleted } = useExerciseRoutine();
  const report = createMockExerciseAiReport(latestSession);
  const returnHome = useCallback(() => router.dismissTo('/exercise'), [router]);

  useEffect(() => {
    if (resultRecordCompleted) return undefined;
    const frame = requestAnimationFrame(() =>
      router.replace({ pathname: '/exercise/result', params: { source: 'home' } }),
    );
    return () => cancelAnimationFrame(frame);
  }, [resultRecordCompleted, router]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      returnHome();
      return true;
    });
    return () => subscription.remove();
  }, [returnHome]);

  if (!resultRecordCompleted) return null;

  return (
    <ExerciseScreenFrame contentHeight={contentHeight}>
      <BackButton onPress={returnHome} style={[styles.back, { top: Math.max(23, insets.top - 20) }]} />
      <Text style={styles.headerTitle}>AI 분석</Text>

      <View style={styles.intro}>
        <View style={styles.introText}>
          <View style={styles.introTitleRow}>
            <SparkleIcon color={colors.primary} fill={colors.primary} height={21} width={21} />
            <Text style={styles.introTitle}>오늘 운동 결과 분석</Text>
          </View>
          <Text style={styles.introDescription}>운동 기록을 바탕으로 오늘의 운동을 분석했어요.</Text>
        </View>
        <Image resizeMode="contain" source={aiImage} style={styles.aiImage} />
      </View>

      <View style={styles.summarySection}>
        <View style={styles.sectionTitleRow}>
          <CheckCircleOutIcon color={colors.primary} height={22} width={22} />
          <Text style={styles.sectionTitle}>운동 요약</Text>
        </View>
        <View style={styles.metricGrid}>
          {report.metrics.map(({ description, label, value }, index) => {
            const Icon = metricIcons[index];
            return (
              <View key={label} style={styles.metricCard}>
                <View style={styles.metricHeading}>
                  <Icon color={colors.primary} fill={colors.primary} height={17} width={17} />
                  <Text style={styles.metricLabel}>{label}</Text>
                </View>
                <Text style={styles.metricValue}>{value}</Text>
                <Text style={styles.metricDescription}>{description}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.insightCard}>
        <View style={styles.insightIcon}>
          <LightbulbIcon color={colors.primary} height={26} width={26} />
        </View>
        <View style={styles.insightText}>
          <Text style={styles.insightTitle}>{report.insight.title}</Text>
          <Text style={styles.insightDescription}>{report.insight.description}</Text>
        </View>
      </View>

      <View style={styles.nextCard}>
        <View style={styles.nextHeading}>
          <RefreshIcon color={colors.primary} height={21} width={21} />
          <Text style={styles.nextTitle}>다음 운동에 반영</Text>
        </View>
        <View style={styles.nextList}>
          {report.nextWorkout.map(({ description, title }) => (
            <View key={title} style={styles.nextItem}>
              <View style={styles.bullet} />
              <Text style={styles.nextItemText}>
                {title}
                {description ? <Text style={styles.nextItemDescription}> {description}</Text> : null}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>꾸준한 기록이 더 정확한 분석으로 이어져요!</Text>
        <Text style={styles.noticeDescription}>더 나은 운동을 위해 계속 기록해주세요.</Text>
      </View>

      <View style={styles.saveCta}>
        <ExerciseActionButton
          borderRadius={10}
          gradient
          labelStyle={styles.saveCtaLabel}
          onPress={returnHome}
          title="저장"
        />
      </View>
    </ExerciseScreenFrame>
  );
}

const styles = StyleSheet.create({
  aiImage: { height: 110, position: 'absolute', right: 10, top: -12, width: 140 },
  back: { left: 10, position: 'absolute' },
  bullet: { backgroundColor: colors.primary, borderRadius: 99, height: 4, marginTop: 7, width: 4 },
  headerTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 20,
    left: 0,
    lineHeight: 28,
    position: 'absolute',
    textAlign: 'center',
    top: 38,
    width: 412,
  },
  insightCard: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 15,
    flexDirection: 'row',
    left: 21,
    minHeight: 152,
    paddingHorizontal: 17,
    position: 'absolute',
    top: 460,
    width: 370,
  },
  insightDescription: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  insightIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 99,
    height: 45,
    justifyContent: 'center',
    marginRight: 13,
    width: 45,
  },
  insightText: { flex: 1 },
  insightTitle: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 17,
    lineHeight: 23,
  },
  intro: { height: 104, left: 21, position: 'absolute', top: 78, width: 370 },
  introDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },
  introText: { left: 0, position: 'absolute', top: 5 },
  introTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 21,
    lineHeight: 29,
  },
  introTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  metricCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 94,
    paddingHorizontal: 11,
    paddingTop: 10,
    width: 169,
  },
  metricDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 13 },
  metricHeading: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  metricLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  metricValue: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 21,
    lineHeight: 28,
    marginTop: 3,
  },
  nextCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    height: 140,
    left: 21,
    paddingHorizontal: 17,
    paddingTop: 15,
    position: 'absolute',
    top: 627,
    width: 370,
  },
  nextHeading: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  nextItem: { flexDirection: 'row', gap: 7 },
  nextItemDescription: { color: colors.textSecondary, fontFamily: fontFamilies.pretendardMedium },
  nextItemText: {
    color: colors.textBody,
    flex: 1,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
    lineHeight: 18,
  },
  nextList: { gap: 5, marginTop: 10 },
  nextTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  noticeCard: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    height: 54,
    justifyContent: 'center',
    left: 21,
    position: 'absolute',
    top: 782,
    width: 370,
  },
  noticeDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  noticeTitle: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  saveCta: { left: 21, position: 'absolute', top: 850, width: 370 },
  saveCtaLabel: { fontSize: 18, lineHeight: 24 },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 17,
    lineHeight: 23,
  },
  sectionTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  summarySection: { left: 21, position: 'absolute', top: 197, width: 370 },
});
