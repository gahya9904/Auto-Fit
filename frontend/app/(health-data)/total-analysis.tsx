import { type ComponentType } from 'react';
import { useRouter } from 'expo-router';
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { SvgProps } from 'react-native-svg';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ArrowRightIcon from '@/assets/icons/common/ArrowRight.svg';
import BMIIcon from '@/assets/icons/data/BMI.svg';
import DiabetesIcon from '@/assets/icons/data/Diabetes.svg';
import FatIcon from '@/assets/icons/data/Fat.svg';
import BarbellIcon from '@/assets/icons/deco/Barbell.svg';
import HeartIcon from '@/assets/icons/deco/Heart.svg';
import RobotIcon from '@/assets/icons/feature/Robot_Fill.svg';
import CheckIcon from '@/assets/icons/system/Check.svg';
import WarningCircleIcon from '@/assets/icons/system/WarningCircle.svg';
import {
  mockTotalAnalysis,
  type HealthMetricItem,
  type HealthMetricKey,
  type HealthSummaryItem,
  type TotalAnalysisResult,
} from '@/src/features/health-data/totalAnalysis';
import { colors, fontFamilies, radius } from '@/src/theme';

const analysisBackground = require('../../assets/images/backgrounds/6_Exercise.png');
const analysisIllustration = require('../../assets/images/illustrations/analysis_and_start/Analysis.png');

const referenceWidth = 412;
const referenceHeight = 917;
const referenceTitleTop = 38;
const minimumScreenHeight = 740;
const maximumScreenHeight = 917;
const minimumVerticalPositionScale = 0.86;
const warningColor = '#FF7B00';
const warningSoft = '#FFF9F4';

const interpolate = (expanded: number, compact: number, progress: number) =>
  expanded + (compact - expanded) * progress;

const metricIcons: Record<HealthMetricKey, ComponentType<SvgProps>> = {
  bodyFatPercentage: FatIcon,
  skeletalMuscleMass: BarbellIcon,
  bmi: BMIIcon,
  bloodPressure: HeartIcon,
  fastingBloodSugar: DiabetesIcon,
};

function OverallScore({
  data,
  height,
  paddingVertical,
}: {
  data: TotalAnalysisResult['overall'];
  height: number;
  paddingVertical: number;
}) {
  const radiusValue = 60;
  const circumference = 2 * Math.PI * radiusValue;
  const progress = Math.max(0, Math.min(100, data.score)) / 100;

  return (
    <View
      style={[
        styles.overallCard,
        {
          height,
          paddingVertical,
        },
      ]}
    >
      <View style={styles.scoreGraph}>
        <Svg height={140} style={styles.scoreRing} width={140}>
          <Defs>
            <LinearGradient id="analysisScoreGradient" x1="0" x2="1" y1="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} />
              <Stop offset="0.55" stopColor={colors.primaryMedium} />
              <Stop offset="1" stopColor={colors.primary} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={70}
            cy={70}
            fill="none"
            r={radiusValue}
            stroke="#D7F1EC"
            strokeWidth={10}
          />
          <Circle
            cx={70}
            cy={70}
            fill="none"
            r={radiusValue}
            stroke="url(#analysisScoreGradient)"
            strokeDasharray={[circumference * progress, circumference]}
            strokeLinecap="round"
            strokeWidth={10}
            transform="rotate(-90 70 70)"
          />
        </Svg>
        <View style={styles.scoreHeartCircle}>
          <HeartIcon fill={colors.primary} height={15} width={15} />
        </View>
        <Text style={styles.scoreLabel}>종합 건강 점수</Text>
        <View style={styles.scoreValueRow}>
          <Text style={styles.scoreValue}>{data.score}</Text>
          <Text style={styles.scoreTotal}>/100</Text>
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreBadgeText}>{data.status}</Text>
        </View>
      </View>

      <View style={styles.overallCopy}>
        <Text style={styles.overallSummary}>
          {data.summaryLead}{'\n'}
          <Text style={styles.overallHighlight}>{data.summaryHighlight}</Text>
          {data.summaryTail}
        </Text>
        <Text style={styles.overallDescription}>{data.description}</Text>
      </View>
    </View>
  );
}

function HealthSummaryRow({
  item,
  last,
  rowHeight,
}: {
  item: HealthSummaryItem;
  last: boolean;
  rowHeight: number;
}) {
  const isWarning = item.type === 'warning';

  return (
    <>
      <View
        style={[styles.summaryRow, { height: rowHeight }]}
      >
        <View
          style={[
            styles.summaryIconCircle,
            isWarning ? styles.warningBackground : styles.goodBackground,
          ]}
        >
          {isWarning ? (
            <WarningCircleIcon fill={warningColor} height={24} width={24} />
          ) : (
            <CheckIcon fill={colors.primary} height={24} width={24} />
          )}
        </View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>{item.title}</Text>
          <Text style={styles.summaryDescription}>{item.description}</Text>
        </View>
        <View
          style={[
            styles.summaryStatus,
            isWarning ? styles.warningBackground : styles.goodBackground,
          ]}
        >
          <Text style={[styles.summaryStatusText, isWarning && styles.warningText]}>
            {item.status}
          </Text>
        </View>
      </View>
      {!last ? <View style={styles.summaryDivider} /> : null}
    </>
  );
}

function HealthSummary({
  items,
  rowHeight,
}: {
  items: HealthSummaryItem[];
  rowHeight: number;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>주요 건강 요약</Text>
      <View style={styles.summaryCard}>
        {items.map((item, index) => (
          <HealthSummaryRow
            item={item}
            key={item.id}
            last={index === items.length - 1}
            rowHeight={rowHeight}
          />
        ))}
      </View>
    </View>
  );
}

function HealthMetricFactor({ item }: { item: HealthMetricItem }) {
  const Icon = metricIcons[item.key];
  const isWarning = item.status === '높음';
  const iconColor = isWarning ? warningColor : colors.primary;
  const iconColorProps =
    item.key === 'bmi'
      ? { color: iconColor, fill: 'none' }
      : { fill: iconColor, stroke: iconColor };

  return (
    <View style={styles.metricFactor}>
      <View
        style={[
          styles.metricIconCircle,
          isWarning ? styles.warningBackground : styles.goodBackground,
        ]}
      >
        <Icon
          {...iconColorProps}
          height={18}
          width={18}
        />
      </View>
      <View style={styles.metricCopy}>
        <Text style={styles.metricLabel}>{item.label}</Text>
        <Text numberOfLines={1} style={styles.metricValue}>
          {item.value}
          {item.unit ? <Text style={styles.metricUnit}>{item.unit}</Text> : null}
        </Text>
        <View
          style={[
            styles.metricStatus,
            isWarning ? styles.warningBackground : styles.goodBackground,
          ]}
        >
          <Text style={[styles.metricStatusText, isWarning && styles.warningText]}>
            {item.status}
          </Text>
        </View>
      </View>
    </View>
  );
}

function HealthMetrics({
  height,
  items,
}: {
  height: number;
  items: HealthMetricItem[];
}) {
  return (
    <View
      style={[
        styles.section,
        styles.metricsSection,
        { height },
      ]}
    >
      <Text style={styles.sectionTitle}>건강 지표 요약</Text>
      <View style={styles.metricFactors}>
        {items.map((item) => (
          <HealthMetricFactor item={item} key={item.id} />
        ))}
      </View>
    </View>
  );
}

function AIComment({ height, text }: { height: number; text: string }) {
  return (
    <View
      style={[
        styles.aiCommentCard,
        { height },
      ]}
    >
      <View style={styles.aiIconCircle}>
        <RobotIcon fill={colors.primary} height={35} width={35} />
      </View>
      <View style={styles.aiCommentCopy}>
        <Text style={styles.aiCommentTitle}>AI 종합 코멘트</Text>
        <Text style={styles.aiCommentText}>{text}</Text>
      </View>
    </View>
  );
}

function StartButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
    >
      <Svg height={45} style={StyleSheet.absoluteFill} width={370}>
        <Defs>
          <LinearGradient id="analysisButtonGradient" x1="0" x2="1" y1="0" y2="0">
            <Stop offset="0" stopColor={colors.primaryDark} />
            <Stop offset="1" stopColor={colors.primary} />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#analysisButtonGradient)" height={45} rx={10} width={370} />
      </Svg>
      <Text style={styles.startButtonText}>건강 관리 시작하기</Text>
      <View style={styles.startArrowCircle}>
        <ArrowRightIcon fill={colors.primary} height={16} width={16} />
      </View>
    </Pressable>
  );
}

export default function TotalAnalysisScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const analysis = mockTotalAnalysis;

  const availableWidth = Math.max(0, windowWidth - insets.left - insets.right);
  const widthScale = Math.min(1, availableWidth / referenceWidth);
  const scaledWidth = referenceWidth * widthScale;
  const canvasLeft = insets.left + (availableWidth - scaledWidth) / 2;
  const canvasTop = Math.max(0, insets.top + 8 - referenceTitleTop * widthScale);
  const usableHeight = Math.max(0, windowHeight - canvasTop);

  const screenHeight = Dimensions.get('screen').height;
  const responsiveHeight =
    Platform.OS === 'web' ? windowHeight : screenHeight;

  const legacyVerticalPositionScale = Math.max(
    minimumVerticalPositionScale,
    Math.min(1, usableHeight / Math.max(widthScale, 0.01) / referenceHeight),
  );
  const legacyCompactProgress =
    (1 - legacyVerticalPositionScale) / (1 - minimumVerticalPositionScale);
  const minimumHeightVerticalScale = Math.max(
    minimumVerticalPositionScale,
    Math.min(
      1,
      minimumScreenHeight / Math.max(widthScale, 0.01) / referenceHeight,
    ),
  );
  const minimumHeightCompactProgress =
    (1 - minimumHeightVerticalScale) / (1 - minimumVerticalPositionScale);
  const heightProgress = Math.max(
    0,
    Math.min(
      1,
      (responsiveHeight - minimumScreenHeight) /
        (maximumScreenHeight - minimumScreenHeight),
    ),
  );

  const verticalValue = (expanded: number, compact: number) => {
    const compactScreenValue =
      interpolate(expanded, compact, minimumHeightCompactProgress) * widthScale;
    return interpolate(compactScreenValue, expanded, heightProgress) / Math.max(widthScale, 0.01);
  };
  const analysisTop = verticalValue(64, 56);
  const analysisHeight = verticalValue(120, 95);
  const analysisWidth = interpolate(120, 95, legacyCompactProgress);
  const contentTop = verticalValue(192, 162);
  const contentGap = verticalValue(10, 6);
  const overallHeight = verticalValue(160, 140);
  const overallPaddingVertical = verticalValue(10, 5);
  const summaryRowHeight = verticalValue(60, 52);
  const metricsHeight = verticalValue(140, 120);
  const aiCommentHeight = verticalValue(90, 76);

  const handleStart = () => {
    router.push('/start-move');
  };

  return (
    <View style={styles.root}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        source={analysisBackground}
        style={styles.background}
      />
      <View
        style={[
          styles.canvas,
          {
            left: canvasLeft,
            top: canvasTop,
            transform: [{ scale: widthScale }],
          },
        ]}
      >
        <Text style={styles.screenTitle}>종합 건강 분석</Text>

        <View
          style={[
            styles.analysisExplain,
            { height: analysisHeight, top: analysisTop },
          ]}
        >
          <View style={styles.analysisExplainCopy}>
            <Text style={styles.analysisTitle}>
              {analysis.userName}님,{`\n`}분석이{' '}
              <Text style={styles.analysisTitleEmphasis}>완료</Text>되었어요!
            </Text>
            <Text style={styles.analysisDescription}>
              업로드한 데이터를 기반으로{`\n`}현재 건강 상태를 종합적으로 분석했어요.
            </Text>
          </View>
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={analysisIllustration}
            style={{ height: analysisHeight, width: analysisWidth }}
          />
        </View>

        <View style={[styles.content, { gap: contentGap, top: contentTop }]}>
          <OverallScore
            data={analysis.overall}
            height={overallHeight}
            paddingVertical={overallPaddingVertical}
          />
          <HealthSummary items={analysis.healthSummaries} rowHeight={summaryRowHeight} />
          <HealthMetrics height={metricsHeight} items={analysis.healthMetrics} />
          <AIComment height={aiCommentHeight} text={analysis.aiComment} />
          <StartButton onPress={handleStart} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#F5F7FA',
    flex: 1,
    overflow: 'hidden',
  },
  background: {
    ...StyleSheet.absoluteFill,
    height: '100%',
    width: '100%',
  },
  canvas: {
    height: referenceHeight,
    position: 'absolute',
    transformOrigin: 'top left',
    width: referenceWidth,
  },
  screenTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
    left: 21,
    letterSpacing: 1.5,
    lineHeight: 20,
    position: 'absolute',
    right: 21,
    textAlign: 'center',
    top: 38,
  },
  analysisExplain: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 120,
    justifyContent: 'space-between',
    left: 21,
    position: 'absolute',
    top: 64,
    width: 370,
  },
  analysisExplainCopy: {
    gap: 8,
    width: 230,
  },
  analysisTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
    includeFontPadding: false,
    lineHeight: 27,
  },
  analysisTitleEmphasis: {
    color: colors.primary,
  },
  analysisDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    includeFontPadding: false,
    lineHeight: 18,
  },
  content: {
    gap: 10,
    left: 21,
    position: 'absolute',
    top: 192,
    width: 370,
  },
  overallCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    elevation: Platform.OS === 'android' ? 1 : 0,
    flexDirection: 'row',
    gap: 16,
    height: 160,
    padding: 10,
    shadowColor: '#000000',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    width: '100%',
  },
  scoreGraph: {
    height: 150,
    position: 'relative',
    width: 150,
  },
  scoreRing: {
    left: 5,
    position: 'absolute',
    top: 5,
  },
  scoreHeartCircle: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.round,
    height: 20,
    justifyContent: 'center',
    left: 65,
    position: 'absolute',
    top: 26,
    width: 20,
  },
  scoreLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 10,
    includeFontPadding: false,
    left: 0,
    lineHeight: 14,
    position: 'absolute',
    textAlign: 'center',
    top: 49,
    width: 150,
  },
  scoreValueRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 64,
    width: 150,
  },
  scoreValue: {
    color: colors.primary,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 32,
    includeFontPadding: false,
    lineHeight: 39,
  },
  scoreTotal: {
    color: colors.textDisabled,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 15,
    includeFontPadding: false,
    lineHeight: 22,
  },
  scoreBadge: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.round,
    height: 21,
    justifyContent: 'center',
    left: 55,
    position: 'absolute',
    top: 102,
    width: 40,
  },
  scoreBadgeText: {
    color: colors.primary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 12,
    includeFontPadding: false,
    lineHeight: 16,
  },
  overallCopy: {
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  overallSummary: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 14,
    includeFontPadding: false,
    lineHeight: 22,
  },
  overallHighlight: {
    color: colors.primaryDark,
    fontSize: 16,
  },
  overallDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
    includeFontPadding: false,
    lineHeight: 18,
  },
  section: {
    gap: 8,
    width: '100%',
  },
  sectionTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
    includeFontPadding: false,
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    elevation: Platform.OS === 'android' ? 1 : 0,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    width: '100%',
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 60,
    paddingHorizontal: 14,
  },
  summaryIconCircle: {
    alignItems: 'center',
    borderRadius: radius.round,
    height: 40,
    justifyContent: 'center',
    marginRight: 12,
    width: 40,
  },
  warningBackground: {
    backgroundColor: warningSoft,
  },
  goodBackground: {
    backgroundColor: colors.primaryLight,
  },
  summaryCopy: {
    flex: 1,
    gap: 5,
  },
  summaryTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 14,
    includeFontPadding: false,
    lineHeight: 17,
  },
  summaryDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 12,
    includeFontPadding: false,
    lineHeight: 15,
  },
  summaryStatus: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 22,
    paddingHorizontal: 10,
  },
  summaryStatusText: {
    color: colors.primary,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 11,
    includeFontPadding: false,
    lineHeight: 15,
  },
  warningText: {
    color: '#FFA450',
  },
  summaryDivider: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    height: 1,
    width: 350,
  },
  metricsSection: {
    height: 140,
  },
  metricFactors: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricFactor: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 10,
    height: '100%',
    justifyContent: 'center',
    width: 70,
  },
  metricIconCircle: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  metricCopy: {
    alignItems: 'center',
    gap: 3,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 11,
    includeFontPadding: false,
    lineHeight: 14,
  },
  metricValue: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
    includeFontPadding: false,
    lineHeight: 18,
  },
  metricUnit: {
    color: colors.textSecondary,
    fontSize: 9,
  },
  metricStatus: {
    alignItems: 'center',
    borderRadius: 10,
    height: 15,
    justifyContent: 'center',
    minWidth: 32,
  },
  metricStatusText: {
    color: colors.primary,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 10,
    includeFontPadding: false,
    lineHeight: 13,
  },
  aiCommentCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    elevation: Platform.OS === 'android' ? 1 : 0,
    flexDirection: 'row',
    gap: 12,
    height: 90,
    paddingHorizontal: 15,
    shadowColor: '#000000',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    width: '100%',
  },
  aiIconCircle: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.round,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  aiCommentCopy: {
    flex: 1,
    gap: 5,
  },
  aiCommentTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 14,
    includeFontPadding: false,
    lineHeight: 18,
  },
  aiCommentText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 11,
    includeFontPadding: false,
    lineHeight: 14,
  },
  startButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    elevation: Platform.OS === 'android' ? 3 : 0,
    flexDirection: 'row',
    height: 45,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    width: '100%',
  },
  startButtonText: {
    color: colors.surface,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
    includeFontPadding: false,
    lineHeight: 20,
  },
  startArrowCircle: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.round,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 15,
    width: 24,
  },
  pressed: {
    opacity: 0.78,
  },
});
