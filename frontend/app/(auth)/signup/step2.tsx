import { useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import EmailIcon from '@/assets/icons/input/Email.svg';
import { SignUpScreenLayout, SignUpSection } from '@/src/components/auth';
import { colors, fontFamilies, radius, typography } from '@/src/theme';

const verificationCodeLength = 6;

export default function SignUpStep2Screen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : 'user@example.com';
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [digits, setDigits] = useState(() =>
    Array.from({ length: verificationCodeLength }, () => ''),
  );
  const [focusedIndex, setFocusedIndex] = useState(0);

  const updateDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setDigits((current) => current.map((item, itemIndex) => (itemIndex === index ? digit : item)));
    if (digit && index < verificationCodeLength - 1) inputRefs.current[index + 1]?.focus();
  };

  return (
    <SignUpScreenLayout
      ctaLabel="다음"
      currentStep={2}
      onBack={() => router.back()}
      onContinue={() => router.push('/signup/step3')}
    >
      <SignUpSection innerStyle={styles.confirmContent} top={300}>
        <Text style={styles.sectionTitle}>이메일 인증</Text>
        <Text style={styles.description}>
          입력하신 이메일로 인증번호를 발송했어요.{`\n`}인증번호 6자리를 입력해주세요.
        </Text>
        <View style={styles.emailCard}>
          <View style={styles.emailLeft}>
            <View style={styles.fieldIcon}>
              <EmailIcon color={colors.textNavigator} height={18} width={18} />
            </View>
            <Text numberOfLines={1} style={styles.emailText}>
              {email}
            </Text>
          </View>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()}>
            <Text style={styles.changeEmail}>이메일 변경</Text>
          </Pressable>
        </View>
        <View style={styles.codeRow}>
          {digits.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              accessibilityLabel={`인증번호 ${index + 1}번째 자리`}
              autoFocus={index === 0}
              keyboardType="number-pad"
              maxLength={1}
              onChangeText={(value) => updateDigit(index, value)}
              onFocus={() => setFocusedIndex(index)}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
                  inputRefs.current[index - 1]?.focus();
                }
              }}
              selectTextOnFocus
              style={[styles.codeInput, focusedIndex === index && styles.codeInputFocused]}
              value={digit}
            />
          ))}
        </View>
      </SignUpSection>

      <SignUpSection innerStyle={styles.resendContent} top={636}>
        <Text style={styles.resendQuestion}>이메일을 받지 못하였나요?</Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => undefined}>
          <Text style={styles.resendLink}>인증 메일 재발송</Text>
        </Pressable>
      </SignUpSection>
    </SignUpScreenLayout>
  );
}

const styles = StyleSheet.create({
  confirmContent: {
    gap: 30,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.textBody,
    fontSize: 17,
    height: 20,
    includeFontPadding: false,
    lineHeight: 20,
  },
  description: {
    ...typography.body,
    color: colors.textBody,
    height: 44,
    includeFontPadding: false,
    lineHeight: 22,
  },
  emailCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    height: 55,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  emailLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  fieldIcon: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  emailText: {
    ...typography.body,
    color: colors.textNavigator,
    flex: 1,
    includeFontPadding: false,
    lineHeight: 17,
  },
  changeEmail: {
    ...typography.bodySmall,
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardMedium,
    includeFontPadding: false,
    lineHeight: 16,
    marginLeft: 10,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    width: '100%',
  },
  codeInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textBody,
    flex: 1,
    fontFamily: fontFamilies.pretendardLight,
    fontSize: 25,
    height: 45,
    includeFontPadding: false,
    maxWidth: 45,
    padding: 0,
    textAlign: 'center',
  },
  codeInputFocused: {
    borderColor: colors.primary,
  },
  resendContent: {
    alignItems: 'center',
    gap: 10,
  },
  resendQuestion: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    includeFontPadding: false,
    lineHeight: 16,
  },
  resendLink: {
    ...typography.bodySmall,
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    includeFontPadding: false,
    lineHeight: 16,
  },
});
