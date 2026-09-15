import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Dimensions, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View, type ViewStyle } from 'react-native';

import BarbellIcon from '@/assets/icons/deco/Barbell.svg';
import BarbellFillIcon from '@/assets/icons/deco/Barbell_Fill.svg';
import FirstAidIcon from '@/assets/icons/deco/FirstAid_Fill.svg';
import HandHeartFillIcon from '@/assets/icons/deco/HandHeart_Fill.svg';
import HouseIcon from '@/assets/icons/deco/HouseLine.svg';
import MapPinIcon from '@/assets/icons/deco/MapPin_Fill.svg';
import SparkleIcon from '@/assets/icons/deco/Sparkle_Fill.svg';
import ClockFillIcon from '@/assets/icons/input/Clock_Fill.svg';
import CheckIcon from '@/assets/icons/system/Check.svg';
import { BackButton } from '@/src/components/common/BackButton';
import { ExerciseActionButton } from '@/src/components/exercise/ExerciseActionButton';
import { ExerciseScreenFrame } from '@/src/components/exercise/ExerciseScreenFrame';
import { useExerciseRoutine } from '@/src/features/exercise/ExerciseRoutineContext';
import { exerciseEquipmentLabels, exerciseLocationLabels, type ExerciseEquipment, type ExerciseLocation } from '@/src/features/exercise/exerciseData';
import { colors, fontFamilies } from '@/src/theme';

const referenceHeight = 917;
const minimumScreenHeight = 740;
const keyboardSafeGap = 20;
const times = [30, 45, 60, 90, 120];
const locations: { id: ExerciseLocation; Icon: ComponentType<any> }[] = [
  { id: 'gym', Icon: BarbellIcon },
  { id: 'home', Icon: HouseIcon },
  { id: 'outdoor', Icon: MapPinIcon },
  { id: 'other', Icon: MapPinIcon },
];
const equipment = Object.keys(exerciseEquipmentLabels) as ExerciseEquipment[];
type FocusedInput = 'condition' | 'discomfort' | null;

export default function ExerciseConditionScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const { condition: savedCondition, generateRoutine } = useExerciseRoutine();
  const conditionInputRef = useRef<TextInput>(null);
  const discomfortInputRef = useRef<TextInput>(null);
  const [condition, setCondition] = useState(savedCondition);
  const [focusedInput, setFocusedInput] = useState<FocusedInput>(null);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const [keyboardContentOffset, setKeyboardContentOffset] = useState(0);
  const responsiveHeight = Platform.OS === 'web' ? windowHeight : Dimensions.get('screen').height;
  const heightProgress = Math.max(0, Math.min(1, (responsiveHeight - minimumScreenHeight) / (referenceHeight - minimumScreenHeight)));
  const verticalValue = (expanded: number, compact: number) => compact + (expanded - compact) * heightProgress;
  const layout = {
    cardHeight: verticalValue(100, 90), cardPadding: verticalValue(12.5, 10), ctaTop: verticalValue(820, 727),
    discomfortHeight: verticalValue(124, 112), discomfortPadding: verticalValue(10, 9), equipmentButtonHeight: verticalValue(65, 60),
    equipmentHeight: verticalValue(138, 120), equipmentPadding: verticalValue(14, 11), formGap: verticalValue(10, 7),
    formTop: verticalValue(200, 180), inputHeight: verticalValue(34, 31), introDescriptionMargin: verticalValue(9, 6), introTop: verticalValue(100, 85),
  };
  const contentHeight = verticalValue(865, 772);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const show = Keyboard.addListener('keyboardDidShow', (event) => setKeyboardTop(event.endCoordinates.screenY));
    const hide = Keyboard.addListener('keyboardDidHide', () => { setKeyboardTop(null); setKeyboardContentOffset(0); });
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'android' || focusedInput === null || keyboardTop === null) return undefined;
    const inputRef = focusedInput === 'condition' ? conditionInputRef : discomfortInputRef;
    const frame = requestAnimationFrame(() => inputRef.current?.measureInWindow((_x, y, _width, height) => {
      setKeyboardContentOffset(Math.max(0, y + height - (keyboardTop - keyboardSafeGap)));
    }));
    return () => cancelAnimationFrame(frame);
  }, [focusedInput, keyboardTop]);

  const toggleEquipment = (id: ExerciseEquipment) => setCondition((current) => ({
    ...current, equipment: current.equipment.includes(id) ? current.equipment.filter((item) => item !== id) : [...current.equipment, id],
  }));
  const handleInputBlur = useCallback(() => { setFocusedInput(null); setKeyboardContentOffset(0); }, []);
  const handleGenerate = () => { generateRoutine(condition); router.replace('/exercise/summary'); };

  return (
    <ExerciseScreenFrame contentHeight={contentHeight}>
      <View style={{ transform: [{ translateY: -keyboardContentOffset }] }}>
        <BackButton onPress={() => router.back()} style={styles.back} />
        <Text style={styles.screenTitle}>컨디션 입력</Text>
        <View style={[styles.intro, { top: layout.introTop }]}>
          <Text style={styles.introTitle}>운동 환경과{'\n'}<Text style={styles.introAccent}>현재 상태를 알려주세요</Text></Text>
          <Text style={[styles.introDescription, { marginTop: layout.introDescriptionMargin }]}>입력한 정보를 바탕으로 오늘의 맞춤 루틴을 만들어 드려요</Text>
        </View>
        <View style={[styles.form, { gap: layout.formGap, top: layout.formTop }]}>
          <FormCard Icon={ClockFillIcon} style={{ height: layout.cardHeight, paddingVertical: layout.cardPadding }} title="운동 가능 시간">
            <View style={styles.row}>{times.map((minutes) => <Choice key={minutes} selected={condition.availableMinutes === minutes} label={minutes === 120 ? '120분 이상' : `${minutes}분`} onPress={() => setCondition({ ...condition, availableMinutes: minutes })} />)}</View>
          </FormCard>
          <FormCard Icon={MapPinIcon} style={{ height: layout.cardHeight, paddingVertical: layout.cardPadding }} title="운동 장소">
            <View style={styles.row}>{locations.map(({ Icon, id }) => <Choice key={id} Icon={Icon} selected={condition.location === id} label={exerciseLocationLabels[id]} onPress={() => setCondition({ ...condition, location: id })} />)}</View>
          </FormCard>
          <FormCard Icon={BarbellFillIcon} style={{ height: layout.equipmentHeight, paddingVertical: layout.equipmentPadding }} title={<>사용 가능한 장비 <Text style={styles.titleAside}>(복수 선택)</Text></>}>
            <View style={styles.equipmentRow}>{equipment.map((id) => {
              const selected = condition.equipment.includes(id);
              return <Pressable key={id} onPress={() => toggleEquipment(id)} style={[styles.equipmentChoice, { height: layout.equipmentButtonHeight }, selected && styles.choiceSelected]}>
                <BarbellIcon color={selected ? colors.primary : colors.textSecondary} height={25} width={25} />
                <Text style={[styles.equipmentText, selected && styles.choiceTextSelected]}>{exerciseEquipmentLabels[id]}</Text>
                {selected ? <CheckIcon color={colors.primary} height={13} width={13} /> : null}
              </Pressable>;
            })}</View>
          </FormCard>
          <FormCard Icon={FirstAidIcon} style={{ height: layout.cardHeight, paddingVertical: layout.cardPadding }} title="현재 컨디션">
            <TextInput ref={conditionInputRef} onBlur={handleInputBlur} onChangeText={(value) => setCondition({ ...condition, condition: value })} onFocus={() => setFocusedInput('condition')} placeholder="예) 좋음, 보통, 나쁨, 매우 피곤 등" placeholderTextColor={colors.textDisabled} style={[styles.input, { height: layout.inputHeight }]} value={condition.condition} />
          </FormCard>
          <FormCard description={'운동 시 불편하거나 주의가 필요한 부위를 알려주세요.\n없을 시 생략 가능합니다.'} Icon={HandHeartFillIcon} style={{ height: layout.discomfortHeight, paddingVertical: layout.discomfortPadding }} title={<>운동 시 불편한 부위 <Text style={styles.titleAside}>(선택)</Text></>}>
            <TextInput ref={discomfortInputRef} onBlur={handleInputBlur} onChangeText={(value) => setCondition({ ...condition, discomfortArea: value })} onFocus={() => setFocusedInput('discomfort')} placeholder="예) 오른쪽 무릎, 허리, 어깨 등" placeholderTextColor={colors.textDisabled} style={[styles.input, { height: layout.inputHeight }]} value={condition.discomfortArea} />
          </FormCard>
        </View>
        <View style={[styles.cta, { top: layout.ctaTop }]}>
          <ExerciseActionButton borderRadius={10} gap={10} gradient icon={<SparkleIcon color={colors.surface} height={22} width={22} />} labelStyle={styles.ctaLabel} onPress={handleGenerate} title="맞춤 루틴 만들기" />
        </View>
      </View>
    </ExerciseScreenFrame>
  );
}

function FormCard({ children, description, Icon, style, title }: { children: ReactNode; description?: string; Icon: ComponentType<any>; style?: ViewStyle; title: ReactNode }) {
  return <View style={[styles.card, style]}><View style={[styles.cardTitleRow, description && styles.cardTitleWithDescription]}><Icon color={colors.primary} height={25} width={25} /><View><Text style={styles.cardTitle}>{title}</Text>{description ? <Text style={styles.helper}>{description}</Text> : null}</View></View>{children}</View>;
}

function Choice({ Icon, label, onPress, selected }: { Icon?: ComponentType<any>; label: string; onPress: () => void; selected: boolean }) {
  return <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}>{Icon ? <Icon color={selected ? colors.primary : colors.textSecondary} height={16} width={16} /> : null}<Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>{selected ? <CheckIcon color={colors.primary} height={13} width={13} /> : null}</Pressable>;
}

const styles = StyleSheet.create({
  back: { left: 22, position: 'absolute', top: 32 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, justifyContent: 'space-between', paddingHorizontal: 10 },
  cardTitle: { color: colors.textPrimary, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 18, includeFontPadding: false },
  cardTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 5 }, cardTitleWithDescription: { alignItems: 'flex-start' },
  choice: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 7, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 3, height: 30, justifyContent: 'center', paddingHorizontal: 3 },
  choiceSelected: { backgroundColor: '#F5FFFC', borderColor: colors.primary },
  choiceText: { color: colors.textPrimary, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 12, includeFontPadding: false }, choiceTextSelected: { color: colors.primaryDark },
  cta: { left: 21, position: 'absolute', width: 370 }, ctaLabel: { fontFamily: fontFamilies.pretendardMedium, fontSize: 20, lineHeight: 24 },
  equipmentChoice: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, gap: 5, justifyContent: 'center', position: 'relative', width: 60 },
  equipmentRow: { flexDirection: 'row', justifyContent: 'space-between' }, equipmentText: { color: colors.textPrimary, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 14, includeFontPadding: false },
  form: { left: 21, position: 'absolute', width: 370 }, helper: { color: colors.textSecondary, fontFamily: fontFamilies.pretendardMedium, fontSize: 13, lineHeight: 16, marginTop: 3 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 5, borderWidth: 1, color: colors.textPrimary, fontFamily: fontFamilies.pretendardMedium, fontSize: 13, paddingHorizontal: 10, paddingVertical: 0 },
  intro: { left: 21, position: 'absolute', width: 370 }, introAccent: { color: colors.primaryDark }, introDescription: { color: colors.textSecondary, fontFamily: fontFamilies.pretendardMedium, fontSize: 14, lineHeight: 20 }, introTitle: { color: colors.textPrimary, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 22, lineHeight: 30 },
  row: { flexDirection: 'row', gap: 5 }, screenTitle: { alignSelf: 'center', color: colors.textPrimary, fontFamily: fontFamilies.pretendardBold, fontSize: 15, letterSpacing: 1.5, position: 'absolute', top: 38 },
  titleAside: { color: colors.textSecondary, fontFamily: fontFamilies.pretendardMedium, fontSize: 13 },
});
