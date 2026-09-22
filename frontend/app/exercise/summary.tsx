import { useCallback, useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import {
  Alert,
  BackHandler,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BarbellIcon from '@/assets/icons/deco/Barbell.svg';
import HandHeartIcon from '@/assets/icons/deco/HandHeart.svg';
import HouseIcon from '@/assets/icons/deco/HouseLine.svg';
import PlayIcon from '@/assets/icons/feature/PlayCircle_Fill.svg';
import ClockIcon from '@/assets/icons/input/Clock.svg';
import CheckIcon from '@/assets/icons/system/CheckCircle_Fill.svg';
import LightbulbIcon from '@/assets/icons/system/Lightbulb.svg';
import { getExerciseApiErrorMessage } from '@/src/api/exercise';
import { BackButton } from '@/src/components/common/BackButton';
import { ExerciseActionButton } from '@/src/components/exercise/ExerciseActionButton';
import { ExerciseScreenFrame } from '@/src/components/exercise/ExerciseScreenFrame';
import { useExerciseRoutine } from '@/src/features/exercise/ExerciseRoutineContext';
import { useExerciseSession } from '@/src/features/exercise/ExerciseSessionContext';
import {
  exerciseEquipmentLabels,
  exerciseLocationLabels,
} from '@/src/features/exercise/exerciseData';
import { colors, fontFamilies } from '@/src/theme';

const exerciseImage = require('@/assets/images/illustrations/temp/Image_Exercise.png');
const referenceHeight = 917;
const minimumScreenHeight = 740;
const expandedSecondaryCtaTop = 820;
const compactSecondaryCtaTop = 777;
const ctaHeight = 45;
const ctaGap = 10;

export default function ExerciseSummaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { condition, refreshHome, routine, startRoutine } = useExerciseRoutine();
  const { beginSession } = useExerciseSession();
  const [isStarting, setIsStarting] = useState(false);
  useEffect(() => {
    if (routine) return undefined;
    const frame = requestAnimationFrame(() => {
      void refreshHome();
    });
    return () => cancelAnimationFrame(frame);
  }, [refreshHome, routine]);
  const responsiveHeight = Platform.OS === 'web' ? windowHeight : Dimensions.get('screen').height;
  const heightProgress = Math.max(
    0,
    Math.min(1, (responsiveHeight - minimumScreenHeight) / (referenceHeight - minimumScreenHeight)),
  );
  const verticalValue = (expanded: number, compact: number) =>
    compact + (expanded - compact) * heightProgress;
  const availableWidth = windowWidth - insets.left - insets.right;
  const dietWidthScale = Math.min(1, availableWidth / 412);
  const frameWidthScale = Math.min(1, windowWidth / 412);
  const dietCanvasTop = Math.max(0, insets.top + 8 - 38 * dietWidthScale);
  const titleTop =
    (dietCanvasTop + verticalValue(38, 30) * dietWidthScale) / Math.max(frameWidthScale, 0.01);
  const secondaryCtaTop = verticalValue(expandedSecondaryCtaTop, compactSecondaryCtaTop);
  const layout = {
    conditionSummaryHeight: verticalValue(100, 90),
    conditionSummaryTop: verticalValue(80, 70),
    primaryCtaTop: secondaryCtaTop - ctaHeight - ctaGap,
    programCardHeight: verticalValue(300, 280),
    programInfoGap: verticalValue(22, 14),
    programInnerGap: verticalValue(12, 10),
    programCardTop: verticalValue(190, 170),
    reasonSectionGap: verticalValue(7, 5),
    secondaryCtaTop,
    workoutCardHeight: 250,
    workoutCardTop: verticalValue(500, 460),
  };
  const contentHeight = secondaryCtaTop + ctaHeight;
  const backToExerciseHome = useCallback(() => router.dismissTo('/exercise'), [router]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      backToExerciseHome();
      return true;
    });

    return () => subscription.remove();
  }, [backToExerciseHome]);

  const handleStartWorkout = async () => {
    if (!routine || isStarting) return;
    setIsStarting(true);
    try {
      const startedSession = await startRoutine();
      beginSession(routine, startedSession);
      requestAnimationFrame(() => router.push('/exercise/session' as Href));
    } catch (error) {
      console.error('Exercise session start failed:', error);
      Alert.alert('운동 시작 실패', getExerciseApiErrorMessage(error));
    } finally {
      setIsStarting(false);
    }
  };

  const summary = [
    {
      label: '시간',
      value: condition.availableMinutes === null ? '미선택' : `${condition.availableMinutes}분`,
      Icon: ClockIcon,
    },
    {
      label: '장소',
      value: condition.location ? exerciseLocationLabels[condition.location] : '미선택',
      Icon: HouseIcon,
    },
    {
      label: '장비',
      value:
        condition.equipment.length === 1
          ? exerciseEquipmentLabels[condition.equipment[0]]
          : `${condition.equipment.length}종`,
      Icon: BarbellIcon,
    },
    { label: '컨디션', value: condition.condition || '미입력', Icon: HandHeartIcon },
    { label: '불편 부위', value: condition.discomfortArea || '없음', Icon: HandHeartIcon },
  ];

  return (
    <ExerciseScreenFrame contentHeight={contentHeight}>
      <BackButton onPress={backToExerciseHome} style={[styles.back, { top: titleTop - 15 }]} />
      <Text style={[styles.screenTitle, { top: titleTop }]}>오늘의 맞춤 운동</Text>
      <View
        style={[
          styles.conditionSummary,
          { height: layout.conditionSummaryHeight, top: layout.conditionSummaryTop },
        ]}
      >
        {summary.map(({ Icon, label, value }) => (
          <View key={label} style={styles.conditionItem}>
            <View style={styles.conditionIcon}>
              <Icon color={colors.primary} fill={colors.primary} height={19} width={19} />
            </View>
            <Text style={styles.conditionLabel}>{label}</Text>
            <Text numberOfLines={1} style={styles.conditionValue}>
              {value}
            </Text>
          </View>
        ))}
      </View>

      <View
        style={[
          styles.programCard,
          {
            height: layout.programCardHeight,
            top: layout.programCardTop,
          },
        ]}
      >
        {routine ? (
          <View style={[styles.programInner, { gap: layout.programInnerGap }]}>
            <View style={styles.programOverview}>
              <View style={[styles.programInfo, { gap: layout.programInfoGap }]}>
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>AI 추천 운동 프로그램</Text>
                </View>
                <Text style={styles.programTitle}>
                  {routine.title}
                  {routine.subtitle ? `\n` : null}
                  {routine.subtitle ? (
                    <Text style={styles.programAccent}>{routine.subtitle}</Text>
                  ) : null}
                </Text>
                <Text numberOfLines={1} style={styles.programMeta}>
                  {routine.totalDurationMinutes !== null
                    ? `${routine.totalDurationMinutes}분`
                    : condition.availableMinutes === null
                      ? '시간 미선택'
                      : `${condition.availableMinutes}분`}{' '}
                  · {routine.exercises.length}개 운동
                  {routine.intensity ? ` · 강도 ${routine.intensity}` : ''}
                </Text>
              </View>
              <Image resizeMode="contain" source={exerciseImage} style={styles.programImage} />
            </View>
            <View style={styles.divider} />
            <View style={[styles.reasonSection, { gap: layout.reasonSectionGap }]}>
              <View style={styles.reasonTitleRow}>
                <LightbulbIcon color={colors.primary} height={22} width={22} />
                <Text style={styles.reasonTitle}>추천 이유</Text>
              </View>
              {routine.reasons.length > 0 ? (
                <View style={styles.reasonList}>
                  {routine.reasons.map((reason) => (
                    <View key={reason} style={styles.reasonRow}>
                      <CheckIcon
                        color={colors.primary}
                        fill={colors.primary}
                        height={15}
                        width={15}
                      />
                      <Text style={styles.reasonText}>{reason}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>추천 이유 정보가 없어요.</Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.emptyProgram}>
            <Text style={styles.emptyText}>표시할 운동 추천 정보가 없어요.</Text>
          </View>
        )}
      </View>

      <View
        style={[
          styles.workoutCard,
          { height: layout.workoutCardHeight, top: layout.workoutCardTop },
        ]}
      >
        <View style={styles.workoutHeader}>
          <View style={styles.workoutTitleRow}>
            <BarbellIcon color={colors.primary} fill={colors.primary} height={23} width={23} />
            <Text style={styles.workoutTitle}>운동 리스트</Text>
          </View>
          <Text style={styles.workoutCount}>
            {routine ? `${routine.exercises.length}개 운동` : '-'}
          </Text>
        </View>
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={styles.workoutList}>
          {routine?.exercises.map((exercise) => (
            <View key={exercise.id} style={styles.workoutRow}>
              <View style={styles.number}>
                <Text style={styles.numberText}>{exercise.sequenceOrder ?? ''}</Text>
              </View>
              <View style={styles.workoutText}>
                <Text style={styles.workoutName}>{exercise.name}</Text>
                <Text style={styles.workoutPrescription}>{exercise.prescription}</Text>
              </View>
            </View>
          ))}
          {!routine || routine.exercises.length === 0 ? (
            <Text style={styles.emptyText}>표시할 운동 목록이 없어요.</Text>
          ) : null}
        </ScrollView>
      </View>
      <View
        pointerEvents={isStarting ? 'none' : 'auto'}
        style={[styles.primaryCta, { top: layout.primaryCtaTop }, isStarting && styles.ctaLoading]}
      >
        <ExerciseActionButton
          borderRadius={10}
          gap={10}
          gradient
          icon={<PlayIcon color={colors.surface} fill={colors.surface} height={22} width={22} />}
          labelStyle={styles.ctaLabel}
          onPress={() => void handleStartWorkout()}
          title="운동 시작하기"
        />
      </View>
      <View style={[styles.secondaryCta, { top: layout.secondaryCtaTop }]}>
        <ExerciseActionButton
          onPress={() => router.replace('/exercise/condition')}
          title="조건 다시 설정"
          variant="secondary"
        />
      </View>
    </ExerciseScreenFrame>
  );
}

const styles = StyleSheet.create({
  aiBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    height: 21,
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  aiBadgeText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 13,
    includeFontPadding: false,
    lineHeight: 16,
  },
  back: { left: 10, position: 'absolute', top: 32 },
  conditionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    height: 31,
    justifyContent: 'center',
    width: 31,
  },
  conditionItem: { alignItems: 'center', flex: 1, gap: 4 },
  conditionLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 11,
  },
  conditionSummary: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    height: 100,
    left: 21,
    paddingHorizontal: 8,
    position: 'absolute',
    top: 80,
    width: 370,
  },
  conditionValue: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 13,
    maxWidth: 64,
  },
  ctaLabel: { fontFamily: fontFamilies.pretendardMedium, fontSize: 20, lineHeight: 24 },
  ctaLoading: { opacity: 0.7 },
  divider: { backgroundColor: colors.border, height: 1, width: '100%' },
  emptyProgram: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    textAlign: 'center',
  },
  number: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    height: 27,
    justifyContent: 'center',
    width: 27,
  },
  numberText: { color: colors.primaryDark, fontFamily: fontFamilies.pretendardBold, fontSize: 13 },
  primaryCta: { left: 21, position: 'absolute', top: 765, width: 370 },
  programAccent: { color: colors.primaryDark },
  programCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 300,
    left: 21,
    overflow: 'hidden',
    padding: 10,
    position: 'absolute',
    top: 190,
    width: 370,
  },
  programImage: {
    flexShrink: 0,
    height: 120,
    width: 120,
  },
  programInfo: { flexShrink: 0, width: 216 },
  programInner: { flex: 1 },
  programMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    includeFontPadding: false,
    lineHeight: 16,
  },
  programOverview: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  programTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 21,
    includeFontPadding: false,
    lineHeight: 28,
    width: 216,
  },
  reasonList: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 3,
  },
  reasonRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  reasonSection: { flex: 1 },
  reasonText: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 13,
    includeFontPadding: false,
    lineHeight: 16,
  },
  reasonTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
    includeFontPadding: false,
    lineHeight: 22,
  },
  reasonTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  screenTitle: {
    alignSelf: 'center',
    color: colors.textPrimary,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
    letterSpacing: 1.5,
    position: 'absolute',
    top: 37,
  },
  secondaryCta: { left: 21, position: 'absolute', top: 820, width: 370 },
  workoutCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 250,
    left: 21,
    padding: 16,
    position: 'absolute',
    top: 500,
    width: 370,
  },
  workoutCount: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 13,
  },
  workoutHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  workoutList: { marginTop: 10 },
  workoutName: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 15,
  },
  workoutPrescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 12,
    marginTop: 2,
  },
  workoutRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
    paddingVertical: 7,
  },
  workoutText: { marginLeft: 10 },
  workoutTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 18,
  },
  workoutTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
});
