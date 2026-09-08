import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  LayoutAnimation,
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
import Right from '@/assets/icons/common/chevrons/Right.svg';
import Up from '@/assets/icons/common/chevrons/Up.svg';
import Bmr from '@/assets/icons/data/BMR.svg';
import Fat from '@/assets/icons/data/Fat.svg';
import Plant from '@/assets/icons/deco/Plant.svg';
import Sparkle from '@/assets/icons/deco/StarFour_Fill.svg';
import Moon from '@/assets/icons/day/Moon.svg';
import Star from '@/assets/icons/day/Star.svg';
import Sun from '@/assets/icons/day/Sun.svg';
import Fish from '@/assets/icons/food/Fish.svg';
import FishSimple from '@/assets/icons/food/FishSimple.svg';
import Grains from '@/assets/icons/food/Grains.svg';
import Fridge from '@/assets/icons/feature/Fridge.svg';
import Pencil from '@/assets/icons/feature/Pencil_Line.svg';
import Check from '@/assets/icons/system/Check_Fat.svg';
import Prohibit from '@/assets/icons/system/Prohibit.svg';
import Change from '@/assets/icons/system/Change.svg';
import Refresh from '@/assets/icons/system/Refresh.svg';
import { CustomScrollIndicator, useCustomScrollIndicator } from '@/src/components/common';
import {
  BOTTOM_NAVIGATION_MIN_BOTTOM_GAP,
  getBottomNavigationVisualHeight,
} from '@/src/components/navigation';
import { colors, fontFamilies } from '@/src/theme';

const hero = require('../../assets/images/illustrations/diet/Diet.png');
const food = require('../../assets/images/illustrations/diet/EmptyFood.png');
const W = 412;
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type MealStatus = 'recommended' | 'eaten' | 'modified' | 'recorded' | 'skipped';
type Meal = {
  id: MealType;
  title: string;
  kcal: number;
  color: string;
  foods: string;
  tags: string[];
  note: string;
  badge: string;
  ingredient: string;
  intake: [string, string][];
  recorded?: boolean;
};
type NutritionGoal = {
  label: string;
  current: number;
  target: number;
  unit: string;
  Icon: typeof Bmr;
};
const meals: Meal[] = [
  {
    id: 'breakfast',
    title: '아침',
    kcal: 480,
    color: colors.primaryDark,
    foods: '현미밥, 연어구이, 두부샐러드, 미역국, 키위',
    tags: ['근육 유지', '혈당 관리', '식이섬유'],
    note: '연어와 두부로 단백질을 보충하고 혈당 부담을 낮춘 구성',
    badge: '냉장고 재료 3개 활용',
    ingredient: '두부 · 현미밥 · 토마토',
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
    color: colors.warning,
    foods: '현미밥, 연어구이, 두부샐러드, 미역국, 키위',
    tags: ['고단백', '건강한 지방', '영양 균형'],
    note: '연어와 두부로 단백질을 보충하고 혈당 부담을 낮춘 구성',
    badge: '사용자가 직접 기록한 식단이에요',
    ingredient: '오후 12:45에 기록했어요',
    recorded: true,
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
    color: colors.info,
    foods: '현미밥, 닭가슴살구이, 두부버섯볶음, 브로콜리무침',
    tags: ['근육 유지', '혈당 관리', '식이섬유'],
    note: '현미밥과 닭가슴살로 포만감과 영양 균형을 맞춘 구성',
    badge: '냉장고 재료 4개 활용',
    ingredient: '현미밥, 닭가슴살, 두부, 브로콜리',
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
    foods: '그릭요거트, 블루베리, 호두',
    tags: ['고단백', '식이섬유', '건강한 지방'],
    note: '그릭요거트로 단백질을 보충하고 혈당 부담을 낮춘 구성',
    badge: '냉장고 재료 3개 활용',
    ingredient: '블루베리',
    intake: [
      ['그릭요거트', '100g'],
      ['블루베리', '10개 (약 30g)'],
      ['호두', '1개 (약 5g)'],
    ],
  },
];
const initialMealStatuses: Record<MealType, MealStatus> = {
  breakfast: 'recommended',
  lunch: 'recorded',
  dinner: 'recommended',
  snack: 'recommended',
};
const mealCardLayoutAnimation = {
  duration: 280,
  create: {
    duration: 220,
    property: LayoutAnimation.Properties.opacity,
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    duration: 180,
    property: LayoutAnimation.Properties.opacity,
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
};

function animateMealCardLayout() {
  if (Platform.OS !== 'web') {
    LayoutAnimation.configureNext(mealCardLayoutAnimation);
  }
}
const days = [
  ['오늘 (월)', '08.10'],
  ['내일 (화)', '08.11'],
  ['수', '08.12'],
  ['목', '08.13'],
  ['금', '08.14'],
  ['토', '08.15'],
  ['일', '08.16'],
];
const palettes = [
  ['#EEF4FF', '#AFC8FF', '#4F7FE8'],
  ['#ECFAF6', '#A9E2D4', '#31A990'],
  ['#EFF9F1', '#BEE3C6', '#58A870'],
];
const nutritionGoals: NutritionGoal[] = [
  { label: '열량', current: 1650, target: 1700, unit: 'kcal', Icon: Bmr },
  { label: '탄수화물', current: 210, target: 230, unit: 'g', Icon: Plant },
  { label: '단백질', current: 30, target: 90, unit: 'g', Icon: Fish },
  { label: '지방', current: 45, target: 50, unit: 'g', Icon: Fat },
];
function MealIcon({ id, color }: { id: MealType; color: string }) {
  return id === 'dinner' ? (
    <Moon width={15} height={15} color={color} />
  ) : id === 'snack' ? (
    <Star width={15} height={15} color={color} />
  ) : (
    <Sun width={15} height={15} color={color} />
  );
}

function FadeUpSwap({
  transitionKey,
  children,
  style,
  animateOnMount = false,
}: {
  transitionKey: string;
  children: ReactNode;
  style?: object;
  animateOnMount?: boolean;
}) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [translateY] = useState(() => new Animated.Value(0));
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      if (!animateOnMount) return;
    }

    opacity.stopAnimation();
    translateY.stopAnimation();
    opacity.setValue(0);
    translateY.setValue(8);

    const animation = Animated.parallel([
      Animated.timing(opacity, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(translateY, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [animateOnMount, opacity, transitionKey, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
function Actions({
  status,
  showStatusSelector,
  onEat,
  onModify,
  onSkip,
}: {
  status: MealStatus;
  showStatusSelector: boolean;
  onEat: () => void;
  onModify: () => void;
  onSkip: () => void;
}) {
  let content: ReactNode = null;

  if (showStatusSelector || status === 'recommended') {
    content = (
      <View style={s.actions}>
        <Pressable onPress={onEat} style={[s.action, s.eaten]}>
          <Check width={12} height={12} color={colors.primaryDark} />
          <Text style={[s.actionText, { color: colors.primaryDark }]}>먹었어요</Text>
        </Pressable>
        <Pressable onPress={onModify} style={[s.action, s.other]}>
          <Pencil width={12} height={12} color={colors.info} />
          <Text style={[s.actionText, { color: colors.info }]}>다른 음식 먹었어요</Text>
        </Pressable>
        <Pressable onPress={onSkip} style={[s.action, s.skip]}>
          <Prohibit width={12} height={12} color={colors.textSecondary} />
          <Text style={s.actionText}>건너뛰었어요</Text>
        </Pressable>
      </View>
    );
  } else if (status === 'recorded' || status === 'modified') {
    content = (
      <Pressable style={s.modify}>
        <View style={s.actionLabel}>
          <Pencil width={12} height={12} color={colors.warning} />
          <Text style={s.modifyText}>식단 수정하기</Text>
        </View>
        <Right width={12} height={12} color={colors.warning} />
      </Pressable>
    );
  } else if (status === 'eaten') {
    content = (
      <View style={s.eatenStatus}>
        <Check width={12} height={12} color={colors.primaryDark} />
        <Text style={s.eatenStatusText}>추천 식단을 그대로 먹었어요</Text>
      </View>
    );
  }

  const transitionKey = showStatusSelector || status === 'recommended' ? 'selector' : status;

  return (
    <FadeUpSwap style={content ? undefined : s.emptyAction} transitionKey={transitionKey}>
      {content}
    </FadeUpSwap>
  );
}
function MealCard({
  m,
  open,
  status,
  isChangingStatus,
  toggle,
  onStartStatusChange,
  onStatusChange,
}: {
  m: Meal;
  open: boolean;
  status: MealStatus;
  isChangingStatus: boolean;
  toggle: () => void;
  onStartStatusChange: () => void;
  onStatusChange: (status: MealStatus) => void;
}) {
  const isStateManaged = status !== 'recommended';
  const showStateChangeButton = isStateManaged && !isChangingStatus;
  const showOriginalContent = status !== 'skipped' || isChangingStatus;
  return (
    <View style={s.mealCard}>
      <Pressable onPress={toggle} accessibilityState={{ expanded: open }} style={s.mealHeader}>
        <View style={s.mealHeadLeft}>
          <View style={s.mealName}>
            <MealIcon id={m.id} color={m.color} />
            <Text style={[s.mealNameText, { color: m.color }]}>{m.title}</Text>
          </View>
          <Text style={s.kcal}>{m.kcal} kcal</Text>
        </View>
        <Pressable
          disabled={!showStateChangeButton}
          onPress={(event) => {
            event.stopPropagation();
            onStartStatusChange();
          }}
          style={[s.change, showStateChangeButton && s.stateChange]}
        >
          {showStateChangeButton ? (
            <Change width={11} height={11} color={colors.info} />
          ) : (
            <Refresh width={11} height={11} color={colors.primaryDark} />
          )}
          <Text style={[s.changeText, showStateChangeButton && s.stateChangeText]}>
            {showStateChangeButton ? '상태변경' : '다른식단'}
          </Text>
        </Pressable>
      </Pressable>
      {showOriginalContent ? (
        <FadeUpSwap
          animateOnMount={status === 'skipped' && isChangingStatus}
          style={s.mealBody}
          transitionKey="details"
        >
          <View style={s.summary}>
            <Image source={food} resizeMode="contain" style={s.foodImage} />
            <View style={s.summaryText}>
              <Pressable onPress={toggle} style={s.foodRow}>
                <Text numberOfLines={2} style={s.foodText}>
                  {m.foods}
                </Text>
                {open ? (
                  <Up width={15} height={15} color={colors.textBody} />
                ) : (
                  <Down width={15} height={15} color={colors.textBody} />
                )}
              </Pressable>
              <View>
                <View style={s.tags}>
                  {m.tags.map((t, i) => (
                    <View
                      key={t}
                      style={[
                        s.tag,
                        { backgroundColor: palettes[i][0], borderColor: palettes[i][1] },
                      ]}
                    >
                      <Text style={[s.tagText, { color: palettes[i][2] }]}>{t}</Text>
                    </View>
                  ))}
                </View>
                <View style={s.note}>
                  <Sparkle width={9} height={9} color={colors.textSecondary} />
                  <Text numberOfLines={1} style={s.noteText}>
                    {m.note}
                  </Text>
                </View>
              </View>
              <View style={s.divider} />
              <View style={s.ingredient}>
                <View style={[s.badge, m.recorded && { backgroundColor: '#E2EEFF' }]}>
                  <Text style={[s.badgeText, m.recorded && { color: colors.info }]}>{m.badge}</Text>
                </View>
                <Text style={s.ingredientText}>{m.ingredient}</Text>
              </View>
            </View>
          </View>
          {open ? (
            <FadeUpSwap animateOnMount transitionKey="intake">
              <View style={s.intake}>
                <Text style={s.intakeTitle}>추천 섭취량</Text>
                {m.intake.map(([name, amount], i) => (
                  <View key={name}>
                    <View style={s.intakeRow}>
                      <Text style={s.intakeText}>{name}</Text>
                      <Text style={s.intakeText}>{amount}</Text>
                    </View>
                    {i < m.intake.length - 1 ? <View style={s.intakeLine} /> : null}
                  </View>
                ))}
                <Text style={s.macros}>
                  <Text style={{ color: colors.primary }}>●</Text> 탄 85g　{' '}
                  <Text style={{ color: colors.info }}>●</Text> 단 21g　{' '}
                  <Text style={{ color: '#ED9276' }}>●</Text> 지 18g
                </Text>
              </View>
            </FadeUpSwap>
          ) : null}
        </FadeUpSwap>
      ) : (
        <FadeUpSwap animateOnMount transitionKey="skipped">
          <View style={s.skippedStatus}>
            <Prohibit width={12} height={12} color={colors.textSecondary} />
            <Text style={s.skippedStatusText}>식단을 건너뛰었어요</Text>
          </View>
        </FadeUpSwap>
      )}
      <Actions
        status={status}
        showStatusSelector={isChangingStatus}
        onEat={() => onStatusChange('eaten')}
        onModify={() => onStatusChange('modified')}
        onSkip={() => onStatusChange('skipped')}
      />
    </View>
  );
}
function Goal({
  label,
  current,
  target,
  unit,
  Icon,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  Icon: typeof Bmr;
}) {
  const progress = target > 0 ? Math.min(current / target, 1) : 0;
  return (
    <View style={s.goal}>
      <View style={s.goalTop}>
        <View style={s.goalIcon}>
          <Icon width={14} height={14} color={colors.primaryDark} />
        </View>
        <View>
          <Text style={s.goalLabel}>{label}</Text>
          <Text style={s.goalValue}>
            {current.toLocaleString()}{' '}
            <Text style={s.goalTotal}>
              / {target.toLocaleString()} {unit}
            </Text>
          </Text>
        </View>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}
export default function DietScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState<Set<MealType>>(() => new Set());
  const [mealStatuses, setMealStatuses] =
    useState<Record<MealType, MealStatus>>(initialMealStatuses);
  const [changingMeals, setChangingMeals] = useState<Set<MealType>>(() => new Set());
  const aw = width - insets.left - insets.right;
  const scale = Math.min(1, aw / W);
  const rh = Platform.OS === 'web' ? height : Dimensions.get('screen').height;
  const hp = Math.max(0, Math.min(1, (rh - 740) / 177));
  const vertical = (a: number, b: number) => b + (a - b) * hp;
  const left = insets.left + (aw - W * scale) / 2;
  const top = Math.max(0, insets.top + 8 - 38 * scale);
  const bottom =
    getBottomNavigationVisualHeight(height) +
    Math.max(insets.bottom, BOTTOM_NAVIGATION_MIN_BOTTOM_GAP) +
    16;
  const indicator = useCustomScrollIndicator({ showInitially: true });
  const toggle = (id: MealType) => {
    animateMealCardLayout();
    setOpen((old) => {
      const n = new Set(old);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: top, paddingBottom: bottom }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        onLayout={indicator.onLayout}
        onContentSizeChange={indicator.onContentSizeChange}
        onScroll={indicator.onScroll}
        onScrollBeginDrag={indicator.onScrollBeginDrag}
        onScrollEndDrag={indicator.onScrollEndDrag}
        onMomentumScrollBegin={indicator.onMomentumScrollBegin}
        onMomentumScrollEnd={indicator.onMomentumScrollEnd}
      >
        <View style={[s.canvas, { left, transform: [{ scale }] }]}>
          <Text style={s.title}>식단 추천</Text>
          <View style={[s.content, { paddingTop: vertical(69, 58) }]}>
            <View style={s.hero}>
              <View>
                <View style={s.strategy}>
                  <Text style={s.strategyText}>Auto-Fit 식단전략</Text>
                </View>
                <Text style={s.heroTitle}>
                  OO님을 위한{`\n`}
                  <Text style={s.mint}>맞춤 식단</Text>이에요!
                </Text>
                <Text style={s.heroDetail}>
                  빠른 감량보다는 근육을 유지하면서{`\n`}체지방을 줄이는 방향으로 구성했어요.
                </Text>
              </View>
              <Image source={hero} resizeMode="contain" style={s.heroImage} />
            </View>
            <View style={s.chips}>
              <View style={s.chip}>
                <FishSimple width={22} height={22} color={colors.primaryDark} />
                <Text style={s.chipText}>단백질 충분히</Text>
              </View>
              <View style={s.chip}>
                <Grains width={22} height={22} color={colors.primaryDark} />
                <Text style={s.chipText}>정제 탄수 줄이기</Text>
              </View>
              <View style={s.chip}>
                <Bmr width={22} height={22} color={colors.primaryDark} />
                <Text style={s.chipText}>적정 열량 유지</Text>
              </View>
            </View>
            <View style={s.fridge}>
              <View style={s.fridgeIconSlot}>
                <Fridge width={32} height={30} color={colors.primaryDark} style={s.fridgeIcon} />
              </View>
              <View style={s.fridgeCopy}>
                <Text style={s.fridgeTitle}>
                  <Text style={s.mint}>냉장고 재료 8개</Text> 반영중
                </Text>
                <Text style={s.fridgeDetail}>
                  닭가슴살 · 계란 · 두부 · 토마토 · 브로콜리 외 3개
                </Text>
              </View>
              <View style={s.manage}>
                <Text style={s.manageText}>관리하기</Text>
                <Right width={10} height={10} color={colors.textBody} />
              </View>
            </View>
            <View style={s.days}>
              {days.map(([label, date], i) => (
                <View key={date} style={[s.day, i === 0 && s.dayActive]}>
                  <Text style={[s.dayLabel, i === 0 && s.mint]}>{label}</Text>
                  <Text style={s.dayDate}>{date}</Text>
                  {i === 0 ? <View style={s.dayLine} /> : null}
                </View>
              ))}
            </View>
            <View style={s.goalCard}>
              <View style={s.goalHeader}>
                <Text style={s.goalTitle}>오늘의 영양 목표</Text>
                <Text style={s.goalDetail}>근손실 방지를 위해 단백질 비중을 높였어요</Text>
              </View>
              <View style={s.goals}>
                {nutritionGoals.map((goal) => (
                  <Goal key={goal.label} {...goal} />
                ))}
              </View>
            </View>
            <Text style={s.sectionTitle}>오늘의 추천 식단</Text>
            <View style={s.meals}>
              {meals.map((m) => (
                <MealCard
                  key={m.id}
                  m={m}
                  open={open.has(m.id)}
                  status={mealStatuses[m.id]}
                  isChangingStatus={changingMeals.has(m.id)}
                  toggle={() => toggle(m.id)}
                  onStartStatusChange={() => {
                    if (mealStatuses[m.id] === 'skipped') animateMealCardLayout();
                    setChangingMeals((current) => new Set(current).add(m.id));
                  }}
                  onStatusChange={(status) => {
                    if (mealStatuses[m.id] === 'skipped' || status === 'skipped') {
                      animateMealCardLayout();
                    }
                    setMealStatuses((current) => ({ ...current, [m.id]: status }));
                    setChangingMeals((current) => {
                      const next = new Set(current);
                      next.delete(m.id);
                      return next;
                    });
                  }}
                />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
      <CustomScrollIndicator
        {...indicator.indicatorProps}
        topInset={Math.max(8, insets.top + 4)}
        bottomInset={bottom}
        rightInset={Math.max(4, insets.right + 4)}
      />
    </View>
  );
}
const medium = { fontFamily: fontFamilies.pretendardMedium } as const;
const card = {
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderRadius: 10,
  borderWidth: 1,
} as const;
const s = StyleSheet.create({
  root: { backgroundColor: colors.background, flex: 1, overflow: 'hidden' },
  canvas: {
    alignSelf: 'flex-start',
    paddingBottom: 10,
    position: 'relative',
    transformOrigin: 'top left',
    width: W,
  },
  title: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
    left: 21,
    letterSpacing: 1.5,
    position: 'absolute',
    right: 21,
    textAlign: 'center',
    top: 38,
  },
  content: { paddingHorizontal: 21 },
  hero: { height: 126, position: 'relative' },
  strategy: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  strategyText: { ...medium, color: colors.primaryDark, fontSize: 10 },
  heroTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 18,
    lineHeight: 26,
    marginTop: 10,
  },
  mint: { color: colors.primaryDark },
  heroDetail: {
    ...medium,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
  },
  heroImage: { height: 112, position: 'absolute', right: -2, top: 7, width: 174 },
  chips: { flexDirection: 'row', gap: 8, height: 30, marginBottom: 10 },
  chip: {
    alignItems: 'center',
    backgroundColor: 'rgba(223,244,240,.2)',
    borderColor: colors.primary,
    borderRadius: 20,
    borderWidth: 0.5,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
  },
  chipText: { ...medium, color: colors.primaryDark, fontSize: 11 },
  fridge: {
    ...card,
    alignItems: 'center',
    flexDirection: 'row',
    height: 60,
    paddingHorizontal: 10,
  },
  fridgeCopy: { marginLeft: 10 },
  fridgeIconSlot: { height: 30, overflow: 'visible', position: 'relative', width: 19 },
  fridgeIcon: { left: -6.5, position: 'absolute', top: 0 },
  fridgeTitle: { ...medium, color: colors.textPrimary, fontSize: 11 },
  fridgeDetail: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 9,
    marginTop: 4,
  },
  manage: { alignItems: 'center', flexDirection: 'row', gap: 2, marginLeft: 'auto' },
  manageText: { fontFamily: fontFamilies.pretendardSemiBold, fontSize: 10 },
  days: {
    ...card,
    alignItems: 'center',
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 3,
    paddingVertical: 5,
  },
  day: {
    alignItems: 'center',
    borderRadius: 10,
    gap: 5,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  dayActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 0.5,
  },
  dayLabel: { ...medium, fontSize: 10 },
  dayDate: { ...medium, fontSize: 8 },
  dayLine: { backgroundColor: colors.primary, height: 2, width: 20 },
  goalCard: { ...card, height: 80, marginTop: 10, paddingHorizontal: 10, paddingVertical: 7 },
  goalHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  goalTitle: { fontFamily: fontFamilies.pretendardSemiBold, fontSize: 11 },
  goalDetail: { ...medium, color: colors.textSecondary, fontSize: 8 },
  goals: { flexDirection: 'row', height: 50, justifyContent: 'space-between' },
  goal: { gap: 9, height: 50, justifyContent: 'center', width: 80 },
  goalTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  goalIcon: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 0.5,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  goalLabel: { ...medium, fontSize: 9, textAlign: 'right' },
  goalValue: { ...medium, fontSize: 7.5 },
  goalTotal: { color: colors.textSecondary, fontSize: 6 },
  track: { backgroundColor: colors.primaryLight, height: 3 },
  fill: { backgroundColor: colors.primary, borderRadius: 2, height: 3 },
  sectionTitle: {
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 12,
    marginBottom: 5,
    marginTop: 9,
  },
  meals: { gap: 10 },
  mealCard: { ...card, gap: 10, padding: 10 },
  mealBody: { gap: 10 },
  mealHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 18,
    justifyContent: 'space-between',
  },
  mealHeadLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 110,
  },
  mealName: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  mealNameText: { ...medium, fontSize: 12 },
  kcal: { ...medium, fontSize: 11 },
  change: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 5,
    flexDirection: 'row',
    gap: 2,
    height: 17,
    paddingHorizontal: 3,
  },
  changeText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 8.5,
  },
  stateChange: { backgroundColor: '#E2EEFF' },
  stateChangeText: { color: colors.info },
  summary: { flexDirection: 'row', justifyContent: 'space-between' },
  foodImage: { backgroundColor: '#F7FAF9', borderRadius: 10, height: 110, width: 110 },
  summaryText: { height: 110, justifyContent: 'space-between', width: 226 },
  foodRow: { flexDirection: 'row', height: 30, justifyContent: 'space-between' },
  foodText: { ...medium, fontSize: 10, lineHeight: 15, width: 200 },
  tags: { flexDirection: 'row', gap: 3, height: 20 },
  tag: {
    borderRadius: 3,
    borderWidth: 0.5,
    height: 15,
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tagText: { ...medium, fontSize: 8 },
  note: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F0',
    borderRadius: 5,
    flexDirection: 'row',
    gap: 3,
    height: 15,
    maxWidth: 226,
    paddingHorizontal: 5,
  },
  noteText: { ...medium, color: colors.textSecondary, fontSize: 7, maxWidth: 207 },
  divider: { backgroundColor: colors.border, height: 1 },
  ingredient: { gap: 4, height: 35 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: 3,
    height: 15,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { ...medium, color: colors.primaryDark, fontSize: 9 },
  ingredientText: { ...medium, color: colors.textSecondary, fontSize: 8 },
  intake: { gap: 6 },
  intakeTitle: { ...medium, fontSize: 12 },
  intakeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  intakeText: { fontFamily: fontFamilies.pretendardRegular, fontSize: 10.5 },
  intakeLine: { backgroundColor: colors.border, height: 1, marginVertical: 3 },
  macros: { fontFamily: fontFamilies.pretendardRegular, fontSize: 9 },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  emptyAction: { position: 'absolute' },
  action: {
    alignItems: 'center',
    borderRadius: 5,
    borderWidth: 0.5,
    flexDirection: 'row',
    gap: 5,
    height: 25,
    justifyContent: 'center',
    width: 110,
  },
  eaten: { backgroundColor: colors.primaryLight, borderColor: colors.primaryDark },
  eatenStatus: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryDark,
    borderRadius: 5,
    borderWidth: 0.5,
    flexDirection: 'row',
    gap: 5,
    height: 25,
    paddingHorizontal: 5,
  },
  eatenStatusText: { ...medium, color: colors.primaryDark, fontSize: 10 },
  other: { backgroundColor: '#E2EEFF', borderColor: colors.info },
  skip: { backgroundColor: '#F4F4F4', borderColor: colors.textSecondary },
  skippedStatus: {
    alignItems: 'center',
    backgroundColor: '#F4F4F4',
    borderColor: colors.textSecondary,
    borderRadius: 5,
    borderWidth: 0.5,
    flexDirection: 'row',
    gap: 5,
    height: 25,
    paddingHorizontal: 5,
  },
  skippedStatusText: { ...medium, color: colors.textSecondary, fontSize: 10 },
  actionText: { ...medium, color: colors.textSecondary, fontSize: 9.5 },
  modify: {
    alignItems: 'center',
    backgroundColor: '#FFF9F4',
    borderColor: colors.warning,
    borderRadius: 5,
    borderWidth: 0.5,
    flexDirection: 'row',
    height: 25,
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  actionLabel: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  modifyText: { ...medium, color: colors.warning, fontSize: 10 },
});
