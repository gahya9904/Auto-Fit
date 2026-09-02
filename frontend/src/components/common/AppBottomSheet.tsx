import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CloseIcon from '@/assets/icons/common/X.svg';
import { colors, radius, shadows, spacing, typography } from '@/src/theme';

import { IconButton } from './IconButton';

export interface AppBottomSheetProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  title?: string;
  showHandle?: boolean;
  scrollable?: boolean;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  handleStyle?: StyleProp<ViewStyle>;
  overlayStyle?: StyleProp<ViewStyle>;
  sheetStyle?: StyleProp<ViewStyle>;
  separateAnimations?: boolean;
}

export function AppBottomSheet({
  visible,
  onClose,
  title,
  showHandle = true,
  scrollable = false,
  footer,
  children,
  contentStyle,
  handleStyle,
  overlayStyle,
  sheetStyle,
  separateAnimations = false,
}: AppBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [isMounted, setIsMounted] = useState(visible);
  const [dimOpacity] = useState(() => new Animated.Value(0));
  const [sheetTranslateY] = useState(() => new Animated.Value(420));

  useEffect(() => {
    if (!separateAnimations) return;

    const useNativeDriver = Platform.OS !== 'web';

    if (visible) {
      let animationFrame: number | undefined;
      const mountFrame = requestAnimationFrame(() => {
        setIsMounted(true);
        dimOpacity.setValue(0);
        sheetTranslateY.setValue(420);

        animationFrame = requestAnimationFrame(() => {
          Animated.parallel([
            Animated.timing(dimOpacity, {
              duration: 260,
              easing: Easing.out(Easing.cubic),
              toValue: 1,
              useNativeDriver,
            }),
            Animated.timing(sheetTranslateY, {
              duration: 280,
              easing: Easing.out(Easing.cubic),
              toValue: 0,
              useNativeDriver,
            }),
          ]).start();
        });
      });

      return () => {
        cancelAnimationFrame(mountFrame);
        if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      };
    }

    Animated.parallel([
      Animated.timing(dimOpacity, {
        duration: 220,
        easing: Easing.in(Easing.cubic),
        toValue: 0,
        useNativeDriver,
      }),
      Animated.timing(sheetTranslateY, {
        duration: 240,
        easing: Easing.in(Easing.cubic),
        toValue: 420,
        useNativeDriver,
      }),
    ]).start(({ finished }) => {
      if (finished) setIsMounted(false);
    });
  }, [dimOpacity, separateAnimations, sheetTranslateY, visible]);

  const content = scrollable ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentStyle]}>{children}</View>
  );
  const sheetContent = (
    <>
      {showHandle ? <View style={[styles.handle, handleStyle]} /> : null}
      {title ? (
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <IconButton
            accessibilityLabel="닫기"
            icon={<CloseIcon color={colors.textBody} height={24} width={24} />}
            onPress={onClose}
          />
        </View>
      ) : null}
      {content}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  );
  const sheetStyles = [
    styles.sheet,
    shadows.bottomSheet,
    { paddingBottom: Math.max(insets.bottom, spacing.lg) },
    sheetStyle,
  ];

  return (
    <Modal
      animationType={separateAnimations ? 'none' : 'slide'}
      onRequestClose={onClose}
      transparent
      visible={separateAnimations ? isMounted : visible}
    >
      <View
        style={[
          styles.overlay,
          separateAnimations && styles.separateOverlay,
          !separateAnimations && overlayStyle,
        ]}
      >
        {separateAnimations ? (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.dimLayer,
              overlayStyle,
              { opacity: dimOpacity },
            ]}
          />
        ) : null}
        <Pressable
          accessibilityLabel="바텀시트 닫기"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        {separateAnimations ? (
          <Animated.View
            accessibilityViewIsModal
            style={[sheetStyles, { transform: [{ translateY: sheetTranslateY }] }]}
          >
            {sheetContent}
          </Animated.View>
        ) : (
          <View accessibilityViewIsModal style={sheetStyles}>
            {sheetContent}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: colors.overlay, flex: 1, justifyContent: 'flex-end' },
  separateOverlay: { backgroundColor: colors.transparent },
  dimLayer: { backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: radius.round,
    height: 5,
    marginTop: spacing.sm,
    width: 42,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 56,
    paddingLeft: spacing.xl,
    paddingRight: spacing.sm,
  },
  title: { ...typography.title, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
});
