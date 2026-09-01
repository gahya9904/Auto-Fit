import { useState, type ComponentType } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type { SvgProps } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BMIIcon from '@/assets/icons/data/BMI.svg';
import BloodPressureIcon from '@/assets/icons/data/BloodPressure.svg';
import CholesterolIcon from '@/assets/icons/data/Cholesterol.svg';
import DateIcon from '@/assets/icons/data/Date.svg';
import DiabetesIcon from '@/assets/icons/data/Diabetes.svg';
import HeightIcon from '@/assets/icons/data/Height.svg';
import HemoglobinIcon from '@/assets/icons/data/Hemoglobin.svg';
import WeightIcon from '@/assets/icons/data/Weight.svg';
import DocumentIcon from '@/assets/icons/system/Document.svg';
import CheckIcon from '@/assets/icons/system/Check.svg';
import ShieldCheckIcon from '@/assets/icons/system/ShieldCheck.svg';
import { AppCard, BackButton } from '@/src/components/common';
import { colors, fontFamilies, radius } from '@/src/theme';

const resultBackground = require('../../assets/images/backgrounds/4_Upload.png');

const referenceWidth = 412;
const referenceHeight = 917;
const referenceTitleTop = 38;

interface HealthCheckupOCRResult {
  bloodPressure: string;
  bmi: number;
  checkupDate: string;
  fastingBloodSugar: number;
  height: number;
  hemoglobin: number;
  totalCholesterol: number;
  weight: number;
}

interface HealthMetricDefinition {
  Icon: ComponentType<SvgProps>;
  iconKind: 'fill' | 'stroke';
  keyboardType: 'decimal-pad' | 'default';
  key: keyof HealthCheckupOCRResult;
  label: string;
  unit: string;
}

const mockHealthCheckupResult: HealthCheckupOCRResult = {
  checkupDate: '2026.08.01',
  height: 175.2,
  weight: 68.4,
  bmi: 22.3,
  bloodPressure: '120 / 80',
  fastingBloodSugar: 92,
  totalCholesterol: 185,
  hemoglobin: 14.2,
};

const healthMetricDefinitions: HealthMetricDefinition[] = [
  {
    Icon: DateIcon,
    iconKind: 'fill',
    keyboardType: 'default',
    key: 'checkupDate',
    label: '검진일',
    unit: '',
  },
  {
    Icon: HeightIcon,
    iconKind: 'fill',
    keyboardType: 'decimal-pad',
    key: 'height',
    label: '신장',
    unit: 'cm',
  },
  {
    Icon: WeightIcon,
    iconKind: 'stroke',
    keyboardType: 'decimal-pad',
    key: 'weight',
    label: '체중',
    unit: 'kg',
  },
  {
    Icon: BMIIcon,
    iconKind: 'stroke',
    keyboardType: 'decimal-pad',
    key: 'bmi',
    label: 'BMI',
    unit: '',
  },
  {
    Icon: BloodPressureIcon,
    iconKind: 'fill',
    keyboardType: 'default',
    key: 'bloodPressure',
    label: '혈압',
    unit: 'mmHg',
  },
  {
    Icon: DiabetesIcon,
    iconKind: 'fill',
    keyboardType: 'decimal-pad',
    key: 'fastingBloodSugar',
    label: '공복혈당',
    unit: 'mg/dL',
  },
  {
    Icon: CholesterolIcon,
    iconKind: 'stroke',
    keyboardType: 'decimal-pad',
    key: 'totalCholesterol',
    label: '총콜레스테롤',
    unit: 'mg/dL',
  },
  {
    Icon: HemoglobinIcon,
    iconKind: 'stroke',
    keyboardType: 'decimal-pad',
    key: 'hemoglobin',
    label: '혈색소',
    unit: 'g/dL',
  },
];

function ResultStepIndicator() {
  return (
    <View accessibilityLabel="OCR 결과 확인 1단계 중 1단계" style={styles.stepIndicator}>
      {[1, 2, 3].map((step, index) => (
        <View key={step} style={styles.stepGroup}>
          {index > 0 ? <View style={styles.stepLine} /> : null}
          <View style={[styles.step, step === 1 && styles.activeStep]}>
            <Text style={[styles.stepText, step === 1 && styles.activeStepText]}>{step}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function MetricRow({
  definition,
  draftValue,
  isEditing,
  onChangeDraft,
  onToggleEdit,
  value,
}: {
  definition: HealthMetricDefinition;
  draftValue: string;
  isEditing: boolean;
  onChangeDraft: (value: string) => void;
  onToggleEdit: () => void;
  value: string;
}) {
  const { Icon } = definition;
  const iconColorProps =
    definition.iconKind === 'fill' ? { fill: colors.primary } : { stroke: colors.primary };

  return (
    <View style={styles.metricRow}>
      <View style={styles.metricIconCircle}>
        <Icon {...iconColorProps} height={22} width={22} />
      </View>
      <View style={styles.metricMain}>
        <View style={styles.metricContent}>
          <Text style={styles.metricLabel}>{definition.label}</Text>
          <View style={styles.metricValue}>
            {isEditing ? (
              <TextInput
                autoFocus
                keyboardType={definition.keyboardType}
                onChangeText={onChangeDraft}
                onSubmitEditing={onToggleEdit}
                returnKeyType="done"
                selectTextOnFocus
                selectionColor="#1371EB"
                style={styles.metricInput}
                value={draftValue}
              />
            ) : (
              <Text style={styles.metricValueText}>{value}</Text>
            )}
            {definition.unit ? <Text style={styles.metricUnit}> {definition.unit}</Text> : null}
          </View>
          <Pressable
            accessibilityLabel={`${definition.label} ${isEditing ? '확인' : '수정'}`}
            accessibilityRole="button"
            onPress={onToggleEdit}
            style={({ pressed }) => [
              styles.modifyButton,
              isEditing && styles.confirmButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.modifyButtonText, isEditing && styles.confirmButtonText]}>
              {isEditing ? '확인' : '수정'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.metricDivider} />
      </View>
    </View>
  );
}

export default function OCRResultScreen() {
  const router = useRouter();
  const { fileName } = useLocalSearchParams<{ fileName?: string }>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [metricValues, setMetricValues] = useState<Record<keyof HealthCheckupOCRResult, string>>(
    () =>
      Object.fromEntries(
        Object.entries(mockHealthCheckupResult).map(([key, value]) => [key, String(value)]),
      ) as Record<keyof HealthCheckupOCRResult, string>,
  );
  const [editingMetricKey, setEditingMetricKey] = useState<keyof HealthCheckupOCRResult | null>(
    null,
  );
  const [draftValue, setDraftValue] = useState('');

  const availableWidth = Math.max(0, windowWidth - insets.left - insets.right);
  const scale = Math.min(1, availableWidth / referenceWidth);
  const safeTopAdjustment = Math.max(0, insets.top + 8 - referenceTitleTop * scale);
  const canvasHeight = referenceHeight * scale;
  const displayedFileName = fileName ?? '2026_건강검진결과표.pdf';

  const handleMetricEdit = (key: keyof HealthCheckupOCRResult) => {
    if (editingMetricKey === key) {
      setMetricValues((current) => ({ ...current, [key]: draftValue }));
      setEditingMetricKey(null);
      return;
    }

    if (editingMetricKey) {
      setMetricValues((current) => ({ ...current, [editingMetricKey]: draftValue }));
    }

    setDraftValue(metricValues[key]);
    setEditingMetricKey(key);
  };

  return (
    <View style={styles.root}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="stretch"
        source={resultBackground}
        style={styles.background}
      />
      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            minHeight: windowHeight,
            paddingBottom: insets.bottom,
            paddingTop: safeTopAdjustment,
          },
        ]}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: canvasHeight, width: referenceWidth * scale }}>
          <View style={[styles.canvas, { transform: [{ scale }] }]}>
            <BackButton onPress={() => router.back()} size={44} style={styles.backButton} />
            <Text style={styles.screenTitle}>OCR 결과 확인</Text>
            <View style={styles.stepPosition}>
              <ResultStepIndicator />
            </View>

            <View style={styles.completionSection}>
              <View style={styles.completionIconCircle}>
                <CheckIcon fill={colors.primary} height={32} width={32} />
              </View>
              <View style={styles.completionTexts}>
                <Text style={styles.completionTitle}>데이터 추출이 완료되었습니다!</Text>
                <Text style={styles.completionDescription}>
                  아래 내용을 확인하고,{`\n`}수정이 필요한 항목이 있다면 수정해주세요.
                </Text>
              </View>
            </View>

            <AppCard bordered padding="none" style={styles.uploadFileCard}>
              <View style={styles.uploadFileContent}>
                <Text style={styles.cardTitle}>업로드 파일</Text>
                <View style={styles.uploadFileBottom}>
                  <View style={styles.filePreview}>
                    <DocumentIcon fill={colors.primary} height={42} width={42} />
                  </View>
                  <View style={styles.fileTexts}>
                    <Text numberOfLines={1} style={styles.fileName}>
                      {displayedFileName}
                    </Text>
                    <Text style={styles.uploadTime}>업로드 일시 2026. 08. 11 09:13</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.back()}
                    style={({ pressed }) => [styles.reuploadButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.reuploadText}>다시 업로드</Text>
                  </Pressable>
                </View>
              </View>
            </AppCard>

            <AppCard bordered padding="none" style={styles.extractedCard}>
              <View style={styles.extractedContent}>
                <Text style={styles.cardTitle}>추출된 데이터</Text>
                <ScrollView
                  bounces={false}
                  contentContainerStyle={styles.metricListContent}
                  nestedScrollEnabled
                  overScrollMode="never"
                  showsVerticalScrollIndicator={true}
                  style={styles.metricList}
                >
                  {healthMetricDefinitions.map((definition) => (
                    <MetricRow
                      key={definition.key}
                      definition={definition}
                      draftValue={editingMetricKey === definition.key ? draftValue : ''}
                      isEditing={editingMetricKey === definition.key}
                      onChangeDraft={setDraftValue}
                      onToggleEdit={() => handleMetricEdit(definition.key)}
                      value={metricValues[definition.key]}
                    />
                  ))}
                </ScrollView>
                <View style={styles.privacyBox}>
                  <ShieldCheckIcon fill={colors.primary} height={24} width={24} />
                  <Text style={styles.privacyText}>
                    추출된 데이터는 사용자 동의 없이 저장되거나 공유되지 않으며,{`\n`}
                    <Text style={styles.privacyEmphasis}>분석 및 추천 서비스 제공</Text>에만
                    사용됩니다.
                  </Text>
                </View>
              </View>
            </AppCard>

            <Pressable
              accessibilityRole="button"
              onPress={() => undefined}
              style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
            >
              <Text style={styles.nextButtonText}>다음</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFill,
    height: '100%',
    width: '100%',
  },
  scrollContent: {
    alignItems: 'center',
  },
  canvas: {
    height: referenceHeight,
    position: 'absolute',
    transformOrigin: 'top left',
    width: referenceWidth,
  },
  backButton: {
    left: 12,
    position: 'absolute',
    top: 22,
  },
  screenTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
    left: 70,
    letterSpacing: 1.5,
    lineHeight: 20,
    position: 'absolute',
    right: 70,
    textAlign: 'center',
    top: 38,
  },
  stepPosition: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 75,
  },
  stepIndicator: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 20,
    justifyContent: 'center',
  },
  stepGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  stepLine: {
    backgroundColor: colors.textDisabled,
    height: StyleSheet.hairlineWidth,
    marginLeft: 3,
    width: 37.6,
  },
  step: {
    alignItems: 'center',
    borderColor: colors.textDisabled,
    borderRadius: radius.round,
    borderWidth: 1,
    height: 17,
    justifyContent: 'center',
    width: 17,
  },
  activeStep: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepText: {
    color: colors.textDisabled,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 9,
    includeFontPadding: false,
    lineHeight: 11,
  },
  activeStepText: {
    color: colors.surface,
  },
  completionSection: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    left: 21,
    position: 'absolute',
    top: 114,
    width: 370,
  },
  completionIconCircle: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  completionTexts: {
    gap: 15,
    width: 252,
  },
  completionTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 17,
    includeFontPadding: false,
    lineHeight: 22,
  },
  completionDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
    includeFontPadding: false,
    lineHeight: 17,
  },
  uploadFileCard: {
    borderRadius: radius.md,
    left: 21,
    position: 'absolute',
    top: 204,
    width: 370,
  },
  uploadFileContent: {
    gap: 8,
    padding: 15,
  },
  cardTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 13,
    includeFontPadding: false,
    lineHeight: 17,
  },
  uploadFileBottom: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  filePreview: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  fileTexts: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  fileName: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
    includeFontPadding: false,
    lineHeight: 17,
  },
  uploadTime: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 10,
    includeFontPadding: false,
    lineHeight: 17,
  },
  reuploadButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    height: 30,
    justifyContent: 'center',
    width: 70,
  },
  reuploadText: {
    color: colors.primary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 11,
    includeFontPadding: false,
    lineHeight: 17,
  },
  extractedCard: {
    borderRadius: radius.md,
    height: 450,
    left: 21,
    position: 'absolute',
    top: 359,
    width: 370,
  },
  extractedContent: {
    gap: 12,
    height: '100%',
    paddingBottom: 15,
    paddingHorizontal: 15,
    paddingTop: 16,
  },
  metricList: {
    flex: 1,
    minHeight: 0,
  },
  metricListContent: {
    gap: 12,
    paddingRight: 2,
  },
  metricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
  },
  metricIconCircle: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  metricMain: {
    flex: 1,
    gap: 7,
  },
  metricContent: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 20,
  },
  metricLabel: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 12,
    includeFontPadding: false,
    lineHeight: 17,
    width: 105,
  },
  metricValue: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  metricValueText: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 12,
    includeFontPadding: false,
    lineHeight: 17,
  },
  metricInput: {
    backgroundColor: '#F1F1F1',
    borderRadius: radius.sm,
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 12,
    height: 25,
    includeFontPadding: false,
    lineHeight: 17,
    paddingHorizontal: 6,
    paddingVertical: 0,
    width: 80,
  },
  metricUnit: {
    color: colors.textSecondary,
  },
  modifyButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    height: 20,
    justifyContent: 'center',
    width: 40,
  },
  modifyButtonText: {
    color: colors.primary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 11,
    includeFontPadding: false,
    lineHeight: 17,
  },
  confirmButton: {
    borderColor: '#1371EB',
  },
  confirmButtonText: {
    color: '#1371EB',
  },
  metricDivider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  privacyBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: 20,
    marginTop: 'auto',
    minHeight: 50,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  privacyText: {
    color: colors.textSecondary,
    flex: 1,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 9,
    includeFontPadding: false,
    lineHeight: 13,
  },
  privacyEmphasis: {
    color: colors.primaryDark,
  },
  nextButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryMedium,
    borderRadius: radius.md,
    height: 45,
    justifyContent: 'center',
    left: 21,
    position: 'absolute',
    top: 830,
    width: 370,
  },
  nextButtonText: {
    color: colors.surface,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 16,
    includeFontPadding: false,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.72,
  },
});
