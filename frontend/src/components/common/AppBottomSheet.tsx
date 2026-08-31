import type { PropsWithChildren, ReactNode } from 'react';
import {
  Modal,
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
}: AppBottomSheetProps) {
  const insets = useSafeAreaInsets();
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

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="바텀시트 닫기"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            shadows.bottomSheet,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
        >
          {showHandle ? <View style={styles.handle} /> : null}
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: colors.overlay, flex: 1, justifyContent: 'flex-end' },
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
