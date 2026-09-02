import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
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
  CustomScrollIndicator,
  useCustomScrollIndicator,
} from '@/src/components/common';
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
const keyboardInputGap = 24;
const welcomeMessageText =
  'OO님 안녕하세요!\n무엇을 도와드릴까요?\n궁금한 건강 정보나 관리 방법을 물어보세요.';

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

type ChatMessage = {
  createdAt: number;
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

function createInitialMessages(): ChatMessage[] {
  return [
    {
      createdAt: Date.now(),
      id: 'welcome',
      role: 'assistant',
      text: welcomeMessageText,
    },
  ];
}

function formatMessageTime(timestamp: number) {
  const date = new Date(timestamp);
  const period = date.getHours() < 12 ? '오전' : '오후';
  const hour = date.getHours() % 12 || 12;
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${period} ${hour}:${minute}`;
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
  const messageScrollRef = useRef<ScrollView>(null);
  const messageIdRef = useRef(0);
  const pendingResponseTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const automaticScrollRef = useRef(false);
  const automaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const wasVisibleRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [inputText, setInputText] = useState('');
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>(createInitialMessages);
  const [overlayFrame, setOverlayFrame] = useState<OverlayFrame>({ x: 0, y: 0 });
  const [popupTopBeforeKeyboard, setPopupTopBeforeKeyboard] = useState<number | null>(null);
  const chatScrollIndicator = useCustomScrollIndicator({ showOnScroll: false });

  const bottomClearance = Math.max(insets.bottom, BOTTOM_NAVIGATION_MIN_BOTTOM_GAP);
  const estimatedNavigationTop =
    windowHeight - bottomClearance - getBottomNavigationVisualHeight(windowHeight);
  const navigationTop = navigationLayout
    ? navigationLayout.y - overlayFrame.y
    : estimatedNavigationTop;
  const availableWidth = Math.max(0, windowWidth - insets.left - insets.right);
  const popupScale = Math.min(1, availableWidth / referenceScreenWidth);
  const popupWidth = referencePopupWidth * popupScale;
  const basePopupHeight = referencePopupHeight * popupScale;
  const popupLeft = insets.left + (availableWidth - popupWidth) / 2;
  const minimumPopupTop = Math.max(8, insets.top - overlayFrame.y + 8);
  const preferredPopupTop = referencePopupTop * popupScale;
  const maximumPopupTop =
    navigationTop - referencePopupNavigationGap * popupScale - basePopupHeight;
  const restingPopupTop = Math.max(
    minimumPopupTop,
    Math.min(preferredPopupTop, maximumPopupTop),
  );
  const keyboardSafeBottom =
    keyboardTop === null || keyboardHeight <= 0
      ? null
      : keyboardTop - overlayFrame.y - keyboardInputGap;
  const popupTop =
    keyboardSafeBottom === null
      ? restingPopupTop
      : (popupTopBeforeKeyboard ?? restingPopupTop);
  const popupHeight =
    keyboardSafeBottom === null
      ? basePopupHeight
      : Math.max(0, Math.min(basePopupHeight, keyboardSafeBottom - popupTop));
  const popupContentHeight = popupHeight / Math.max(popupScale, 0.01);

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
  const startScaleY = anchor.height / Math.max(popupHeight, 1);

  const clearPendingResponses = useCallback(() => {
    pendingResponseTimersRef.current.forEach((timer) => clearTimeout(timer));
    pendingResponseTimersRef.current.clear();
  }, []);

  const scrollToLatestMessage = useCallback((animated: boolean) => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    if (automaticScrollTimerRef.current) clearTimeout(automaticScrollTimerRef.current);

    automaticScrollRef.current = true;

    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      messageScrollRef.current?.scrollToEnd({ animated });
      automaticScrollTimerRef.current = setTimeout(() => {
        automaticScrollRef.current = false;
        automaticScrollTimerRef.current = null;
      }, animated ? 600 : 100);
    });
  }, []);

  const handleRequestClose = useCallback(() => {
    clearPendingResponses();
    Keyboard.dismiss();
    onRequestClose();
  }, [clearPendingResponses, onRequestClose]);

  const handleCloseComplete = useCallback(() => {
    setInputText('');
    setMessages(createInitialMessages());
    onCloseComplete();
  }, [onCloseComplete]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;

    setMessages((current) => [
      ...current,
      {
        createdAt: Date.now(),
        id: `user-${Date.now()}-${messageIdRef.current++}`,
        role: 'user',
        text,
      },
    ]);
    setInputText('');

    const timer = setTimeout(() => {
      pendingResponseTimersRef.current.delete(timer);
      setMessages((current) => [
        ...current,
        {
          createdAt: Date.now(),
          id: `assistant-${Date.now()}-${messageIdRef.current++}`,
          role: 'assistant',
          text: 'AI 답변',
        },
      ]);
    }, 1000);

    pendingResponseTimersRef.current.add(timer);
  }, [inputText]);

  useEffect(() => {
    const duration = reduceMotion ? 1 : popupDuration;

    progress.value = withTiming(
      visible ? 1 : 0,
      {
        duration,
        easing: Easing.bezier(0.22, 0.82, 0.24, 1),
      },
      (finished) => {
        if (finished && !visible) runOnJS(handleCloseComplete)();
      },
    );
  }, [handleCloseComplete, progress, reduceMotion, visible]);

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      clearPendingResponses();
      setInputText('');
      setMessages(createInitialMessages());
    } else if (!visible) {
      clearPendingResponses();
    }

    wasVisibleRef.current = visible;
  }, [clearPendingResponses, visible]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardTop(event.endCoordinates.screenY);
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardTop(null);
      setKeyboardHeight(0);
      setPopupTopBeforeKeyboard(null);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (keyboardTop !== null) scrollToLatestMessage(false);
  }, [keyboardTop, scrollToLatestMessage]);

  useEffect(
    () => () => {
      clearPendingResponses();
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
      if (automaticScrollTimerRef.current) clearTimeout(automaticScrollTimerRef.current);
    },
    [clearPendingResponses],
  );

  useEffect(() => {
    if (!visible) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleRequestClose();
      return true;
    });

    return () => subscription.remove();
  }, [handleRequestClose, visible]);

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
              height: popupContentHeight,
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
                onPress={handleRequestClose}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <CloseIcon height={17} stroke={colors.primary} width={17} />
              </Pressable>
            </View>
            <View style={styles.divider} />
          </View>

          <View style={styles.dialogsContainer}>
            <ScrollView
              bounces={false}
              contentContainerStyle={styles.dialogsContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              onContentSizeChange={(width, height) => {
                chatScrollIndicator.onContentSizeChange(width, height);
                scrollToLatestMessage(true);
              }}
              onLayout={chatScrollIndicator.onLayout}
              onScroll={(event) => {
                chatScrollIndicator.onScroll(event);
                if (!automaticScrollRef.current) chatScrollIndicator.show();
              }}
              onScrollBeginDrag={() => {
                automaticScrollRef.current = false;
                if (automaticScrollTimerRef.current) {
                  clearTimeout(automaticScrollTimerRef.current);
                  automaticScrollTimerRef.current = null;
                }
                chatScrollIndicator.onScrollBeginDrag();
              }}
              onScrollEndDrag={chatScrollIndicator.onScrollEndDrag}
              overScrollMode="never"
              ref={messageScrollRef}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              style={[styles.dialogs, webMessageScrollStyle]}
            >
              <View style={styles.messages}>
                {messages.map((chatMessage) =>
                  chatMessage.role === 'assistant' ? (
                    <View key={chatMessage.id} style={styles.botRow}>
                      <View style={styles.profileCircle}>
                        <RobotIcon fill={colors.primary} height={30} width={30} />
                      </View>
                      <View style={styles.botContents}>
                        <Text style={styles.botName}>AI 건강 챗봇</Text>
                        <View style={styles.botBubble}>
                          <Text style={styles.messageText}>{chatMessage.text}</Text>
                        </View>
                        <Text style={styles.time}>{formatMessageTime(chatMessage.createdAt)}</Text>
                      </View>
                    </View>
                  ) : (
                    <View key={chatMessage.id} style={styles.userDialog}>
                      <View style={styles.userBubble}>
                        <Text style={styles.messageText}>{chatMessage.text}</Text>
                      </View>
                      <Text style={[styles.time, styles.userTime]}>
                        {formatMessageTime(chatMessage.createdAt)}
                      </Text>
                    </View>
                  ),
                )}
              </View>
            </ScrollView>
            <CustomScrollIndicator
              {...chatScrollIndicator.indicatorProps}
              color="rgba(120, 120, 120, 0.4)"
              rightInset={4}
            />
          </View>

          <View style={styles.composer}>
            <TextInput
              accessibilityLabel="AI 채팅 메시지"
              onChangeText={setInputText}
              onFocus={() => {
                if (keyboardTop === null) setPopupTopBeforeKeyboard(restingPopupTop);
                scrollToLatestMessage(false);
              }}
              onSubmitEditing={handleSend}
              placeholder="메시지를 입력해주세요..."
              placeholderTextColor={colors.textSecondary}
              returnKeyType="send"
              style={styles.input}
              value={inputText}
            />
            <Pressable
              accessibilityLabel="메시지 보내기"
              accessibilityRole="button"
              hitSlop={4}
              onPress={handleSend}
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
  dialogsContainer: {
    flex: 1,
    position: 'relative',
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
