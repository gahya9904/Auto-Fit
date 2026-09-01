import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import CloseIcon from '@/assets/icons/common/X.svg';
import PaperPlaneIcon from '@/assets/icons/feature/PaperPlane_Fill.svg';
import RobotIcon from '@/assets/icons/feature/Robot_Fill.svg';
import {
  BOTTOM_NAVIGATION_MIN_BOTTOM_GAP,
  getBottomNavigationVisualHeight,
  type BottomNavigationLayout,
} from '@/src/components/navigation';
import { colors, fontFamilies, radius } from '@/src/theme';

import type { AIChatButtonAnchor } from './DraggableAIChatButton';

const referenceScreenWidth = 412;
const referencePopupTop = 232;
const referencePopupWidth = 370;
const referencePopupHeight = 550;
const referencePopupNavigationGap = 48;
const popupDuration = 360;

const webFixedOverlayStyle: ViewStyle | undefined =
  Platform.OS === 'web'
    ? ({
        overscrollBehavior: 'none',
        touchAction: 'none',
        userSelect: 'none',
      } as ViewStyle)
    : undefined;

const webMessageScrollStyle: ViewStyle | undefined =
  Platform.OS === 'web'
    ? ({ overscrollBehavior: 'contain', touchAction: 'pan-y' } as ViewStyle)
    : undefined;

const webOverlayProps =
  Platform.OS === 'web'
    ? {
        draggable: false,
        onDragStart: (event: { preventDefault: () => void }) => event.preventDefault(),
      }
    : {};

interface ChatPopupProps {
  anchor: AIChatButtonAnchor;
  navigationLayout?: BottomNavigationLayout;
  onCloseComplete: () => void;
  onRequestClose: () => void;
  visible: boolean;
}

interface OverlayFrame {
  x: number;
  y: number;
}

function SendButtonGradient() {
  return (
    <Svg height={40} style={StyleSheet.absoluteFill} width={40}>
      <Defs>
        <LinearGradient id="sendGradient" x1="0" x2="1" y1="1" y2="0">
          <Stop offset="0" stopColor={colors.primary} />
          <Stop offset="0.5" stopColor="#42C0A6" />
          <Stop offset="1" stopColor={colors.primary} />
        </LinearGradient>
      </Defs>
      <Rect fill="url(#sendGradient)" height={40} rx={20} width={40} />
    </Svg>
  );
}

export function ChatPopup({
  anchor,
  navigationLayout,
  onCloseComplete,
  onRequestClose,
  visible,
}: ChatPopupProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const overlayRef = useRef<View>(null);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [message, setMessage] = useState('');
  const [overlayFrame, setOverlayFrame] = useState<OverlayFrame>({ x: 0, y: 0 });

  const bottomClearance = Math.max(insets.bottom, BOTTOM_NAVIGATION_MIN_BOTTOM_GAP);
  const estimatedNavigationTop =
    windowHeight - bottomClearance - getBottomNavigationVisualHeight(windowHeight);
  const navigationTop = navigationLayout
    ? navigationLayout.y - overlayFrame.y
    : estimatedNavigationTop;
  const availableWidth = Math.max(0, windowWidth - insets.left - insets.right);
  const popupScale = Math.min(1, availableWidth / referenceScreenWidth);
  const popupWidth = referencePopupWidth * popupScale;
  const popupHeight = referencePopupHeight * popupScale;
  const popupLeft = insets.left + (availableWidth - popupWidth) / 2;
  const minimumPopupTop = Math.max(8, insets.top - overlayFrame.y + 8);
  const preferredPopupTop = referencePopupTop * popupScale;
  const maximumPopupTop = navigationTop - referencePopupNavigationGap * popupScale - popupHeight;
  const popupTop = Math.max(minimumPopupTop, Math.min(preferredPopupTop, maximumPopupTop));

  const anchorCenter = useMemo(
    () => ({
      x: anchor.x - overlayFrame.x + anchor.width / 2,
      y: anchor.y - overlayFrame.y + anchor.height / 2,
    }),
    [anchor, overlayFrame],
  );
  const popupCenterX = popupLeft + popupWidth / 2;
  const popupCenterY = popupTop + popupHeight / 2;
  const startTranslateX = anchorCenter.x - popupCenterX;
  const startTranslateY = anchorCenter.y - popupCenterY;
  const startScaleX = anchor.width / popupWidth;
  const startScaleY = anchor.height / popupHeight;

  useEffect(() => {
    const duration = reduceMotion ? 1 : popupDuration;

    progress.value = withTiming(
      visible ? 1 : 0,
      {
        duration,
        easing: Easing.bezier(0.22, 0.82, 0.24, 1),
      },
      (finished) => {
        if (finished && !visible) runOnJS(onCloseComplete)();
      },
    );
  }, [onCloseComplete, progress, reduceMotion, visible]);

  useEffect(() => {
    if (!visible) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onRequestClose();
      return true;
    });

    return () => subscription.remove();
  }, [onRequestClose, visible]);

  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.45]),
  }));

  const popupAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 1], [0, 0.55, 1]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [startTranslateX, 0]) },
      { translateY: interpolate(progress.value, [0, 1], [startTranslateY, 0]) },
      {
        scaleX: interpolate(
          progress.value,
          [0, 0.28, 1],
          [startScaleX, Math.max(startScaleX, 0.22), 1],
        ),
      },
      {
        scaleY: interpolate(
          progress.value,
          [0, 0.28, 1],
          [startScaleY, Math.max(startScaleY, 0.13), 1],
        ),
      },
    ],
  }));

  const handleOverlayLayout = (_event: LayoutChangeEvent) => {
    overlayRef.current?.measureInWindow((x, y) => {
      setOverlayFrame((current) => (current.x === x && current.y === y ? current : { x, y }));
    });
  };

  return (
    <View
      {...webOverlayProps}
      ref={overlayRef}
      accessibilityViewIsModal
      onLayout={handleOverlayLayout}
      pointerEvents="auto"
      style={[styles.overlay, webFixedOverlayStyle]}
    >
      <Animated.View style={[styles.dim, dimStyle]} />
      <Animated.View
        style={[
          styles.popupShell,
          {
            height: popupHeight,
            left: popupLeft,
            top: popupTop,
            width: popupWidth,
          },
          popupAnimatedStyle,
        ]}
      >
        <View
          style={[
            styles.popupContent,
            {
              transform: [{ scale: popupScale }],
            },
          ]}
        >
          <View style={styles.topSection}>
            <View style={styles.titleRow}>
              <View style={styles.titleLeft}>
                <View style={styles.titleRobotCircle}>
                  <View style={styles.titleRobotBack} />
                  <RobotIcon
                    fill={colors.surface}
                    height={45}
                    style={styles.titleRobotIcon}
                    width={45}
                  />
                </View>
                <Text style={styles.title}>AI 건강 도우미</Text>
              </View>
              <Pressable
                accessibilityLabel="AI 채팅 닫기"
                accessibilityRole="button"
                hitSlop={7}
                onPress={onRequestClose}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <CloseIcon height={17} stroke={colors.textSecondary} width={17} />
              </Pressable>
            </View>
            <View style={styles.divider} />
          </View>

          <ScrollView
            bounces={false}
            contentContainerStyle={styles.dialogsContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            style={[styles.dialogs, webMessageScrollStyle]}
          >
            <View style={styles.messages}>
              <View style={styles.botRow}>
                <View style={styles.profileCircle}>
                  <RobotIcon fill={colors.primary} height={30} width={30} />
                </View>
                <View style={styles.botContents}>
                  <Text style={styles.botName}>AI 건강 챗봇</Text>
                  <View style={styles.botBubble}>
                    <Text style={styles.messageText}>
                      OO님 안녕하세요!{`\n`}무엇을 도와드릴까요?{`\n`}궁금한 건강 정보나 관리 방법을
                      물어보세요.
                    </Text>
                  </View>
                  <Text style={styles.time}>오전 11:39</Text>
                </View>
              </View>

              <View style={styles.userDialog}>
                <View style={styles.userBubble}>
                  <Text style={styles.messageText}>최근 건강 점수가 낮아졌는데 이유가 뭘까요?</Text>
                </View>
                <Text style={[styles.time, styles.userTime]}>오전 11:42</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.composer}>
            <TextInput
              accessibilityLabel="AI 채팅 메시지"
              onChangeText={setMessage}
              placeholder="메시지를 입력해주세요..."
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              value={message}
            />
            <Pressable
              accessibilityLabel="메시지 보내기"
              accessibilityRole="button"
              hitSlop={4}
              style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
            >
              <SendButtonGradient />
              <PaperPlaneIcon
                fill={colors.surface}
                height={22}
                style={styles.sendIcon}
                width={22}
              />
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    zIndex: 30,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  popupShell: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    elevation: Platform.OS === 'android' ? 7 : 0,
    overflow: 'hidden',
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { height: -4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  popupContent: {
    backgroundColor: colors.surface,
    height: referencePopupHeight,
    left: 0,
    position: 'absolute',
    top: 0,
    transformOrigin: 'top left',
    width: referencePopupWidth,
  },
  topSection: {
    gap: 15,
    paddingTop: 16,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  titleLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  titleRobotCircle: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xl,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 40,
  },
  titleRobotBack: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    bottom: 0,
    height: 30,
    position: 'absolute',
    width: 33,
  },
  titleRobotIcon: {
    zIndex: 1,
  },
  title: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 18,
    includeFontPadding: false,
    lineHeight: 24,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 16,
    borderWidth: 1,
    elevation: Platform.OS === 'android' ? 1 : 0,
    height: 30,
    justifyContent: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { height: 2, width: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2.5,
    width: 30,
  },
  divider: {
    backgroundColor: colors.border,
    height: 2,
    width: '100%',
  },
  dialogs: {
    flex: 1,
  },
  dialogsContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  messages: {
    gap: 15,
  },
  botRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  profileCircle: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  botContents: {
    flex: 1,
    gap: 4,
  },
  botName: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 12,
    includeFontPadding: false,
    lineHeight: 17,
  },
  botBubble: {
    backgroundColor: '#F2F3F5',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
  },
  messageText: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 13,
    includeFontPadding: false,
    lineHeight: 18,
  },
  time: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 10,
    includeFontPadding: false,
    lineHeight: 15,
  },
  userDialog: {
    alignItems: 'flex-end',
    width: '100%',
  },
  userBubble: {
    backgroundColor: colors.primaryLight,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: 220,
  },
  userTime: {
    textAlign: 'right',
    width: '100%',
  },
  composer: {
    alignItems: 'center',
    backgroundColor: '#F2F3F5',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    gap: 10,
    height: 60,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  input: {
    backgroundColor: '#F2F3F5',
    color: colors.textBody,
    flex: 1,
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 13,
    height: 40,
    includeFontPadding: false,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 40,
  },
  sendIcon: {
    zIndex: 1,
  },
  pressed: {
    opacity: 0.72,
  },
});
