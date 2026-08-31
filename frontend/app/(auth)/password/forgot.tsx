import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Keyboard, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import EmailIcon from '@/assets/icons/input/Email.svg';
import ShieldCheckIcon from '@/assets/icons/system/ShieldCheck.svg';
import { PasswordAuthScreenLayout, PasswordAuthSection } from '@/src/components/auth';
import { AppButton, AppTextField } from '@/src/components/common';
import { colors, fontFamilies, radius, typography } from '@/src/theme';

const securityCardShadow: ViewStyle =
  Platform.OS === 'web'
    ? { boxShadow: '0 0 2.5px rgba(0, 0, 0, 0.05)' }
    : {
        elevation: 1,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.05,
        shadowRadius: 2.5,
      };

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  const openResetPassword = () => {
    Keyboard.dismiss();
    router.push('/password/reset');
  };

  return (
    <PasswordAuthScreenLayout
      description={
        <>
          가입 시 입력한 이메일을 입력해주세요.{`\n`}비밀번호 재설정 링크를 이메일로 보내드릴게요.
        </>
      }
      onBack={() => router.back()}
      title="비밀번호 찾기"
    >
      <PasswordAuthSection innerStyle={styles.emailContent} top={317}>
        <AppTextField
          accessibilityLabel="가입 이메일"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          leftElement={
            <View style={styles.inputIconSlot}>
              <EmailIcon color={colors.textSecondary} height={18} width={18} />
            </View>
          }
          onChangeText={setEmail}
          onSubmitEditing={openResetPassword}
          placeholder="이메일을 입력해주세요"
          returnKeyType="send"
          textContentType="emailAddress"
          value={email}
        />
        <AppButton onPress={openResetPassword} title="인증 메일 보내기" />
      </PasswordAuthSection>

      <PasswordAuthSection innerStyle={styles.securityCard} top={468}>
        <View style={styles.securityIconCircle}>
          <ShieldCheckIcon color={colors.primary} height={30} width={30} />
        </View>
        <View style={styles.securityCopy}>
          <Text style={styles.securityTitle}>안전하게 비밀번호를 재설정해요</Text>
          <Text style={styles.securityDescription}>
            입력하신 이메일로 비밀번호 재설정 링크를 보내드려요.{`\n`}링크는{' '}
            <Text style={styles.securityAccent}>10분</Text>동안 유효합니다.
          </Text>
        </View>
      </PasswordAuthSection>

      <PasswordAuthSection innerStyle={styles.divider} top={570}>
        <View style={styles.dividerLine} />
      </PasswordAuthSection>

      <PasswordAuthSection innerStyle={styles.deliveryHelp} top={608}>
        <View style={styles.emailBadge}>
          <EmailIcon color={colors.primary} height={15} width={15} />
        </View>
        <Text style={styles.helpTitle}>메일이 오지 않나요?</Text>
        <Text style={styles.helpDescription}>
          스팸 메일함을 확인하거나 잠시 후 다시 시도해주세요.
        </Text>
      </PasswordAuthSection>
    </PasswordAuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  emailContent: {
    gap: 11,
  },
  inputIconSlot: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  securityCard: {
    ...securityCardShadow,
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.xl,
    flexDirection: 'row',
    gap: 20,
    minHeight: 74,
    maxWidth: 344,
    paddingHorizontal: 15,
    paddingVertical: 10,
    width: '100%',
  },
  securityIconCircle: {
    alignItems: 'center',
    backgroundColor: '#DEF2EF',
    borderRadius: 25,
    height: 45,
    justifyContent: 'center',
    width: 45,
  },
  securityCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  securityTitle: {
    ...typography.bodySmall,
    color: '#373737',
    fontFamily: fontFamilies.pretendardSemiBold,
    includeFontPadding: false,
    lineHeight: 16,
  },
  securityDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
    fontSize: 10,
    includeFontPadding: false,
    lineHeight: 17,
  },
  securityAccent: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  dividerLine: {
    backgroundColor: colors.textDisabled,
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  deliveryHelp: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 10,
    maxWidth: 241,
  },
  emailBadge: {
    alignItems: 'center',
    backgroundColor: '#DEF2EF',
    borderRadius: 12.5,
    height: 25,
    justifyContent: 'center',
    width: 25,
  },
  helpTitle: {
    ...typography.bodySmall,
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    includeFontPadding: false,
    lineHeight: 17,
    textAlign: 'center',
    width: '100%',
  },
  helpDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
    includeFontPadding: false,
    lineHeight: 17,
    textAlign: 'center',
    width: '100%',
  },
});
