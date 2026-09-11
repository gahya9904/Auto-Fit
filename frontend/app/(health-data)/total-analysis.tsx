import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Animated,
  Dimensions,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ArrowRightIcon from '@/assets/icons/common/ArrowRight.svg';
import CaretDownIcon from '@/assets/icons/common/chevrons/Down.svg';
import CaretRightIcon from '@/assets/icons/common/chevrons/Right.svg';
import BarbellIcon from '@/assets/icons/deco/Barbell.svg';
import ClipboardIcon from '@/assets/icons/deco/ClipboardText.svg';
import TargetIcon from '@/assets/icons/deco/Target.svg';
import MuscleIcon from '@/assets/icons/data/Muscle.svg';
import WeightIcon from '@/assets/icons/data/Weight.svg';
import StarIcon from '@/assets/icons/day/Star_Fill.svg';
import ChartIcon from '@/assets/icons/graph/ChartBar.svg';
import QuestionIcon from '@/assets/icons/system/Question.svg';
import {
  TotalAnalysisBottomSheet,
  type AnalysisSheetState,
} from '@/src/components/analysis/TotalAnalysisBottomSheet';
import {
  analysisReasons,
  keyMetrics,
  metricCriteria,
  references,
  type AnalysisIcon,
  type AnalysisMetric,
  type AnalysisTone,
} from '@/src/components/analysis/totalAnalysisData';
import { CustomScrollIndicator, useCustomScrollIndicator } from '@/src/components/common';
import { colors, fontFamilies } from '@/src/theme';

const background = require('../../assets/images/backgrounds/6_Exercise.png');
const illustration = require('../../assets/images/illustrations/analysis_and_start/Analysis.png');
const strategyBackground = require('../../assets/images/backgrounds/9_Analysis_Card.png');

const referenceWidth = 412;
const referenceHeight = 917;
const minimumScreenHeight = 740;
const maximumScreenHeight = referenceHeight;
const warning = '#FFA450';
const danger = '#E57373';

const accordionAnimation = {
  duration: Platform.OS === 'web' ? 240 : 200,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

const tonePalette = {
  normal: { color: colors.primaryDark, background: colors.primaryLight },
  warning: { color: warning, background: '#FFF9F4' },
  danger: { color: danger, background: '#FFF1F1' },
} satisfies Record<AnalysisTone, { color: string; background: string }>;

function IconCircle({
  Icon,
  color,
  backgroundColor,
  size = 30,
  iconSize = 22,
}: {
  Icon: AnalysisIcon;
  color: string;
  backgroundColor: string;
  size?: number;
  iconSize?: number;
}) {
  return (
    <View
      style={[
        styles.iconCircle,
        {
          backgroundColor,
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      <Icon color={color} height={iconSize} width={iconSize} />
    </View>
  );
}

function StrategyChip({ Icon, label }: { Icon: AnalysisIcon; label: string }) {
  return (
    <View style={styles.strategyChip}>
      <View style={styles.strategyChipInner}>
        <IconCircle
          Icon={Icon}
          backgroundColor="#D2EEE9"
          color={colors.primaryDark}
          iconSize={15}
          size={20}
        />
        <Text style={styles.strategyChipText}>{label}</Text>
      </View>
    </View>
  );
}

function MetricStatus({ metric }: { metric: AnalysisMetric }) {
  const palette = tonePalette[metric.tone ?? 'normal'];
  return (
    <View style={[styles.metricStatus, { backgroundColor: palette.background }]}>
      <Text style={[styles.metricStatusText, { color: palette.color }]}>{metric.status}</Text>
    </View>
  );
}

function KeyMetricCard({ metric, height }: { metric: AnalysisMetric; height: number }) {
  const Icon = metric.icon;
  const palette = tonePalette[metric.tone ?? 'normal'];
  return (
    <View style={[styles.keyMetricCard, { height }]}>
      <View style={styles.keyMetricTitleRow}>
        <IconCircle Icon={Icon} backgroundColor={palette.background} color={palette.color} />
        <Text style={styles.keyMetricName}>{metric.name}</Text>
      </View>
      <Text style={styles.keyMetricValue}>
        {metric.value} <Text style={styles.keyMetricUnit}>{metric.unit}</Text>
      </Text>
      <MetricStatus metric={metric} />
    </View>
  );
}

function AccordionHeader({
  icon: Icon,
  title,
  expanded,
  height,
  onPress,
}: {
  icon: AnalysisIcon;
  title: string;
  expanded: boolean;
  height: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={({ pressed }) => [styles.accordionHeader, { height }, pressed && styles.pressed]}
    >
      <View style={styles.accordionHeaderLeft}>
        <IconCircle
          Icon={Icon}
          backgroundColor={colors.primaryLight}
          color={colors.primaryDark}
          iconSize={25}
        />
        <Text style={styles.accordionHeaderTitle}>{title}</Text>
      </View>
      <View style={expanded ? styles.caretUp : undefined}>
        <CaretDownIcon color={colors.textBody} height={22} width={22} />
      </View>
    </Pressable>
  );
}

function ReasonAccordion({
  expanded,
  headerHeight,
  onToggle,
  onOpenMetrics,
}: {
  expanded: boolean;
  headerHeight: number;
  onToggle: () => void;
  onOpenMetrics: (reasonId: string) => void;
}) {
  return (
    <View style={styles.accordionCard}>
      <AccordionHeader
        expanded={expanded}
        height={headerHeight}
        icon={QuestionIcon}
        onPress={onToggle}
        title="추천 이유 자세히 보기"
      />
      {expanded ? (
        <View style={styles.accordionBody}>
          <View style={styles.accordionDivider} />
          <View style={styles.reasonIntro}>
            <Text style={styles.evidenceSectionTitle}>왜 이런 전략을 추천했나요?</Text>
            <Text style={styles.evidenceDescription}>
              체중 감량 목표는 유지하고,{`\n`}현재 건강 상태에 맞게 감량 방식을 조정했어요.
            </Text>
          </View>
          <View style={styles.accordionDivider} />
          <View style={styles.reasonList}>
            {analysisReasons.map((reason) => {
              const Icon = reason.icon;
              return (
                <View key={reason.id} style={styles.reasonItem}>
                  <View style={styles.reasonTitleRow}>
                    <IconCircle
                      Icon={Icon}
                      backgroundColor={colors.primaryLight}
                      color={colors.primaryDark}
                      iconSize={20}
                      size={32}
                    />
                    <Text style={styles.reasonTitle}>{reason.title}</Text>
                  </View>
                  <Text style={styles.reasonDescription}>{reason.description}</Text>
                  <View style={styles.additionalRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onOpenMetrics(reason.id)}
                      style={({ pressed }) => [styles.additionalButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.additionalButtonText}>추가 지표 보기</Text>
                      <CaretRightIcon color={colors.primaryDark} height={16} width={16} />
                    </Pressable>
                    <Text numberOfLines={1} style={styles.additionalSummary}>
                      {reason.metricSummary}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
          <View style={styles.accordionDivider} />
          <View style={styles.finalRecommendation}>
            <IconCircle
              Icon={TargetIcon}
              backgroundColor={colors.surface}
              color={colors.primaryDark}
              iconSize={25}
              size={35}
            />
            <View style={styles.finalRecommendationCopy}>
              <Text style={styles.finalRecommendationLabel}>최종 추천 방향</Text>
              <Text numberOfLines={1} style={styles.finalRecommendationText}>
                단기간 체중 감량{' '}
                <Text style={styles.primaryDark}>→ 근육 유지 기반 체지방 감량</Text>
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SourceAccordion({
  expanded,
  headerHeight,
  onToggle,
  onOpenCriterion,
  onOpenReference,
}: {
  expanded: boolean;
  headerHeight: number;
  onToggle: () => void;
  onOpenCriterion: (criterionId: string) => void;
  onOpenReference: (referenceId: string) => void;
}) {
  return (
    <View style={styles.accordionCard}>
      <AccordionHeader
        expanded={expanded}
        height={headerHeight}
        icon={ChartIcon}
        onPress={onToggle}
        title="분석 기준 및 출처 보기"
      />
      {expanded ? (
        <View style={styles.sourceBody}>
          <View style={styles.accordionDivider} />
          <View style={styles.sourceSection}>
            <View style={styles.sourceSectionHeading}>
              <Text style={styles.evidenceSectionTitle}>주요 지표 판정 기준</Text>
              <Text style={styles.sourceDescription}>
                현재 수치의 상태를 판단할 때 적용한 기준이에요.
              </Text>
            </View>
            <View style={styles.criteriaList}>
              {metricCriteria.map((criterion) => {
                const Icon = criterion.icon;
                const palette = tonePalette[criterion.tone];
                return (
                  <View key={criterion.id} style={styles.criterionCard}>
                    <View style={styles.criterionTop}>
                      <View style={styles.criterionTitleRow}>
                        <IconCircle
                          Icon={Icon}
                          backgroundColor={palette.background}
                          color={palette.color}
                        />
                        <Text style={styles.criterionName}>{criterion.metricName}</Text>
                      </View>
                      <View
                        style={[styles.criterionStatus, { backgroundColor: palette.background }]}
                      >
                        <Text style={[styles.criterionStatusText, { color: palette.color }]}>
                          {criterion.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.criterionSummary}>{criterion.summary}</Text>
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={6}
                      onPress={() => onOpenCriterion(criterion.id)}
                    >
                      <Text style={styles.criterionLink}>기준 자세히 보기 &gt;</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
          <View style={styles.sourceSection}>
            <View style={styles.sourceSectionHeading}>
              <Text style={styles.evidenceSectionTitle}>참고한 기준 및 자료</Text>
              <Text style={styles.sourceDescription}>
                분석에 활용한 공식 기준과 전문 자료를 확인할 수 있어요.
              </Text>
            </View>
            <View style={styles.referenceList}>
              {references.map((reference, index) => (
                <View key={reference.id}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onOpenReference(reference.id)}
                    style={({ pressed }) => [styles.referenceItem, pressed && styles.pressed]}
                  >
                    <View style={styles.referenceItemLeft}>
                      <View style={styles.referenceNumber}>
                        <Text style={styles.referenceNumberText}>{index + 1}</Text>
                      </View>
                      <View style={styles.referenceCopy}>
                        <Text style={styles.referenceTitle}>{reference.title}</Text>
                        <Text style={styles.referenceDescription}>{reference.description}</Text>
                      </View>
                    </View>
                    <CaretRightIcon color={colors.textSecondary} height={20} width={20} />
                  </Pressable>
                  {index < references.length - 1 ? <View style={styles.referenceDivider} /> : null}
                </View>
              ))}
            </View>
          </View>
          <View style={styles.analysisInfo}>
            <View style={styles.analysisInfoTitleRow}>
              <QuestionIcon color={colors.primaryDark} height={16} width={16} />
              <Text style={styles.analysisInfoTitle}>분석 안내</Text>
            </View>
            <Text style={styles.analysisInfoText}>
              이 결과는 등록된 건강 데이터와 사용자가 설정한 목표를 기반으로 제공되는 건강관리 참고
              정보입니다. 데이터가 변경되면 분석 결과도 달라질 수 있어요.
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function TotalAnalysisScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [measuredContentHeight, setMeasuredContentHeight] = useState(0);
  const [reasonExpanded, setReasonExpanded] = useState(false);
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const [sheet, setSheet] = useState<AnalysisSheetState>(null);
  const [sectionAnimations] = useState(() =>
    Array.from({ length: 5 }, () => new Animated.Value(0)),
  );

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const availableWidth = Math.max(0, windowWidth - insets.left - insets.right);
  const widthScale = Math.min(1, availableWidth / referenceWidth);
  const canvasLeft = insets.left + (availableWidth - referenceWidth * widthScale) / 2;
  const safeTop = Math.max(0, insets.top + 8 - 38 * widthScale);
  const responsiveHeight = Platform.OS === 'web' ? windowHeight : Dimensions.get('screen').height;
  const heightProgress = Math.max(
    0,
    Math.min(
      1,
      (responsiveHeight - minimumScreenHeight) / (maximumScreenHeight - minimumScreenHeight),
    ),
  );
  const verticalValue = useCallback(
    (expanded: number, compact: number) => compact + (expanded - compact) * heightProgress,
    [heightProgress],
  );
  const screenTitleTop = verticalValue(38, 28);
  const explainTop = verticalValue(64, 54);
  const explainHeight = verticalValue(120, 108);
  const explainImageSize = verticalValue(128, 104);
  const explainImageRadius = verticalValue(47, 40);
  const explainImageTop = (explainHeight - explainImageSize) / 2;
  const explainCopyWidth = verticalValue(270, 282);
  const explainCopyGap = verticalValue(8, 7);
  const contentTop = verticalValue(192, 168);
  const sectionGap = verticalValue(10, 7);
  const summaryPadding = verticalValue(14, 12);
  const summaryGap = verticalValue(10, 8);
  const summaryCopyGap = verticalValue(7, 6);
  const strategyPadding = verticalValue(15, 13);
  const strategyGap = verticalValue(10, 7);
  const strategyHeadingGap = verticalValue(7, 5);
  const keyMetricsGap = verticalValue(10, 8);
  const keyMetricCardHeight = verticalValue(100, 94);
  const accordionHeaderHeight = verticalValue(50, 46);
  const accordionGap = verticalValue(5, 4);
  const theoreticalContentHeight = verticalValue(637, 646);
  const contentBottom = contentTop + (measuredContentHeight || theoreticalContentHeight);
  const bottomPadding = Math.max(12, insets.bottom + 8);
  const renderedHeight = safeTop + contentBottom * widthScale;
  const needsScroll = renderedHeight > windowHeight + 3;
  const indicator = useCustomScrollIndicator({ enabled: needsScroll, showInitially: true });

  useFocusEffect(
    useCallback(() => {
      sectionAnimations.forEach((animation) => animation.setValue(0));
      const entrance = Animated.stagger(
        150,
        sectionAnimations.map((animation) =>
          Animated.timing(animation, {
            duration: 330,
            toValue: 1,
            useNativeDriver: true,
          }),
        ),
      );
      entrance.start();
      return () => entrance.stop();
    }, [sectionAnimations]),
  );

  const sectionEntranceStyle = useCallback(
    (animation: Animated.Value) => ({
      opacity: animation,
      transform: [
        {
          translateY: animation.interpolate({
            inputRange: [0, 1],
            outputRange: [10, 0],
          }),
        },
      ],
    }),
    [],
  );

  const toggleAccordion = useCallback((section: 'reason' | 'source') => {
    LayoutAnimation.configureNext(accordionAnimation);
    if (section === 'reason') setReasonExpanded((current) => !current);
    else setSourceExpanded((current) => !current);
  }, []);

  const openAdditionalMetrics = useCallback((reasonId: string) => {
    const reason = analysisReasons.find((item) => item.id === reasonId);
    if (reason) setSheet({ type: 'additional', reason });
  }, []);

  const openCriterion = useCallback((criterionId: string) => {
    const criterion = metricCriteria.find((item) => item.id === criterionId);
    if (criterion) setSheet({ type: 'criterion', criterion });
  }, []);

  const openReference = useCallback((referenceId: string) => {
    const reference = references.find((item) => item.id === referenceId);
    if (reference) setSheet({ type: 'reference', reference });
  }, []);

  const slotHeight = useMemo(() => contentBottom * widthScale, [contentBottom, widthScale]);

  return (
    <View style={styles.root}>
      <Image source={background} resizeMode="cover" style={styles.background} />
      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            minHeight: needsScroll ? undefined : windowHeight,
            paddingBottom: needsScroll ? bottomPadding : 0,
            paddingTop: safeTop,
          },
        ]}
        onContentSizeChange={indicator.onContentSizeChange}
        onLayout={indicator.onLayout}
        onMomentumScrollBegin={indicator.onMomentumScrollBegin}
        onMomentumScrollEnd={indicator.onMomentumScrollEnd}
        onScroll={indicator.onScroll}
        onScrollBeginDrag={indicator.onScrollBeginDrag}
        onScrollEndDrag={indicator.onScrollEndDrag}
        overScrollMode="never"
        scrollEnabled={needsScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.slot, { height: slotHeight }]}>
          <View
            style={[
              styles.canvas,
              {
                height: contentBottom,
                left: canvasLeft,
                transform: [{ scale: widthScale }],
              },
            ]}
          >
            <Text style={[styles.screenTitle, { top: screenTitleTop }]}>종합 건강 분석</Text>
            <View style={[styles.explain, { height: explainHeight, top: explainTop }]}>
              <View style={[styles.explainCopy, { gap: explainCopyGap, width: explainCopyWidth }]}>
                <Text style={styles.explainTitle}>
                  OO님, 목표를 반영해 방법을{`\n`}
                  <Text style={styles.primary}>더 건강하게 </Text>조정했어요!
                </Text>
                <View style={styles.explainDescription}>
                  <Text numberOfLines={1} style={styles.explainDescriptionLine}>
                    선택한 목표와 최근 건강 데이터를 함께 분석해
                  </Text>
                  <Text numberOfLines={1} style={styles.explainDescriptionLine}>
                    가장 현실적이고 건강한 전략을 제안해드려요
                  </Text>
                </View>
              </View>
              <Image
                source={illustration}
                resizeMode="contain"
                style={[
                  styles.explainImage,
                  {
                    borderRadius: explainImageRadius,
                    height: explainImageSize,
                    top: explainImageTop,
                    width: explainImageSize,
                  },
                ]}
              />
            </View>
            <View
              onLayout={(event) => setMeasuredContentHeight(event.nativeEvent.layout.height)}
              style={[styles.content, { gap: sectionGap, top: contentTop }]}
            >
              <Animated.View
                style={[
                  styles.summaryCard,
                  { gap: summaryGap, padding: summaryPadding },
                  sectionEntranceStyle(sectionAnimations[0]),
                ]}
              >
                <View style={styles.summaryTop}>
                  <IconCircle
                    Icon={ClipboardIcon}
                    backgroundColor={colors.primaryLight}
                    color={colors.primary}
                    iconSize={30}
                    size={50}
                  />
                  <View style={[styles.summaryCopy, { gap: summaryCopyGap }]}>
                    <View style={styles.summaryBadges}>
                      <View style={styles.summaryBadge}>
                        <Text style={styles.summaryBadgeText}>분석 요약</Text>
                      </View>
                      <View style={styles.needBadge}>
                        <Text style={styles.needBadgeText}>조정 필요</Text>
                      </View>
                    </View>
                    <Text style={styles.summaryTitle}>목표와 건강 상태 사이에 간극이 있어요</Text>
                    <Text style={styles.summaryDescription}>
                      빠른 감량보다 근육을 지키는 방식이 더 적절해요.
                    </Text>
                  </View>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.goalRow}>
                  <View style={styles.goalBadge}>
                    <Text style={styles.goalBadgeText}>내 목표</Text>
                  </View>
                  <Text style={styles.goalText}>결혼식 준비를 위한 단기간 체중 감량</Text>
                </View>
              </Animated.View>

              <Animated.View
                style={[
                  styles.strategyCard,
                  { gap: strategyGap, padding: strategyPadding },
                  sectionEntranceStyle(sectionAnimations[1]),
                ]}
              >
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <Image
                    resizeMode="stretch"
                    source={strategyBackground}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
                <View style={styles.strategyLabelRow}>
                  <View style={styles.starCircle}>
                    <StarIcon color="#FFFFFF" height={13} width={13} />
                  </View>
                  <Text style={styles.strategyLabel}>Auto-Fit 맞춤 제안</Text>
                </View>
                <View style={[styles.strategyHeading, { gap: strategyHeadingGap }]}>
                  <Text style={styles.strategyTitle}>근육을 지키는 결혼식 맞춤 감량 전략</Text>
                  <Text style={styles.strategyDescription}>
                    체중 감량 목표는 유지하면서,{`\n`}현재 근육량과 건강 지표를 고려해 감량 방식만
                    조정했어요.
                  </Text>
                </View>
                <View style={styles.strategyChips}>
                  <StrategyChip Icon={WeightIcon} label="체지방 감량 유지" />
                  <StrategyChip Icon={MuscleIcon} label="근육 손실 최소화" />
                  <StrategyChip Icon={BarbellIcon} label="식단·근력 병행" />
                </View>
                <View style={styles.strategyDivider} />
                <Text style={styles.strategyFooter}>
                  현재 건강 상태를 고려해 감량 속도보다{`\n`}
                  <Text style={styles.primaryDark}>체성분 개선과 대사 건강</Text>을 우선했어요.
                </Text>
              </Animated.View>

              <Animated.View
                style={[
                  styles.keyMetricsSection,
                  { gap: keyMetricsGap },
                  sectionEntranceStyle(sectionAnimations[2]),
                ]}
              >
                <Text style={styles.keyMetricsTitle}>핵심 분석 지표</Text>
                <View style={styles.keyMetricRow}>
                  {keyMetrics.map((metric) => (
                    <KeyMetricCard key={metric.id} height={keyMetricCardHeight} metric={metric} />
                  ))}
                </View>
              </Animated.View>

              <Animated.View
                style={[
                  styles.evidence,
                  { gap: accordionGap },
                  sectionEntranceStyle(sectionAnimations[3]),
                ]}
              >
                <ReasonAccordion
                  headerHeight={accordionHeaderHeight}
                  expanded={reasonExpanded}
                  onOpenMetrics={openAdditionalMetrics}
                  onToggle={() => toggleAccordion('reason')}
                />
                <SourceAccordion
                  headerHeight={accordionHeaderHeight}
                  expanded={sourceExpanded}
                  onOpenCriterion={openCriterion}
                  onOpenReference={openReference}
                  onToggle={() => toggleAccordion('source')}
                />
              </Animated.View>

              <Animated.View style={sectionEntranceStyle(sectionAnimations[4])}>
                <Pressable
                  onPress={() => router.push('/start-move')}
                  style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
                >
                  <Svg height={45} style={StyleSheet.absoluteFill} width={373}>
                    <Defs>
                      <LinearGradient id="startGradient" x1="0" x2="1">
                        <Stop offset="0" stopColor={colors.primaryDark} />
                        <Stop offset="1" stopColor={colors.primary} />
                      </LinearGradient>
                    </Defs>
                    <Rect fill="url(#startGradient)" height={45} rx={10} width={373} />
                  </Svg>
                  <Text style={styles.startButtonText}>건강 관리 시작하기</Text>
                  <View style={styles.startArrow}>
                    <ArrowRightIcon color={colors.primary} height={16} width={16} />
                  </View>
                </Pressable>
              </Animated.View>
            </View>
          </View>
        </View>
      </ScrollView>

      {needsScroll ? (
        <CustomScrollIndicator
          {...indicator.indicatorProps}
          bottomInset={Math.max(8, insets.bottom + 4)}
          rightInset={Math.max(4, insets.right + 4)}
          topInset={Math.max(8, insets.top + 4)}
        />
      ) : null}

      <TotalAnalysisBottomSheet
        onClose={() => setSheet(null)}
        onOpenReference={openReference}
        sheet={sheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  background: { ...StyleSheet.absoluteFill, height: '100%', width: '100%' },
  scrollContent: { alignItems: 'center' },
  slot: { position: 'relative', width: '100%' },
  canvas: {
    position: 'absolute',
    transformOrigin: 'top left',
    width: referenceWidth,
  },
  screenTitle: {
    position: 'absolute',
    top: 38,
    left: 21,
    right: 21,
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  explain: {
    position: 'absolute',
    left: 21,
    width: 370,
    height: 120,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  explainCopy: { width: 250, gap: 8 },
  explainTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
    lineHeight: 27,
  },
  explainDescription: {
    width: 282,
  },
  explainDescriptionLine: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  explainImage: { position: 'absolute', right: 0, width: 120, height: 120, borderRadius: 44 },
  primary: { color: colors.primary },
  primaryDark: { color: colors.primaryDark },
  content: { position: 'absolute', left: 18, width: 373, alignItems: 'stretch' },
  iconCircle: { alignItems: 'center', justifyContent: 'center' },
  summaryCard: {
    width: '100%',
    padding: 14,
    gap: 10,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  summaryCopy: { flex: 1, gap: 7 },
  summaryBadges: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryBadge: {
    width: 70,
    height: 20,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBadgeText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 12,
  },
  needBadge: {
    width: 70,
    height: 20,
    borderRadius: 20,
    backgroundColor: '#FFF9F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  needBadgeText: {
    color: warning,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 12,
  },
  summaryTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 18,
  },
  summaryDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
  },
  summaryDivider: { height: 1, width: 340, backgroundColor: colors.border },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  goalBadge: {
    width: 60,
    height: 22,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalBadgeText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 13,
    letterSpacing: 1.3,
  },
  goalText: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 14,
  },
  strategyCard: {
    width: '100%',
    padding: 15,
    gap: 10,
    overflow: 'hidden',
    borderColor: colors.primaryDark,
    borderRadius: 15,
    borderWidth: 0.5,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  strategyLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  starCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strategyLabel: {
    color: colors.primary,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 12,
  },
  strategyHeading: { gap: 7 },
  strategyTitle: {
    color: colors.primary,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
  },
  strategyDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  strategyChips: { flexDirection: 'row', gap: 4 },
  strategyChip: {
    height: 32,
    flex: 1,
    paddingHorizontal: 2,
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 5,
    borderWidth: 0.5,
    justifyContent: 'center',
  },
  strategyChipInner: {
    height: 27.5,
    borderRadius: 3,
    backgroundColor: 'rgba(232,248,244,0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  strategyChipText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 12,
  },
  strategyDivider: { width: 350, height: 1, backgroundColor: colors.border },
  strategyFooter: {
    width: 350,
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  keyMetricsSection: { width: '100%', gap: 10 },
  keyMetricsTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 20,
  },
  keyMetricRow: { flexDirection: 'row', justifyContent: 'space-between' },
  keyMetricCard: {
    width: 120,
    height: 100,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  keyMetricTitleRow: { height: 22, flexDirection: 'row', alignItems: 'center', gap: 2 },
  keyMetricName: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 15,
  },
  keyMetricValue: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 20,
  },
  keyMetricUnit: { color: colors.textSecondary, fontSize: 15 },
  metricStatus: {
    width: 50,
    height: 20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricStatusText: { fontFamily: fontFamilies.pretendardSemiBold, fontSize: 14 },
  evidence: { width: '100%', gap: 5 },
  accordionCard: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
  },
  accordionHeader: {
    height: 50,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accordionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  accordionHeaderTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
  },
  caretUp: { transform: [{ rotate: '180deg' }] },
  accordionBody: { paddingHorizontal: 10, paddingBottom: 10, gap: 10 },
  accordionDivider: { height: 1, width: '100%', backgroundColor: colors.border },
  reasonIntro: { paddingHorizontal: 10, paddingTop: 8, gap: 5 },
  evidenceSectionTitle: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 18,
  },
  evidenceDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 16,
    lineHeight: 22,
  },
  reasonList: { gap: 12 },
  reasonItem: { paddingHorizontal: 8, paddingVertical: 10, gap: 8, borderRadius: 12 },
  reasonTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reasonTitle: {
    flex: 1,
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 17,
  },
  reasonDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 15,
    letterSpacing: -0.1,
    lineHeight: 20,
  },
  additionalRow: {
    height: 25,
    maxWidth: '100%',
    paddingRight: 10,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(232,248,244,0.5)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  additionalButton: {
    height: 25,
    paddingLeft: 8,
    paddingRight: 5,
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  additionalButtonText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 13.5,
  },
  additionalSummary: {
    flexShrink: 1,
    color: colors.textNavigator,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
  },
  finalRecommendation: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  finalRecommendationCopy: { flex: 1, gap: 6 },
  finalRecommendationLabel: {
    color: colors.primary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 15,
  },
  finalRecommendationText: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 14,
  },
  sourceBody: { paddingHorizontal: 10, paddingBottom: 10, gap: 12 },
  sourceSection: { gap: 8 },
  sourceSectionHeading: { gap: 5 },
  sourceDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 15,
    lineHeight: 20,
  },
  criteriaList: { gap: 10 },
  criterionCard: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 6,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
  },
  criterionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  criterionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  criterionName: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 18,
  },
  criterionStatus: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  criterionStatusText: { fontFamily: fontFamilies.pretendardBold, fontSize: 13 },
  criterionSummary: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
    letterSpacing: -0.1,
    lineHeight: 20,
  },
  criterionLink: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 13,
  },
  referenceList: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
  },
  referenceItem: {
    minHeight: 70,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referenceItemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  referenceNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  referenceNumberText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 20,
  },
  referenceCopy: { flex: 1, gap: 2 },
  referenceTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
  },
  referenceDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
    lineHeight: 19,
  },
  referenceDivider: { height: 1, backgroundColor: colors.border },
  analysisInfo: { padding: 12, gap: 8, borderRadius: 10, backgroundColor: colors.primaryLight },
  analysisInfoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  analysisInfoTitle: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 14,
  },
  analysisInfoText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  startButton: {
    width: 373,
    height: 45,
    overflow: 'hidden',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  startButtonText: {
    color: colors.surface,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
  },
  startArrow: {
    position: 'absolute',
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.76 },
});
