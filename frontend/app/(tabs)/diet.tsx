import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  type ImageSourcePropType,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Down from '@/assets/icons/common/chevrons/Down.svg';
import Left from '@/assets/icons/common/chevrons/Left.svg';
import Right from '@/assets/icons/common/chevrons/Right.svg';
import Up from '@/assets/icons/common/chevrons/Up.svg';
import Bmr from '@/assets/icons/data/BMR.svg';
import Fat from '@/assets/icons/data/Fat.svg';
import LeafFill from '@/assets/icons/deco/Leaf_Fill.svg';
import Plant from '@/assets/icons/deco/Plant.svg';
import Moon from '@/assets/icons/day/Moon.svg';
import Star from '@/assets/icons/day/Star.svg';
import Sun from '@/assets/icons/day/Sun.svg';
import FishSimple from '@/assets/icons/food/FishSimple.svg';
import Fridge from '@/assets/icons/feature/Fridge.svg';
import ForkKnife from '@/assets/icons/feature/navigator/Diet.svg';
import Pencil from '@/assets/icons/feature/Pencil_Line.svg';
import Check from '@/assets/icons/system/Check_Fat.svg';
import Prohibit from '@/assets/icons/system/Prohibit.svg';
import Refresh from '@/assets/icons/system/Refresh.svg';
import { CustomScrollIndicator, useCustomScrollIndicator } from '@/src/components/common';
import {
  FridgeManagerSheets,
  type DietSheet,
  type FridgeIngredient,
} from '@/src/components/diet/FridgeManagerSheets';
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
  usedIngredients: string[];
  intake: [string, string][];
};

type NutritionGoal = {
  label: string;
  current: number;
  target: number;
  unit: string;
  Icon: typeof Bmr;
  accentColor: string;
  softColor: string;
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
    color: '#2FAF96',
    image: breakfastImage,
    foods: '현미밥, 연어구이, 두부샐러드, 미역국, 키위',
    tags: ['근육 유지', '혈당 관리', '식이섬유'],
    note: '연어와 두부로 단백질을 보충하고 혈당 부담을 낮춘 구성',
    usedIngredients: ['두부', '현미밥', '토마토'],
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
    color: '#FF7B00',
    image: lunchImage,
    foods: '현미밥, 연어구이, 두부샐러드, 미역국, 키위',
    tags: ['고단백', '건강한 지방', '영양 균형'],
    note: '한 끼에 필요한 단백질과 건강한 지방을 균형 있게 담은 구성',
    usedIngredients: ['두부', '현미밥', '토마토'],
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
    color: '#0066FF',
    image: dinnerImage,
    foods: '현미밥, 닭가슴살구이, 두부버섯볶음, 브로콜리무침',
    tags: ['근육 유지', '혈당 관리', '식이섬유'],
    note: '현미밥과 닭가슴살로 포만감과 영양 균형을 맞춘 구성',
    usedIngredients: ['현미밥', '닭가슴살', '두부', '브로콜리'],
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
    color: '#AA2CD9',
    image: snackImage,
    foods: '그릭요거트, 블루베리, 호두',
    tags: ['고단백', '식이섬유', '건강한 지방'],
    note: '그릭요거트로 단백질을 보충하고 혈당 부담을 낮춘 구성',
    usedIngredients: ['그릭요거트', '블루베리', '호두'],
    intake: [
      ['그릭요거트', '100g'],
      ['블루베리', '10개 (약 30g)'],
      ['호두', '1개 (약 5g)'],
    ],
  },
];

const nutritionGoals: NutritionGoal[] = [
  {
    label: '열량',
    current: 1650,
    target: 1700,
    unit: 'kcal',
    Icon: Bmr,
    accentColor: '#E57373',
    softColor: '#FFF1F1',
  },
  {
    label: '탄수화물',
    current: 210,
    target: 230,
    unit: 'g',
    Icon: Plant,
    accentColor: '#2FAF96',
    softColor: '#E8F8F4',
  },
  {
    label: '단백질',
    current: 30,
    target: 90,
    unit: 'g',
    Icon: FishSimple,
    accentColor: '#0066FF',
    softColor: '#E2EEFF',
  },
  {
    label: '지방',
    current: 45,
    target: 50,
    unit: 'g',
    Icon: Fat,
    accentColor: '#F6D200',
    softColor: '#FFFAE8',
  },
];

const initialFridgeIngredients: FridgeIngredient[] = [
  { id: 'chicken-breast', name: '닭가슴살', icon: 'meat' },
  { id: 'eggs', name: '계란', icon: 'egg' },
  { id: 'tofu', name: '두부', icon: 'bean' },
  { id: 'broccoli', name: '브로콜리', icon: 'vegetable' },
  { id: 'tomato', name: '토마토', icon: 'vegetable' },
  { id: 'onion', name: '양파', icon: 'vegetable' },
  { id: 'avocado', name: '아보카도', icon: 'fruit' },
  { id: 'spinach', name: '시금치', icon: 'vegetable' },
];

const isWeb = Platform.OS === 'web';
const mealCardLayoutDuration = isWeb ? 320 : 200;
const mealCardContentDuration = isWeb ? 320 : 140;
const mealStatusFeedbackDelay = isWeb ? 100 : 60;

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
  if (id === 'dinner') return <Moon color={color} height={20} width={20} />;
  if (id === 'snack') return <Star color={color} height={20} width={20} />;
  return <Sun color={color} height={20} width={20} />;
}

const Goal = memo(function Goal({
  label,
  current,
  target,
  unit,
  Icon,
  accentColor,
  softColor,
}: NutritionGoal) {
  const ratio = target > 0 ? current / target : 0;
  const barProgress = Math.max(0, Math.min(ratio, 1));
  const percentage = Math.round(ratio * 100);

  return (
    <View style={styles.goal}>
      <View style={styles.goalTop}>
        <View style={[styles.goalIcon, { backgroundColor: softColor }]}>
          <Icon color={accentColor} fill={accentColor} height={20} width={20} />
        </View>
        <View style={styles.goalCopy}>
          <View style={styles.goalLabelRow}>
            <Text style={styles.goalLabel}>{label}</Text>
            <View style={[styles.percentageBadge, { backgroundColor: softColor }]}>
              <Text style={[styles.percentageText, { color: accentColor }]}>{percentage}%</Text>
            </View>
          </View>
          <Text style={styles.goalValue}>
            {current.toLocaleString()}{' '}
            <Text style={styles.goalTarget}>
              / {target.toLocaleString()} {unit}
            </Text>
          </Text>
        </View>
      </View>
      <View style={styles.goalTrack}>
        <View
          style={[
            styles.goalFill,
            { backgroundColor: accentColor, width: `${barProgress * 100}%` },
          ]}
        />
      </View>
    </View>
  );
});

function StatusBadge({ status }: { status: MealStatus }) {
  if (status === 'eaten') {
    return (
      <View style={[styles.statusBadge, styles.eatenBadge]}>
        <Check color="#2FAF96" height={13} width={13} />
        <Text style={[styles.statusBadgeText, styles.eatenBadgeText]}>먹었어요</Text>
      </View>
    );
  }
  if (status === 'modified') {
    return (
      <View style={[styles.statusBadge, styles.modifiedBadge]}>
        <Pencil color="#0066FF" height={13} width={13} />
        <Text style={[styles.statusBadgeText, styles.modifiedBadgeText]}>수정하기</Text>
      </View>
    );
  }
  if (status === 'skipped') {
    return (
      <View style={[styles.statusBadge, styles.skippedBadge]}>
        <Prohibit color="#767676" height={13} width={13} />
        <Text style={[styles.statusBadgeText, styles.skippedBadgeText]}>건너뜀</Text>
      </View>
    );
  }
  return (
    <View style={[styles.statusBadge, styles.recommendedBadge]}>
      <Refresh color="#2FAF96" height={13} width={13} />
      <Text style={[styles.statusBadgeText, styles.recommendedBadgeText]}>다른 식단</Text>
    </View>
  );
}

const DIET_TAG_STYLES: Record<
  string,
  { backgroundColor: string; borderColor: string; textColor: string }
> = {
  '근육 유지': { backgroundColor: '#EEF4FF', borderColor: '#AFC8FF', textColor: '#4F7FE8' },
  '혈당 관리': { backgroundColor: '#ECFAF6', borderColor: '#A9E2D4', textColor: '#31A990' },
  '체지방 관리': { backgroundColor: '#FFF3EA', borderColor: '#FFCBAA', textColor: '#EA8245' },
  고단백: { backgroundColor: '#F4F0FF', borderColor: '#D6C7F5', textColor: '#8064C6' },
  식이섬유: { backgroundColor: '#EFF9F1', borderColor: '#BEE3C6', textColor: '#58A870' },
  '건강한 지방': { backgroundColor: '#FFF8E8', borderColor: '#EED99E', textColor: '#C8952F' },
  '나트륨 조절': { backgroundColor: '#FFF0F0', borderColor: '#F3BABA', textColor: '#DD6A6A' },
  '영양 균형': { backgroundColor: '#F2F5F7', borderColor: '#CCD6DC', textColor: '#657783' },
};

const defaultTagStyle = DIET_TAG_STYLES['영양 균형'];

function actionStyle(status: MealStatus, selectedStatus: MealStatus, pressed: boolean) {
  const selected = status === selectedStatus;
  if (status === 'eaten') {
    return [
      styles.actionButton,
      selected ? styles.actionEatenSelected : styles.actionEaten,
      pressed && styles.actionEatenPressed,
    ];
  }
  if (status === 'modified') {
    return [
      styles.actionButton,
      styles.actionWide,
      selected ? styles.actionModifiedSelected : styles.actionModified,
      pressed && styles.actionModifiedPressed,
    ];
  }
  return [
    styles.actionButton,
    selected ? styles.actionSkippedSelected : styles.actionSkipped,
    pressed && styles.actionSkippedPressed,
  ];
}

function getMealAccentColor(meal: Meal, status: MealStatus) {
  switch (status) {
    case 'eaten':
      return '#2FAF96';

    case 'modified':
      return '#0066FF';

    case 'skipped':
      return '#464646';

    case 'recommended':
    default:
      return meal.color;
  }
}

const MealCard = memo(function MealCard({
  meal,
  expanded,
  status,
  onToggle,
  onStatusChange,
  onCollapse,
  onTransitionChange,
}: {
  meal: Meal;
  expanded: boolean;
  status: MealStatus;
  onToggle: (mealId: MealType) => void;
  onStatusChange: (mealId: MealType, status: MealStatus) => void;
  onCollapse: (mealId: MealType) => void;
  onTransitionChange: (mealId: MealType, active: boolean) => void;
}) {
  const [detailHeight, setDetailHeight] = useState(0);
  const [detailProgress] = useState(() => new Animated.Value(expanded ? 1 : 0));
  const [detailOpacity] = useState(() => new Animated.Value(expanded ? 1 : 0));
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousExpanded = useRef(expanded);
  const displayedStatus = status;
  const dimmed = displayedStatus === 'skipped';
  const accentColor = getMealAccentColor(meal, displayedStatus);
  const borderStyle =
    displayedStatus === 'eaten'
      ? styles.mealCardEaten
      : displayedStatus === 'modified'
        ? styles.mealCardModified
        : displayedStatus === 'skipped'
          ? styles.mealCardSkipped
          : null;

  useEffect(
    () => () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (previousExpanded.current === expanded) return;

    // 상세 영역의 실제 높이가 측정되기 전에는
    // expand animation을 시작하지 않는다.
    if (expanded && detailHeight <= 0) return;

    previousExpanded.current = expanded;

    let transitionEnded = false;

    const endTransition = () => {
      if (transitionEnded) return;
      transitionEnded = true;
      onTransitionChange(meal.id, false);
    };

    const heightAnimation = Animated.timing(detailProgress, {
      duration: mealCardLayoutDuration,
      easing: Easing.inOut(Easing.ease),
      toValue: expanded ? 1 : 0,
      useNativeDriver: false,
    });

    const opacityAnimation = Animated.timing(detailOpacity, {
      duration: mealCardContentDuration,
      easing: Easing.inOut(Easing.ease),
      toValue: expanded ? 1 : 0,
      useNativeDriver: false,
    });

    onTransitionChange(meal.id, true);

    const animation = Animated.parallel([heightAnimation, opacityAnimation]);

    animation.start(({ finished }) => {
      if (finished) {
        endTransition();
      }
    });

    return () => {
      animation.stop();
      endTransition();
    };
  }, [detailHeight, detailOpacity, detailProgress, expanded, meal.id, onTransitionChange]);

  const chooseStatus = (nextStatus: MealStatus) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    onStatusChange(meal.id, nextStatus);
    statusTimer.current = setTimeout(() => {
      onCollapse(meal.id);
      statusTimer.current = null;
    }, mealStatusFeedbackDelay);
  };

  const renderDetailContent = () => (
    <>
      <Text style={styles.mealNote}>{meal.note}</Text>
      <View style={styles.mealDivider} />

      <View style={styles.fridgeDetailCard}>
        <View style={styles.fridgeDetailHeader}>
          <View style={styles.detailTitleRow}>
            <LeafFill color="#2FAF96" fill="#2FAF96" height={25} width={25} />
            <Text style={[styles.detailTitle, styles.fridgeDetailTitle]}>냉장고 재료 활용</Text>
          </View>

          <View style={styles.detailBadge}>
            <Text style={styles.detailBadgeText}>{meal.usedIngredients.length}개 활용</Text>
          </View>
        </View>

        <View style={styles.fridgeIngredientRow}>
          <Text style={styles.fridgeIngredient}>{meal.usedIngredients.join(' · ')}</Text>
        </View>
      </View>

      <View style={styles.intakeCard}>
        <View style={styles.intakeTitleRow}>
          <View style={styles.detailTitleRow}>
            <ForkKnife color="#5C4D3C" height={25} width={25} />
            <Text style={[styles.detailTitle, styles.intakeTitle]}>권장 섭취량</Text>
          </View>

          <View style={styles.intakeBadge}>
            <Text style={styles.intakeBadgeText}>1인 기준</Text>
          </View>
        </View>

        <View style={styles.intakeItems}>
          {meal.intake.map(([name, amount]) => (
            <View key={name} style={styles.intakeItem}>
              <Text style={styles.intakeName}>{name}</Text>
              <Text numberOfLines={1} style={styles.intakeAmount}>
                {amount}
              </Text>
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
          style={({ pressed }) => actionStyle('eaten', displayedStatus, pressed)}
        >
          <Check color="#2FAF96" height={15} width={15} />
          <Text style={[styles.actionText, styles.actionEatenText]}>먹었어요</Text>
        </Pressable>

        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            chooseStatus('modified');
          }}
          style={({ pressed }) => actionStyle('modified', displayedStatus, pressed)}
        >
          <Pencil color="#0066FF" height={15} width={15} />
          <Text style={[styles.actionText, styles.actionModifiedText]}>다른 음식 먹었어요</Text>
        </Pressable>

        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            chooseStatus('skipped');
          }}
          style={({ pressed }) => actionStyle('skipped', displayedStatus, pressed)}
        >
          <Prohibit color="#727272" height={15} width={15} />
          <Text style={[styles.actionText, styles.actionSkippedText]}>건너뛰었어요</Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <Pressable
      accessibilityState={{ expanded }}
      onPress={() => onToggle(meal.id)}
      style={[styles.mealCard, borderStyle]}
    >
      <View style={styles.mealSummary}>
        <Image
          resizeMode="cover"
          source={meal.image}
          style={[styles.mealImage, dimmed && styles.skippedContent]}
        />
        <View style={styles.mealRight}>
          <View style={styles.mealMetadataRow}>
            <View style={styles.mealMetadataLeft}>
              <View style={styles.mealNameRow}>
                <MealIcon color={accentColor} id={meal.id} />
                <Text style={[styles.mealTitle, { color: accentColor }]}>{meal.title}</Text>
              </View>
              <View style={styles.mealMetadataDivider} />
              <Text style={styles.mealKcal}>{meal.kcal} kcal</Text>
            </View>
            <Pressable
              hitSlop={6}
              onPress={(event) => event.stopPropagation()}
              style={styles.statusPressable}
            >
              <StatusBadge status={displayedStatus} />
            </Pressable>
          </View>
          <View style={styles.mealBottomRow}>
            <View style={[styles.mealCopy, dimmed && styles.skippedContent]}>
              <Text numberOfLines={2} style={styles.foodsText}>
                {meal.foods}
              </Text>
              <View style={styles.tags}>
                {meal.tags.map((tag) => {
                  const palette = DIET_TAG_STYLES[tag] ?? defaultTagStyle;
                  return (
                    <View
                      key={tag}
                      style={[
                        styles.tag,
                        {
                          backgroundColor: palette.backgroundColor,
                          borderColor: palette.borderColor,
                        },
                      ]}
                    >
                      <Text style={[styles.tagText, { color: palette.textColor }]}>{tag}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={styles.chevronArea}>
              <View style={styles.chevronCircle}>
                {expanded ? (
                  <Up color="#2FAF96" height={15} width={15} />
                ) : (
                  <Down color="#2FAF96" height={15} width={15} />
                )}
              </View>
            </View>
          </View>
        </View>
      </View>

      {detailHeight === 0 ? (
        <View
          collapsable={false}
          pointerEvents="none"
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;

            if (nextHeight > 0) {
              setDetailHeight(nextHeight);
            }
          }}
          style={styles.expandedMeasure}
        >
          <View style={styles.expandedContent}>{renderDetailContent()}</View>
        </View>
      ) : null}

      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        style={[
          styles.expandedClip,
          {
            height:
              detailHeight > 0
                ? detailProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, detailHeight],
                  })
                : 0,
            opacity: detailOpacity,
          },
        ]}
      >
        <View style={styles.expandedContent}>{renderDetailContent()}</View>
      </Animated.View>
    </Pressable>
  );
});

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
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [activeSheet, setActiveSheet] = useState<DietSheet>(null);
  const [fridgeIngredients, setFridgeIngredients] =
    useState<FridgeIngredient[]>(initialFridgeIngredients);
  const activeMealTransitions = useRef(new Set<MealType>());
  const pendingCanvasHeight = useRef(0);

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
  const fridgePreview = fridgeIngredients
    .slice(0, 5)
    .map((item) => item.name)
    .join(' · ');
  const fridgeRemainder = Math.max(0, fridgeIngredients.length - 5);
  const fridgeDescription =
    fridgeIngredients.length === 0
      ? '등록된 재료가 없어요'
      : `${fridgePreview}${fridgeRemainder > 0 ? ` 외 ${fridgeRemainder}개` : ''}`;

  const handleMealTransitionChange = useCallback((mealId: MealType, active: boolean) => {
    if (active) {
      activeMealTransitions.current.add(mealId);
      return;
    }

    activeMealTransitions.current.delete(mealId);
    if (activeMealTransitions.current.size === 0 && pendingCanvasHeight.current > 0) {
      const nextHeight = pendingCanvasHeight.current;
      setCanvasHeight((currentHeight) =>
        Math.abs(currentHeight - nextHeight) < 0.5 ? currentHeight : nextHeight,
      );
    }
  }, []);

  const handleCanvasLayout = useCallback((height: number) => {
    pendingCanvasHeight.current = height;
    if (activeMealTransitions.current.size > 0) return;

    setCanvasHeight((currentHeight) =>
      Math.abs(currentHeight - height) < 0.5 ? currentHeight : height,
    );
  }, []);

  const toggleMeal = useCallback((mealId: MealType) => {
    setExpandedMeals((current) => {
      const next = new Set(current);
      if (next.has(mealId)) next.delete(mealId);
      else next.add(mealId);
      return next;
    });
  }, []);

  const changeMealStatus = useCallback(
    (mealId: MealType, status: MealStatus) => {
      setStatusesByDate((current) => ({
        ...current,
        [selectedDateKey]: {
          ...(current[selectedDateKey] ?? defaultMealStatuses),
          [mealId]: status,
        },
      }));
    },
    [selectedDateKey],
  );

  const collapseMeal = useCallback((mealId: MealType) => {
    setExpandedMeals((current) => {
      if (!current.has(mealId)) return current;
      const next = new Set(current);
      next.delete(mealId);
      return next;
    });
  }, []);

  const chooseDate = (key: string) => {
    setSelectedDateKey(key);
    if (expandedMeals.size > 0) {
      setExpandedMeals(new Set());
    }
  };

  const moveDateWindow = (amount: number) => {
    const nextWindowStart = Math.max(
      dateWindowMin,
      Math.min(dateWindowMax, dateWindowStart + amount),
    );
    setDateWindowStart(nextWindowStart);
  };

  return (
    <View style={[styles.root, Platform.OS === 'web' && styles.webViewport]}>
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
        style={Platform.OS === 'web' ? styles.webScrollViewport : undefined}
      >
        <View style={[styles.canvasSlot, { height: canvasHeight * widthScale }]}>
          <View
            onLayout={(event) => handleCanvasLayout(event.nativeEvent.layout.height)}
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
              <Pressable
                accessibilityLabel="냉장고 재료 관리 열기"
                accessibilityRole="button"
                onPress={() => setActiveSheet('fridge')}
                style={({ pressed }) => [styles.fridgeCard, pressed && styles.pressed]}
              >
                <View style={styles.fridgeIconCircle}>
                  <Fridge color="#2FAF96" height={25} width={17} />
                </View>
                <View style={styles.fridgeCopy}>
                  <Text style={styles.fridgeTitle}>
                    <Text style={styles.fridgeTitleEmphasis}>
                      냉장고 재료 {fridgeIngredients.length}개
                    </Text>{' '}
                    활용 중
                  </Text>
                  <Text numberOfLines={1} style={styles.fridgeDescription}>
                    {fridgeDescription}
                  </Text>
                </View>
                <View style={styles.manageRow}>
                  <Text style={styles.manageText}>관리하기</Text>
                  <Right color="#767676" height={15} width={15} />
                </View>
              </Pressable>

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
                  <Left color="#2FAF96" height={15} width={15} />
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
                          {selected ? <View style={styles.dateSelectedLine} /> : null}
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
                  <Right color="#2FAF96" height={15} width={15} />
                </Pressable>
              </View>

              <View style={styles.nutritionCard}>
                <View style={styles.nutritionHeading}>
                  <Text style={styles.nutritionTitle}>오늘의 영양 목표</Text>
                  <Text style={styles.nutritionDescription}>
                    근손실 방지를 위해 단백질 비중을 높였어요
                  </Text>
                </View>
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
                    onCollapse={collapseMeal}
                    onStatusChange={changeMealStatus}
                    onToggle={toggleMeal}
                    onTransitionChange={handleMealTransitionChange}
                    status={selectedStatuses[meal.id]}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      <CustomScrollIndicator {...indicator.indicatorProps} color="rgba(73, 205, 177, 0.56)" />
      <FridgeManagerSheets
        activeSheet={activeSheet}
        ingredients={fridgeIngredients}
        onActiveSheetChange={setActiveSheet}
        onIngredientsChange={setFridgeIngredients}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA', overflow: 'hidden' },
  webViewport: { height: '100%', maxHeight: '100%', minHeight: 0 },
  webScrollViewport: { flex: 1, maxHeight: '100%', minHeight: 0 },
  canvasSlot: { position: 'relative', width: '100%' },
  canvas: {
    alignSelf: 'flex-start',
    position: 'absolute',
    transformOrigin: 'top left',
    width: referenceWidth,
  },
  screenTitle: {
    color: '#464646',
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
    letterSpacing: 1.5,
    lineHeight: 20,
    textAlign: 'center',
    width: referenceWidth,
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
    borderRadius: 20,
    height: 20,
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  strategyBadgeText: {
    color: '#31A990',
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
  },
  heroTitle: {
    color: '#464646',
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
    lineHeight: 27,
    marginTop: 5,
  },
  primaryText: { color: '#31A990' },
  heroDescription: {
    color: '#767676',
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 9,
  },
  heroImage: { height: 105, position: 'absolute', right: 19, top: 18, width: 170 },
  sectionStack: { gap: 10, marginHorizontal: 21 },
  fridgeCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5EAE9',
    borderRadius: 10,
    borderWidth: 1,
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
  fridgeTitle: { color: '#000000', fontFamily: fontFamilies.pretendardMedium, fontSize: 14 },
  fridgeTitleEmphasis: { color: '#2FAF96', fontFamily: fontFamilies.pretendardSemiBold },
  fridgeDescription: {
    color: '#767676',
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 11,
    marginTop: 5,
  },
  manageRow: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  manageText: { color: '#767676', fontFamily: fontFamilies.pretendardSemiBold, fontSize: 11.5 },
  dateCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5EAE9',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    height: 70,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  arrowButton: {
    alignItems: 'center',
    backgroundColor: '#E8F8F4',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  arrowDisabled: { opacity: 0.3 },
  pressed: { opacity: 0.7 },
  dateChoices: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    width: 258,
  },
  dateChoiceWrap: { alignItems: 'center', flexDirection: 'row', gap: 8 },
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
    color: '#767676',
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
    marginTop: 4,
  },
  dateValueSelected: {
    color: '#464646',
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 13,
  },
  dateSelectedLine: {
    backgroundColor: '#2FAF96',
    borderRadius: 1,
    height: 2,
    marginTop: 7,
    width: 35,
  },
  nutritionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5EAE9',
    borderRadius: 10,
    borderWidth: 1,
    height: 215,
    paddingBottom: 20,
    paddingHorizontal: 17,
    paddingTop: 15,
  },
  nutritionHeading: { gap: 3 },
  nutritionTitle: {
    color: '#464646',
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 18,
    lineHeight: 17,
  },
  nutritionDescription: {
    color: '#767676',
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    letterSpacing: 1.3,
    lineHeight: 16,
  },
  goalsGrid: {
    columnGap: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 5,
    marginTop: 5,
    rowGap: 10,
    width: 326,
  },
  goal: {
    alignItems: 'center',
    gap: 12,
    height: 70,
    justifyContent: 'center',
    width: 158,
  },
  goalTop: { alignItems: 'flex-start', flexDirection: 'row', gap: 5, width: '100%' },
  goalIcon: {
    alignItems: 'center',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  goalCopy: { flex: 1, gap: 3, justifyContent: 'center' },
  goalLabelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  goalLabel: { color: '#464646', fontFamily: fontFamilies.pretendardSemiBold, fontSize: 14 },
  percentageBadge: {
    alignItems: 'center',
    borderRadius: 8,
    height: 17,
    justifyContent: 'center',
    width: 40,
  },
  percentageText: { fontFamily: fontFamilies.pretendardSemiBold, fontSize: 12 },
  goalValue: {
    color: '#464646',
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 15,
  },
  goalTarget: { color: '#767676', fontFamily: fontFamilies.pretendardMedium, fontSize: 12 },
  goalTrack: {
    backgroundColor: '#E5EAE9',
    borderRadius: 3,
    height: 5,
    overflow: 'hidden',
    width: '100%',
  },
  goalFill: { borderRadius: 3, height: 5 },
  mealSectionTitle: {
    color: '#464646',
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 18,
    marginBottom: 1,
    marginTop: 4,
  },
  mealList: { gap: 10 },
  mealCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5EAE9',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  mealCardEaten: { borderColor: '#49CDB1', borderWidth: 2 },
  mealCardModified: { borderColor: '#5FA0FB', borderWidth: 2 },
  mealCardSkipped: { borderColor: '#E5EAE9' },
  mealSummary: { flexDirection: 'row', gap: 13, height: 110, width: 350 },
  mealRight: { flex: 1, gap: 17, height: 110 },
  mealMetadataRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mealMetadataLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 130,
  },
  mealNameRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  mealMetadataDivider: { backgroundColor: '#E5EAE9', height: 12, width: 1 },
  mealTitle: { fontFamily: fontFamilies.pretendardBold, fontSize: 15 },
  mealKcal: {
    color: '#464646',
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
  },
  statusPressable: { borderRadius: 10 },
  statusBadge: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 3,
    height: 20,
    justifyContent: 'center',
    width: 75,
  },
  statusBadgeText: { fontFamily: fontFamilies.pretendardSemiBold, fontSize: 12 },
  recommendedBadge: { backgroundColor: '#E8F8F4' },
  recommendedBadgeText: { color: '#2FAF96' },
  eatenBadge: { backgroundColor: '#E8F8F4' },
  eatenBadgeText: { color: '#2FAF96' },
  modifiedBadge: { backgroundColor: '#E2EEFF' },
  modifiedBadgeText: { color: '#0066FF' },
  skippedBadge: { backgroundColor: '#EAEAEA' },
  skippedBadgeText: { color: '#767676' },
  skippedContent: { opacity: 0.5 },
  mealImage: { backgroundColor: '#F3F5F4', borderRadius: 10, height: 110, width: 110 },
  mealBottomRow: { flex: 1, flexDirection: 'row' },
  mealCopy: { flex: 1, justifyContent: 'space-between' },
  foodsText: {
    color: '#464646',
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 17,
    lineHeight: 21,
    width: 200,
  },
  tags: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 3, width: 200 },
  tag: {
    borderRadius: 10,
    borderWidth: 0.5,
    height: 20,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tagText: { fontFamily: fontFamilies.pretendardMedium, fontSize: 12 },
  chevronArea: { alignItems: 'center', alignSelf: 'stretch', paddingTop: 10, width: 25 },
  chevronCircle: {
    alignItems: 'center',
    backgroundColor: '#E8F8F4',
    borderRadius: 12.5,
    height: 25,
    justifyContent: 'center',
    width: 25,
  },
  expandedClip: { overflow: 'hidden' },
  expandedMeasure: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 122,
    opacity: 0,
    zIndex: -1,
  },
  expandedContent: { gap: 12, paddingTop: 12 },
  mealDivider: { backgroundColor: '#E5EAE9', height: 1 },
  mealNote: {
    color: '#767676',
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
  },
  fridgeDetailCard: {
    backgroundColor: '#EEF9F7',
    borderRadius: 10,
    height: 65,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  fridgeDetailHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  detailTitle: { fontFamily: fontFamilies.pretendardSemiBold, fontSize: 14 },
  fridgeDetailTitle: { color: '#2FAF96' },
  detailBadge: {
    alignItems: 'center',
    backgroundColor: '#DBF4ED',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    width: 50,
  },
  detailBadgeText: { color: '#2FAF96', fontFamily: fontFamilies.pretendardMedium, fontSize: 12 },
  fridgeIngredientRow: {
    alignItems: 'center',
    backgroundColor: '#F7FCFB',
    borderRadius: 7,
    flexDirection: 'row',
    height: 25,
    marginTop: 5,
    paddingLeft: 20,
  },
  fridgeIngredient: { color: '#464646', fontFamily: fontFamilies.pretendardMedium, fontSize: 14 },
  intakeCard: { backgroundColor: '#FBF7F1', borderRadius: 10, gap: 10, padding: 10 },
  intakeTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  intakeTitle: { color: '#5C4D3C' },
  intakeBadge: {
    alignItems: 'center',
    backgroundColor: '#EFECE7',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    width: 50,
  },
  intakeBadgeText: { color: '#767676', fontFamily: fontFamilies.pretendardMedium, fontSize: 12 },
  intakeItems: {
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    columnGap: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
    width: '100%',
  },
  intakeItem: {
    alignItems: 'flex-start',
    backgroundColor: '#FCFBF9',
    borderRadius: 10,
    flexBasis: '48.4%',
    flexGrow: 0,
    flexShrink: 0,
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: 10,
    maxWidth: '48.4%',
  },
  intakeName: {
    color: '#767676',
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
    lineHeight: 17,
  },
  intakeAmount: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 15,
    lineHeight: 18,
    marginTop: 2,
    width: '100%',
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  actionButton: {
    alignItems: 'center',
    borderRadius: 5,
    borderWidth: 0.5,
    flexDirection: 'row',
    gap: 4,
    height: 32,
    justifyContent: 'center',
    width: 103,
  },
  actionWide: { width: 135 },
  actionEaten: { backgroundColor: '#FFFFFF', borderColor: '#2FAF96' },
  actionEatenSelected: { backgroundColor: '#E8F8F4', borderColor: '#2FAF96' },
  actionEatenPressed: { backgroundColor: '#E8F8F4', borderColor: '#2FAF96' },
  actionModified: { backgroundColor: '#FFFFFF', borderColor: '#0066FF' },
  actionModifiedSelected: { backgroundColor: '#E2EEFF', borderColor: '#0066FF' },
  actionModifiedPressed: { backgroundColor: '#E2EEFF', borderColor: '#0066FF' },
  actionSkipped: { backgroundColor: '#FFFFFF', borderColor: '#727272' },
  actionSkippedSelected: { backgroundColor: '#F4F4F4', borderColor: '#727272' },
  actionSkippedPressed: { backgroundColor: '#F4F4F4', borderColor: '#727272' },
  actionText: { fontFamily: fontFamilies.pretendardMedium, fontSize: 14 },
  actionEatenText: { color: '#2FAF96' },
  actionModifiedText: { color: '#0066FF' },
  actionSkippedText: { color: '#727272' },
});
