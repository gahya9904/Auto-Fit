import { useRef, useState, type ComponentType } from 'react';
import { useRouter } from 'expo-router';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import type { SvgProps } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmailIcon from '@/assets/icons/input/Email.svg';
import EyeCloseIcon from '@/assets/icons/input/EyeClose.svg';
import PasswordIcon from '@/assets/icons/input/Password.svg';
import LogoIcon from '@/assets/icons/Logo_Auto-Fit.svg';
import GoogleIcon from '@/assets/icons/social/Google.svg';
import KakaoIcon from '@/assets/icons/social/Kakao.svg';
import { AppButton, AppTextField, IconButton } from '@/src/components/common';
import { colors, radius, spacing, typography } from '@/src/theme';

const authBackground = require('../../assets/images/backgrounds/2_Auth.png');
const figmaContentTop = 80;
const figmaContentBottom = 742;
const referenceContentHeight = figmaContentBottom - figmaContentTop;
const figmaBrandToFormGap = 71.521;
const formGroupUpwardAdjustment = spacing.sm;
const minimumContentScale = 0.8;

type SocialLoginButtonProps = {
  label: string;
  icon: ComponentType<SvgProps>;
  onPress: () => void;
  style?: ViewStyle;
};

function SocialLoginButton({ label, icon: SocialIcon, onPress, style }: SocialLoginButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.socialButton, pressed && styles.pressed, style]}
    >
      <View style={styles.socialIconBox}>
        <SocialIcon height={50} width={50} />
      </View>
      <Text style={styles.socialLabel}>{label}</Text>
      <View style={styles.socialBalance} />
    </Pressable>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleLogin = () => {
    Keyboard.dismiss();
    router.replace('/health-data/upload');
  };

  const dismissKeyboard = () => Keyboard.dismiss();
  const openSignUp = () => {
    Keyboard.dismiss();
    router.push('/signup/step1');
  };
  const openForgotPassword = () => {
    Keyboard.dismiss();
    router.push('/password/forgot');
  };
  const contentTop = Math.max(figmaContentTop, insets.top);
  const bottomClearance = Math.max(spacing.lg, insets.bottom);
  const availableContentHeight = Math.max(0, windowHeight - contentTop - bottomClearance);
  const contentScale = Math.max(
    minimumContentScale,
    Math.min(1, availableContentHeight / referenceContentHeight),
  );

  return (
    <View style={styles.background}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="stretch"
        source={authBackground}
        style={styles.backgroundImage}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
      >
        <Pressable accessible={false} onPress={dismissKeyboard} style={styles.keyboardDismissArea}>
          <View style={[styles.contentViewport, { paddingTop: contentTop }]}>
            <View
              style={[styles.scaledContentSlot, { height: referenceContentHeight * contentScale }]}
            >
              <View
                style={[
                  styles.contentContainer,
                  {
                    transform: [{ scale: contentScale }],
                  },
                ]}
              >
                <View style={styles.brandSection}>
                  <LogoIcon accessibilityLabel="Auto-Fit 로고" height={68.479} width={71.591} />
                  <Text style={styles.brandName}>Auto-Fit</Text>
                  <Text style={styles.tagline}>
                    <Text style={styles.taglineAccent}>AI</Text>가 함께하는 나만의 헬스케어
                  </Text>
                </View>

                <View style={styles.form}>
                  <AppTextField
                    accessibilityLabel="이메일"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    leftElement={
                      <View style={styles.inputIconSlot}>
                        <EmailIcon color={colors.textNavigator} height={18} width={18} />
                      </View>
                    }
                    onChangeText={setEmail}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    placeholder="이메일을 입력해주세요"
                    returnKeyType="next"
                    textContentType="emailAddress"
                    value={email}
                  />
                  <AppTextField
                    ref={passwordRef}
                    accessibilityLabel="비밀번호"
                    autoCapitalize="none"
                    autoComplete="password"
                    leftElement={
                      <View style={styles.inputIconSlot}>
                        <PasswordIcon color={colors.textNavigator} height={18} width={18} />
                      </View>
                    }
                    onChangeText={setPassword}
                    onSubmitEditing={handleLogin}
                    placeholder="비밀번호를 입력해주세요"
                    returnKeyType="done"
                    rightElement={
                      <IconButton
                        accessibilityLabel={passwordVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
                        icon={<EyeCloseIcon color={colors.textNavigator} height={18} width={18} />}
                        onPress={() => setPasswordVisible((visible) => !visible)}
                        size={44}
                        style={styles.eyeButton}
                      />
                    }
                    secureTextEntry={!passwordVisible}
                    textContentType="password"
                    value={password}
                  />
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={openForgotPassword}
                    style={styles.forgotPasswordButton}
                  >
                    <Text style={styles.forgotPasswordText}>비밀번호 찾기</Text>
                  </Pressable>
                  <AppButton onPress={handleLogin} title="로그인" />
                </View>

                <View accessible={false} style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerLabel}>또는</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.socialSection}>
                  <SocialLoginButton
                    icon={GoogleIcon}
                    label="Google로 계속하기"
                    onPress={dismissKeyboard}
                  />
                  <SocialLoginButton
                    icon={KakaoIcon}
                    label="Kakao로 계속하기"
                    onPress={dismissKeyboard}
                  />
                  <View style={styles.signUpGuide}>
                    <Text style={styles.signUpGuideText}>계정이 없으신가요?</Text>
                    <Pressable accessibilityRole="button" hitSlop={8} onPress={openSignUp}>
                      <Text style={styles.signUpLinkText}>회원가입</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surface,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    width: '100%',
  },
  backgroundImage: {
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
  keyboardDismissArea: {
    flex: 1,
    width: '100%',
  },
  contentViewport: {
    alignItems: 'center',
    flex: 1,
    overflow: 'hidden',
    width: '100%',
  },
  scaledContentSlot: {
    alignItems: 'center',
    width: '100%',
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: 31,
    transformOrigin: 'top center',
    width: '100%',
  },
  brandSection: {
    alignItems: 'center',
    paddingVertical: 25,
    width: '100%',
  },
  brandName: {
    ...typography.display,
    color: colors.textBody,
    height: 50,
    includeFontPadding: false,
    marginTop: 6,
    textAlign: 'center',
    width: 200,
  },
  tagline: {
    ...typography.body,
    color: colors.textBody,
    height: 17,
    includeFontPadding: false,
    lineHeight: 17,
    textAlign: 'center',
    width: 252,
  },
  taglineAccent: {
    color: colors.primary,
  },
  form: {
    alignSelf: 'center',
    gap: spacing.sm,
    marginTop: figmaBrandToFormGap - formGroupUpwardAdjustment,
    maxWidth: 350,
    width: '100%',
  },
  eyeButton: {
    marginRight: -11,
  },
  inputIconSlot: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    justifyContent: 'center',
    minHeight: 14,
  },
  forgotPasswordText: {
    ...typography.label,
    color: colors.primaryDark,
    includeFontPadding: false,
    lineHeight: 14,
  },
  divider: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    height: 16,
    marginTop: spacing.xl,
    maxWidth: 350,
    width: '100%',
  },
  dividerLine: {
    backgroundColor: colors.textDisabled,
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerLabel: {
    ...typography.label,
    color: colors.textDisabled,
    includeFontPadding: false,
    lineHeight: 14,
  },
  socialSection: {
    alignSelf: 'center',
    gap: 17,
    marginTop: spacing.xl,
    maxWidth: 350,
    width: '100%',
  },
  socialButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    height: 45,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  socialIconBox: {
    alignItems: 'center',
    height: 50,
    justifyContent: 'center',
    marginLeft: 10,
    width: 50,
  },
  socialBalance: {
    marginRight: 10,
    width: 50,
  },
  socialLabel: {
    ...typography.bodySmall,
    color: colors.textBody,
    includeFontPadding: false,
    lineHeight: 16,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  signUpGuide: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  signUpGuideText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    includeFontPadding: false,
    lineHeight: 16,
  },
  signUpLinkText: {
    ...typography.bodySmall,
    color: colors.primaryDark,
    fontFamily: typography.label.fontFamily,
    includeFontPadding: false,
    lineHeight: 16,
  },
});
