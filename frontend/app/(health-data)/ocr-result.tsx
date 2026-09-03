import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import type { SvgProps } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BMIIcon from '@/assets/icons/data/BMI.svg';
import BMRIcon from '@/assets/icons/data/BMR.svg';
import BloodPressureIcon from '@/assets/icons/data/BloodPressure.svg';
import BodyFatPercentageIcon from '@/assets/icons/data/BodyFat_Percentage.svg';
import CholesterolIcon from '@/assets/icons/data/Cholesterol.svg';
import DateIcon from '@/assets/icons/data/Date.svg';
import DiabetesIcon from '@/assets/icons/data/Diabetes.svg';
import FatIcon from '@/assets/icons/data/Fat.svg';
import VisceralFatIcon from '@/assets/icons/data/Fat_Level.svg';
import HeightIcon from '@/assets/icons/data/Height.svg';
import HemoglobinIcon from '@/assets/icons/data/Hemoglobin.svg';
import MuscleIcon from '@/assets/icons/data/Muscle.svg';
import WeightIcon from '@/assets/icons/data/Weight.svg';
import CameraIcon from '@/assets/icons/system/Camera.svg';
import DocumentIcon from '@/assets/icons/system/Document.svg';
import CheckIcon from '@/assets/icons/system/Check.svg';
import ShieldCheckIcon from '@/assets/icons/system/ShieldCheck.svg';
import {
  AppBottomSheet,
  AppCard,
  BackButton,
  CustomScrollIndicator,
  useCustomScrollIndicator,
} from '@/src/components/common';
import { HealthUploadOptionCard } from '@/src/features/health-data/HealthUploadOptionCard';
import {
  createMockOCRResults,
  type HealthCheckupOCRResult,
  type InbodyOCRResult,
  type OCRResultItem,
} from '@/src/features/health-data/ocrResults';
import {
  type SelectedHealthFile,
  useHealthFilePicker,
} from '@/src/features/health-data/useHealthFilePicker';
import { colors, fontFamilies, radius } from '@/src/theme';

const resultBackground = require('../../assets/images/backgrounds/4_Upload.png');

const referenceWidth = 412;
const referenceHeight = 917;
const referenceTitleTop = 38;
const keyboardSafeGap = 16;
const webInnerScrollStyle =
  Platform.OS === 'web' ? ({ overscrollBehavior: 'contain' } as ViewStyle) : undefined;

function formatUploadTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}. ${pad(date.getMonth() + 1)}. ${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isImageFile(file: SelectedHealthFile) {
  if (file.mimeType?.toLowerCase().startsWith('image/')) return true;
  return /\.(avif|bmp|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name);
}

function parseSelectedFiles(value?: string): SelectedHealthFile[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (file): file is SelectedHealthFile =>
        typeof file === 'object' &&
        file !== null &&
        typeof file.name === 'string' &&
        typeof file.uri === 'string' &&
        (file.source === 'camera' || file.source === 'document'),
    );
  } catch {
    return [];
  }
}

type OCRMetricKey = keyof HealthCheckupOCRResult | keyof InbodyOCRResult;

interface HealthMetricDefinition {
  Icon: ComponentType<SvgProps>;
  iconKind: 'fill' | 'stroke';
  inputKind: 'bloodPressure' | 'date' | 'decimal' | 'integer';
  keyboardType: 'decimal-pad' | 'numeric';
  key: OCRMetricKey;
  label: string;
  unit: string;
}

const healthMetricDefinitions: HealthMetricDefinition[] = [
  {
    Icon: DateIcon,
    iconKind: 'fill',
    inputKind: 'date',
    keyboardType: 'numeric',
    key: 'checkupDate',
    label: '검진일',
    unit: '',
  },
  {
    Icon: HeightIcon,
    iconKind: 'fill',
    inputKind: 'decimal',
    keyboardType: 'decimal-pad',
    key: 'height',
    label: '신장',
    unit: 'cm',
  },
  {
    Icon: WeightIcon,
    iconKind: 'stroke',
    inputKind: 'decimal',
    keyboardType: 'decimal-pad',
    key: 'weight',
    label: '체중',
    unit: 'kg',
  },
  {
    Icon: BMIIcon,
    iconKind: 'stroke',
    inputKind: 'decimal',
    keyboardType: 'decimal-pad',
    key: 'bmi',
    label: 'BMI',
    unit: '',
  },
  {
    Icon: BloodPressureIcon,
    iconKind: 'fill',
    inputKind: 'bloodPressure',
    keyboardType: 'numeric',
    key: 'bloodPressure',
    label: '혈압',
    unit: 'mmHg',
  },
  {
    Icon: DiabetesIcon,
    iconKind: 'fill',
    inputKind: 'integer',
    keyboardType: 'numeric',
    key: 'fastingBloodSugar',
    label: '공복혈당',
    unit: 'mg/dL',
  },
  {
    Icon: CholesterolIcon,
    iconKind: 'stroke',
    inputKind: 'integer',
    keyboardType: 'numeric',
    key: 'totalCholesterol',
    label: '총콜레스테롤',
    unit: 'mg/dL',
  },
  {
    Icon: HemoglobinIcon,
    iconKind: 'stroke',
    inputKind: 'decimal',
    keyboardType: 'decimal-pad',
    key: 'hemoglobin',
    label: '혈색소',
    unit: 'g/dL',
  },
];

const inbodyMetricDefinitions: HealthMetricDefinition[] = [
  {
    Icon: DateIcon,
    iconKind: 'fill',
    inputKind: 'date',
    keyboardType: 'numeric',
    key: 'measurementDate',
    label: '검사일',
    unit: '',
  },
  {
    Icon: HeightIcon,
    iconKind: 'fill',
    inputKind: 'decimal',
    keyboardType: 'decimal-pad',
    key: 'height',
    label: '신장',
    unit: 'cm',
  },
  {
    Icon: WeightIcon,
    iconKind: 'stroke',
    inputKind: 'decimal',
    keyboardType: 'decimal-pad',
    key: 'weight',
    label: '체중',
    unit: 'kg',
  },
  {
    Icon: MuscleIcon,
    iconKind: 'stroke',
    inputKind: 'decimal',
    keyboardType: 'decimal-pad',
    key: 'skeletalMuscleMass',
    label: '골격근량',
    unit: 'kg',
  },
  {
    Icon: FatIcon,
    iconKind: 'fill',
    inputKind: 'decimal',
    keyboardType: 'decimal-pad',
    key: 'bodyFatMass',
    label: '체지방량',
    unit: 'kg',
  },
  {
    Icon: BodyFatPercentageIcon,
    iconKind: 'stroke',
    inputKind: 'decimal',
    keyboardType: 'decimal-pad',
    key: 'bodyFatPercentage',
    label: '체지방률',
    unit: '%',
  },
  {
    Icon: BMIIcon,
    iconKind: 'stroke',
    inputKind: 'decimal',
    keyboardType: 'decimal-pad',
    key: 'bmi',
    label: 'BMI',
    unit: '',
  },
  {
    Icon: BMRIcon,
    iconKind: 'stroke',
    inputKind: 'integer',
    keyboardType: 'numeric',
    key: 'basalMetabolicRate',
    label: '기초대사량',
    unit: 'kcal',
  },
  {
    Icon: VisceralFatIcon,
    iconKind: 'stroke',
    inputKind: 'integer',
    keyboardType: 'numeric',
    key: 'visceralFatLevel',
    label: '내장지방레벨',
    unit: '',
  },
];

function sanitizeDecimalInput(text: string) {
  const sanitized = text.replace(/[^0-9.]/g, '');
  const [integer = '', ...decimals] = sanitized.split('.');
  return decimals.length > 0 ? `${integer}.${decimals.join('')}` : integer;
}

function sanitizeMetricInput(text: string, inputKind: HealthMetricDefinition['inputKind']) {
  if (inputKind === 'decimal') return sanitizeDecimalInput(text);
  return text.replace(/\D/g, '');
}

function formatCheckupDate(value: string) {
  if (!/^\d{8}$/.test(value)) return null;

  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
}

function updateResultData(
  result: OCRResultItem,
  values: Record<string, string>,
): OCRResultItem {
  if (result.type === 'health_checkup') {
    return {
      ...result,
      data: values as unknown as HealthCheckupOCRResult,
    };
  }

  return {
    ...result,
    data: values as unknown as InbodyOCRResult,
  };
}

function ResultStepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View
      accessibilityLabel={`OCR 결과 확인 ${total}개 중 ${current}번째`}
      style={styles.stepIndicator}
    >
      {Array.from({ length: total }, (_, index) => index + 1).map((step, index) => (
        <View key={step} style={styles.stepGroup}>
          {index > 0 ? <View style={styles.stepLine} /> : null}
          <View style={[styles.step, step === current && styles.activeStep]}>
            <Text style={[styles.stepText, step === current && styles.activeStepText]}>{step}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function MetricRow({
  definition,
  diastolicDraft,
  draftValue,
  isEditing,
  onChangeDraft,
  onChangeDiastolicDraft,
  onChangeSystolicDraft,
  onRowRef,
  onToggleEdit,
  systolicDraft,
  value,
}: {
  definition: HealthMetricDefinition;
  diastolicDraft: string;
  draftValue: string;
  isEditing: boolean;
  onChangeDraft: (value: string) => void;
  onChangeDiastolicDraft: (value: string) => void;
  onChangeSystolicDraft: (value: string) => void;
  onRowRef: (instance: View | null) => void;
  onToggleEdit: () => void;
  systolicDraft: string;
  value: string;
}) {
  const { Icon } = definition;
  const iconColorProps =
    definition.iconKind === 'fill' ? { fill: colors.primary } : { stroke: colors.primary };

  return (
    <View ref={onRowRef} style={styles.metricRow}>
      <View style={styles.metricIconCircle}>
        <Icon {...iconColorProps} height={22} width={22} />
      </View>
      <View style={styles.metricMain}>
        <View style={styles.metricContent}>
          <Text style={styles.metricLabel}>{definition.label}</Text>
          <View style={styles.metricValue}>
            {isEditing && definition.inputKind === 'bloodPressure' ? (
              <View style={styles.bloodPressureInputs}>
                <TextInput
                  accessibilityLabel="수축기 혈압"
                  autoFocus
                  keyboardType="numeric"
                  maxLength={3}
                  onChangeText={(text) => onChangeSystolicDraft(text.replace(/\D/g, ''))}
                  returnKeyType="next"
                  selectionColor="#1371EB"
                  style={[styles.metricInput, styles.bloodPressureInput]}
                  value={systolicDraft}
                />
                <Text style={styles.bloodPressureSeparator}>/</Text>
                <TextInput
                  accessibilityLabel="이완기 혈압"
                  keyboardType="numeric"
                  maxLength={3}
                  onChangeText={(text) => onChangeDiastolicDraft(text.replace(/\D/g, ''))}
                  onSubmitEditing={onToggleEdit}
                  returnKeyType="done"
                  selectionColor="#1371EB"
                  style={[styles.metricInput, styles.bloodPressureInput]}
                  value={diastolicDraft}
                />
              </View>
            ) : isEditing ? (
              <TextInput
                autoFocus
                keyboardType={definition.keyboardType}
                maxLength={definition.inputKind === 'date' ? 8 : undefined}
                onChangeText={(text) =>
                  onChangeDraft(sanitizeMetricInput(text, definition.inputKind))
                }
                onSubmitEditing={onToggleEdit}
                returnKeyType="done"
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
  const { files } = useLocalSearchParams<{
    files?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { isSelecting, pickDocument, takePhoto } = useHealthFilePicker();
  const [results, setResults] = useState<OCRResultItem[]>(() =>
    createMockOCRResults(parseSelectedFiles(files)),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isInnerScrollActive, setIsInnerScrollActive] = useState(false);
  const [isReuploadSheetOpen, setIsReuploadSheetOpen] = useState(false);
  const [metricValues, setMetricValues] = useState<Record<string, string>>(
    () => ({ ...results[0].data }),
  );
  const [editingMetricKey, setEditingMetricKey] = useState<OCRMetricKey | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [systolicDraft, setSystolicDraft] = useState('');
  const [diastolicDraft, setDiastolicDraft] = useState('');
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0); // 추가
  const correctionFrame = useRef<number | null>(null);
  const editingMetricKeyRef = useRef<OCRMetricKey | null>(null);
  const metricRowRefs = useRef<Partial<Record<OCRMetricKey, View>>>({});
  const inbodyScrollRef = useRef<ScrollView>(null);
  const screenScrollRef = useRef<ScrollView>(null);
  const screenScrollY = useRef(0);
  const screenViewportRef = useRef<View>(null);
  const innerTouchActiveRef = useRef(false);
  const innerScrollIndicator = useCustomScrollIndicator();
  const scrollIndicator = useCustomScrollIndicator();

  const availableWidth = Math.max(0, windowWidth - insets.left - insets.right);
  const scale = Math.min(1, availableWidth / referenceWidth);
  const safeTopAdjustment = Math.max(0, insets.top + 8 - referenceTitleTop * scale);
  const canvasHeight = referenceHeight * scale;
  const currentResult = results[currentIndex];
  const metricDefinitions =
    currentResult.type === 'health_checkup' ? healthMetricDefinitions : inbodyMetricDefinitions;
  const uploadedFile: SelectedHealthFile = {
    mimeType: currentResult.fileMimeType,
    name: currentResult.fileName,
    source: currentResult.fileSource,
    uri: currentResult.previewUri ?? '',
  };
  const uploadTimestamp = currentResult.uploadedAt ?? '2026. 08. 11 09:13';
  const hasImagePreview = uploadedFile.uri.length > 0 && isImageFile(uploadedFile);

  const setParentScrollLocked = useCallback((locked: boolean) => {
    if (innerTouchActiveRef.current === locked) return;

    innerTouchActiveRef.current = locked;
    screenScrollRef.current?.setNativeProps({ scrollEnabled: !locked });
    setIsInnerScrollActive(locked);
  }, []);

  const centerFocusedRow = useCallback(
  (key: OCRMetricKey, activeKeyboardTop: number) => {
    const row = metricRowRefs.current[key];
    const scrollView = screenScrollRef.current;
    const viewport = screenViewportRef.current;

    if (
      !row ||
      !scrollView ||
      !viewport ||
      editingMetricKeyRef.current !== key
    ) {
      return;
    }

    viewport.measureInWindow(
      (_viewportX, viewportTop, _viewportWidth, viewportHeight) => {
        if (editingMetricKeyRef.current !== key) return;

        row.measureInWindow(
          (_rowX, rowTop, _rowWidth, rowHeight) => {
            if (editingMetricKeyRef.current !== key) return;

            // 실제로 사용할 수 있는 화면의 위/아래
            const visibleTop = Math.max(viewportTop, insets.top);
            const visibleBottom = Math.min(
              viewportTop + viewportHeight,
              activeKeyboardTop - keyboardSafeGap,
            );

            // 키보드를 제외한 화면의 정확한 세로 중앙
            const visibleCenter =
              visibleTop + (visibleBottom - visibleTop) / 2;

            // 현재 수정 중인 Row의 세로 중앙
            const rowCenter = rowTop + rowHeight / 2;

            // Row 중심을 화면 중심으로 옮기기 위해 필요한 거리
            const deltaY = rowCenter - visibleCenter;

            const targetY = Math.max(
              0,
              screenScrollY.current + deltaY,
            );

            screenScrollY.current = targetY;

            scrollView.scrollTo({
              animated: false,
              y: targetY,
            });
          },
        );
      },
    );
  },
  [insets.top],
);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardTop(event.endCoordinates.screenY);
      setKeyboardHeight(event.endCoordinates.height); // 추가
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardTop(null);
      setKeyboardHeight(0); // 추가
      if (correctionFrame.current !== null) {
        cancelAnimationFrame(correctionFrame.current);
        correctionFrame.current = null;
      }
    });

    return () => {
      if (correctionFrame.current !== null) cancelAnimationFrame(correctionFrame.current);
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    editingMetricKeyRef.current = editingMetricKey;
    if (!editingMetricKey || keyboardTop === null) return;

    if (correctionFrame.current !== null) cancelAnimationFrame(correctionFrame.current);
    correctionFrame.current = requestAnimationFrame(() => {
      correctionFrame.current = null;

      if (editingMetricKeyRef.current === editingMetricKey) {
        centerFocusedRow(editingMetricKey, keyboardTop);
      }
    });

    return () => {
      if (correctionFrame.current !== null) {
        cancelAnimationFrame(correctionFrame.current);
        correctionFrame.current = null;
      }
    };
  }, [centerFocusedRow, editingMetricKey, keyboardTop, keyboardHeight]);

  const applyEditingDraft = (current: Record<string, string>) => {
    if (!editingMetricKey) return current;

    let nextValue = current[editingMetricKey];
    const editingDefinition = metricDefinitions.find(
      (definition) => definition.key === editingMetricKey,
    );

    if (editingDefinition?.inputKind === 'date') {
      if (draftValue.trim() !== '') {
        nextValue = formatCheckupDate(draftValue) ?? current[editingMetricKey];
      }
    } else if (editingMetricKey === 'bloodPressure') {
      if (systolicDraft && diastolicDraft) {
        nextValue = `${systolicDraft} / ${diastolicDraft}`;
      }
    } else if (draftValue.trim() !== '') {
      nextValue = draftValue;
    }

    return { ...current, [editingMetricKey]: nextValue };
  };

  const handleMetricEdit = (key: OCRMetricKey) => {
    if (editingMetricKey) {
      setMetricValues(applyEditingDraft);
    }

    if (editingMetricKey === key) {
      editingMetricKeyRef.current = null;
      setEditingMetricKey(null);
      return;
    }

    if (key === 'bloodPressure') {
      setSystolicDraft('');
      setDiastolicDraft('');
    } else {
      setDraftValue('');
    }

    editingMetricKeyRef.current = key;
    setEditingMetricKey(key);
  };

  const handleReuploadSelection = async (selectFile: () => Promise<SelectedHealthFile | null>) => {
    const file = await selectFile();
    if (!file) return;

    setResults((current) =>
      current.map((result, index) =>
        index === currentIndex
          ? {
              ...result,
              fileMimeType: file.mimeType,
              fileName: file.name,
              fileSource: file.source,
              previewUri: file.uri,
              uploadedAt: formatUploadTimestamp(new Date()),
            }
          : result,
      ),
    );
    setIsReuploadSheetOpen(false);
    console.log('reuploadFile', file);
    // TODO: 선택한 파일로 OCR 재실행
  };

  const handleNext = () => {
    const committedValues = applyEditingDraft(metricValues);
    setMetricValues(committedValues);
    setResults((current) =>
      current.map((result, index) =>
        index === currentIndex ? updateResultData(result, committedValues) : result,
      ),
    );

    if (currentIndex >= results.length - 1) {
      Keyboard.dismiss();
      router.push('/total-analysis');
      return;
    }

    const nextIndex = currentIndex + 1;
    const nextResult = results[nextIndex];
    editingMetricKeyRef.current = null;
    metricRowRefs.current = {};
    setEditingMetricKey(null);
    setDraftValue('');
    setSystolicDraft('');
    setDiastolicDraft('');
    setIsInnerScrollActive(false);
    setCurrentIndex(nextIndex);
    setMetricValues({ ...nextResult.data });
    inbodyScrollRef.current?.scrollTo({ animated: false, y: 0 });
    screenScrollY.current = 0;
    screenScrollRef.current?.scrollTo({ animated: false, y: 0 });
    Keyboard.dismiss();
  };

  const metricRows = metricDefinitions.map((definition) => (
    <MetricRow
      key={definition.key}
      definition={definition}
      diastolicDraft={diastolicDraft}
      draftValue={editingMetricKey === definition.key ? draftValue : ''}
      isEditing={editingMetricKey === definition.key}
      onChangeDraft={setDraftValue}
      onChangeDiastolicDraft={setDiastolicDraft}
      onChangeSystolicDraft={setSystolicDraft}
      onRowRef={(instance) => {
        if (instance) {
          metricRowRefs.current[definition.key] = instance;
        } else {
          delete metricRowRefs.current[definition.key];
        }
      }}
      onToggleEdit={() => handleMetricEdit(definition.key)}
      systolicDraft={systolicDraft}
      value={metricValues[definition.key] ?? ''}
    />
  ));

  return (
    <View ref={screenViewportRef} style={styles.root}>
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
            //paddingBottom: insets.bottom,
            paddingBottom: 
              insets.bottom +
              (keyboardHeight > 0 ? keyboardHeight + keyboardSafeGap : 0), // 추가
            paddingTop: safeTopAdjustment,
          },
        ]}
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="always"
        onContentSizeChange={scrollIndicator.onContentSizeChange}
        onLayout={scrollIndicator.onLayout}
        onMomentumScrollBegin={scrollIndicator.onMomentumScrollBegin}
        onMomentumScrollEnd={scrollIndicator.onMomentumScrollEnd}
        onScroll={(event) => {
          screenScrollY.current = event.nativeEvent.contentOffset.y;
          scrollIndicator.onScroll(event);
        }}
        onScrollBeginDrag={scrollIndicator.onScrollBeginDrag}
        onScrollEndDrag={scrollIndicator.onScrollEndDrag}
        overScrollMode="never"
        ref={screenScrollRef}
        scrollEnabled={!isInnerScrollActive}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: canvasHeight, width: referenceWidth * scale }}>
          <View style={[styles.canvas, { transform: [{ scale }] }]}>
            <BackButton onPress={() => router.back()} size={44} style={styles.backButton} />
            <Text style={styles.screenTitle}>OCR 결과 확인</Text>
            <View style={styles.stepPosition}>
              <ResultStepIndicator current={currentIndex + 1} total={results.length} />
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
                    {hasImagePreview ? (
                      <Image
                        accessibilityLabel={`${uploadedFile.name} 미리보기`}
                        resizeMode="cover"
                        source={{ uri: uploadedFile.uri }}
                        style={styles.filePreviewImage}
                      />
                    ) : (
                      <DocumentIcon fill={colors.primary} height={42} width={42} />
                    )}
                  </View>
                  <View style={styles.fileTexts}>
                    <Text numberOfLines={1} style={styles.fileName}>
                      {uploadedFile.name}
                    </Text>
                    <Text style={styles.uploadTime}>업로드 일시 {uploadTimestamp}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setIsReuploadSheetOpen(true)}
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
                {currentResult.type === 'inbody' ? (
                  <View style={styles.inbodyMetricListContainer}>
                    <ScrollView
                      key={currentResult.id}
                      ref={inbodyScrollRef}
                      bounces={false}
                      contentContainerStyle={styles.metricListContent}
                      keyboardShouldPersistTaps="always"
                      nestedScrollEnabled
                      onContentSizeChange={innerScrollIndicator.onContentSizeChange}
                      onLayout={innerScrollIndicator.onLayout}
                      onMomentumScrollBegin={innerScrollIndicator.onMomentumScrollBegin}
                      onMomentumScrollEnd={innerScrollIndicator.onMomentumScrollEnd}
                      onScroll={innerScrollIndicator.onScroll}
                      onResponderTerminate={() => setParentScrollLocked(false)}
                      onScrollBeginDrag={innerScrollIndicator.onScrollBeginDrag}
                      onScrollEndDrag={innerScrollIndicator.onScrollEndDrag}
                      onTouchCancel={() => setParentScrollLocked(false)}
                      onTouchEnd={() => setParentScrollLocked(false)}
                      onTouchStart={() => setParentScrollLocked(true)}
                      scrollEventThrottle={16}
                      showsVerticalScrollIndicator={false}
                      style={[styles.inbodyMetricList, webInnerScrollStyle]}
                    >
                      {metricRows}
                    </ScrollView>
                    <CustomScrollIndicator
                      {...innerScrollIndicator.indicatorProps}
                      rightInset={-5}
                    />
                  </View>
                ) : (
                  <View style={styles.metricListContent}>{metricRows}</View>
                )}
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
              onPress={handleNext}
              style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
            >
              <Text style={styles.nextButtonText}>다음</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <CustomScrollIndicator {...scrollIndicator.indicatorProps} />
      <AppBottomSheet
        contentStyle={styles.reuploadSheetContent}
        handleStyle={styles.reuploadSheetHandle}
        onClose={() => setIsReuploadSheetOpen(false)}
        overlayStyle={styles.reuploadSheetOverlay}
        separateAnimations
        sheetStyle={styles.reuploadSheet}
        visible={isReuploadSheetOpen}
      >
        <View style={styles.reuploadOptions}>
          <HealthUploadOptionCard
            buttonLabel="카메라 열기"
            description={[
              '처방전, 검진 결과, 체성분',
              '리포트 등을 촬영하여',
              '업로드할 수 있어요.',
            ]}
            disabled={isSelecting}
            Icon={CameraIcon}
            onPress={() => void handleReuploadSelection(takePhoto)}
            style={styles.reuploadOptionCard}
            title="카메라로 촬영하기"
          />
          <HealthUploadOptionCard
            buttonLabel="파일 선택"
            description={[
              '이미지, PDF, CSV 파일을',
              '선택하여 여러 개의 파일을',
              '한 번에 업로드할 수 있어요.',
            ]}
            disabled={isSelecting}
            Icon={DocumentIcon}
            onPress={() => void handleReuploadSelection(pickDocument)}
            secondary
            style={styles.reuploadOptionCard}
            title="문서/파일 선택하기"
          />
        </View>
      </AppBottomSheet>
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
    overflow: 'hidden',
    width: 80,
  },
  filePreviewImage: {
    height: '100%',
    width: '100%',
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
  metricListContent: {
    gap: 12,
    paddingRight: 2,
  },
  inbodyMetricList: {
    flex: 1,
    width: '100%',
  },
  inbodyMetricListContainer: {
    height: 328,
    position: 'relative',
    width: 341,
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
    backgroundColor: '#FFFFFF',
    borderColor: '#D9DEE5',
    borderRadius: 8,
    borderWidth: 1,

    color: colors.textBody,
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 12,

    height: 28,
    includeFontPadding: false,
    lineHeight: 17,

    paddingHorizontal: 8,
    paddingVertical: 0,

    width: 92,
  },
  bloodPressureInputs: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  bloodPressureInput: {
    paddingHorizontal: 3,
    textAlign: 'center',
    width: 36,
  },
  bloodPressureSeparator: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 12,
    lineHeight: 17,
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
  reuploadSheetOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  reuploadSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    minHeight: 300,
  },
  reuploadSheetHandle: {
    backgroundColor: '#D9D9D9',
    height: 4,
    marginTop: 11,
    width: 40,
  },
  reuploadSheetContent: {
    paddingBottom: 0,
    paddingHorizontal: 16,
    paddingTop: 36,
  },
  reuploadOptions: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
    width: '100%',
  },
  reuploadOptionCard: {
    flex: 1,
    maxWidth: 180,
    width: 'auto',
  },
});
