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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ChevronRightIcon from '@/assets/icons/common/chevrons/Right.svg';
import BarbellIcon from '@/assets/icons/deco/Barbell_Fill.svg';
import StarFourIcon from '@/assets/icons/deco/StarFour_Fill.svg';
import DietIcon from '@/assets/icons/feature/navigator/Diet.svg';
import HomeIcon from '@/assets/icons/feature/navigator/Home.svg';
import ShieldCheckIcon from '@/assets/icons/system/ShieldCheck.svg';
import { colors, fontFamilies, radius, shadows } from '@/src/theme';

const startBackground = require('../../assets/images/backgrounds/7_Start.png');
const completeIllustration = require('../../assets/images/illustrations/analysis_and_start/Check_Start.png');
const dietIllustration = require('../../assets/images/illustrations/analysis_and_start/Diet_Start.png');
const exerciseIllustration = require('../../assets/images/illustrations/analysis_and_start/Exercise_Start.png');

const referenceWidth = 412;
const referenceHeight = 917;
const referenceTitleTop = 38;
const minimumScreenHeight = 740;
const maximumScreenHeight = 917;
const minimumVerticalPositionScale = 0.86;
const exerciseColor = '#A96DE5';
const exerciseSoft = '#F0E8F8';

const interpolate = (expanded: number, compact: number, progress: number) =>
  expanded + (compact - expanded) * progress;

type StartDestination = '/home' | '/diet' | '/exercise';

type ManagementCardProps = {
  accentColor: string;
  badgeColor: string;
  BadgeIcon: React.ComponentType<SvgProps>;
  cardHeight: number;
  cardPaddingVertical: number;
  description: string;
  illustrationHeight: number;
  illustrationWidth: number;
  illustration: number;
  onPress: () => void;
  title: string;
};

function SelectionGuide({ top }: { top: number }) {
  return (
    <View style={[styles.selectionGuide, { top }]}>
      <View style={styles.guideDecoration}>
        <View style={styles.guideLine} />
        <StarFourIcon color={colors.primary} height={10} width={10} />
      </View>
      <Text style={styles.selectionGuideText}>어떤 관리부터 시작할까요?</Text>
      <View style={styles.guideDecoration}>
        <StarFourIcon color={colors.primary} height={10} width={10} />
        <View style={styles.guideLine} />
      </View>
    </View>
  );
}

function ManagementCard({
  accentColor,
  badgeColor,
  BadgeIcon,
  cardHeight,
  cardPaddingVertical,
  description,
  illustrationHeight,
  illustrationWidth,
  illustration,
  onPress,
  title,
}: ManagementCardProps) {
  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.managementCard,
        {
          height: cardHeight,
          paddingVertical: cardPaddingVertical,
        },
        pressed && styles.pressed,
      ]}
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={illustration}
        style={[
          styles.managementIllustration,
          {
            height: illustrationHeight,
            width: illustrationWidth,
          },
        ]}
      />
      <View style={styles.managementCopy}>
        <View style={[styles.managementBadge, { backgroundColor: badgeColor }]}>
          <BadgeIcon color={accentColor} height={18} width={18} />
        </View>
        <Text style={styles.managementTitle}>{title}</Text>
        <Text style={styles.managementDescription}>{description}</Text>
      </View>
      <View style={[styles.managementArrow, { backgroundColor: accentColor }]}>
        <ChevronRightIcon color={colors.surface} height={20} width={20} />
      </View>
    </Pressable>
  );
}

function LaterCard({
  height,
  onPress,
}: {
  height: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel="나중에 할게요"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.laterCard,
        { height },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.laterIconBox}>
        <HomeIcon color={colors.textNavigator} height={24} width={24} />
      </View>
      <View style={styles.laterCopy}>
        <Text style={styles.laterTitle}>나중에 할게요</Text>
        <Text style={styles.laterDescription}>홈으로 이동하여 나중에 시작할 수 있어요.</Text>
      </View>
      <ChevronRightIcon color={colors.textNavigator} height={20} width={20} />
    </Pressable>
  );
}

export default function StartMoveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

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
  const analysisTop = verticalValue(90, 70);
  const completeIllustrationHeight = verticalValue(132, 100);
  const completeIllustrationWidth = interpolate(220, 180, legacyCompactProgress);
  const analysisGap = verticalValue(14, 10);
  const selectionTop = verticalValue(354, 290);
  const contentTop = verticalValue(400, 326);
  const contentGap = verticalValue(13, 10);
  const managementCardHeight = verticalValue(145, 125);
  const managementCardPaddingVertical = verticalValue(20, 10);
  const managementIllustrationHeight = verticalValue(100, 88);
  const managementIllustrationWidth = interpolate(130, 115, legacyCompactProgress);
  const laterCardHeight = verticalValue(80, 70);
  const infoBoxHeight = verticalValue(65, 55);

  const completeInitialFlow = (destination: StartDestination) => {
    router.dismissAll();
    router.replace(destination);
  };

  return (
    <View style={styles.root}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        source={startBackground}
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
        <Text style={styles.screenTitle}>건강 관리 시작하기</Text>

        <View
          style={[
            styles.analysisComplete,
            {
              gap: analysisGap,
              top: analysisTop,
            },
          ]}
        >
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            source={completeIllustration}
            style={[
              styles.completeIllustration,
              {
                height: completeIllustrationHeight,
                width: completeIllustrationWidth,
              },
            ]}
          />
          <Text style={styles.completeTitle}>
            나에게 맞는 <Text style={styles.completeTitleEmphasis}>관리</Text>를 시작해볼까요?
          </Text>
          <Text style={styles.completeDescription}>
            분석된 건강 정보를 바탕으로{`\n`}원하는 관리 방법을 선택해 주세요.
          </Text>
        </View>

        <SelectionGuide top={selectionTop} />

        <View style={[styles.content, { gap: contentGap, top: contentTop }]}>
          <ManagementCard
            accentColor={colors.primary}
            badgeColor="#DFF4F0"
            BadgeIcon={DietIcon}
            cardHeight={managementCardHeight}
            cardPaddingVertical={managementCardPaddingVertical}
            description={'내 건강 상태와 목표에 맞는\n식단을 추천받아 보세요.'}
            illustrationHeight={managementIllustrationHeight}
            illustrationWidth={managementIllustrationWidth}
            illustration={dietIllustration}
            onPress={() => completeInitialFlow('/diet')}
            title="맞춤 식단 관리"
          />
          <ManagementCard
            accentColor={exerciseColor}
            badgeColor={exerciseSoft}
            BadgeIcon={BarbellIcon}
            cardHeight={managementCardHeight}
            cardPaddingVertical={managementCardPaddingVertical}
            description={'현재 체력과 목표에 맞는\n운동 프로그램을 추천받아 보세요.'}
            illustrationHeight={managementIllustrationHeight}
            illustrationWidth={managementIllustrationWidth}
            illustration={exerciseIllustration}
            onPress={() => completeInitialFlow('/exercise')}
            title="맞춤 운동 관리"
          />
          <LaterCard
            height={laterCardHeight}
            onPress={() => completeInitialFlow('/home')}
          />
          <View
            style={[
              styles.infoBox,
              { height: infoBoxHeight },
            ]}
          >
            <ShieldCheckIcon color={colors.primary} height={32} width={32} />
            <Text style={styles.infoText}>
              추천 내용은 입력한 건강 데이터를 기반으로 생성되며,{`\n`}언제든지 설정에서 정보를 수정할 수 있어요.
            </Text>
          </View>
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
    top: referenceTitleTop,
  },
  analysisComplete: {
    alignItems: 'center',
    gap: 14,
    left: 21,
    position: 'absolute',
    top: 90,
    width: 370,
  },
  completeIllustration: {
    borderRadius: 40,
    height: 132,
    width: 220,
  },
  completeTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 22,
    includeFontPadding: false,
    lineHeight: 29,
    textAlign: 'center',
  },
  completeTitleEmphasis: {
    color: colors.primary,
  },
  completeDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
    includeFontPadding: false,
    lineHeight: 22,
    textAlign: 'center',
  },
  selectionGuide: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    left: 21,
    position: 'absolute',
    top: 354,
    width: 370,
  },
  selectionGuideText: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 16,
    includeFontPadding: false,
    lineHeight: 21,
  },
  guideDecoration: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 13,
    width: 83,
  },
  guideLine: {
    backgroundColor: colors.primary,
    flex: 1,
    height: 1,
    opacity: 0.55,
  },
  content: {
    gap: 13,
    left: 21,
    position: 'absolute',
    top: 400,
    width: 370,
  },
  managementCard: {
    ...shadows.subtle,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    height: 145,
    paddingHorizontal: 16,
    paddingVertical: 20,
    width: '100%',
  },
  managementIllustration: {
    borderRadius: 16,
    height: 100,
    width: 130,
  },
  managementCopy: {
    flex: 1,
    gap: 6,
  },
  managementBadge: {
    alignItems: 'center',
    borderRadius: radius.round,
    height: 25,
    justifyContent: 'center',
    width: 35,
  },
  managementTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 16,
    includeFontPadding: false,
    lineHeight: 21,
  },
  managementDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    includeFontPadding: false,
    lineHeight: 17,
  },
  managementArrow: {
    alignItems: 'center',
    borderRadius: 10,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    width: 30,
  },
  laterCard: {
    ...shadows.subtle,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    height: 80,
    padding: 16,
    width: '100%',
  },
  laterIconBox: {
    alignItems: 'center',
    backgroundColor: '#ECECEC',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  laterCopy: {
    flex: 1,
    gap: 7,
  },
  laterTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
    includeFontPadding: false,
    lineHeight: 19,
  },
  laterDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    includeFontPadding: false,
    lineHeight: 17,
  },
  infoBox: {
    ...shadows.subtle,
    alignItems: 'center',
    backgroundColor: '#DFF4F0',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    height: 65,
    paddingHorizontal: 15,
    width: '100%',
  },
  infoText: {
    color: colors.textSecondary,
    flex: 1,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
    includeFontPadding: false,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.82,
  },
});
