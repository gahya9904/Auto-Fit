import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  type ImageSourcePropType,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Down from '@/assets/icons/common/chevrons/Down.svg';
import Left from '@/assets/icons/common/chevrons/Left.svg';
import Right from '@/assets/icons/common/chevrons/Right.svg';
import Up from '@/assets/icons/common/chevrons/Up.svg';
import Bmr from '@/assets/icons/data/BMR.svg';
import Fat from '@/assets/icons/data/Fat.svg';
import Plant from '@/assets/icons/deco/Plant.svg';
import Moon from '@/assets/icons/day/Moon.svg';
import Star from '@/assets/icons/day/Star.svg';
import Sun from '@/assets/icons/day/Sun.svg';
import Fish from '@/assets/icons/food/Fish.svg';
import Fridge from '@/assets/icons/feature/Fridge.svg';
import ForkKnife from '@/assets/icons/feature/navigator/Diet.svg';
import Pencil from '@/assets/icons/feature/Pencil_Line.svg';
import Check from '@/assets/icons/system/Check_Fat.svg';
import Prohibit from '@/assets/icons/system/Prohibit.svg';
import Refresh from '@/assets/icons/system/Refresh.svg';
import { CustomScrollIndicator, useCustomScrollIndicator } from '@/src/components/common';
import {
  BOTTOM_NAVIGATION_MIN_BOTTOM_GAP,
  getBottomNavigationVisualHeight,
} from '@/src/components/navigation';
import { colors, fontFamilies } from '@/src/theme';

const hero = require('../../assets/images/illustrations/diet/Diet.png');
const breakfastImage = require('../../assets/images/illustrations/temp/Image_MealPicture_1.png');
const lunchImage = require('../../assets/images/illustrations/diet/EmptyFood.png');
const dinnerImage = require('../../assets/images/illustrations/temp/Image_MealPicture_2.png');
const snackImage = require('../../assets/images/illustrations/temp/Image_MealPicture_3.png');

const referenceWidth = 412;
const minimumScreenHeight = 740;
const maximumScreenHeight = 917;
const dateWindowMin = -6;
const dateWindowMax = 6;
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type MealStatus = 'recommended' | 'eaten' | 'modified' | 'skipped';
type MealStatuses = Record<MealType, MealStatus>;

type Meal = {
  id: MealType;
  title: string;
  kcal: number;
  color: string;
  image: ImageSourcePropType;
  foods: string;
  tags: string[];
  note: string;
  fridgeBadge: string;
  ingredients: string;
  intake: [string, string][];
};

type NutritionGoal = {
  label: string;
  current: number;
  target: number;
  unit: string;
  Icon: typeof Bmr;
};

const defaultMealStatuses: MealStatuses = {
  breakfast: 'recommended',
  lunch: 'recommended',
  dinner: 'recommended',
  snack: 'recommended',
};

const meals: Meal[] = [
  {
    id: 'breakfast',
    title: '아침',
    kcal: 480,
    color: '#31A990',
    image: breakfastImage,
    foods: '현미밥, 연어구이, 두부샐러드, 미역국, 키위',
    tags: ['근육 유지', '혈당 관리', '식이섬유'],
    note: '연어와 두부로 단백질을 보충하고 혈당 부담을 낮춘 구성',
    fridgeBadge: '냉장고 재료 3개 활용',
    ingredients: '두부 · 현미밥 · 토마토',
    intake: [
      ['현미밥', '1공기 (약 150g)'],
      ['연어구이', '1토막 (약 100g)'],
      ['두부샐러드', '1접시'],
      ['미역국', '1그릇 (약 200ml)'],
      ['키위', '1개'],
    ],
  },
  {
    id: 'lunch',
    title: '점심',
    kcal: 480,
    color: '#E49B42',
    image: lunchImage,
    foods: '현미밥, 연어구이, 두부샐러드, 미역국, 키위',
    tags: ['고단백', '건강한 지방', '영양 균형'],
    note: '한 끼에 필요한 단백질과 건강한 지방을 균형 있게 담은 구성',
    fridgeBadge: '냉장고 재료 3개 활용',
    ingredients: '두부 · 현미밥 · 토마토',
    intake: [
      ['현미밥', '1공기 (약 150g)'],
      ['연어구이', '1토막 (약 100g)'],
      ['두부샐러드', '1접시'],
      ['미역국', '1그릇 (약 200ml)'],
      ['키위', '1개'],
    ],
  },
  {
    id: 'dinner',
    title: '저녁',
    kcal: 520,
    color: '#5489D8',
    image: dinnerImage,
    foods: '현미밥, 닭가슴살구이, 두부버섯볶음, 브로콜리무침',
    tags: ['근육 유지', '혈당 관리', '식이섬유'],
    note: '현미밥과 닭가슴살로 포만감과 영양 균형을 맞춘 구성',
    fridgeBadge: '냉장고 재료 4개 활용',
    ingredients: '현미밥 · 닭가슴살 · 두부 · 브로콜리',
    intake: [
      ['현미밥', '1공기 (약 150g)'],
      ['닭가슴살구이', '1조각 (약 120g)'],
      ['두부버섯볶음', '1접시'],
      ['브로콜리무침', '1접시 (약 70g)'],
    ],
  },
  {
    id: 'snack',
    title: '간식',
    kcal: 480,
    color: '#A357C7',
    image: snackImage,
    foods: '그릭요거트, 블루베리, 호두',
    tags: ['고단백', '식이섬유', '건강한 지방'],
    note: '그릭요거트로 단백질을 보충하고 혈당 부담을 낮춘 구성',
    fridgeBadge: '냉장고 재료 3개 활용',
    ingredients: '그릭요거트 · 블루베리 · 호두',
    intake: [
      ['그릭요거트', '100g'],
      ['블루베리', '10개 (약 30g)'],
      ['호두', '1개 (약 5g)'],
    ],
  },
];

const nutritionGoals: NutritionGoal[] = [
  { label: '열량', current: 1650, target: 1700, unit: 'kcal', Icon: Bmr },
  { label: '탄수화물', current: 210, target: 230, unit: 'g', Icon: Plant },
  { label: '단백질', current: 30, target: 90, unit: 'g', Icon: Fish },
  { label: '지방', current: 45, target: 50, unit: 'g', Icon: Fat },
];

const mealCardLayoutAnimation = {
  duration: 280,
  create: {
    duration: 230,
    property: LayoutAnimation.Properties.opacity,
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    duration: 210,
    property: LayoutAnimation.Properties.opacity,
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
};

function animateMealCardLayout() {
  if (Platform.OS !== 'web') LayoutAnimation.configureNext(mealCardLayoutAnimation);
}

function addDays(source: Date, amount: number) {
  const next = new Date(source);
  next.setHours(12, 0, 0, 0);
  next.setDate(next.getDate() + amount);
  return next;
}

function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function getDateCopy(date: Date, offset: number) {
  const weekday = weekdays[date.getDay()];
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (offset === 0) return { label: `오늘 (${weekday})`, date: `${month}.${day}` };
  if (offset === 1) return { label: `내일 (${weekday})`, date: `${month}.${day}` };
  return { label: `${weekday}요일`, date: `${month}.${day}` };
}

function MealIcon({ id, color }: { id: MealType; color: string }) {
  if (id === 'dinner') return <Moon color={color} height={15} width={15} />;
  if (id === 'snack') return <Star color={color} height={15} width={15} />;
  return <Sun color={color} height={15} width={15} />;
}

function FadeUp({ children }: { children: ReactNode }) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(8));

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        duration: 230,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(translateY, {
        duration: 230,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function Goal({ label, current, target, unit, Icon }: NutritionGoal) {
  const ratio = target > 0 ? current / target : 0;
  const barProgress = Math.max(0, Math.min(ratio, 1));
  const percentage = Math.round(ratio * 100);

  return (
    <View style={styles.goal}>
      <View style={styles.goalIcon}>
        <Icon color={colors.primaryDark} height={20} width={20} />
      </View>
      <View style={styles.goalCopy}>
        <View style={styles.goalLabelRow}>
          <Text style={styles.goalLabel}>{label}</Text>
          <View style={styles.percentageBadge}>
            <Text style={styles.percentageText}>{percentage}%</Text>
          </View>
        </View>
        <Text style={styles.goalValue}>
          {current.toLocaleString()}{' '}
          <Text style={styles.goalTarget}>
            / {target.toLocaleString()} {unit}
          </Text>
        </Text>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${barProgress * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: MealStatus }) {
  if (status === 'eaten') {
    return (
      <View style={[styles.statusBadge, styles.eatenBadge]}>
        <Check color="#31A990" height={11} width={11} />
        <Text style={[styles.statusBadgeText, styles.eatenBadgeText]}>먹었어요</Text>
      </View>
    );
  }
  if (status === 'modified') {
    return (
      <View style={[styles.statusBadge, styles.modifiedBadge]}>
        <Pencil color="#5489D8" height={11} width={11} />
        <Text style={[styles.statusBadgeText, styles.modifiedBadgeText]}>수정하기</Text>
      </View>
    );
  }
  if (status === 'skipped') {
    return (
      <View style={[styles.statusBadge, styles.skippedBadge]}>
        <Prohibit color="#767676" height={11} width={11} />
        <Text style={[styles.statusBadgeText, styles.skippedBadgeText]}>건너뜀</Text>
      </View>
    );
  }
  return (
    <View style={[styles.statusBadge, styles.recommendedBadge]}>
      <Refresh color="#31A990" height={11} width={11} />
      <Text style={[styles.statusBadgeText, styles.recommendedBadgeText]}>다른 식단</Text>
    </View>
  );
}

function tagStyle(tag: string, index: number) {
  if (tag === '영양 균형') return { backgroundColor: '#F4F4F4', borderColor: '#D8DDDC' };
  if (tag === '건강한 지방') return { backgroundColor: '#FFF8E8', borderColor: '#F0D899' };
  if (tag === '고단백') return { backgroundColor: '#F6EEFB', borderColor: '#DABAE8' };
  return [
    { backgroundColor: '#EEF4FF', borderColor: '#AFC8FF' },
    { backgroundColor: '#ECFAF6', borderColor: '#A9E2D4' },
    { backgroundColor: '#EFF9F1', borderColor: '#BEE3C6' },
  ][index % 3];
}

function actionStyle(status: MealStatus, selectedStatus: MealStatus): ViewStyle[] {
  const selected = status === selectedStatus;
  if (status === 'eaten')
    return [styles.actionButton, selected ? styles.actionEatenSelected : styles.actionEaten];
  if (status === 'modified') {
    return [
      styles.actionButton,
      styles.actionWide,
      selected ? styles.actionModifiedSelected : styles.actionModified,
    ];
  }
  return [styles.actionButton, selected ? styles.actionSkippedSelected : styles.actionSkipped];
}

function MealCard({
  meal,
  expanded,
  status,
  onToggle,
  onStatusChange,
}: {
  meal: Meal;
  expanded: boolean;
  status: MealStatus;
  onToggle: () => void;
  onStatusChange: (status: MealStatus) => void;
}) {
  const dimmed = status === 'skipped';
  const borderStyle =
    status === 'eaten'
      ? styles.mealCardEaten
      : status === 'modified'
        ? styles.mealCardModified
        : status === 'skipped'
          ? styles.mealCardSkipped
          : null;

  const chooseStatus = (nextStatus: MealStatus) => {
    animateMealCardLayout();
    onStatusChange(nextStatus);
  };

  return (
    <Pressable
      accessibilityState={{ expanded }}
      onPress={onToggle}
      style={[styles.mealCard, borderStyle]}
    >
      <View style={styles.mealCardTop}>
        <View style={styles.mealTitleRow}>
          <MealIcon color={meal.color} id={meal.id} />
          <Text style={[styles.mealTitle, { color: meal.color }]}>{meal.title}</Text>
          <Text style={styles.mealKcal}>{meal.kcal} kcal</Text>
        </View>
        <Pressable
          hitSlop={6}
          onPress={(event) => event.stopPropagation()}
          style={styles.statusPressable}
        >
          <StatusBadge status={status} />
        </Pressable>
      </View>

      <View style={styles.mealSummary}>
        <View style={[styles.mealContent, dimmed && styles.skippedContent]}>
          <Image resizeMode="cover" source={meal.image} style={styles.mealImage} />
          <View style={styles.mealCopy}>
            <Text numberOfLines={2} style={styles.foodsText}>
              {meal.foods}
            </Text>
            <View style={styles.tags}>
              {meal.tags.map((tag, index) => (
                <View key={tag} style={[styles.tag, tagStyle(tag, index)]}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <View style={styles.chevronCircle}>
          {expanded ? (
            <Up color="#555555" height={13} width={13} />
          ) : (
            <Down color="#555555" height={13} width={13} />
          )}
        </View>
      </View>

      {expanded ? (
        <FadeUp>
          <View style={styles.expandedContent}>
            <View style={styles.mealDivider} />
            <Text style={styles.mealNote}>{meal.note}</Text>

            <View style={styles.fridgeDetailCard}>
              <View style={styles.fridgeDetailHeader}>
                <Text style={styles.detailTitle}>냉장고 재료 활용</Text>
                <View style={styles.detailBadge}>
                  <Text style={styles.detailBadgeText}>{meal.fridgeBadge}</Text>
                </View>
              </View>
              <View style={styles.fridgeIngredientRow}>
                <Fridge color="#31A990" height={20} width={17} />
                <Text style={styles.fridgeIngredient}>{meal.ingredients}</Text>
              </View>
            </View>

            <View style={styles.intakeCard}>
              <View style={styles.intakeTitleRow}>
                <Text style={styles.detailTitle}>권장 섭취량</Text>
                <View style={styles.intakeBadge}>
                  <Text style={styles.intakeBadgeText}>1인 기준</Text>
                </View>
              </View>
              <View style={styles.intakeItems}>
                {meal.intake.map(([name, amount]) => (
                  <View key={name} style={styles.intakeItem}>
                    <ForkKnife color="#5C4D3C" height={25} width={25} />
                    <Text style={styles.intakeName}>{name}</Text>
                    <Text style={styles.intakeAmount}>{amount}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  chooseStatus('eaten');
                }}
                style={actionStyle('eaten', status)}
              >
                <Check color="#31A990" height={12} width={12} />
                <Text style={[styles.actionText, styles.actionEatenText]}>먹었어요</Text>
              </Pressable>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  chooseStatus('modified');
                }}
                style={actionStyle('modified', status)}
              >
                <Pencil color="#5489D8" height={12} width={12} />
                <Text style={[styles.actionText, styles.actionModifiedText]}>
                  다른 음식 먹었어요
                </Text>
              </Pressable>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  chooseStatus('skipped');
                }}
                style={actionStyle('skipped', status)}
              >
                <Prohibit color="#767676" height={12} width={12} />
                <Text style={[styles.actionText, styles.actionSkippedText]}>건너뛰었어요</Text>
              </Pressable>
            </View>
          </View>
        </FadeUp>
      ) : null}
    </Pressable>
  );
}

export default function DietScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [today] = useState(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    return date;
  });
  const [dateWindowStart, setDateWindowStart] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(today));
  const [expandedMeals, setExpandedMeals] = useState<Set<MealType>>(() => new Set());
  const [statusesByDate, setStatusesByDate] = useState<Record<string, MealStatuses>>({});

  const availableWidth = windowWidth - insets.left - insets.right;
  const widthScale = Math.min(1, availableWidth / referenceWidth);
  const responsiveHeight = Platform.OS === 'web' ? windowHeight : Dimensions.get('screen').height;
  const heightProgress = Math.max(
    0,
    Math.min(
      1,
      (responsiveHeight - minimumScreenHeight) / (maximumScreenHeight - minimumScreenHeight),
    ),
  );
  const verticalValue = (expanded: number, compact: number) =>
    compact + (expanded - compact) * heightProgress;
  const canvasLeft = insets.left + (availableWidth - referenceWidth * widthScale) / 2;
  const canvasTop = Math.max(0, insets.top + 8 - 38 * widthScale);
  const bottomPadding =
    getBottomNavigationVisualHeight(windowHeight) +
    Math.max(insets.bottom, BOTTOM_NAVIGATION_MIN_BOTTOM_GAP) +
    16;
  const indicator = useCustomScrollIndicator({ showInitially: true });
  const selectedStatuses = statusesByDate[selectedDateKey] ?? defaultMealStatuses;
  const visibleDates = [dateWindowStart, dateWindowStart + 1].map((offset) => {
    const date = addDays(today, offset);
    return { ...getDateCopy(date, offset), key: toDateKey(date), offset };
  });

  const toggleMeal = (mealId: MealType) => {
    animateMealCardLayout();
    setExpandedMeals((current) => {
      const next = new Set(current);
      if (next.has(mealId)) next.delete(mealId);
      else next.add(mealId);
      return next;
    });
  };

  const changeMealStatus = (mealId: MealType, status: MealStatus) => {
    setStatusesByDate((current) => ({
      ...current,
      [selectedDateKey]: {
        ...(current[selectedDateKey] ?? defaultMealStatuses),
        [mealId]: status,
      },
    }));
    setExpandedMeals((current) => {
      const next = new Set(current);
      next.delete(mealId);
      return next;
    });
  };

  const chooseDate = (key: string) => {
    setSelectedDateKey(key);
    if (expandedMeals.size > 0) {
      animateMealCardLayout();
      setExpandedMeals(new Set());
    }
  };

  const moveDateWindow = (amount: number) => {
    const nextWindowStart = Math.max(
      dateWindowMin,
      Math.min(dateWindowMax, dateWindowStart + amount),
    );
    setDateWindowStart(nextWindowStart);
    chooseDate(toDateKey(addDays(today, nextWindowStart)));
  };

  return (
    <View style={styles.root}>
      <ScrollView
        bounces={false}
        contentContainerStyle={{ paddingBottom: bottomPadding, paddingTop: canvasTop }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={indicator.onContentSizeChange}
        onLayout={indicator.onLayout}
        onMomentumScrollBegin={indicator.onMomentumScrollBegin}
        onMomentumScrollEnd={indicator.onMomentumScrollEnd}
        onScroll={indicator.onScroll}
        onScrollBeginDrag={indicator.onScrollBeginDrag}
        onScrollEndDrag={indicator.onScrollEndDrag}
        overScrollMode="never"
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.canvas,
            {
              left: canvasLeft,
              paddingTop: verticalValue(38, 30),
              transform: [{ scale: widthScale }],
            },
          ]}
        >
          <Text style={styles.screenTitle}>식단 추천</Text>

          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <View style={styles.strategyBadge}>
                <Text style={styles.strategyBadgeText}>Auto-Fit 식단전략</Text>
              </View>
              <Text style={styles.heroTitle}>
                OO님을 위한{`\n`}
                <Text style={styles.primaryText}>맞춤 식단</Text>이에요!
              </Text>
              <Text style={styles.heroDescription}>
                빠른 감량보다는 근육을 유지하면서{`\n`}체지방을 줄이는 방향으로 구성했어요.
              </Text>
            </View>
            <Image resizeMode="contain" source={hero} style={styles.heroImage} />
          </View>

          <View style={styles.sectionStack}>
            <View style={styles.fridgeCard}>
              <View style={styles.fridgeIconCircle}>
                <Fridge color="#31A990" height={25} width={17} />
              </View>
              <View style={styles.fridgeCopy}>
                <Text style={styles.fridgeTitle}>
                  <Text style={styles.primaryText}>냉장고 재료 8개</Text> 반영중
                </Text>
                <Text style={styles.fridgeDescription}>
                  닭가슴살 · 계란 · 두부 · 토마토 · 브로콜리 외 3개
                </Text>
              </View>
              <View style={styles.manageRow}>
                <Text style={styles.manageText}>관리하기</Text>
                <Right color="#555555" height={10} width={10} />
              </View>
            </View>

            <View style={styles.dateCard}>
              <Pressable
                disabled={dateWindowStart <= dateWindowMin}
                hitSlop={6}
                onPress={() => moveDateWindow(-2)}
                style={({ pressed }) => [
                  styles.arrowButton,
                  dateWindowStart <= dateWindowMin && styles.arrowDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Left color="#555555" height={13} width={13} />
              </Pressable>

              <View style={styles.dateChoices}>
                {visibleDates.map((item, index) => {
                  const selected = selectedDateKey === item.key;
                  return (
                    <View key={item.key} style={styles.dateChoiceWrap}>
                      <Pressable
                        onPress={() => chooseDate(item.key)}
                        style={[styles.dateChoice, selected && styles.dateChoiceSelected]}
                      >
                        <Text style={[styles.dateLabel, selected && styles.dateLabelSelected]}>
                          {item.label}
                        </Text>
                        <Text style={[styles.dateValue, selected && styles.dateValueSelected]}>
                          {item.date}
                        </Text>
                      </Pressable>
                      {index === 0 ? <View style={styles.dateDivider} /> : null}
                    </View>
                  );
                })}
              </View>

              <Pressable
                disabled={dateWindowStart >= dateWindowMax}
                hitSlop={6}
                onPress={() => moveDateWindow(2)}
                style={({ pressed }) => [
                  styles.arrowButton,
                  dateWindowStart >= dateWindowMax && styles.arrowDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Right color="#555555" height={13} width={13} />
              </Pressable>
            </View>

            <View style={styles.nutritionCard}>
              <Text style={styles.nutritionTitle}>오늘의 영양 목표</Text>
              <Text style={styles.nutritionDescription}>
                근손실 방지를 위해 단백질 비중을 높였어요
              </Text>
              <View style={styles.goalsGrid}>
                {nutritionGoals.map((goal) => (
                  <Goal key={goal.label} {...goal} />
                ))}
              </View>
            </View>

            <Text style={styles.mealSectionTitle}>오늘의 추천 식단</Text>
            <View style={styles.mealList}>
              {meals.map((meal) => (
                <MealCard
                  expanded={expandedMeals.has(meal.id)}
                  key={meal.id}
                  meal={meal}
                  onStatusChange={(status) => changeMealStatus(meal.id, status)}
                  onToggle={() => toggleMeal(meal.id)}
                  status={selectedStatuses[meal.id]}
                />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
      <CustomScrollIndicator {...indicator.indicatorProps} color="rgba(73, 205, 177, 0.56)" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFA', overflow: 'hidden' },
  canvas: {
    alignSelf: 'flex-start',
    paddingBottom: 10,
    position: 'relative',
    transformOrigin: 'top left',
    width: referenceWidth,
  },
  screenTitle: {
    color: '#333333',
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
    lineHeight: 20,
    marginLeft: 21,
  },
  hero: {
    height: 143,
    marginTop: 11,
    paddingLeft: 21,
    position: 'relative',
  },
  heroCopy: { zIndex: 2 },
  strategyBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EAF8F5',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  strategyBadgeText: {
    color: '#31A990',
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 11,
  },
  heroTitle: {
    color: '#333333',
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
    lineHeight: 27,
    marginTop: 7,
  },
  primaryText: { color: '#31A990' },
  heroDescription: {
    color: '#777777',
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  heroImage: { height: 105, position: 'absolute', right: 19, top: 18, width: 170 },
  sectionStack: { gap: 10, marginHorizontal: 21 },
  fridgeCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    flexDirection: 'row',
    height: 70,
    paddingHorizontal: 17,
  },
  fridgeIconCircle: {
    alignItems: 'center',
    backgroundColor: '#EAF8F5',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  fridgeCopy: { flex: 1, marginLeft: 11 },
  fridgeTitle: { color: '#333333', fontFamily: fontFamilies.pretendardBold, fontSize: 13 },
  fridgeDescription: {
    color: '#777777',
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 11,
    marginTop: 5,
  },
  manageRow: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  manageText: { color: '#555555', fontFamily: fontFamilies.pretendardMedium, fontSize: 11.5 },
  dateCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    flexDirection: 'row',
    height: 70,
    justifyContent: 'space-between',
    paddingHorizontal: 17,
  },
  arrowButton: {
    alignItems: 'center',
    backgroundColor: '#F4F6F6',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  arrowDisabled: { opacity: 0.3 },
  pressed: { opacity: 0.7 },
  dateChoices: { alignItems: 'center', flexDirection: 'row', height: 60 },
  dateChoiceWrap: { alignItems: 'center', flexDirection: 'row' },
  dateChoice: {
    alignItems: 'center',
    borderRadius: 10,
    height: 60,
    justifyContent: 'center',
    width: 120,
  },
  dateChoiceSelected: { backgroundColor: '#EAF8F5' },
  dateDivider: { backgroundColor: '#E8ECEB', height: 50, marginHorizontal: 1, width: 1 },
  dateLabel: { color: '#666666', fontFamily: fontFamilies.pretendardSemiBold, fontSize: 15 },
  dateLabelSelected: { color: '#31A990' },
  dateValue: {
    color: '#999999',
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 10,
    marginTop: 4,
  },
  dateValueSelected: { color: '#31A990', fontFamily: fontFamilies.pretendardMedium, fontSize: 12 },
  nutritionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    height: 210,
    paddingHorizontal: 17,
    paddingTop: 15,
  },
  nutritionTitle: { color: '#333333', fontFamily: fontFamilies.pretendardBold, fontSize: 17 },
  nutritionDescription: {
    color: '#777777',
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 11,
    marginTop: 3,
  },
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  goal: {
    alignItems: 'center',
    backgroundColor: '#F8FAFA',
    borderRadius: 8,
    flexDirection: 'row',
    height: 70,
    paddingHorizontal: 9,
    width: 160,
  },
  goalIcon: {
    alignItems: 'center',
    backgroundColor: '#EAF8F5',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  goalCopy: { flex: 1, marginLeft: 7 },
  goalLabelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  goalLabel: { color: '#555555', fontFamily: fontFamilies.pretendardMedium, fontSize: 11 },
  percentageBadge: {
    alignItems: 'center',
    backgroundColor: '#EAF8F5',
    borderRadius: 8,
    height: 15,
    justifyContent: 'center',
    width: 35,
  },
  percentageText: { color: '#31A990', fontFamily: fontFamilies.pretendardSemiBold, fontSize: 10 },
  goalValue: {
    color: '#333333',
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 14,
    marginTop: 3,
  },
  goalTarget: { color: '#999999', fontFamily: fontFamilies.pretendardRegular, fontSize: 10 },
  goalTrack: {
    backgroundColor: '#E5EBEA',
    borderRadius: 3,
    height: 5,
    marginTop: 5,
    overflow: 'hidden',
  },
  goalFill: { backgroundColor: '#49CDB1', borderRadius: 3, height: 5 },
  mealSectionTitle: {
    color: '#333333',
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 17,
    marginBottom: 1,
    marginTop: 4,
  },
  mealList: { gap: 10 },
  mealCard: {
    backgroundColor: '#FFFFFF',
    borderColor: 'transparent',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  mealCardEaten: { borderColor: '#49CDB1' },
  mealCardModified: { borderColor: '#78A7DB' },
  mealCardSkipped: { borderColor: '#D8DDDC' },
  mealCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 20,
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mealTitleRow: { alignItems: 'center', flexDirection: 'row' },
  mealTitle: { fontFamily: fontFamilies.pretendardBold, fontSize: 15, marginLeft: 5 },
  mealKcal: {
    color: '#777777',
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 12,
    marginLeft: 8,
  },
  statusPressable: { borderRadius: 10 },
  statusBadge: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 3,
    height: 20,
    justifyContent: 'center',
    width: 65,
  },
  statusBadgeText: { fontFamily: fontFamilies.pretendardSemiBold, fontSize: 10 },
  recommendedBadge: { backgroundColor: '#EAF8F5' },
  recommendedBadgeText: { color: '#31A990' },
  eatenBadge: { backgroundColor: '#EAF8F5' },
  eatenBadgeText: { color: '#31A990' },
  modifiedBadge: { backgroundColor: '#EDF4FC' },
  modifiedBadgeText: { color: '#5489D8' },
  skippedBadge: { backgroundColor: '#F1F2F2' },
  skippedBadgeText: { color: '#767676' },
  mealSummary: { height: 110, position: 'relative' },
  mealContent: { flexDirection: 'row', height: 110, paddingRight: 32 },
  skippedContent: { opacity: 0.5 },
  mealImage: { backgroundColor: '#F3F5F4', borderRadius: 8, height: 110, width: 110 },
  mealCopy: { flex: 1, justifyContent: 'center', marginLeft: 17 },
  foodsText: {
    color: '#333333',
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9 },
  tag: {
    borderRadius: 10,
    borderWidth: 0.7,
    height: 20,
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  tagText: { color: '#66706E', fontFamily: fontFamilies.pretendardMedium, fontSize: 11 },
  chevronCircle: {
    alignItems: 'center',
    backgroundColor: '#F1F3F3',
    borderRadius: 13,
    bottom: 7,
    height: 25,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 25,
  },
  expandedContent: { gap: 10, paddingTop: 10 },
  mealDivider: { backgroundColor: '#E8ECEB', height: 1 },
  mealNote: {
    color: '#555555',
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  fridgeDetailCard: {
    backgroundColor: '#EEF9F7',
    borderRadius: 8,
    height: 65,
    paddingHorizontal: 10,
    paddingTop: 9,
  },
  fridgeDetailHeader: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  detailTitle: { color: '#333333', fontFamily: fontFamilies.pretendardBold, fontSize: 13 },
  detailBadge: {
    alignItems: 'center',
    backgroundColor: '#D8F2EC',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  detailBadgeText: { color: '#31A990', fontFamily: fontFamilies.pretendardMedium, fontSize: 10 },
  fridgeIngredientRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    height: 30,
    marginTop: 1,
  },
  fridgeIngredient: { color: '#555555', fontFamily: fontFamilies.pretendardMedium, fontSize: 13 },
  intakeCard: { backgroundColor: '#FBF7F1', borderRadius: 8, padding: 10 },
  intakeTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  intakeBadge: {
    alignItems: 'center',
    backgroundColor: '#F2E7D8',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    width: 45,
  },
  intakeBadgeText: { color: '#8E6F4E', fontFamily: fontFamilies.pretendardMedium, fontSize: 10 },
  intakeItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9 },
  intakeItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    height: 50,
    justifyContent: 'center',
    width: 103.3,
  },
  intakeName: {
    color: '#555555',
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 14,
    lineHeight: 17,
  },
  intakeAmount: {
    color: '#777777',
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 10,
    marginTop: 1,
  },
  actions: { flexDirection: 'row', gap: 7.5 },
  actionButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 0.5,
    flexDirection: 'row',
    gap: 4,
    height: 32,
    justifyContent: 'center',
    width: 105,
  },
  actionWide: { width: 125 },
  actionEaten: { backgroundColor: '#FFFFFF', borderColor: '#8EDCCB' },
  actionEatenSelected: { backgroundColor: '#DFF5F0', borderColor: '#49CDB1', borderWidth: 1.5 },
  actionModified: { backgroundColor: '#FFFFFF', borderColor: '#9FBDDE' },
  actionModifiedSelected: { backgroundColor: '#E8F1FA', borderColor: '#78A7DB', borderWidth: 1.5 },
  actionSkipped: { backgroundColor: '#FFFFFF', borderColor: '#C9CECD' },
  actionSkippedSelected: { backgroundColor: '#ECEEEE', borderColor: '#AEB5B3', borderWidth: 1.5 },
  actionText: { fontFamily: fontFamilies.pretendardMedium, fontSize: 13 },
  actionEatenText: { color: '#31A990' },
  actionModifiedText: { color: '#5489D8' },
  actionSkippedText: { color: '#767676' },
});
