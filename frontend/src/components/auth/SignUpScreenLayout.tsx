import type { ReactNode } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, BackButton } from '@/src/components/common';
import { colors, spacing } from '@/src/theme';

import { SignUpBrand } from './SignUpBrand';
import { SignUpStepIndicator } from './SignUpStepIndicator';

const authBackground = require('../../../assets/images/backgrounds/2_Auth.png');
const referenceContentHeight = 815;
const referenceBackTop = 67;
const minimumContentScale = 0.76;

export interface SignUpScreenLayoutProps {
  currentStep: 1 | 2 | 3;
  ctaLabel: string;
  onBack: () => void;
  onContinue: () => void;
  children: ReactNode;
}

export interface SignUpSectionProps {
  top: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
}

export function SignUpSection({ top, children, style, innerStyle }: SignUpSectionProps) {
  return (
    <View style={[styles.section, { top }, style]}>
      <View style={[styles.sectionInner, innerStyle]}>{children}</View>
    </View>
  );
}

export function SignUpScreenLayout({
  currentStep,
  ctaLabel,
  onBack,
  onContinue,
  children,
}: SignUpScreenLayoutProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const topSafetyOffset = Math.max(0, insets.top - referenceBackTop);
  const bottomClearance = Math.max(spacing.lg, insets.bottom);
  const availableContentHeight = Math.max(0, windowHeight - topSafetyOffset - bottomClearance);
  const contentScale = Math.max(
    minimumContentScale,
    Math.min(1, availableContentHeight / referenceContentHeight),
  );

  return (
    <View style={styles.root}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="stretch"
        source={authBackground}
        style={styles.background}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
      >
        <Pressable accessible={false} onPress={Keyboard.dismiss} style={styles.dismissArea}>
          <View style={[styles.viewport, { paddingTop: topSafetyOffset }]}>
            <View style={[styles.scaledSlot, { height: referenceContentHeight * contentScale }]}>
              <View style={[styles.contentUnit, { transform: [{ scale: contentScale }] }]}>
                <View style={styles.backButton}>
                  <BackButton onPress={onBack} size={44} />
                </View>
                <View style={styles.stepIndicator}>
                  <SignUpStepIndicator currentStep={currentStep} />
                </View>
                <View style={styles.brand}>
                  <SignUpBrand />
                </View>
                {children}
                <SignUpSection top={760}>
                  <AppButton onPress={onContinue} title={ctaLabel} />
                </SignUpSection>
              </View>
            </View>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    width: '100%',
  },
  background: {
    bottom: 0,
    height: '100%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
  },
  keyboardAvoidingView: {
    flex: 1,
    width: '100%',
  },
  dismissArea: {
    flex: 1,
    width: '100%',
  },
  viewport: {
    alignItems: 'center',
    flex: 1,
    overflow: 'hidden',
    width: '100%',
  },
  scaledSlot: {
    alignItems: 'center',
    width: '100%',
  },
  contentUnit: {
    height: referenceContentHeight,
    transformOrigin: 'top center',
    width: '100%',
  },
  backButton: {
    left: 0,
    position: 'absolute',
    top: 57.5,
    zIndex: 2,
  },
  stepIndicator: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 70,
  },
  brand: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 96,
  },
  section: {
    alignItems: 'center',
    left: 0,
    paddingHorizontal: 31,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 0,
  },
  sectionInner: {
    maxWidth: 350,
    width: '100%',
  },
});
