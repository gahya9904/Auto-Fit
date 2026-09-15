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
import { MealRecordSheets, type MealRecordDraft } from '@/src/components/diet/MealRecordSheets';
import {
  BOTTOM_NAVIGATION_MIN_BOTTOM_GAP,
  getBottomNavigationVisualHeight,
} from '@/src/components/navigation';
import { colors, fontFamilies } from '@/src/theme';

const hero = require('../../assets/images/illustrations/diet/Diet.png');
const breakfastImage = require('../../assets/images/illustrations/temp/Image_MealPicture_1.png');
const emptyFoodImage = require('../../assets/images/illustrations/diet/EmptyFood.png');
const lunchImage = breakfastImage;
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
  variantId: string;
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
    variantId: 'breakfast-default',
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
    variantId: 'lunch-default',
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
    variantId: 'dinner-default',
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
    variantId: 'snack-default',
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

const mealRecommendations: Record<MealType, Meal[]> = {
  breakfast: [
    meals[0],
    {
      ...meals[0],
      variantId: 'breakfast-oatmeal',
      image: snackImage,
      kcal: 430,
      foods: '오트밀, 그릭요거트, 블루베리, 삶은 달걀',
      tags: ['고단백', '식이섬유', '혈당 관리'],
      note: '오트밀과 그릭요거트로 포만감을 높이고 아침 혈당 부담을 낮춘 구성',
      usedIngredients: ['계란', '블루베리'],
      intake: [
        ['오트밀', '1그릇 (약 50g)'],
        ['그릭요거트', '100g'],
        ['블루베리', '한 줌 (약 40g)'],
        ['삶은 달걀', '1개'],
      ],
    },
    {
      ...meals[0],
      variantId: 'breakfast-toast',
      image: breakfastImage,
      kcal: 460,
      foods: '통밀토스트, 닭가슴살, 아보카도, 토마토',
      tags: ['근육 유지', '건강한 지방', '영양 균형'],
      note: '통밀과 닭가슴살에 건강한 지방을 더해 든든하게 시작하는 아침 식단',
      usedIngredients: ['닭가슴살', '아보카도', '토마토'],
      intake: [
        ['통밀토스트', '2장'],
        ['닭가슴살', '1조각 (약 100g)'],
        ['아보카도', '1/2개'],
        ['토마토', '1개'],
      ],
    },
    {
      ...meals[0],
      variantId: 'breakfast-sweet-potato',
      image: dinnerImage,
      kcal: 450,
      foods: '고구마, 닭가슴살 샐러드, 삶은 달걀, 사과',
      tags: ['근육 유지', '식이섬유', '체지방 관리'],
      note: '복합 탄수화물과 단백질을 균형 있게 담아 오전 에너지를 유지하는 구성',
      usedIngredients: ['닭가슴살', '계란', '시금치'],
      intake: [
        ['고구마', '1개 (약 150g)'],
        ['닭가슴살 샐러드', '1접시'],
        ['삶은 달걀', '1개'],
        ['사과', '1/2개'],
      ],
    },
  ],
  lunch: [
    meals[1],
    {
      ...meals[1],
      variantId: 'lunch-chicken-rice',
      image: breakfastImage,
      kcal: 510,
      foods: '현미밥, 닭가슴살구이, 채소볶음, 된장국',
      tags: ['고단백', '근육 유지', '영양 균형'],
      note: '현미밥과 닭가슴살을 중심으로 오후 활동에 필요한 에너지를 채운 구성',
      usedIngredients: ['현미밥', '닭가슴살', '브로콜리', '양파'],
      intake: [
        ['현미밥', '1공기 (약 150g)'],
        ['닭가슴살구이', '1조각 (약 120g)'],
        ['채소볶음', '1접시'],
        ['된장국', '1그릇'],
      ],
    },
    {
      ...meals[1],
      variantId: 'lunch-beef-bibimbap',
      image: dinnerImage,
      kcal: 540,
      foods: '소고기 채소 비빔밥, 두부구이, 방울토마토',
      tags: ['근육 유지', '식이섬유', '나트륨 조절'],
      note: '살코기와 다양한 채소를 한 그릇에 담아 단백질과 식이섬유를 보충한 식단',
      usedIngredients: ['두부', '토마토', '시금치'],
      intake: [
        ['소고기 채소 비빔밥', '1그릇'],
        ['두부구이', '4조각'],
        ['방울토마토', '5개'],
      ],
    },
    {
      ...meals[1],
      variantId: 'lunch-tofu-bowl',
      image: snackImage,
      kcal: 490,
      foods: '두부 버섯 덮밥, 브로콜리무침, 달걀국',
      tags: ['식이섬유', '혈당 관리', '영양 균형'],
      note: '두부와 버섯으로 포만감을 높이고 부담 없이 먹을 수 있게 구성한 점심 식단',
      usedIngredients: ['두부', '브로콜리', '계란'],
      intake: [
        ['두부 버섯 덮밥', '1그릇'],
        ['브로콜리무침', '1접시'],
        ['달걀국', '1그릇'],
      ],
    },
  ],
  dinner: [
    meals[2],
    {
      ...meals[2],
      variantId: 'dinner-salmon',
      image: breakfastImage,
      kcal: 500,
      foods: '연어구이, 렌틸콩 샐러드, 구운 채소',
      tags: ['고단백', '건강한 지방', '체지방 관리'],
      note: '연어의 단백질과 건강한 지방을 활용해 저녁 포만감을 높인 구성',
      usedIngredients: ['브로콜리', '토마토', '양파'],
      intake: [
        ['연어구이', '1토막 (약 120g)'],
        ['렌틸콩 샐러드', '1접시'],
        ['구운 채소', '1접시'],
      ],
    },
    {
      ...meals[2],
      variantId: 'dinner-chicken-salad',
      image: dinnerImage,
      kcal: 470,
      foods: '닭가슴살 샐러드, 단호박구이, 두부스테이크',
      tags: ['근육 유지', '식이섬유', '나트륨 조절'],
      note: '지방 부담은 낮추고 단백질과 채소 비중을 높인 가벼운 저녁 식단',
      usedIngredients: ['닭가슴살', '두부', '브로콜리'],
      intake: [
        ['닭가슴살 샐러드', '1접시'],
        ['단호박구이', '4조각'],
        ['두부스테이크', '1개'],
      ],
    },
    {
      ...meals[2],
      variantId: 'dinner-tofu-stew',
      image: snackImage,
      kcal: 490,
      foods: '잡곡밥, 두부 채소전골, 시금치무침',
      tags: ['혈당 관리', '식이섬유', '영양 균형'],
      note: '잡곡과 두부를 중심으로 늦은 시간에도 부담이 적도록 구성한 저녁 식단',
      usedIngredients: ['두부', '시금치', '양파'],
      intake: [
        ['잡곡밥', '2/3공기'],
        ['두부 채소전골', '1그릇'],
        ['시금치무침', '1접시'],
      ],
    },
  ],
  snack: [
    meals[3],
    {
      ...meals[3],
      variantId: 'snack-yogurt',
      image: snackImage,
      kcal: 210,
      foods: '그릭요거트, 딸기, 아몬드',
      tags: ['고단백', '건강한 지방', '혈당 관리'],
      note: '단백질과 건강한 지방을 소량 보충해 포만감을 유지하는 간식',
      usedIngredients: ['그릭요거트'],
      intake: [
        ['그릭요거트', '100g'],
        ['딸기', '5개'],
        ['아몬드', '8알'],
      ],
    },
    {
      ...meals[3],
      variantId: 'snack-egg-tomato',
      image: breakfastImage,
      kcal: 190,
      foods: '삶은 달걀, 방울토마토, 호두',
      tags: ['근육 유지', '나트륨 조절', '건강한 지방'],
      note: '간단한 재료로 단백질을 채우고 당 섭취를 낮춘 간식 구성',
      usedIngredients: ['계란', '토마토'],
      intake: [
        ['삶은 달걀', '1개'],
        ['방울토마토', '6개'],
        ['호두', '2알'],
      ],
    },
    {
      ...meals[3],
      variantId: 'snack-apple-cheese',
      image: dinnerImage,
      kcal: 220,
      foods: '사과, 저지방 치즈, 무가당 두유',
      tags: ['영양 균형', '식이섬유', '체지방 관리'],
      note: '과일과 단백질 식품을 함께 구성해 간식의 당 흡수를 완만하게 조절한 구성',
      usedIngredients: [],
      intake: [
        ['사과', '1/2개'],
        ['저지방 치즈', '1장'],
        ['무가당 두유', '1팩'],
      ],
    },
  ],
};

function getRandomMockMeal(mealId: MealType, currentVariantId: string) {
  const candidates = mealRecommendations[mealId].filter(
    (recommendation) => recommendation.variantId !== currentVariantId,
  );
  return candidates[Math.floor(Math.random() * candidates.length)];
}

type RecommendedMealsByDate = Record<string, Partial<Record<MealType, Meal>>>;

function applyRecommendedMeal(
  current: RecommendedMealsByDate,
  dateKey: string,
  mealId: MealType,
  recommendation: Meal,
) {
  return {
    ...current,
    [dateKey]: {
      ...(current[dateKey] ?? {}),
      [mealId]: recommendation,
    },
  };
}

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
    accentColor: '#2FAF96',
    softColor: '#E8F8F4',
  },
  {
    label: '지방',
    current: 45,
    target: 50,
    unit: 'g',
    Icon: Fat,
    accentColor: '#2FAF96',
    softColor: '#E8F8F4',
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
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (offset === 0)
    return { label: `오늘 (${weekday})`, date: `${month}월 ${day}일 ${weekday}요일` };
  if (offset === -1)
    return { label: `어제 (${weekday})`, date: `${month}월 ${day}일 ${weekday}요일` };
  if (offset === 1)
    return { label: `내일 (${weekday})`, date: `${month}월 ${day}일 ${weekday}요일` };
  return { label: `${weekday}요일`, date: `${month}월 ${day}일 ${weekday}요일` };
}

function MealIcon({ id, color }: { id: MealType; color: string }) {
  if (id === 'dinner') return <Moon color={color} height={20} width={20} />;
  if (id === 'snack') return <Star color={color} height={20} width={20} />;
  return <Sun color={color} height={20} width={20} />;
}

const CalorieGoal = memo(function CalorieGoal({
  current,
  target,
  unit,
  Icon,
  accentColor,
  softColor,
}: NutritionGoal) {
  const ratio = target > 0 ? current / target : 0;
  const barProgress = Math.max(0, Math.min(ratio, 1));

  return (
    <View style={styles.calorieGoal}>
      <View style={styles.calorieGoalTop}>
        <View style={[styles.nutritionIcon, { backgroundColor: softColor }]}>
          <Icon color={accentColor} height={20} width={20} />
        </View>
        <Text style={styles.calorieValue}>
          {current.toLocaleString()}{' '}
          <Text style={styles.calorieTarget}>
            / {target.toLocaleString()} {unit}
          </Text>
        </Text>
      </View>
      <View style={styles.calorieTrack}>
        <View
          style={[
            styles.calorieFill,
            { backgroundColor: accentColor, width: `${barProgress * 100}%` },
          ]}
        />
      </View>
    </View>
  );
});

const MacroGoal = memo(function MacroGoal({
  label,
  current,
  target,
  unit,
  Icon,
  accentColor,
  softColor,
}: NutritionGoal) {
  return (
    <View style={styles.macroGoal}>
      <View style={[styles.nutritionIcon, { backgroundColor: softColor }]}>
        <Icon color={accentColor} fill={accentColor} height={20} width={20} />
      </View>
      <View style={styles.macroCopy}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {current.toLocaleString()}{' '}
          <Text style={styles.macroTarget}>
            / {target.toLocaleString()} {unit}
          </Text>
        </Text>
      </View>
    </View>
  );
});

function StatusBadge({ status, pressed = false }: { status: MealStatus; pressed?: boolean }) {
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
      <View
        style={[styles.statusBadge, styles.modifiedBadge, pressed && styles.modifiedBadgePressed]}
      >
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
  recordedMeal,
  onToggle,
  onStatusChange,
  onRecordOtherMeal,
  onRequestAlternativeMeal,
  onCollapse,
  onTransitionChange,
}: {
  meal: Meal;
  expanded: boolean;
  status: MealStatus;
  recordedMeal?: MealRecordDraft;
  onToggle: (mealId: MealType) => void;
  onStatusChange: (mealId: MealType, status: MealStatus) => void;
  onRecordOtherMeal: (mealId: MealType) => void;
  onRequestAlternativeMeal: (mealId: MealType) => void;
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
  const showsRecordedMeal = displayedStatus === 'modified' && recordedMeal !== undefined;
  const displayedFoods = showsRecordedMeal
    ? recordedMeal.foods.map((food) => food.name).join(', ')
    : meal.foods;
  const displayedKcal = showsRecordedMeal ? recordedMeal.kcal : meal.kcal;
  const displayedImage = showsRecordedMeal
    ? recordedMeal.photoUri
      ? { uri: recordedMeal.photoUri }
      : emptyFoodImage
    : meal.image;
  const displayedUsedIngredients = showsRecordedMeal
    ? recordedMeal.usedIngredients
    : meal.usedIngredients;
  const displayedIntake = showsRecordedMeal ? recordedMeal.intake : meal.intake;
  useEffect(
    () => () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    },
    [],
  );

  // 접힘 상태에서는 detailHeight가 다시 측정돼도 진행 중인 collapse를 재시작하지 않는다.
  // 펼침 시작에만 실제 측정 높이가 필요하다.
  const canAnimateDetail = !expanded || detailHeight > 0;

  useEffect(() => {
    if (previousExpanded.current === expanded) return;

    // 상세 영역의 실제 높이가 측정되기 전에는
    // expand animation을 시작하지 않는다.
    if (!canAnimateDetail) return;

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
  }, [canAnimateDetail, detailOpacity, detailProgress, expanded, meal.id, onTransitionChange]);

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
      <View style={styles.mealDivider} />
      <View style={styles.fridgeDetailCard}>
        <View style={styles.fridgeDetailHeader}>
          <View style={styles.detailTitleRow}>
            <LeafFill color="#2FAF96" fill="#2FAF96" height={25} width={25} />
            <Text style={[styles.detailTitle, styles.fridgeDetailTitle]}>냉장고 재료 활용</Text>
          </View>

          <View style={styles.detailBadge}>
            <Text style={styles.detailBadgeText}>{displayedUsedIngredients.length}개 활용</Text>
          </View>
        </View>

        <View style={styles.fridgeIngredientRow}>
          <Text style={styles.fridgeIngredient}>
            {displayedUsedIngredients.length > 0
              ? displayedUsedIngredients.join(' · ')
              : '분석된 재료가 없어요'}
          </Text>
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
          {displayedIntake.map(([name, amount]) => (
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
          disabled={displayedStatus === 'modified'}
          onPress={(event) => {
            event.stopPropagation();
            if (displayedStatus === 'modified') return;
            onRecordOtherMeal(meal.id);
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
      style={[
        styles.mealCard,
        Platform.OS === 'web' && styles.mealCardWeb,
      ]}
    >
      {displayedStatus === 'eaten' ? (
        <View pointerEvents="none" style={[styles.selectedCardBorder, styles.eatenCardBorder]} />
      ) : null}

      {displayedStatus === 'modified' ? (
        <View pointerEvents="none" style={[styles.selectedCardBorder, styles.modifiedCardBorder]} />
      ) : null}

      <View style={styles.mealSummary}>
        <Image
          resizeMode="cover"
          source={displayedImage}
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
              <Text style={styles.mealKcal}>{displayedKcal} kcal</Text>
            </View>
            <Pressable
              accessibilityRole={
                displayedStatus === 'recommended' || displayedStatus === 'modified'
                  ? 'button'
                  : undefined
              }
              disabled={displayedStatus === 'eaten' || displayedStatus === 'skipped'}
              hitSlop={6}
              onPress={(event) => {
                event.stopPropagation();
                if (displayedStatus === 'recommended') {
                  onRequestAlternativeMeal(meal.id);
                  return;
                }
                if (displayedStatus === 'modified') onRecordOtherMeal(meal.id);
              }}
              style={({ pressed }) => [
                styles.statusPressable,
                displayedStatus === 'recommended' && pressed && styles.pressed,
              ]}
            >
              {({ pressed }) => (
                <StatusBadge
                  pressed={displayedStatus === 'modified' && pressed}
                  status={displayedStatus}
                />
              )}
            </Pressable>
          </View>
          <View style={styles.mealBottomRow}>
            <View style={[styles.mealCopy, dimmed && styles.skippedContent]}>
              <Text numberOfLines={2} style={styles.foodsText}>
                {displayedFoods}
              </Text>
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

      <View
        accessibilityElementsHidden
        collapsable={false}
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        onLayout={(event) => {
          const nextHeight = event.nativeEvent.layout.height;
          if (nextHeight <= 0) return;

          setDetailHeight((currentHeight) =>
            Math.abs(currentHeight - nextHeight) < 0.5 ? currentHeight : nextHeight,
          );
        }}
        style={styles.expandedMeasure}
      >
        <View style={styles.expandedContent}>{renderDetailContent()}</View>
      </View>

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
  const [selectedDateOffset, setSelectedDateOffset] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(today));
  const [expandedMeals, setExpandedMeals] = useState<Set<MealType>>(() => new Set());
  const [statusesByDate, setStatusesByDate] = useState<Record<string, MealStatuses>>({});
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [activeSheet, setActiveSheet] = useState<DietSheet>(null);
  const [recordingMealId, setRecordingMealId] = useState<MealType | null>(null);
  const [mealRecordsByDate, setMealRecordsByDate] = useState<
    Record<string, Partial<Record<MealType, MealRecordDraft>>>
  >({});
  const [recommendedMealsByDate, setRecommendedMealsByDate] = useState<RecommendedMealsByDate>({});
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
  const selectedDate = addDays(today, selectedDateOffset);
  const selectedDateCopy = getDateCopy(selectedDate, selectedDateOffset);

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

  const openMealRecord = useCallback((mealId: MealType) => {
    setRecordingMealId(mealId);
  }, []);

  const requestAlternativeMeal = useCallback(
    (mealId: MealType) => {
      setRecommendedMealsByDate((current) => {
        const currentMeal = current[selectedDateKey]?.[mealId] ?? mealRecommendations[mealId][0];
        const nextMeal = getRandomMockMeal(mealId, currentMeal.variantId);
        return applyRecommendedMeal(current, selectedDateKey, mealId, nextMeal);
      });
    },
    [selectedDateKey],
  );

  const completeMealRecord = useCallback(
    (draft: MealRecordDraft) => {
      const mealId = draft.mealId as MealType;

      setMealRecordsByDate((current) => ({
        ...current,
        [selectedDateKey]: {
          ...(current[selectedDateKey] ?? {}),
          [mealId]: draft,
        },
      }));
      changeMealStatus(mealId, 'modified');
      setRecordingMealId(null);
      collapseMeal(mealId);
    },
    [changeMealStatus, collapseMeal, selectedDateKey],
  );

  const moveSelectedDate = (amount: number) => {
    const nextOffset = Math.max(
      dateWindowMin,
      Math.min(dateWindowMax, selectedDateOffset + amount),
    );
    if (nextOffset === selectedDateOffset) return;

    setSelectedDateOffset(nextOffset);
    setSelectedDateKey(toDateKey(addDays(today, nextOffset)));
    setExpandedMeals(new Set());
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
                <Text style={styles.heroTitle}>
                  OO님을 위한{`\n`}
                  <Text style={styles.primaryText}>맞춤 식단</Text>이에요!
                </Text>
                <Text style={styles.heroDescription}>근육은 지키고, 체지방은 천천히</Text>
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
                  <Fridge color="#2FAF96" height={30} width={30} />
                </View>
                <View style={styles.fridgeCopy}>
                  <Text style={styles.fridgeTitle}>
                    <Text style={styles.fridgeTitleEmphasis}>
                      냉장고 재료 {fridgeIngredients.length}개
                    </Text>{' '}
                    반영중
                  </Text>
                </View>
                <View style={styles.manageRow}>
                  <Text style={styles.manageText}>관리하기</Text>
                  <Right color="#767676" height={15} width={15} />
                </View>
              </Pressable>

              <View style={styles.dateCard}>
                <Pressable
                  disabled={selectedDateOffset <= dateWindowMin}
                  hitSlop={6}
                  onPress={() => moveSelectedDate(-1)}
                  style={({ pressed }) => [
                    styles.arrowButton,
                    selectedDateOffset <= dateWindowMin && styles.arrowDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Left color="#2FAF96" height={15} width={15} />
                </Pressable>

                <View style={styles.selectedDate}>
                  <Text style={styles.selectedDateLabel}>{selectedDateCopy.label}</Text>
                  <Text style={styles.selectedDateValue}>{selectedDateCopy.date}</Text>
                  <View style={styles.selectedDateLine} />
                </View>

                <Pressable
                  disabled={selectedDateOffset >= dateWindowMax}
                  hitSlop={6}
                  onPress={() => moveSelectedDate(1)}
                  style={({ pressed }) => [
                    styles.arrowButton,
                    selectedDateOffset >= dateWindowMax && styles.arrowDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Right color="#2FAF96" height={15} width={15} />
                </Pressable>
              </View>

              <View style={styles.nutritionCard}>
                <Text style={styles.nutritionTitle}>오늘의 영양 목표</Text>
                <View style={styles.nutritionInner}>
                  <CalorieGoal {...nutritionGoals[0]} />
                  <View style={styles.macroGoals}>
                    {nutritionGoals.slice(1).map((goal) => (
                      <MacroGoal key={goal.label} {...goal} />
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.mealSectionTitle}>오늘의 추천 식단</Text>
              <View style={styles.mealList}>
                {meals.map((meal) => (
                  <MealCard
                    expanded={expandedMeals.has(meal.id)}
                    key={meal.id}
                    meal={recommendedMealsByDate[selectedDateKey]?.[meal.id] ?? meal}
                    recordedMeal={mealRecordsByDate[selectedDateKey]?.[meal.id]}
                    onCollapse={collapseMeal}
                    onRecordOtherMeal={openMealRecord}
                    onRequestAlternativeMeal={requestAlternativeMeal}
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
      <MealRecordSheets
        initialDraft={
          recordingMealId ? mealRecordsByDate[selectedDateKey]?.[recordingMealId] : undefined
        }
        mealId={recordingMealId}
        onClose={() => setRecordingMealId(null)}
        onComplete={completeMealRecord}
        visible={recordingMealId !== null}
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
    height: 118,
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
  heroImage: { height: 100, position: 'absolute', right: 18, top: 6, width: 165 },
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
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  fridgeCopy: { flex: 1, marginLeft: 11, justifyContent: 'center' },
  fridgeTitle: { color: '#000000', fontFamily: fontFamilies.pretendardMedium, fontSize: 14 },
  fridgeTitleEmphasis: { color: '#2FAF96', fontFamily: fontFamilies.pretendardSemiBold },
  manageRow: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  manageText: { color: '#767676', fontFamily: fontFamilies.pretendardSemiBold, fontSize: 11.5 },
  dateCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5EAE9',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    height: 80,
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
  selectedDate: {
    alignItems: 'center',
    backgroundColor: '#E8F8F4',
    borderRadius: 10,
    gap: 5,
    height: 70,
    justifyContent: 'center',
    width: 240,
  },
  selectedDateLabel: {
    color: '#2FAF96',
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  selectedDateValue: {
    color: '#464646',
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
    lineHeight: 20,
  },
  selectedDateLine: {
    backgroundColor: '#2FAF96',
    borderRadius: 1,
    height: 2,
    width: 35,
  },
  nutritionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5EAE9',
    borderRadius: 10,
    borderWidth: 1,
    height: 165,
    padding: 15,
  },
  nutritionTitle: {
    color: '#464646',
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 18,
    lineHeight: 17,
  },
  nutritionInner: { gap: 17, marginTop: 10, width: '100%' },
  calorieGoal: { alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 5 },
  calorieGoalTop: { alignItems: 'center', flexDirection: 'row', gap: 7, width: '100%' },
  nutritionIcon: {
    alignItems: 'center',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  calorieValue: {
    color: '#464646',
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 18,
    lineHeight: 22,
  },
  calorieTarget: {
    color: '#767676',
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 15,
    lineHeight: 22,
  },
  calorieTrack: {
    backgroundColor: '#E5EAE9',
    borderRadius: 3,
    height: 5,
    overflow: 'hidden',
    width: '100%',
  },
  calorieFill: { borderRadius: 3, height: 5 },
  macroGoals: { flexDirection: 'row', height: 43, justifyContent: 'space-between', width: '100%' },
  macroGoal: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    height: 43,
    paddingHorizontal: 5,
  },
  macroCopy: { alignSelf: 'stretch', gap: 12, justifyContent: 'center' },
  macroLabel: {
    color: '#2FAF96',
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 14,
    lineHeight: 17,
  },
  macroValue: {
    color: '#464646',
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
    lineHeight: 20,
  },
  macroTarget: {
    color: '#767676',
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
    lineHeight: 20,
  },
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
    position: 'relative',
  },
  mealCardEaten: { borderColor: '#49CDB1' },
  mealCardModified: { borderColor: '#5FA0FB' },
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
  modifiedBadgePressed: { backgroundColor: '#C9DDFF' },
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
  mealDivider: {
    backgroundColor: '#E5EAE9',
    height: 1,
    width: '100%',
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

  selectedCardBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 10,
    borderWidth: 2,
    zIndex: 10,
  },
  mealCardWeb: {
    overflow: 'hidden',
  },
  eatenCardBorder: {
    borderColor: '#49CDB1',
  },
  modifiedCardBorder: {
    borderColor: '#5FA0FB',
  },
});
