import { useId, useState, type ComponentType } from 'react';
import { useRouter } from 'expo-router';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Mask, Rect, Stop, type SvgProps } from 'react-native-svg';

import BreadIcon from '@/assets/icons/food/Bread.svg';
import BuckwheatIcon from '@/assets/icons/food/Buckwheat.svg';
import CrabIcon from '@/assets/icons/food/Crab.svg';
import EggsIcon from '@/assets/icons/food/Eggs.svg';
import FishIcon from '@/assets/icons/food/Fish.svg';
import MilkIcon from '@/assets/icons/food/Milk.svg';
import NutsIcon from '@/assets/icons/food/Nuts.svg';
import PeachIcon from '@/assets/icons/food/Peach.svg';
import PeanutIcon from '@/assets/icons/food/Peanut.svg';
import SesameIcon from '@/assets/icons/food/Sesame.svg';
import ShellfishIcon from '@/assets/icons/food/Shellfish.svg';
import SoybeanIcon from '@/assets/icons/food/Soybean.svg';
import CheckCircleFillIcon from '@/assets/icons/system/CheckCircle_Fill.svg';
import WarningIcon from '@/assets/icons/system/WarningCircle.svg';
import { SignUpScreenLayout, SignUpSection } from '@/src/components/auth';
import { colors, fontFamilies, radius, typography } from '@/src/theme';

interface AllergenOption {
  id: string;
  label: string;
  icon: ComponentType<SvgProps>;
}

const allergenOptions: AllergenOption[] = [
  { id: 'milk', label: '우유', icon: MilkIcon },
  { id: 'egg', label: '계란', icon: EggsIcon },
  { id: 'peanut', label: '땅콩', icon: PeanutIcon },
  { id: 'nuts', label: '견과류', icon: NutsIcon },
  { id: 'wheat', label: '밀(글루텐)', icon: BreadIcon },
  { id: 'buckwheat', label: '메밀', icon: BuckwheatIcon },
  { id: 'soybean', label: '콩(대두)', icon: SoybeanIcon },
  { id: 'peach', label: '복숭아', icon: PeachIcon },
  { id: 'fish', label: '생선', icon: FishIcon },
  { id: 'crab', label: '갑각류', icon: CrabIcon },
  { id: 'shellfish', label: '조개', icon: ShellfishIcon },
  { id: 'sesame', label: '참깨', icon: SesameIcon },
];

const otherCardShadow: ViewStyle =
  Platform.OS === 'web'
    ? { boxShadow: '0 0 1.5px rgba(0, 0, 0, 0.05)' }
    : {
        elevation: 1,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.05,
        shadowRadius: 1.5,
      };

const descriptionTop = 350;
const allergenGridTop = 414;
const allergenGridHeight = 230;
const otherCardTop = 664;
const referenceDescriptionHeight = 44;

export default function SignUpStep3Screen() {
  const router = useRouter();
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>(['milk']);
  const [otherAllergy, setOtherAllergy] = useState('');
  const [descriptionHeight, setDescriptionHeight] = useState(referenceDescriptionHeight);
  const responsiveAllergenGridTop = Math.max(allergenGridTop, descriptionTop + descriptionHeight);
  const responsiveOtherCardTop = Math.max(
    otherCardTop,
    responsiveAllergenGridTop + allergenGridHeight,
  );

  const toggleAllergen = (id: string) => {
    setSelectedAllergens((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return (
    <SignUpScreenLayout
      ctaLabel="회원가입 완료"
      currentStep={3}
      onBack={() => router.back()}
      onContinue={() => router.replace('/login')}
    >
      <SignUpSection innerStyle={styles.explanation} top={300}>
        <Text style={styles.sectionTitle}>
          알레르기 정보 <Text style={styles.titleAside}>(복수 선택 가능)</Text>
        </Text>
        <Text
          onLayout={(event) => setDescriptionHeight(event.nativeEvent.layout.height)}
          style={styles.description}
        >
          알레르기 정보는 더 정확한 식단 추천을 위해 활용돼요.{`\n`}나중에 프로필에서
          정보를 수정할 수 있어요.
        </Text>
      </SignUpSection>

      <SignUpSection innerStyle={styles.allergenGrid} top={responsiveAllergenGridTop}>
        {[0, 1, 2].map((rowIndex) => (
          <View key={rowIndex} style={styles.allergenRow}>
            {allergenOptions.slice(rowIndex * 4, rowIndex * 4 + 4).map((option) => (
              <AllergenButton
                key={option.id}
                onPress={() => toggleAllergen(option.id)}
                option={option}
                selected={selectedAllergens.includes(option.id)}
              />
            ))}
          </View>
        ))}
      </SignUpSection>

      <SignUpSection innerStyle={styles.otherCard} top={responsiveOtherCardTop}>
        <View style={styles.otherTitleRow}>
          <WarningIcon color={colors.primaryDark} height={18} width={18} />
          <Text style={styles.otherTitle}>기타 알레르기가 있으신가요?</Text>
        </View>
        <View style={styles.otherInputIndent}>
          <TextInput
            accessibilityLabel="기타 알레르기"
            onChangeText={setOtherAllergy}
            placeholder="직접 입력해주세요 (선택 사항)"
            placeholderTextColor={colors.textDisabled}
            returnKeyType="done"
            style={styles.otherInput}
            value={otherAllergy}
          />
        </View>
      </SignUpSection>
    </SignUpScreenLayout>
  );
}

function AllergenButton({
  option,
  selected,
  onPress,
}: {
  option: AllergenOption;
  selected: boolean;
  onPress: () => void;
}) {
  const AllergenIcon = option.icon;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.allergenButton,
        selected && styles.allergenButtonSelected,
        pressed && styles.pressed,
      ]}
    >
      {selected ? (
        <View style={styles.selectionMark}>
          <GradientCheckMark />
        </View>
      ) : null}
      <AllergenIcon
        color={selected ? colors.primary : colors.textSecondary}
        height={35}
        width={35}
      />
      <Text style={[styles.allergenLabel, selected && styles.allergenLabelSelected]}>
        {option.label}
      </Text>
    </Pressable>
  );
}

function GradientCheckMark() {
  const id = useId().replace(/:/g, '');
  const gradientId = `check-gradient-${id}`;
  const maskId = `check-mask-${id}`;

  return (
    <Svg height={15} viewBox="0 0 15 15" width={15}>
      <Defs>
        <LinearGradient
          gradientUnits="userSpaceOnUse"
          id={gradientId}
          x1="10.8516"
          x2="3.6914"
          y1="2.625"
          y2="12.375"
        >
          <Stop offset="0" stopColor="#49CDB1" />
          <Stop offset="0.2" stopColor="#42C0A6" />
          <Stop offset="0.4" stopColor="#49CDB1" />
          <Stop offset="0.600962" stopColor="#42C0A6" />
          <Stop offset="0.8" stopColor="#49CDB1" />
          <Stop offset="1" stopColor="#42C0A6" />
        </LinearGradient>
        <Mask height={15} id={maskId} maskUnits="userSpaceOnUse" width={15} x={0} y={0}>
          <CheckCircleFillIcon color="#FFFFFF" height={15} width={15} />
        </Mask>
      </Defs>
      <Rect fill={`url(#${gradientId})`} height={15} mask={`url(#${maskId})`} width={15} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  explanation: {
    gap: 30,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.textBody,
    fontSize: 17,
    height: 20,
    includeFontPadding: false,
    lineHeight: 20,
  },
  titleAside: {
    color: colors.textBody,
    fontSize: 13,
  },
  description: {
    ...typography.body,
    color: colors.textBody,
    flexShrink: 1,
    includeFontPadding: false,
    lineHeight: 22,
    width: '100%',
  },
  allergenGrid: {
    gap: 10,
    height: 230,
  },
  allergenRow: {
    flexDirection: 'row',
    gap: 10,
    height: 70,
  },
  allergenButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    height: 70,
    justifyContent: 'space-between',
    maxWidth: 80,
    paddingBottom: 5,
    paddingHorizontal: 4,
    paddingTop: 10,
    position: 'relative',
  },
  allergenButtonSelected: {
    borderColor: colors.primary,
  },
  selectionMark: {
    position: 'absolute',
    right: 3,
    top: 2,
  },
  allergenLabel: {
    ...typography.label,
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardSemiBold,
    includeFontPadding: false,
    lineHeight: 22,
    textAlign: 'center',
  },
  allergenLabelSelected: {
    color: colors.primary,
  },
  otherCard: {
    ...otherCardShadow,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    height: 80,
    justifyContent: 'space-between',
    paddingBottom: 13,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  otherTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  otherTitle: {
    ...typography.label,
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    includeFontPadding: false,
    lineHeight: 22,
  },
  otherInputIndent: {
    paddingLeft: 25,
    paddingRight: 10,
  },
  otherInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 9,
    height: 40,
    includeFontPadding: false,
    lineHeight: 22,
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  pressed: {
    opacity: 0.75,
  },
});
