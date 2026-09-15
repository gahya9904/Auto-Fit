import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import BarbellIcon from '@/assets/icons/deco/Barbell.svg';
import HandHeartIcon from '@/assets/icons/deco/HandHeart.svg';
import HouseIcon from '@/assets/icons/deco/HouseLine.svg';
import MapPinIcon from '@/assets/icons/deco/MapPin_Fill.svg';
import PlayIcon from '@/assets/icons/feature/PlayCircle_Fill.svg';
import ClockIcon from '@/assets/icons/input/Clock.svg';
import CheckIcon from '@/assets/icons/system/CheckCircle_Fill.svg';
import LightbulbIcon from '@/assets/icons/system/Lightbulb.svg';
import { BackButton } from '@/src/components/common/BackButton';
import { ExerciseActionButton } from '@/src/components/exercise/ExerciseActionButton';
import { ExerciseScreenFrame } from '@/src/components/exercise/ExerciseScreenFrame';
import { useExerciseRoutine } from '@/src/features/exercise/ExerciseRoutineContext';
import {
  exerciseEquipmentLabels,
  exerciseLocationLabels,
  mockExerciseRoutine,
} from '@/src/features/exercise/exerciseData';
import { colors, fontFamilies } from '@/src/theme';

const exerciseImage = require('@/assets/images/illustrations/temp/Image_Exercise.png');

export default function ExerciseSummaryScreen() {
  const router = useRouter();
  const { completeRoutine, condition, routine } = useExerciseRoutine();
  const currentRoutine = routine ?? mockExerciseRoutine;
  const backToExerciseHome = () => router.replace('/exercise');
  const handleStartWorkout = () => {
    // TODO: 실제 운동 수행 화면이 추가되면 해당 route로 이동하고 완료 시 completeRoutine을 호출합니다.
    completeRoutine();
    router.replace('/exercise');
  };

  const summary = [
    { label: '시간', value: `${condition.availableMinutes}분`, Icon: ClockIcon },
    {
      label: '장소',
      value: exerciseLocationLabels[condition.location],
      Icon: condition.location === 'home' ? HouseIcon : MapPinIcon,
    },
    {
      label: '장비',
      value:
        condition.equipment.length === 1
          ? exerciseEquipmentLabels[condition.equipment[0]]
          : `${condition.equipment.length}종`,
      Icon: BarbellIcon,
    },
    { label: '컨디션', value: condition.condition || '보통', Icon: HandHeartIcon },
    { label: '불편 부위', value: condition.discomfortArea || '없음', Icon: HandHeartIcon },
  ];

  return (
    <ExerciseScreenFrame contentHeight={880}>
      <BackButton onPress={backToExerciseHome} style={styles.back} />
      <Text style={styles.screenTitle}>오늘의 맞춤 운동</Text>
      <View style={styles.conditionSummary}>
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

      <View style={styles.programCard}>
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI 추천 운동 프로그램</Text>
        </View>
        <Text style={styles.programTitle}>
          {currentRoutine.title}
          {`\n`}
          <Text style={styles.programAccent}>{currentRoutine.subtitle}</Text>
        </Text>
        <Image source={exerciseImage} style={styles.programImage} />
        <Text style={styles.programMeta}>
          {condition.availableMinutes}분 · {currentRoutine.exercises.length}개 운동 · 강도{' '}
          {currentRoutine.intensity}
        </Text>
        <View style={styles.divider} />
        <View style={styles.reasonTitleRow}>
          <LightbulbIcon color={colors.primary} height={22} width={22} />
          <Text style={styles.reasonTitle}>추천 이유</Text>
        </View>
        <View style={styles.reasonList}>
          {currentRoutine.reasons.map((reason) => (
            <View key={reason} style={styles.reasonRow}>
              <CheckIcon color={colors.primary} fill={colors.primary} height={15} width={15} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.workoutCard}>
        <View style={styles.workoutHeader}>
          <View style={styles.workoutTitleRow}>
            <BarbellIcon color={colors.primary} fill={colors.primary} height={23} width={23} />
            <Text style={styles.workoutTitle}>운동 리스트</Text>
          </View>
          <Text style={styles.workoutCount}>{currentRoutine.exercises.length}개 운동</Text>
        </View>
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={styles.workoutList}>
          {currentRoutine.exercises.map((exercise, index) => (
            <View key={exercise.id} style={styles.workoutRow}>
              <View style={styles.number}>
                <Text style={styles.numberText}>{index + 1}</Text>
              </View>
              <View style={styles.workoutText}>
                <Text style={styles.workoutName}>{exercise.name}</Text>
                <Text style={styles.workoutPrescription}>{exercise.prescription}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={styles.primaryCta}>
        <ExerciseActionButton
          icon={<PlayIcon color={colors.surface} fill={colors.surface} height={25} width={25} />}
          onPress={handleStartWorkout}
          title="운동 시작하기"
        />
      </View>
      <View style={styles.secondaryCta}>
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
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  aiBadgeText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 13,
  },
  back: { left: 16, position: 'absolute', top: 25 },
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
  divider: { backgroundColor: colors.border, height: 1, marginTop: 15 },
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
    padding: 18,
    position: 'absolute',
    top: 190,
    width: 370,
  },
  programImage: {
    borderRadius: 60,
    height: 120,
    position: 'absolute',
    right: 12,
    top: 42,
    width: 120,
  },
  programMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    marginTop: 10,
  },
  programTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 21,
    lineHeight: 28,
    marginTop: 10,
    width: 225,
  },
  reasonList: { gap: 5, marginTop: 8 },
  reasonRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  reasonText: { color: colors.textBody, fontFamily: fontFamilies.pretendardRegular, fontSize: 13 },
  reasonTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
  },
  reasonTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 12 },
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
