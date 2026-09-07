import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ArrowRightIcon from '@/assets/icons/common/ArrowRight.svg';
import ClipboardIcon from '@/assets/icons/deco/ClipboardText.svg';
import TargetIcon from '@/assets/icons/deco/Target.svg';
import BarbellIcon from '@/assets/icons/deco/Barbell.svg';
import FatIcon from '@/assets/icons/data/Fat.svg';
import MuscleIcon from '@/assets/icons/data/Muscle.svg';
import WeightIcon from '@/assets/icons/data/Weight.svg';
import EggsIcon from '@/assets/icons/food/Eggs.svg';
import DiabetesIcon from '@/assets/icons/data/Diabetes.svg';
import StarIcon from '@/assets/icons/day/Star_Fill.svg';
import WarningIcon from '@/assets/icons/system/Warning.svg';
import WarningCircleIcon from '@/assets/icons/system/WarningCircle.svg';

import {
  CustomScrollIndicator,
  useCustomScrollIndicator,
} from '@/src/components/common';

import { colors, fontFamilies } from '@/src/theme';

const background = require('../../assets/images/backgrounds/6_Exercise.png');
const illustration = require('../../assets/images/illustrations/analysis_and_start/Analysis.png');
const suggestionIllustration = require('../../assets/images/illustrations/analysis_and_start/Suggestion.png');
const strategyBackground = require('../../assets/images/backgrounds/9_Analysis_Card.png');

const refWidth = 412;
const refHeight = 917;

const minHeight = 740;
const maxHeight = 917;

const warning = '#FFA450';
const danger = '#E57373';

function Badge({
  children,
  dangerTone = false,
}: {
  children: string;
  dangerTone?: boolean;
}) {
  const tone = dangerTone ? danger : warning;

  return (
    <View
      style={[
        s.badge,
        {
          backgroundColor: dangerTone
            ? '#FFF1F1'
            : '#FFF9F4',
        },
      ]}
    >
      <WarningIcon
        fill={tone}
        height={9}
        width={9}
      />

      <Text
        style={[
          s.badgeText,
          {
            color: tone,
          },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

function Reason({
  title,
  text,
  Icon,
  dangerTone = false,
  outline = false,
  fillOnly = false,
}: {
  title: string;
  text: string;
  Icon: typeof FatIcon;
  dangerTone?: boolean;
  outline?: boolean;
  fillOnly?: boolean;
}) {
  const tone = dangerTone ? danger : warning;

  return (
    <View style={s.reason}>
      <View
        style={[
          s.reasonIcon,
          {
            backgroundColor: dangerTone
              ? '#FFF1F1'
              : '#FFF9F4',
          },
        ]}
      >
        <Icon
          fill={
            fillOnly
              ? tone
              : outline
                ? 'none'
                : tone
          }
          stroke={
            fillOnly
              ? 'none'
              : tone
          }
          height={22}
          width={22}
        />
      </View>

      <View>
        <Text style={s.reasonTitle}>
          {title}
        </Text>

        <Text style={s.reasonText}>
          {text}
        </Text>
      </View>
    </View>
  );
}

function Chip({
  title,
  Icon,
  outline = false,
  fillOnly = false,
}: {
  title: string;
  Icon: typeof WeightIcon;
  outline?: boolean;
  fillOnly?: boolean;
}) {
  return (
    <View style={s.chip}>
      <View style={s.chipInside}>
        <View style={s.chipIcon}>
          <Icon
            color={colors.primaryDark}
            fill={
              fillOnly
                ? colors.primaryDark
                : outline
                  ? 'none'
                  : colors.primaryDark
            }
            stroke={
              fillOnly
                ? 'none'
                : colors.primaryDark
            }
            height={15}
            width={15}
          />
        </View>

        <Text style={s.chipText}>
          {title}
        </Text>
      </View>
    </View>
  );
}

export default function TotalAnalysisScreen() {
  const router = useRouter();

  const insets = useSafeAreaInsets();

  const {
    width: windowWidth,
    height: windowHeight,
  } = useWindowDimensions();

  /*
   * 기존에는 마지막 버튼의 y + height를 측정했는데,
   * 이제는 content 전체 높이를 직접 측정합니다.
   */
  const [
    measuredContentHeight,
    setMeasuredContentHeight,
  ] = useState(0);

  const availableWidth = Math.max(
    0,
    windowWidth - insets.left - insets.right,
  );

  const scale = Math.min(
    1,
    availableWidth / refWidth,
  );

  const canvasLeft =
    insets.left +
    (availableWidth - refWidth * scale) / 2;

  const safeTop = Math.max(
    0,
    insets.top + 8 - 38 * scale,
  );

  /*
   * 웹에서는 windowHeight,
   * 실제 모바일에서는 screen.height를 사용합니다.
   */
  const responsiveHeight =
    Platform.OS === 'web'
      ? windowHeight
      : Dimensions.get('screen').height;

  const progress = Math.max(
    0,
    Math.min(
      1,
      (responsiveHeight - minHeight) /
        (maxHeight - minHeight),
    ),
  );

  const vertical = (
    expanded: number,
    compact: number,
  ) =>
    compact +
    (expanded - compact) * progress;

  const explainTop =
    vertical(64, 56);

  const contentTop =
    vertical(192, 174);

  const gap =
    vertical(13, 9);

  /*
   * 첫 렌더에서 아직 content 높이를 측정하지 못했을 때
   * 사용할 fallback 값입니다.
   *
   * 피그마 기준:
   * Summary 100
   * Compare 140
   * Reason 175
   * Strategy 170
   * Button 45
   */
  const theoreticalBottom =
    contentTop +
    100 +
    gap +
    140 +
    gap +
    175 +
    gap +
    170 +
    gap +
    45;

  /*
   * measuredContentHeight는 s.content 내부의 실제 높이입니다.
   * 따라서 canvas 기준 하단 좌표를 만들기 위해
   * contentTop을 더해줍니다.
   */
  const measuredContentBottom =
    contentTop + measuredContentHeight;

  /*
   * 실제 측정값이 있으면 그것을 사용하고,
   * 첫 렌더에서만 theoreticalBottom을 사용합니다.
   */
  const contentBottom =
    measuredContentHeight > 0
      ? measuredContentBottom
      : theoreticalBottom;

  /*
   * 실제 ScrollView 하단 여백입니다.
   * renderedHeight에는 포함하지 않습니다.
   */
  const bottomPadding =
    Math.max(12, insets.bottom + 8);

  /*
   * scale이 적용된 실제 콘텐츠 높이만 계산합니다.
   */
  const renderedHeight =
    safeTop +
    contentBottom * scale;
  
  const totalContentHeight = 
    renderedHeight + bottomPadding;

  /*
   * 작은 화면에서만 스크롤을 활성화합니다.
   */
  const needsScroll =
    totalContentHeight > windowHeight;

  const indicator =
    useCustomScrollIndicator({
      enabled: needsScroll,
      showInitially: true,
    });

  return (
    <View style={s.root}>
      <Image
        source={background}
        resizeMode="cover"
        style={s.background}
      />

      <ScrollView
        bounces={false}
        scrollEnabled={needsScroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        overScrollMode="never"
        contentContainerStyle={[
          s.scroll,
          {
            minHeight: needsScroll
              ? undefined
              : windowHeight,
            paddingTop: safeTop,
            paddingBottom: needsScroll
              ? Math.max(12, insets.bottom + 8)
              : 0,
          },
        ]}
        onLayout={
          indicator.onLayout
        }
        onContentSizeChange={
          indicator.onContentSizeChange
        }
        onScroll={
          indicator.onScroll
        }
        onScrollBeginDrag={
          indicator.onScrollBeginDrag
        }
        onScrollEndDrag={
          indicator.onScrollEndDrag
        }
        onMomentumScrollBegin={
          indicator.onMomentumScrollBegin
        }
        onMomentumScrollEnd={
          indicator.onMomentumScrollEnd
        }
      >
        <View
          style={[
            s.slot,
            {
              height:
                contentBottom * scale,
            },
          ]}
        >
          <View
            style={[
              s.canvas,
              {
                left: canvasLeft,
                height: contentBottom,
                transform: [
                  {
                    scale,
                  },
                ],
              },
            ]}
          >
            <Text style={s.screenTitle}>
              종합 건강 분석
            </Text>

            <View
              style={[
                s.explain,
                {
                  top: explainTop,
                },
              ]}
            >
              <View style={s.explainCopy}>
                <Text style={s.explainTitle}>
                  OO님, 목표를 반영해 방법을
                  {'\n'}
                  <Text style={s.primary}>
                    더 건강하게{' '}
                  </Text>
                  조정했어요!
                </Text>

                <Text style={s.explainDesc}>
                  선택한 목표와 최근 건강 데이터를 함께 분석해
                  {'\n'}
                  가장 현실적이고 건강한 전략을 제안해드려요
                </Text>
              </View>

              <Image
                source={illustration}
                resizeMode="contain"
                style={s.explainImage}
              />
            </View>

            <View
              onLayout={(e) => {
                const {
                  height,
                } =
                  e.nativeEvent.layout;

                setMeasuredContentHeight(
                  height,
                );
              }}
              style={[
                s.content,
                {
                  top: contentTop,
                  gap,
                },
              ]}
            >
              <View style={s.summary}>
                <View style={s.summaryIcon}>
                  <ClipboardIcon
                    fill={colors.primary}
                    height={27}
                    width={27}
                  />
                </View>

                <View style={s.summaryCopy}>
                  <View style={s.summaryBadges}>
                    <View style={s.mintPill}>
                      <Text style={s.mintPillText}>
                        분석 요약
                      </Text>
                    </View>

                    <View style={s.orangePill}>
                      <Text
                        style={s.orangePillText}
                      >
                        조정 필요
                      </Text>
                    </View>
                  </View>

                  <Text style={s.summaryTitle}>
                    목표와 건강 상태 사이에 간극이 있어요
                  </Text>

                  <Text style={s.summaryDesc}>
                    빠른 체중 감량 보다는 근육을 지키며 체지방을
                    {'\n'}
                    줄이는 방향이 더 적절해요.
                  </Text>
                </View>
              </View>

              <View style={s.compare}>
                <View style={s.goal}>
                  <Text style={s.compareHead}>
                    선택한 목표
                  </Text>

                  <View style={s.goalIcon}>
                    <TargetIcon
                      fill={colors.primary}
                      height={32}
                      width={32}
                    />
                  </View>

                  <Text style={s.goalTitle}>
                    단기간 체중 감량
                  </Text>

                  <Text style={s.goalDesc}>
                    빠르게 체중을 줄이고 싶어요
                  </Text>
                </View>

                <View style={s.vs}>
                  <Text style={s.vsText}>
                    VS
                  </Text>
                </View>

                <View style={s.health}>
                  <Text style={s.compareHead}>
                    통합 건강 상태
                  </Text>

                  <View style={s.mini}>
                    <View style={s.miniHead}>
                      <ClipboardIcon
                        fill={
                          colors.primaryDark
                        }
                        height={12}
                        width={12}
                      />

                      <Text style={s.miniTitle}>
                        건강검진
                      </Text>
                    </View>

                    <Text style={s.miniCount}>
                      주의 2개 · 정상 3개
                    </Text>

                    <View style={s.miniBadges}>
                      <Badge>
                        공복혈당 주의
                      </Badge>

                      <Badge>
                        중성지방 주의
                      </Badge>
                    </View>
                  </View>

                  <View style={s.mini}>
                    <View style={s.miniHead}>
                      <WeightIcon
                        color={
                          colors.primaryDark
                        }
                        height={12}
                        width={12}
                      />

                      <Text style={s.miniTitle}>
                        체성분
                      </Text>
                    </View>

                    <Text style={s.miniCount}>
                      주의 2개 · 정상 2개
                    </Text>

                    <View style={s.miniBadges}>
                      <Badge>
                        체지방률 높음
                      </Badge>

                      <Badge dangerTone>
                        골격근량 낮음
                      </Badge>
                    </View>
                  </View>
                </View>
              </View>

              <View style={s.reasonSection}>
                <View style={s.reasonHeader}>
                  <View
                    style={
                      s.reasonHeaderLeft
                    }
                  >
                    <WarningCircleIcon
                      fill={warning}
                      height={22}
                      width={22}
                    />

                    <Text
                      style={
                        s.reasonHeaderTitle
                      }
                    >
                      왜 조정이 필요할까요?
                    </Text>
                  </View>

                  <Text style={s.helper}>
                    현재 상태에서 체중만 빠르게 줄이면
                    {'\n'}
                    근손실과 혈당 관리 부담이 커질 수 있어요.
                  </Text>
                </View>

                <View style={s.reasonCard}>
                  <Reason
                    Icon={FatIcon}
                    fillOnly
                    title="체지방률이 높아요"
                    text="체중보다 체지방 감소에 우선순위를 두는 것이 좋아요."
                  />

                  <View style={s.line} />

                  <Reason
                    Icon={MuscleIcon}
                    dangerTone
                    outline
                    title="골격근량이 낮아요"
                    text="빠른 감량은 추가적인 근육 감소로 이어질 수 있어요."
                  />

                  <View style={s.line} />

                  <Reason
                    Icon={DiabetesIcon}
                    fillOnly
                    title="혈당 관리가 필요해요"
                    text="체중 감량과 함께 식단 조절과 활동량 관리가 함께 필요해요."
                  />
                </View>
              </View>

              <View style={s.strategy}>
                <View
                  pointerEvents="none"
                  style={
                    s.strategyBgContainer
                  }
                >
                  <Image
                    source={
                      strategyBackground
                    }
                    resizeMode="stretch"
                    style={s.strategyBg}
                  />
                </View>

                <View style={s.strategyTop}>
                  <View style={s.strategyCopy}>
                    <View style={s.strategyLabel}>
                      <View style={s.star}>
                        <StarIcon
                          fill="#fff"
                          height={13}
                          width={13}
                        />
                      </View>

                      <Text
                        style={
                          s.strategyLabelText
                        }
                      >
                        Auto-Fit 맞춤 제안
                      </Text>
                    </View>

                    <Text style={s.strategyTitle}>
                      근육 유지 기반 체지방 감량
                    </Text>

                    <Text style={s.strategyDesc}>
                      목표를 포기하지 않으면서
                      {'\n'}
                      현재 건강 상태에 맞게 실행 방법을 조정했어요.
                    </Text>
                  </View>

                  <Image
                    source={
                      suggestionIllustration
                    }
                    resizeMode="cover"
                    style={s.strategyImage}
                  />
                </View>

                <View style={s.chips}>
                  <Chip
                    Icon={WeightIcon}
                    outline
                    title="감량 속도 완화"
                  />

                  <Chip
                    Icon={EggsIcon}
                    outline
                    title="단백질 강화"
                  />

                  <Chip
                    Icon={BarbellIcon}
                    fillOnly
                    title="근력 운동 우선"
                  />

                  <Chip
                    Icon={DiabetesIcon}
                    fillOnly
                    title="혈당 관리 반영"
                  />
                </View>

                <View style={s.strategyLine} />

                <Text style={s.strategyFooter}>
                  현재 건강 상태를 고려해 감량 속도보다{' '}
                  <Text style={s.primary}>
                    체성분 개선과 대사 건강
                  </Text>
                  에 더 초점을 두었어요.
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  router.push('/start-move')
                }
                style={({ pressed }) => [
                  s.start,
                  pressed && s.pressed,
                ]}
              >
                <Svg
                  width={373}
                  height={45}
                  style={
                    StyleSheet.absoluteFill
                  }
                >
                  <Defs>
                    <LinearGradient
                      id="start"
                      x1="0"
                      x2="1"
                    >
                      <Stop
                        offset="0"
                        stopColor={
                          colors.primaryDark
                        }
                      />

                      <Stop
                        offset="1"
                        stopColor={
                          colors.primary
                        }
                      />
                    </LinearGradient>
                  </Defs>

                  <Rect
                    width={373}
                    height={45}
                    rx={10}
                    fill="url(#start)"
                  />
                </Svg>

                <Text style={s.startText}>
                  건강 관리 시작하기
                </Text>

                <View style={s.arrow}>
                  <ArrowRightIcon
                    fill={colors.primary}
                    height={16}
                    width={16}
                  />
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      {needsScroll && (
        <CustomScrollIndicator
          {...indicator.indicatorProps}
          topInset={Math.max(
            8,
            insets.top + 4,
          )}
          bottomInset={Math.max(
            8,
            insets.bottom + 4,
          )}
          rightInset={Math.max(
            4,
            insets.right + 4,
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    overflow: 'hidden',
  },

  background: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },

  scroll: {
    alignItems: 'center',
  },

  slot: {
    width: '100%',
    position: 'relative',
  },

  canvas: {
    position: 'absolute',
    width: refWidth,
    transformOrigin: 'top left',
  },

  screenTitle: {
    position: 'absolute',
    top: 38,
    left: 21,
    right: 21,
    textAlign: 'center',
    color: colors.textBody,
    fontFamily:
      fontFamilies.pretendardBold,
    fontSize: 15,
    letterSpacing: 1.5,
  },

  explain: {
    position: 'absolute',
    left: 21,
    width: 370,
    height: 120,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  explainCopy: {
    width: 250,
    gap: 8,
  },

  explainTitle: {
    fontFamily:
      fontFamilies.pretendardBold,
    fontSize: 20,
    lineHeight: 27,
    color: colors.textBody,
  },

  primary: {
    color: colors.primary,
  },

  explainDesc: {
    fontFamily:
      fontFamilies.pretendardMedium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  explainImage: {
    width: 120,
    height: 120,
  },

  content: {
    position: 'absolute',
    left: 18,
    width: 373,
    alignItems: 'center',
  },

  summary: {
    height: 100,
    width: '100%',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 15,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  summaryIcon: {
    width: 45,
    height: 45,
    borderRadius: 99,
    backgroundColor:
      colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryCopy: {
    flex: 1,
    gap: 5,
  },

  summaryBadges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  mintPill: {
    width: 55,
    height: 17,
    borderRadius: 20,
    backgroundColor:
      colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  orangePill: {
    width: 55,
    height: 17,
    borderRadius: 20,
    backgroundColor: '#FFF9F4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  mintPillText: {
    fontSize: 10,
    color: colors.primaryDark,
    fontFamily:
      fontFamilies.pretendardBold,
  },

  orangePillText: {
    fontSize: 10,
    color: warning,
    fontFamily:
      fontFamilies.pretendardBold,
  },

  summaryTitle: {
    fontSize: 13,
    color: colors.textBody,
    fontFamily:
      fontFamilies.pretendardBold,
  },

  summaryDesc: {
    fontSize: 10,
    lineHeight: 14,
    color: colors.textSecondary,
    fontFamily:
      fontFamilies.pretendardMedium,
  },

  compare: {
    width: 370,
    height: 140,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  goal: {
    width: 175,
    height: 140,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
  },

  compareHead: {
    fontSize: 11,
    color: colors.primaryDark,
    fontFamily:
      fontFamilies.pretendardSemiBold,
  },

  goalIcon: {
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor:
      colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  goalTitle: {
    fontSize: 13,
    color: colors.textBody,
    fontFamily:
      fontFamilies.pretendardSemiBold,
  },

  goalDesc: {
    fontSize: 9,
    color: colors.textSecondary,
    fontFamily:
      fontFamilies.pretendardMedium,
  },

  vs: {
    position: 'absolute',
    top: 59,
    left: 171,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  vsText: {
    color: '#fff',
    fontSize: 12,
    fontFamily:
      fontFamilies.pretendardBold,
  },

  health: {
    width: 175,
    height: 140,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },

  mini: {
    width: 150,
    height: 50,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 5,
    padding: 5,
    justifyContent: 'space-between',
  },

  miniHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  miniTitle: {
    fontSize: 8,
    color: colors.primaryDark,
    fontFamily:
      fontFamilies.pretendardSemiBold,
  },

  miniCount: {
    fontSize: 5,
    color: colors.textSecondary,
    fontFamily:
      fontFamilies.pretendardMedium,
  },

  miniBadges: {
    flexDirection: 'row',
    gap: 5,
  },

  badge: {
    height: 15,
    borderRadius: 20,
    paddingHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },

  badgeText: {
    fontSize: 7,
    fontFamily:
      fontFamilies.pretendardMedium,
  },

  reasonSection: {
    width: '100%',
    height: 175,
    gap: 8,
  },

  reasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 22,
  },

  reasonHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  reasonHeaderTitle: {
    fontSize: 13,
    fontFamily:
      fontFamilies.pretendardBold,
    color: colors.textBody,
  },

  helper: {
    fontSize: 8,
    lineHeight: 10,
    textAlign: 'right',
    color: colors.textSecondary,
    fontFamily:
      fontFamilies.pretendardMedium,
  },

  reasonCard: {
    height: 145,
    width: '100%',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    overflow: 'hidden',
  },

  reason: {
    height: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  reasonIcon: {
    height: 30,
    width: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reasonTitle: {
    fontSize: 13,
    color: colors.textBody,
    fontFamily:
      fontFamilies.pretendardSemiBold,
  },

  reasonText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily:
      fontFamilies.pretendardMedium,
    marginTop: 3,
  },

  line: {
    height: 1,
    width: 330,
    alignSelf: 'center',
    backgroundColor: colors.border,
  },

  strategy: {
    height: 170,
    width: '100%',
    borderRadius: 15,
    borderWidth: 0.5,
    borderColor: colors.primaryDark,
    padding: 15,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },

  strategyBgContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 373,
    height: 170,
    overflow: 'hidden',
  },

  strategyBg: {
    width: 373,
    height: 170,
  },

  strategyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  strategyCopy: {
    width: 220,
    gap: 4,
  },

  strategyLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  star: {
    width: 18,
    height: 18,
    borderRadius: 99,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  strategyLabelText: {
    fontSize: 9,
    color: colors.primary,
    fontFamily:
      fontFamilies.pretendardBold,
  },

  strategyTitle: {
    fontSize: 17,
    color: colors.primary,
    fontFamily:
      fontFamilies.pretendardBold,
  },

  strategyDesc: {
    fontSize: 8,
    lineHeight: 12,
    color: colors.textSecondary,
    fontFamily:
      fontFamilies.pretendardMedium,
  },

  strategyImage: {
    width: 120,
    height: 80,
  },

  chips: {
    flexDirection: 'row',
    gap: 4,
  },

  chip: {
    height: 32,
    flex: 1,
    borderWidth: 0.5,
    borderColor: colors.primary,
    borderRadius: 5,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  chipInside: {
    width: '100%',
    height: 27,
    backgroundColor:
      'rgba(232,248,244,.8)',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },

  chipIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#D2EEE9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  chipText: {
    fontSize: 9,
    color: colors.primaryDark,
    fontFamily:
      fontFamilies.pretendardSemiBold,
  },

  strategyLine: {
    height: 1,
    width: 350,
    backgroundColor: colors.border,
  },

  strategyFooter: {
    width: 350,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 16,
    color: colors.textSecondary,
    fontFamily:
      fontFamilies.pretendardMedium,
  },

  start: {
    width: 373,
    height: 45,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  startText: {
    fontSize: 15,
    color: '#fff',
    fontFamily:
      fontFamilies.pretendardBold,
  },

  arrow: {
    position: 'absolute',
    right: 15,
    width: 24,
    height: 24,
    borderRadius: 99,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pressed: {
    opacity: 0.78,
  },
});