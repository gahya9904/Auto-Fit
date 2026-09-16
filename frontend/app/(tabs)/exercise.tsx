import { useEffect, useMemo, type ComponentType } from 'react';
import { useRouter } from 'expo-router';
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ArrowRightShortIcon from '@/assets/icons/common/ArrowRight_Short.svg';
import RightIcon from '@/assets/icons/common/chevrons/Right.svg';
import BmrIcon from '@/assets/icons/data/BMR.svg';
import BarbellIcon from '@/assets/icons/deco/Barbell.svg';
import CalendarIcon from '@/assets/icons/deco/CalendarCheck.svg';
import CalendarDotsIcon from '@/assets/icons/deco/CalendarDots.svg';
import FireIcon from '@/assets/icons/deco/Fire.svg';
import SneakerIcon from '@/assets/icons/deco/SneakerMove.svg';
import StarFourIcon from '@/assets/icons/deco/StarFour_Fill.svg';
import TargetIcon from '@/assets/icons/deco/Target.svg';
import TrophyIcon from '@/assets/icons/deco/Trophy.svg';
import ChartIcon from '@/assets/icons/graph/ChartPieSlice.svg';
import ClockIcon from '@/assets/icons/input/Clock.svg';
import { ExerciseActionButton } from '@/src/components/exercise/ExerciseActionButton';
import { ExerciseScreenFrame } from '@/src/components/exercise/ExerciseScreenFrame';
import { useExerciseRoutine } from '@/src/features/exercise/ExerciseRoutineContext';
import { colors, fontFamilies } from '@/src/theme';

const exerciseBackground = require('@/assets/images/backgrounds/6_Exercise.png');
const recentExerciseImage = require('@/assets/images/illustrations/temp/Image_Exercise.png');
const heroImages = {
  'not-created': require('@/assets/images/illustrations/exercise/circles/Uncomplete.png'),
  ready: require('@/assets/images/illustrations/exercise/circles/Ready.png'),
  completed: require('@/assets/images/illustrations/exercise/circles/Complete.png'),
} as const;

const heroCopy = {
  'not-created': {
    badge: '오늘의 시작',
    title: '오늘 운동할\n준비가 되셨나요?',
    action: '오늘 운동 추천받기',
  },
  ready: { badge: '운동 시작', title: '오늘의 운동이\n준비되었어요!', action: '운동 시작하기' },
  completed: {
    badge: '운동 완료',
    title: '오늘 운동을\n완료했어요!',
    action: '운동 결과 확인하기',
  },
} as const;

type ExerciseSummaryItem = {
  Icon: ComponentType<any>;
  label: string;
  unit: string | null;
  value: string;
};

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === 'number';
}

export default function ExerciseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { homeMetrics, latestSession, refreshHome, status } = useExerciseRoutine();
  const responsiveHeight = Platform.OS === 'web' ? windowHeight : Dimensions.get('screen').height;
  const heightProgress = Math.max(0, Math.min(1, (responsiveHeight - 740) / (917 - 740)));
  const verticalValue = (expanded: number, compact: number) =>
    compact + (expanded - compact) * heightProgress;
  const availableWidth = windowWidth - insets.left - insets.right;
  const dietWidthScale = Math.min(1, availableWidth / 412);
  const frameWidthScale = Math.min(1, windowWidth / 412);
  const dietCanvasTop = Math.max(0, insets.top + 8 - 38 * dietWidthScale);
  const titleTop =
    (dietCanvasTop + verticalValue(38, 30) * dietWidthScale) / Math.max(frameWidthScale, 0.01);
  const layout = {
    contentHeight: verticalValue(818, 743),
    heroBadgeTop: verticalValue(39, 25),
    heroHeight: verticalValue(220, 205),
    heroImageTop: verticalValue(10, 5),
    heroTitleTop: verticalValue(78, 58),
    heroTop: verticalValue(74, 62),
    menuHeight: verticalValue(65, 61),
    menuTop: verticalValue(613, 550),
    recentCardHeight: verticalValue(110, 100),
    recentCardPadding: verticalValue(15, 10),
    recentCardTop: verticalValue(489, 444),
    recentHeadingTop: verticalValue(460, 416),
    summaryCardHeight: verticalValue(110, 100),
    summaryCardPadding: verticalValue(15, 10),
    summaryCardTop: verticalValue(334, 303),
    summaryTitleTop: verticalValue(305, 276),
    titleTop,
  };
  useEffect(() => {
    if (status !== null) return undefined;
    const frame = requestAnimationFrame(() => {
      void refreshHome();
    });
    return () => cancelAnimationFrame(frame);
  }, [refreshHome, status]);

  const heroStatus = status ?? 'not-created';
  const hero = heroCopy[heroStatus];
  const summary = useMemo(() => {
    if (heroStatus === 'completed') {
      return [
        {
          label: '칼로리',
          value: hasNumber(latestSession?.calories) ? String(latestSession.calories) : '-',
          unit: hasNumber(latestSession?.calories) ? 'kcal' : null,
          Icon: BmrIcon,
        },
        {
          label: '운동 시간',
          value: hasNumber(latestSession?.durationMinutes)
            ? String(latestSession.durationMinutes)
            : '-',
          unit: hasNumber(latestSession?.durationMinutes) ? '분' : null,
          Icon: CalendarIcon,
        },
        {
          label: '운동 종류',
          value: hasNumber(latestSession?.itemCount) ? String(latestSession.itemCount) : '-',
          unit: hasNumber(latestSession?.itemCount) ? '가지' : null,
          Icon: BarbellIcon,
        },
        {
          label: '목표 달성률',
          value: hasNumber(homeMetrics.goalAchievementRate)
            ? String(homeMetrics.goalAchievementRate)
            : '-',
          unit: hasNumber(homeMetrics.goalAchievementRate) ? '%' : null,
          Icon: TrophyIcon,
        },
      ] satisfies ExerciseSummaryItem[];
    }

    return [
      {
        label: '연속 기록',
        value: hasNumber(homeMetrics.currentWorkoutStreakDays)
          ? String(homeMetrics.currentWorkoutStreakDays)
          : '-',
        unit: hasNumber(homeMetrics.currentWorkoutStreakDays) ? '일째' : null,
        Icon: BmrIcon,
      },
      {
        label: '이번 주',
        value: hasNumber(homeMetrics.currentWeekWorkoutCount)
          ? String(homeMetrics.currentWeekWorkoutCount)
          : '-',
        unit: hasNumber(homeMetrics.currentWeekWorkoutCount) ? '회 완료' : null,
        Icon: CalendarDotsIcon,
      },
      {
        label: '목표까지',
        value: hasNumber(homeMetrics.remainingGoalWorkoutCount)
          ? String(homeMetrics.remainingGoalWorkoutCount)
          : '-',
        unit: hasNumber(homeMetrics.remainingGoalWorkoutCount) ? '회 남음' : null,
        Icon: TargetIcon,
      },
    ] satisfies ExerciseSummaryItem[];
  }, [heroStatus, homeMetrics, latestSession]);

  const handleHeroAction = () => {
    if (heroStatus === 'not-created') router.push('/exercise/condition');
    else router.push('/exercise/summary');
  };

  return (
    <ExerciseScreenFrame
      background={exerciseBackground}
      contentHeight={layout.contentHeight}
      hasBottomNavigation
    >
      <Text style={[styles.screenTitle, { top: layout.titleTop }]}>운동 추천</Text>
      <View style={[styles.heroCard, { height: layout.heroHeight, top: layout.heroTop }]}>
        <View style={[styles.heroBadge, { top: layout.heroBadgeTop }]}>
          {heroStatus === 'not-created' ? (
            <StarFourIcon color={colors.primary} fill={colors.primary} height={15} width={15} />
          ) : null}
          <Text style={styles.heroBadgeText}>{hero.badge}</Text>
        </View>
        <Text style={[styles.heroTitle, { top: layout.heroTitleTop }]}>{hero.title}</Text>
        <Image
          resizeMode="contain"
          source={heroImages[heroStatus]}
          style={[styles.heroImage, { top: layout.heroImageTop }]}
        />
        <View style={styles.heroButton}>
          <ExerciseActionButton
            compact
            gradient
            icon={
              <View style={styles.heroArrowCircle}>
                <ArrowRightShortIcon color={colors.primary} height={16} width={16} />
              </View>
            }
            onPress={handleHeroAction}
            title={hero.action}
          />
        </View>
      </View>
      <Text style={[styles.sectionTitle, { top: layout.summaryTitleTop }]}>
        {heroStatus === 'completed' ? '오늘의 요약' : '루틴 요약'}
      </Text>
      <View
        style={[
          styles.summaryCard,
          {
            height: layout.summaryCardHeight,
            paddingVertical: layout.summaryCardPadding,
            top: layout.summaryCardTop,
          },
        ]}
      >
        {summary.map(({ Icon, label, unit, value }, index) => (
          <View key={label} style={[styles.summaryItem, index > 0 && styles.summaryDivider]}>
            <View style={styles.mintCircle}>
              <Icon color={colors.primary} height={24} width={24} />
            </View>
            <Text style={styles.summaryLabel}>{label}</Text>
            <Text style={styles.summaryValue}>
              {value}
              {unit ? <Text style={styles.summaryUnit}> {unit}</Text> : null}
            </Text>
          </View>
        ))}
      </View>
      <View style={[styles.recentHeading, { top: layout.recentHeadingTop }]}>
        <Text style={styles.sectionTitleInline}>최근 운동</Text>
        <Text style={styles.recentDate}>{latestSession?.date?.slice(0, 10) ?? '-'}</Text>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.recentCard,
          {
            height: layout.recentCardHeight,
            paddingVertical: layout.recentCardPadding,
            top: layout.recentCardTop,
          },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.recentImageContainer}>
          <Image resizeMode="contain" source={recentExerciseImage} style={styles.recentImage} />
        </View>
        <View style={styles.recentBody}>
          <Text style={styles.recentTitle}>-</Text>
          <View style={styles.recentFactors}>
            <MetaItem
              Icon={ClockIcon}
              unit={hasNumber(latestSession?.durationMinutes) ? '분' : null}
              value={hasNumber(latestSession?.durationMinutes) ? String(latestSession.durationMinutes) : '-'}
            />
            <MetaItem
              Icon={BarbellIcon}
              unit={hasNumber(latestSession?.itemCount) ? '종목' : null}
              value={hasNumber(latestSession?.itemCount) ? String(latestSession.itemCount) : '-'}
            />
            <MetaItem
              Icon={FireIcon}
              unit={hasNumber(latestSession?.calories) ? 'kcal' : null}
              value={hasNumber(latestSession?.calories) ? String(latestSession.calories) : '-'}
            />
          </View>
          <View style={styles.recentChip}>
            <Text style={styles.recentChipText}>-</Text>
          </View>
        </View>
        <RightIcon color={colors.textSecondary} height={20} width={20} />
      </Pressable>
      <View style={[styles.menuList, { top: layout.menuTop }]}>
        <MenuItem Icon={SneakerIcon} height={layout.menuHeight} label="운동 기록" />
        <MenuItem Icon={CalendarIcon} height={layout.menuHeight} label="운동 목표" />
        <MenuItem Icon={ChartIcon} height={layout.menuHeight} label="진행 현황" />
      </View>
    </ExerciseScreenFrame>
  );
}

function MetaItem({
  Icon,
  unit,
  value,
}: {
  Icon: ComponentType<any>;
  unit: string | null;
  value: string;
}) {
  return (
    <View style={styles.metaItem}>
      <Icon color={colors.textSecondary} fill={colors.textSecondary} height={15} width={15} />
      <Text style={styles.metaValue}>
        {value}
        {unit ? <Text style={styles.metaUnit}>{unit}</Text> : null}
      </Text>
    </View>
  );
}

function MenuItem({
  Icon,
  height,
  label,
}: {
  Icon: ComponentType<any>;
  height: number;
  label: string;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.menuItem, { height }, pressed && styles.pressed]}>
      <View style={styles.menuIcon}>
        <Icon color={colors.primary} fill={colors.primary} height={27} width={27} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <RightIcon color={colors.textSecondary} height={20} width={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroBadge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    height: 27,
    justifyContent: 'center',
    left: 22,
    paddingHorizontal: 10,
    position: 'absolute',
    top: 39,
  },
  heroBadgeText: {
    color: colors.primary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 15,
    includeFontPadding: false,
    letterSpacing: 0.75,
  },
  heroArrowCircle: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  heroButton: { bottom: 16, left: 20, position: 'absolute', right: 20 },
  heroCard: {
    backgroundColor: '#FAFFFE',
    borderColor: '#E8E8E8',
    borderRadius: 18,
    borderWidth: 1,
    height: 220,
    left: 21,
    overflow: 'hidden',
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    top: 70,
    width: 370,
  },
  heroImage: {
    height: 145,
    position: 'absolute',
    right: 15,
    top: 18,
    width: 163,
  },
  heroTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 23,
    includeFontPadding: false,
    left: 22,
    letterSpacing: 0.46,
    lineHeight: 31,
    position: 'absolute',
    top: 78,
  },
  menuIcon: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  menuItem: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 15,
  },
  menuLabel: {
    color: colors.textBody,
    flex: 1,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 18,
    letterSpacing: 1.8,
    marginLeft: 13,
  },
  menuList: { gap: 5, left: 21, position: 'absolute', top: 613, width: 370 },
  mintCircle: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    height: 35,
    justifyContent: 'center',
    width: 35,
  },
  pressed: { opacity: 0.78 },
  metaItem: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  metaUnit: { fontFamily: fontFamilies.pretendardMedium, fontSize: 12 },
  metaValue: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 15,
    letterSpacing: 1.5,
  },
  recentBody: { gap: 10, marginLeft: 15, width: 230 },
  recentCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    height: 110,
    left: 21,
    paddingHorizontal: 10,
    paddingVertical: 15,
    position: 'absolute',
    top: 490,
    width: 370,
  },
  recentChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    height: 22,
    justifyContent: 'center',
    paddingLeft: 10,
    width: 230,
  },
  recentChipText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 12.5,
    letterSpacing: 1.25,
  },
  recentDate: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
  },
  recentHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    left: 21,
    position: 'absolute',
    top: 460,
  },
  recentFactors: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 230,
  },
  recentImage: { height: 66, width: 66 },
  recentImageContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 80,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 80,
  },
  recentTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 17,
    letterSpacing: 1.7,
  },
  screenTitle: {
    alignSelf: 'center',
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
    letterSpacing: 1.5,
    lineHeight: 20,
    position: 'absolute',
    top: 37,
  },
  sectionTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
    left: 21,
    letterSpacing: 2,
    position: 'absolute',
    top: 306,
  },
  sectionTitleInline: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
    letterSpacing: 2,
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    height: 110,
    left: 21,
    position: 'absolute',
    top: 335,
    width: 370,
    paddingVertical: 15,
  },
  summaryDivider: { borderLeftColor: colors.border, borderLeftWidth: 1 },
  summaryItem: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'space-between' },
  summaryLabel: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 14,
    letterSpacing: 1.4,
    lineHeight: 17,
  },
  summaryUnit: {
    color: colors.primaryMedium,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
  },
  summaryValue: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 18,
  },
});
