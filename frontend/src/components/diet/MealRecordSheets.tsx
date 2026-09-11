import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  type KeyboardEvent,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  UIManager,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CloseIcon from '@/assets/icons/common/X.svg';
import ChevronDownIcon from '@/assets/icons/common/chevrons/Down.svg';
import CameraIcon from '@/assets/icons/system/Camera.svg';
import ClockIcon from '@/assets/icons/input/Clock.svg';
import LightbulbIcon from '@/assets/icons/system/Lightbulb.svg';
import PencilIcon from '@/assets/icons/feature/Pencil_Line.svg';
import SearchIcon from '@/assets/icons/input/MagnifyingGlass.svg';
import { AppBottomSheet } from '@/src/components/common';
import { colors, fontFamilies } from '@/src/theme';
import { analyzeRecordedMealMock } from '@/src/utils/diet/analyzeRecordedMealMock';

export type RecordedFood = {
  id: string;
  name: string;
  serving: number;
  amount: number;
  unit: string;
  kcal?: number;
  carbs?: number;
  protein?: number;
  fat?: number;
};

export type RecordedMealData = {
  mealId: string;
  mealTime: string;
  photoUri: string | null;
  foods: RecordedFood[];
  kcal: number;
  tags: string[];
  note: string;
  usedIngredients: string[];
  intake: [string, string][];
};

export type MealRecordDraft = RecordedMealData;

type FoodDatabaseItem = Omit<RecordedFood, 'id' | 'serving' | 'unit'> & {
  id: string;
  defaultUnit: string;
  units: string[];
};

type SheetView = 'record' | 'edit' | 'add';
type NutrientKey = 'kcal' | 'carbs' | 'protein' | 'fat';

type Props = {
  visible: boolean;
  mealId: string | null;
  initialDraft?: MealRecordDraft;
  onClose: () => void;
  onComplete: (draft: MealRecordDraft) => void;
};

const timeOptions = ['11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00'];
const servingPresets = [1, 1.5, 2] as const;
const editPresetRatios = [1, 0.5, 0.7] as const;
const nutritionKeys: NutrientKey[] = ['kcal', 'carbs', 'protein', 'fat'];
const nutritionLabels: Record<NutrientKey, string> = {
  kcal: '칼로리',
  carbs: '탄수화물',
  protein: '단백질',
  fat: '지방',
};
const nutritionUnits: Record<NutrientKey, string> = {
  kcal: 'kcal',
  carbs: 'g',
  protein: 'g',
  fat: 'g',
};

const mockFoodDatabase: FoodDatabaseItem[] = [
  {
    id: 'db-kimchi-rice',
    name: '김치볶음밥',
    amount: 300,
    defaultUnit: 'g',
    units: ['g', '그릇', '인분'],
    kcal: 480,
    carbs: 72,
    protein: 14,
    fat: 13,
  },
  {
    id: 'db-kimchi-stew',
    name: '김치찌개',
    amount: 200,
    defaultUnit: 'g',
    units: ['g', '그릇', '인분'],
    kcal: 60,
    carbs: 8,
    protein: 5,
    fat: 2,
  },
  {
    id: 'db-cabbage-kimchi',
    name: '배추김치',
    amount: 100,
    defaultUnit: 'g',
    units: ['g', '접시'],
    kcal: 25,
    carbs: 4,
    protein: 2,
    fat: 0,
  },
  {
    id: 'db-kimchi-pancake',
    name: '김치전',
    amount: 150,
    defaultUnit: 'g',
    units: ['g', '장', '조각'],
    kcal: 190,
    carbs: 28,
    protein: 5,
    fat: 7,
  },
  {
    id: 'db-kimchi-noodle',
    name: '김치말이국수',
    amount: 400,
    defaultUnit: 'g',
    units: ['g', '그릇', '인분'],
    kcal: 350,
    carbs: 68,
    protein: 10,
    fat: 5,
  },
  {
    id: 'db-chicken-salad',
    name: '닭가슴살 샐러드',
    amount: 200,
    defaultUnit: 'g',
    units: ['g', '팩', '인분'],
    kcal: 210,
    carbs: 18,
    protein: 30,
    fat: 5,
  },
  {
    id: 'db-apple',
    name: '사과',
    amount: 200,
    defaultUnit: 'g',
    units: ['g', '개'],
    kcal: 104,
    carbs: 28,
    protein: 1,
    fat: 0,
  },
  {
    id: 'db-milk',
    name: '우유',
    amount: 200,
    defaultUnit: 'ml',
    units: ['ml', '컵'],
    kcal: 122,
    carbs: 10,
    protein: 6,
    fat: 7,
  },
];

const createRecognizedFoods = (): RecordedFood[] => [
  {
    id: `recognized-rice-${Date.now()}`,
    name: '김치볶음밥',
    serving: 1,
    amount: 300,
    unit: 'g',
    kcal: 480,
    carbs: 72,
    protein: 14,
    fat: 13,
  },
  {
    id: `recognized-salad-${Date.now()}`,
    name: '닭가슴살 샐러드',
    serving: 1,
    amount: 200,
    unit: 'g',
    kcal: 210,
    carbs: 18,
    protein: 30,
    fat: 5,
  },
  {
    id: `recognized-soup-${Date.now()}`,
    name: '미역국',
    serving: 1,
    amount: 200,
    unit: 'g',
    kcal: 80,
    carbs: 9,
    protein: 4,
    fat: 3,
  },
];

const cloneDraft = (draft: MealRecordDraft): MealRecordDraft => ({
  ...draft,
  foods: draft.foods.map((food) => ({ ...food })),
  tags: [...draft.tags],
  usedIngredients: [...draft.usedIngredients],
  intake: draft.intake.map(([name, amount]) => [name, amount]),
});

export const formatRecordedFoodAmount = (food: RecordedFood) =>
  food.unit === '인분' ? `${food.serving}인분` : `${food.amount}${food.unit}`;

const onlyNumeric = (value: string) => value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

function SheetHeader({
  title,
  description,
  onClose,
}: {
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <View style={styles.headerBlock}>
      <View style={styles.handleArea}>
        <View style={styles.handle} />
      </View>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Text style={styles.sheetDescription}>{description}</Text>
        </View>
        <Pressable
          accessibilityLabel="닫기"
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <CloseIcon color={colors.primary} fill={colors.primary} height={17} width={17} />
        </Pressable>
      </View>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.disabledButton,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function NutritionSummary({ food }: { food: RecordedFood }) {
  return (
    <View style={styles.nutritionSummary}>
      {nutritionKeys.map((key) => (
        <View key={key} style={styles.nutritionSummaryItem}>
          <Text style={styles.nutritionSummaryLabel}>{nutritionLabels[key]}</Text>
          <Text style={[styles.nutritionSummaryValue, key === 'kcal' && styles.primaryText]}>
            {food[key] ?? '-'} {food[key] === undefined ? '' : nutritionUnits[key]}
          </Text>
        </View>
      ))}
    </View>
  );
}

function AmountSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const minimum = 1;
  const maximum = 600;
  const progress = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
  const updateValue = (locationX: number) => {
    if (trackWidth <= 0) return;
    const nextProgress = Math.max(0, Math.min(1, locationX / trackWidth));
    onChange(Math.max(minimum, Math.round(minimum + nextProgress * (maximum - minimum))));
  };

  return (
    <View style={styles.sliderBlock}>
      <View
        accessibilityLabel={`섭취량 ${value}`}
        accessibilityRole="adjustable"
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => updateValue(event.nativeEvent.locationX)}
        onResponderMove={(event) => updateValue(event.nativeEvent.locationX)}
        onStartShouldSetResponder={() => true}
        style={styles.sliderTouchArea}
      >
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.sliderThumb, { left: `${progress * 100}%` }]} />
        </View>
      </View>
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabel}>0g</Text>
        <Text style={styles.sliderLabel}>600g</Text>
      </View>
    </View>
  );
}

function SelectMenu({
  label,
  options,
  open,
  onToggle,
  onSelect,
}: {
  label: string;
  options: readonly (string | number)[];
  open: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.selectWrap}>
      <Pressable onPress={onToggle} style={styles.selectField}>
        <Text style={styles.selectValue}>{label}</Text>
        <ChevronDownIcon color={colors.textSecondary} height={16} width={16} />
      </Pressable>
      {open ? (
        <View style={styles.selectOptions}>
          {options.map((option) => (
            <Pressable
              key={String(option)}
              onPress={() => onSelect(String(option))}
              style={({ pressed }) => [styles.selectOption, pressed && styles.optionPressed]}
            >
              <Text style={styles.selectOptionText}>{option}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function MealRecordSheets({ visible, mealId, initialDraft, onClose, onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [view, setView] = useState<SheetView>('record');
  const [draft, setDraft] = useState<MealRecordDraft | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const [editFood, setEditFood] = useState<RecordedFood | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodDatabaseItem | null>(null);
  const [addAmount, setAddAmount] = useState('200');
  const [addServing, setAddServing] = useState(1);
  const [addUnit, setAddUnit] = useState('g');
  const [unitOpen, setUnitOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualNutrition, setManualNutrition] = useState<Partial<Record<NutrientKey, number>>>({});
  const [editingNutrient, setEditingNutrient] = useState<NutrientKey | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [keyboardOffset] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (!visible || !mealId) return;
    const frame = requestAnimationFrame(() => {
      setDraft(
        initialDraft
          ? cloneDraft(initialDraft)
          : {
              mealId,
              mealTime: '12:00',
              photoUri: null,
              foods: [],
              kcal: 0,
              tags: [],
              note: '',
              usedIngredients: [],
              intake: [],
            },
      );
      setView('record');
      setTimeOpen(false);
      setEditingFoodId(null);
      setEditFood(null);
      setSearchText('');
      setSelectedFood(null);
      setManualMode(false);
      setManualNutrition({});
    });
    return () => cancelAnimationFrame(frame);
  }, [initialDraft, mealId, visible]);

  const minimumTopGap = Math.max(28, insets.top + 8);
  const estimatedSheetHeight = view === 'record' ? 820 : view === 'edit' ? 610 : 690;
  const sheetMaxHeight = windowHeight - minimumTopGap;

  useEffect(() => {
    if (!visible || Platform.OS === 'web') {
      keyboardOffset.setValue(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const safeTop = minimumTopGap;

    const showKeyboard = (event: KeyboardEvent) => {
      const keyboardHeight = event.endCoordinates.height;
      const screenBottom = event.endCoordinates.screenY + keyboardHeight;
      const baseTop = screenBottom - Math.min(estimatedSheetHeight, sheetMaxHeight);
      const lift = Math.min(keyboardHeight, Math.max(0, baseTop - safeTop));
      setKeyboardInset(Math.max(0, keyboardHeight - lift) + 16);
      Animated.timing(keyboardOffset, {
        duration: Platform.OS === 'ios' ? (event.duration ?? 220) : 200,
        easing: Easing.out(Easing.cubic),
        toValue: lift,
        useNativeDriver: true,
      }).start();
    };
    const hideKeyboard = (event: KeyboardEvent) => {
      setKeyboardInset(0);
      Animated.timing(keyboardOffset, {
        duration: Platform.OS === 'ios' ? (event.duration ?? 180) : 180,
        easing: Easing.inOut(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }).start();
    };

    const showSubscription = Keyboard.addListener(showEvent, showKeyboard);
    const hideSubscription = Keyboard.addListener(hideEvent, hideKeyboard);
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      keyboardOffset.stopAnimation();
    };
  }, [estimatedSheetHeight, keyboardOffset, minimumTopGap, sheetMaxHeight, visible]);

  const searchResults = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    if (!query) return [];
    return mockFoodDatabase.filter((food) => food.name.toLocaleLowerCase().includes(query));
  }, [searchText]);

  const selectedFoodPreview = useMemo<RecordedFood | null>(() => {
    if (!selectedFood) return null;
    const amount = Number(addAmount) || 0;
    const ratio = selectedFood.amount > 0 ? amount / selectedFood.amount : 1;
    return {
      id: selectedFood.id,
      name: selectedFood.name,
      serving: addServing,
      amount,
      unit: addUnit,
      kcal: Math.round((selectedFood.kcal ?? 0) * ratio),
      carbs: Math.round((selectedFood.carbs ?? 0) * ratio),
      protein: Math.round((selectedFood.protein ?? 0) * ratio),
      fat: Math.round((selectedFood.fat ?? 0) * ratio),
    };
  }, [addAmount, addServing, addUnit, selectedFood]);

  const closeAll = () => {
    Keyboard.dismiss();
    setKeyboardInset(0);
    onClose();
  };

  const returnToRecord = () => {
    Keyboard.dismiss();
    setKeyboardInset(0);
    setView('record');
    setUnitOpen(false);
    setEditingNutrient(null);
  };

  const takeFoodPhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('카메라 권한이 필요해요', '푸드샷을 촬영하려면 카메라 접근을 허용해주세요.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.back,
        mediaTypes: ['images'],
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]) {
        setDraft((current) =>
          current
            ? {
                ...current,
                photoUri: result.assets[0].uri,
                foods: current.foods.length > 0 ? current.foods : createRecognizedFoods(),
              }
            : current,
        );
      }
    } catch (error) {
      console.error('푸드샷 촬영 실패:', error);
      Alert.alert('카메라를 열 수 없어요', '이 환경에서는 카메라를 사용할 수 없습니다.');
    }
  };

  const openFoodEdit = (food: RecordedFood) => {
    setEditingFoodId(food.id);
    setEditFood({ ...food });
    setView('edit');
  };

  const saveEditedFood = () => {
    if (!editFood || !editingFoodId) return;
    setDraft((current) =>
      current
        ? {
            ...current,
            foods: current.foods.map((food) => (food.id === editingFoodId ? editFood : food)),
          }
        : current,
    );
    returnToRecord();
  };

  const deleteEditedFood = () => {
    if (!editingFoodId) return;
    setDraft((current) =>
      current
        ? { ...current, foods: current.foods.filter((food) => food.id !== editingFoodId) }
        : current,
    );
    returnToRecord();
  };

  const updateEditAmount = (amount: number) => {
    setEditFood((current) => {
      if (!current) return current;
      const previousAmount = Math.max(current.amount, 1);
      const ratio = amount / previousAmount;
      return {
        ...current,
        amount,
        serving: Math.round((amount / 300) * 10) / 10,
        kcal:
          current.kcal === undefined ? undefined : Math.max(0, Math.round(current.kcal * ratio)),
        carbs:
          current.carbs === undefined ? undefined : Math.max(0, Math.round(current.carbs * ratio)),
        protein:
          current.protein === undefined
            ? undefined
            : Math.max(0, Math.round(current.protein * ratio)),
        fat: current.fat === undefined ? undefined : Math.max(0, Math.round(current.fat * ratio)),
      };
    });
  };

  const openAddFood = () => {
    setSearchText('');
    setSelectedFood(null);
    setManualMode(false);
    setManualNutrition({});
    setAddAmount('200');
    setAddServing(1);
    setAddUnit('g');
    setView('add');
  };

  const chooseDatabaseFood = (food: FoodDatabaseItem) => {
    Keyboard.dismiss();
    setSelectedFood(food);
    setManualMode(false);
    setAddServing(1);
    setAddAmount(String(food.amount));
    setAddUnit(food.defaultUnit);
    setUnitOpen(false);
  };

  const startManualMode = () => {
    const name = searchText.trim();
    if (!name) return;
    Keyboard.dismiss();
    setSelectedFood(null);
    setManualMode(true);
    setManualNutrition({});
    setAddAmount('200');
    setAddUnit('g');
  };

  const resetFoodSelection = () => {
    setSelectedFood(null);
    setManualMode(false);
    setUnitOpen(false);
  };

  const setServingPreset = (serving: number) => {
    setAddServing(serving);
    const baseAmount = selectedFood?.amount ?? 200;
    setAddAmount(String(Math.round(baseAmount * serving)));
  };

  const addFood = () => {
    const name = selectedFood?.name ?? searchText.trim();
    const amount = Number(addAmount);
    if (!name || !Number.isFinite(amount) || amount <= 0) return;
    const preview = selectedFoodPreview;
    const food: RecordedFood = preview
      ? { ...preview, id: `food-${Date.now()}` }
      : {
          id: `manual-${Date.now()}`,
          name,
          serving: addServing,
          amount,
          unit: addUnit,
          ...manualNutrition,
        };
    setDraft((current) => (current ? { ...current, foods: [...current.foods, food] } : current));
    returnToRecord();
  };

  const completeRecord = () => {
    if (!draft) return;
    Keyboard.dismiss();
    setKeyboardInset(0);
    const analysis = analyzeRecordedMealMock(draft.foods);
    onComplete(
      cloneDraft({
        ...draft,
        ...analysis,
      }),
    );
  };

  const renderRecord = () => (
    <View style={styles.sheetBody}>
      <SheetHeader
        description="실제로 드신 음식을 기록해 주세요."
        onClose={closeAll}
        title="음식 기록하기"
      />
      <View style={styles.section}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>1. 푸드샷으로 음식 인식하기</Text>
          <Text style={styles.sectionDescription}>
            사진을 찍으면 AI가 음식과 영양 정보를 분석해요.
          </Text>
        </View>
        <View style={styles.photoFrame}>
          <View style={styles.photoRow}>
            <Pressable
              onPress={takeFoodPhoto}
              style={({ pressed }) => [styles.cameraArea, pressed && styles.pressed]}
            >
              <View style={styles.cameraCircle}>
                <CameraIcon color={colors.primary} fill={colors.primary} height={28} width={28} />
              </View>
              <Text style={styles.cameraTitle}>푸드샷 찍기</Text>
              <Text style={styles.cameraDescription}>카메라로 음식을{`\n`}촬영해 주세요.</Text>
            </Pressable>
            <View style={styles.photoPreview}>
              {draft?.photoUri ? (
                <Image
                  resizeMode="cover"
                  source={{ uri: draft.photoUri }}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <Text style={styles.photoPlaceholder}>촬영한 사진이 여기에 표시돼요</Text>
              )}
            </View>
          </View>
          <View style={styles.tipRow}>
            <LightbulbIcon color={colors.primary} fill={colors.primary} height={16} width={16} />
            <Text style={styles.tipText}>
              <Text style={styles.tipLabel}>TIP </Text>밝은 곳에서 음식이 잘 보이도록 찍을수록 더
              정확하게 인식돼요.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionCopy}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>2. 인식된 음식 확인 및 수정</Text>
            <View style={styles.autoBadge}>
              <Text style={styles.autoBadgeText}>자동 인식 완료</Text>
            </View>
          </View>
          <Text style={styles.sectionDescription}>
            AI가 인식한 결과예요. 틀린 항목은 수정해 주세요.
          </Text>
        </View>
        <View style={styles.foodListCard}>
          {draft?.foods.map((food, index) => (
            <View key={food.id}>
              {index > 0 ? <View style={styles.foodDivider} /> : null}
              <View style={styles.foodRow}>
                <View style={styles.foodIndex}>
                  <Text style={styles.foodIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.foodCopy}>
                  <Text numberOfLines={1} style={styles.foodName}>
                    {food.name}
                  </Text>
                  <Text style={styles.foodAmount}>
                    {food.serving}인분 ({food.amount}
                    {food.unit})
                  </Text>
                </View>
                <Text style={styles.foodKcal}>{food.kcal ?? '-'} kcal</Text>
                <Pressable
                  accessibilityLabel={`${food.name} 수정`}
                  onPress={() => openFoodEdit(food)}
                  style={styles.editButton}
                >
                  <PencilIcon
                    color={colors.textSecondary}
                    fill={colors.textSecondary}
                    height={14}
                    width={14}
                  />
                </Pressable>
              </View>
            </View>
          ))}
          <Pressable
            onPress={openAddFood}
            style={({ pressed }) => [styles.addOutlineButton, pressed && styles.pressed]}
          >
            <Text style={styles.addOutlinePlus}>+</Text>
            <Text style={styles.addOutlineText}>음식 추가하기</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. 식사 시간</Text>
        <Pressable
          onPress={() => {
            LayoutAnimation.configureNext({
              duration: 200,
              update: { type: LayoutAnimation.Types.easeInEaseOut },
            });
            setTimeOpen((current) => !current);
          }}
          style={styles.timeField}
        >
          <View style={styles.timeLeft}>
            <ClockIcon color={colors.textSecondary} height={22} width={22} />
            <Text style={styles.timeValue}>{draft?.mealTime}</Text>
          </View>
          <ChevronDownIcon color={colors.textSecondary} height={16} width={16} />
        </Pressable>
        {timeOpen ? (
          <View style={styles.timeOptions}>
            {timeOptions.map((time) => (
              <Pressable
                key={time}
                onPress={() => {
                  setDraft((current) => (current ? { ...current, mealTime: time } : current));
                  setTimeOpen(false);
                }}
                style={[styles.timeOption, draft?.mealTime === time && styles.timeOptionSelected]}
              >
                <Text
                  style={[
                    styles.timeOptionText,
                    draft?.mealTime === time && styles.timeOptionTextSelected,
                  ]}
                >
                  {time}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <PrimaryButton
        disabled={!draft || draft.foods.length === 0}
        label="기록하기"
        onPress={completeRecord}
      />
    </View>
  );

  const renderEdit = () => {
    if (!editFood) return null;
    const baseAmount = 300;
    return (
      <View style={styles.sheetBody}>
        <SheetHeader
          description="실제로 드신 내용을 입력해 주세요."
          onClose={returnToRecord}
          title="음식 수정하기"
        />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. 섭취량 변경</Text>
          <Text style={styles.sectionDescription}>음식의 섭취량을 조절할 수 있어요.</Text>
          <View style={styles.selectedFoodBox}>
            <Text style={styles.selectedFoodName}>{editFood.name}</Text>
            <Text style={styles.selectedFoodMeta}>추천량 1인분 ({baseAmount}g)</Text>
          </View>
          <View style={styles.presetRow}>
            {editPresetRatios.map((ratio) => {
              const amount = Math.round(baseAmount * ratio);
              const selected = Math.abs(editFood.amount - amount) < 2;
              return (
                <Pressable
                  key={ratio}
                  onPress={() => updateEditAmount(amount)}
                  style={[styles.presetButton, selected && styles.presetButtonSelected]}
                >
                  <Text style={[styles.presetTitle, selected && styles.presetTitleSelected]}>
                    {ratio}인분
                  </Text>
                  <Text style={[styles.presetMeta, selected && styles.presetMetaSelected]}>
                    ({amount}g)
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.amountStepper}>
            <Pressable
              onPress={() => updateEditAmount(Math.max(1, editFood.amount - 10))}
              style={styles.stepButton}
            >
              <Text style={styles.stepButtonText}>−</Text>
            </Pressable>
            <Text style={styles.amountValue}>
              {editFood.amount}
              {editFood.unit}
            </Text>
            <Pressable
              onPress={() => updateEditAmount(Math.min(600, editFood.amount + 10))}
              style={styles.stepButton}
            >
              <Text style={styles.stepButtonText}>+</Text>
            </Pressable>
          </View>
          <AmountSlider onChange={updateEditAmount} value={editFood.amount} />
        </View>
        <View style={styles.divider} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. 예상 칼로리</Text>
          <Text style={styles.sectionDescription}>섭취량에 따라 칼로리가 자동으로 계산돼요.</Text>
          <NutritionSummary food={editFood} />
        </View>
        <Pressable
          onPress={deleteEditedFood}
          style={({ pressed }) => [styles.deleteFoodButton, pressed && styles.pressed]}
        >
          <Text style={styles.deleteFoodText}>음식 삭제</Text>
        </Pressable>
        <PrimaryButton label="수정 완료" onPress={saveEditedFood} />
      </View>
    );
  };

  const renderAdd = () => {
    const availableUnits = selectedFood?.units ?? ['g', 'ml', '개', '조각', '그릇', '인분'];
    const canAdd = Boolean(
      (selectedFood || manualMode) && searchText.trim() && Number(addAmount) > 0,
    );

    return (
      <View style={styles.sheetBody}>
        <SheetHeader
          description="인식되지 않은 음식을 추가해 주세요."
          onClose={returnToRecord}
          title="음식 추가"
        />
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>음식명</Text>
          {selectedFood || manualMode ? (
            <Pressable onPress={resetFoodSelection} style={styles.selectedFoodBox}>
              <Text style={styles.selectedFoodName}>{selectedFood?.name ?? searchText.trim()}</Text>
              <Text style={styles.selectedFoodMeta}>눌러서 다시 검색하기</Text>
            </Pressable>
          ) : (
            <View>
              <View style={styles.searchField}>
                <SearchIcon
                  color={colors.textSecondary}
                  fill={colors.textSecondary}
                  height={20}
                  width={20}
                />
                <TextInput
                  autoFocus
                  onChangeText={setSearchText}
                  placeholder="음식명을 입력해 주세요."
                  placeholderTextColor={colors.textDisabled}
                  style={styles.searchInput}
                  value={searchText}
                />
              </View>
              {searchText.trim() ? (
                <View style={styles.searchResults}>
                  {searchResults.length > 0 ? (
                    searchResults.map((food) => (
                      <Pressable
                        key={food.id}
                        onPress={() => chooseDatabaseFood(food)}
                        style={styles.searchResultRow}
                      >
                        <Text style={styles.searchResultName}>{food.name}</Text>
                        <Text style={styles.searchResultKcal}>{food.kcal} kcal</Text>
                      </Pressable>
                    ))
                  ) : (
                    <View style={styles.emptySearch}>
                      <Text style={styles.emptySearchText}>검색 결과가 없어요.</Text>
                      <Pressable onPress={startManualMode} style={styles.manualButton}>
                        <Text style={styles.manualButtonText}>+ 직접 음식 정보 입력하기</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          )}
        </View>

        {selectedFood || manualMode ? (
          <>
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>섭취량</Text>
              <View style={styles.servingPresetRow}>
                {servingPresets.map((serving) => (
                  <Pressable
                    key={serving}
                    onPress={() => setServingPreset(serving)}
                    style={[
                      styles.servingPreset,
                      addServing === serving && styles.servingPresetSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.servingPresetText,
                        addServing === serving && styles.servingPresetTextSelected,
                      ]}
                    >
                      {serving}인분
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.amountInputRow}>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={(value) => setAddAmount(onlyNumeric(value))}
                  style={styles.amountInput}
                  value={addAmount}
                />
                <SelectMenu
                  label={addUnit}
                  onSelect={(unit) => {
                    setAddUnit(unit);
                    setUnitOpen(false);
                  }}
                  onToggle={() => setUnitOpen((current) => !current)}
                  open={unitOpen}
                  options={availableUnits}
                />
              </View>
            </View>

            {manualMode ? (
              <View style={styles.section}>
                <Text style={styles.fieldLabel}>영양 정보 (선택)</Text>
                <View style={styles.manualNutritionGrid}>
                  {nutritionKeys.map((key) => (
                    <Pressable
                      key={key}
                      onPress={() => setEditingNutrient(key)}
                      style={styles.manualNutritionItem}
                    >
                      <Text style={styles.manualNutritionLabel}>{nutritionLabels[key]}</Text>
                      {editingNutrient === key ? (
                        <TextInput
                          autoFocus
                          keyboardType="decimal-pad"
                          onBlur={() => setEditingNutrient(null)}
                          onChangeText={(value) => {
                            const numeric = onlyNumeric(value);
                            setManualNutrition((current) => ({
                              ...current,
                              [key]: numeric ? Number(numeric) : undefined,
                            }));
                          }}
                          onSubmitEditing={() => setEditingNutrient(null)}
                          style={styles.nutritionInput}
                          value={
                            manualNutrition[key] === undefined ? '' : String(manualNutrition[key])
                          }
                        />
                      ) : (
                        <Text style={styles.manualNutritionValue}>
                          {manualNutrition[key] ?? '-'}
                          {manualNutrition[key] === undefined ? '' : ` ${nutritionUnits[key]}`}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.optionalNotice}>* 영양 정보는 선택 입력 사항입니다.</Text>
              </View>
            ) : selectedFoodPreview ? (
              <NutritionSummary food={selectedFoodPreview} />
            ) : null}
          </>
        ) : null}

        <View style={styles.addActions}>
          <Pressable
            onPress={returnToRecord}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          >
            <Text style={styles.cancelButtonText}>취소</Text>
          </Pressable>
          <View style={styles.addPrimaryWrap}>
            <PrimaryButton disabled={!canAdd} label="추가하기" onPress={addFood} />
          </View>
        </View>
      </View>
    );
  };

  return (
    <AppBottomSheet
      animationDistance={820}
      contentStyle={[
        styles.bottomSheetContent,
        keyboardInset > 0 && { paddingBottom: keyboardInset },
      ]}
      lockBackgroundScroll
      keyboardShouldPersistTaps="always"
      minimumTopGap={28}
      onClose={view === 'record' ? closeAll : returnToRecord}
      overlayStyle={styles.overlay}
      scrollable="when-overflow"
      separateAnimations
      sheetOffset={keyboardOffset}
      sheetStyle={styles.sheet}
      showHandle={false}
      visible={visible}
    >
      {view === 'record' ? renderRecord() : view === 'edit' ? renderEdit() : renderAdd()}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', paddingTop: 5 },
  bottomSheetContent: { gap: 18, paddingHorizontal: 21, paddingTop: 0 },
  sheetBody: { gap: 18 },
  headerBlock: { gap: 10 },
  handleArea: { alignItems: 'center', height: 16, justifyContent: 'center' },
  handle: { backgroundColor: '#D9D9D9', borderRadius: 2, height: 4, width: 40 },
  headerRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  headerCopy: { gap: 3 },
  sheetTitle: { color: colors.textBody, fontFamily: fontFamilies.pretendardBold, fontSize: 22 },
  sheetDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 17,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 16,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2.5,
    width: 30,
  },
  section: { gap: 10 },
  sectionCopy: { gap: 4 },
  sectionTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  sectionTitle: { color: colors.textBody, fontFamily: fontFamilies.pretendardBold, fontSize: 20 },
  sectionDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
  },
  photoFrame: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  photoRow: { flexDirection: 'row', gap: 10, height: 125 },
  cameraArea: {
    alignItems: 'center',
    backgroundColor: '#F4FAF9',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    justifyContent: 'center',
  },
  cameraCircle: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 22,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  cameraTitle: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
  },
  cameraDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    textAlign: 'center',
  },
  photoPreview: {
    alignItems: 'center',
    backgroundColor: '#F4FAF9',
    borderRadius: 10,
    flex: 2.45,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPlaceholder: {
    color: colors.textDisabled,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
    padding: 12,
    textAlign: 'center',
  },
  tipRow: {
    alignItems: 'center',
    backgroundColor: '#F4FAF9',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tipText: {
    color: colors.textSecondary,
    flex: 1,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
  },
  tipLabel: { color: colors.primary, fontFamily: fontFamilies.pretendardBold },
  autoBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  autoBadgeText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 12,
  },
  foodListCard: { borderColor: '#EEEEEE', borderRadius: 10, borderWidth: 1, gap: 10, padding: 14 },
  foodRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  foodIndex: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 5,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  foodIndexText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
  },
  foodCopy: { flex: 1, gap: 2 },
  foodName: { color: colors.textBody, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 16 },
  foodAmount: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
  },
  foodKcal: { color: colors.textBody, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 14 },
  editButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  foodDivider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  addOutlineButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    height: 36,
    justifyContent: 'center',
    marginTop: 2,
  },
  addOutlinePlus: {
    color: colors.primary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 23,
    marginRight: 4,
  },
  addOutlineText: {
    color: colors.primary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 15,
  },
  timeField: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  timeLeft: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  timeValue: { color: colors.textBody, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 18 },
  timeOptions: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  timeOption: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 38,
    justifyContent: 'center',
  },
  timeOptionSelected: { backgroundColor: colors.primaryLight },
  timeOptionText: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 15,
  },
  timeOptionTextSelected: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    width: '100%',
  },
  primaryButtonText: {
    color: colors.surface,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
  },
  disabledButton: { opacity: 0.45 },
  selectedFoodBox: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  selectedFoodName: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 17,
  },
  selectedFoodMeta: {
    color: colors.textSecondary,
    flex: 1,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
  },
  presetRow: { flexDirection: 'row', gap: 6 },
  presetButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    height: 57,
    justifyContent: 'center',
  },
  presetButtonSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  presetTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 17,
  },
  presetTitleSelected: { color: colors.primaryDark },
  presetMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
  },
  presetMetaSelected: { color: colors.primary },
  amountStepper: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    height: 58,
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  stepButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  stepButtonText: {
    color: colors.primary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 22,
  },
  amountValue: { color: colors.textBody, fontFamily: fontFamilies.pretendardBold, fontSize: 24 },
  sliderBlock: { gap: 4 },
  sliderTouchArea: { height: 28, justifyContent: 'center' },
  sliderTrack: { backgroundColor: colors.border, borderRadius: 3, height: 5, position: 'relative' },
  sliderFill: { backgroundColor: colors.primary, borderRadius: 3, height: 5 },
  sliderThumb: {
    backgroundColor: colors.primary,
    borderRadius: 9,
    height: 18,
    marginLeft: -9,
    marginTop: -11.5,
    position: 'absolute',
    top: '50%',
    width: 18,
  },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 10,
  },
  divider: { backgroundColor: colors.border, height: 1 },
  nutritionSummary: {
    backgroundColor: '#F4FAF9',
    borderRadius: 12,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  nutritionSummaryItem: { alignItems: 'center', borderRightColor: colors.border, flex: 1, gap: 4 },
  nutritionSummaryLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
  },
  nutritionSummaryValue: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 16,
  },
  primaryText: { color: colors.primary },
  deleteFoodButton: {
    alignItems: 'center',
    backgroundColor: '#FF4D4F',
    borderRadius: 10,
    borderWidth: 0,
    flexDirection: 'row',
    gap: 7,
    height: 44,
    justifyContent: 'center',
  },
  deleteFoodText: {
    color: colors.surface,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
  },
  fieldLabel: { color: colors.textBody, fontFamily: fontFamilies.pretendardBold, fontSize: 20 },
  searchField: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: colors.textBody,
    flex: 1,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 16,
    padding: 0,
  },
  searchResults: {
    borderColor: colors.border,
    borderRadius: 0,
    borderWidth: 1,
    marginTop: -1,
    overflow: 'hidden',
  },
  searchResultRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: 36,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  searchResultName: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 15,
  },
  searchResultKcal: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
  },
  emptySearch: { alignItems: 'center', gap: 14, padding: 18 },
  emptySearchText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
  },
  manualButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: '100%',
  },
  manualButtonText: {
    color: colors.primary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 15,
  },
  servingPresetRow: { flexDirection: 'row', gap: 6 },
  servingPreset: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  servingPresetSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  servingPresetText: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 15,
  },
  servingPresetTextSelected: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
  },
  amountInputRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 6 },
  amountInput: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.textBody,
    flex: 1,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 16,
    height: 44,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  selectWrap: { flex: 1, position: 'relative', zIndex: 2 },
  selectField: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  selectValue: { color: colors.textBody, fontFamily: fontFamilies.pretendardMedium, fontSize: 16 },
  selectOptions: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 47,
    zIndex: 4,
  },
  selectOption: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: 'center',
  },
  selectOptionText: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
  },
  optionPressed: { backgroundColor: colors.primaryLight },
  manualNutritionGrid: { flexDirection: 'row', gap: 6 },
  manualNutritionItem: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    height: 72,
    justifyContent: 'center',
  },
  manualNutritionLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
  },
  manualNutritionValue: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
  },
  nutritionInput: {
    borderBottomColor: colors.primary,
    borderBottomWidth: 1,
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
    minWidth: 40,
    padding: 0,
    textAlign: 'center',
  },
  optionalNotice: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
  },
  addActions: { flexDirection: 'row', gap: 7, marginTop: 2 },
  cancelButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 18,
  },
  addPrimaryWrap: { flex: 1 },
  pressed: { opacity: 0.72 },
});
