import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import DownIcon from '@/assets/icons/common/chevrons/Down.svg';
import CalendarIcon from '@/assets/icons/input/Calendar.svg';
import EmailIcon from '@/assets/icons/input/Email.svg';
import EyeIcon from '@/assets/icons/input/Eye.svg';
import EyeCloseIcon from '@/assets/icons/input/EyeClose.svg';
import FemaleIcon from '@/assets/icons/input/gender/Gender_Female.svg';
import MaleIcon from '@/assets/icons/input/gender/Gender_Male.svg';
import PasswordIcon from '@/assets/icons/input/Password.svg';
import UserIcon from '@/assets/icons/input/User.svg';
import CheckIcon from '@/assets/icons/system/Check.svg';
import { BirthDatePicker, SignUpScreenLayout, SignUpSection } from '@/src/components/auth';
import { AppTextField, IconButton, SelectField } from '@/src/components/common';
import { colors, radius, spacing, typography } from '@/src/theme';

type Gender = 'male' | 'female';
type Step1InputKey = 'email' | 'password' | 'confirm-password' | 'name';

const minimumScreenHeight = 740;
const maximumScreenHeight = 917;
const signUpBrandVisualHeight = 144;
const defaultBirthday = new Date();
const keyboardSafeGap = 20;

function formatBirthday(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}.${month}.${day}`;
}

export default function SignUpStep1Screen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const focusedInputRef = useRef<TextInput | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState<Date>();
  const [birthdayPickerVisible, setBirthdayPickerVisible] = useState(false);
  const [gender, setGender] = useState<Gender>('male');
  const [agreed, setAgreed] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [focusedInputKey, setFocusedInputKey] = useState<Step1InputKey | null>(null);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const [keyboardContentOffset, setKeyboardContentOffset] = useState(0);
  const screenHeight = Dimensions.get('screen').height;
  const responsiveHeight = Platform.OS === 'web' ? windowHeight : screenHeight;
  const heightProgress = Math.max(
    0,
    Math.min(
      1,
      (responsiveHeight - minimumScreenHeight) / (maximumScreenHeight - minimumScreenHeight),
    ),
  );
  const verticalValue = (expanded: number, compact: number) =>
    compact + (expanded - compact) * heightProgress;
  const signUpBrandBottom = verticalValue(96, 74) + signUpBrandVisualHeight;
  const formTop = Math.max(verticalValue(287, 230), signUpBrandBottom + 12);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardTop(event.endCoordinates.screenY);
    });
    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardTop(null);
      setKeyboardContentOffset(0);
    });

    return () => {
      keyboardDidShow.remove();
      keyboardDidHide.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || focusedInputKey === null || keyboardTop === null) {
      return undefined;
    }

    const frame = requestAnimationFrame(() => {
      focusedInputRef.current?.measureInWindow((_x, y, _width, height) => {
        const hiddenAmount = y + height - (keyboardTop - keyboardSafeGap);
        setKeyboardContentOffset(Math.max(0, hiddenAmount));
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [focusedInputKey, keyboardTop]);

  const handleInputFocus = (key: Step1InputKey, input: TextInput | null) => {
    focusedInputRef.current = input;
    setFocusedInputKey(key);
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/login');
  };

  const goNext = () => {
    router.push({ pathname: '/signup/step2', params: { email: email || 'user@example.com' } });
  };

  const openBirthdayPicker = () => {
    setBirthdayPickerVisible(true);
  };

  return (
    <SignUpScreenLayout
      alignStepCta
      ctaLabel="다음"
      contentOffsetY={keyboardContentOffset}
      currentStep={1}
      onBack={goBack}
      onContinue={goNext}
    >
      <SignUpSection innerStyle={styles.form} top={formTop}>
        <AppTextField
          ref={emailRef}
          accessibilityLabel="이메일"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          leftElement={
            <FieldIcon icon={<EmailIcon color={colors.textNavigator} height={18} width={18} />} />
          }
          onChangeText={setEmail}
          onFocus={() => handleInputFocus('email', emailRef.current)}
          onSubmitEditing={() => passwordRef.current?.focus()}
          placeholder="이메일을 입력해주세요"
          returnKeyType="next"
          style={styles.textFieldInput}
          textContentType="emailAddress"
          value={email}
        />
        <AppTextField
          ref={passwordRef}
          accessibilityLabel="비밀번호"
          autoCapitalize="none"
          autoComplete="new-password"
          leftElement={
            <FieldIcon
              icon={<PasswordIcon color={colors.textNavigator} height={18} width={18} />}
            />
          }
          onChangeText={setPassword}
          onFocus={() => handleInputFocus('password', passwordRef.current)}
          onSubmitEditing={() => confirmPasswordRef.current?.focus()}
          placeholder="비밀번호를 입력해주세요"
          returnKeyType="next"
          rightElement={
            <PasswordVisibilityButton
              onPress={() => setPasswordVisible((visible) => !visible)}
              visible={passwordVisible}
            />
          }
          secureTextEntry={!passwordVisible}
          style={styles.textFieldInput}
          textContentType="newPassword"
          value={password}
        />
        <AppTextField
          ref={confirmPasswordRef}
          accessibilityLabel="비밀번호 확인"
          autoCapitalize="none"
          autoComplete="new-password"
          leftElement={
            <FieldIcon
              icon={<PasswordIcon color={colors.textNavigator} height={18} width={18} />}
            />
          }
          onChangeText={setConfirmPassword}
          onFocus={() => handleInputFocus('confirm-password', confirmPasswordRef.current)}
          onSubmitEditing={() => nameRef.current?.focus()}
          placeholder="비밀번호를 다시 입력해주세요"
          returnKeyType="next"
          rightElement={
            <PasswordVisibilityButton
              onPress={() => setConfirmPasswordVisible((visible) => !visible)}
              visible={confirmPasswordVisible}
            />
          }
          secureTextEntry={!confirmPasswordVisible}
          style={styles.textFieldInput}
          textContentType="newPassword"
          value={confirmPassword}
        />
        <SelectField
          accessibilityLabel="생년월일 선택"
          fieldStyle={styles.selectField}
          leftElement={
            <FieldIcon
              icon={<CalendarIcon color={colors.textNavigator} height={17} width={17} />}
            />
          }
          onPress={openBirthdayPicker}
          placeholder="생년월일을 선택해주세요"
          placeholderTextColor={colors.textNavigator}
          valueStyle={styles.selectFieldText}
          value={birthday ? formatBirthday(birthday) : undefined}
        />
        <AppTextField
          ref={nameRef}
          accessibilityLabel="이름"
          autoComplete="name"
          leftElement={
            <FieldIcon icon={<UserIcon color={colors.textNavigator} height={17} width={17} />} />
          }
          onChangeText={setName}
          onFocus={() => handleInputFocus('name', nameRef.current)}
          placeholder="이름을 입력해주세요"
          returnKeyType="done"
          style={styles.textFieldInput}
          textContentType="name"
          value={name}
        />
        <View style={styles.genderField}>
          <Text style={styles.genderLabel}>성별</Text>
          <View style={styles.genderActions}>
            <GenderButton
              icon={
                <MaleIcon
                  color={gender === 'male' ? colors.primary : colors.textNavigator}
                  height={20}
                  width={20}
                />
              }
              label="남성"
              onPress={() => setGender('male')}
              selected={gender === 'male'}
            />
            <GenderButton
              icon={
                <FemaleIcon
                  color={gender === 'female' ? colors.primary : colors.textNavigator}
                  height={20}
                  width={20}
                />
              }
              label="여성"
              onPress={() => setGender('female')}
              selected={gender === 'female'}
            />
          </View>
        </View>
        <Pressable
          accessibilityLabel="모든 약관 동의"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          onPress={() => setAgreed((value) => !value)}
          style={({ pressed }) => [styles.termsField, pressed && styles.pressed]}
        >
          <View style={styles.termsLeft}>
            <View style={[styles.checkbox, agreed && styles.checkboxSelected]}>
              {agreed ? <CheckIcon color={colors.primaryDark} height={11} width={11} /> : null}
            </View>
            <Text style={styles.termsText}>모든 약관에 동의합니다</Text>
          </View>
          <DownIcon color={colors.textSecondary} height={17} width={17} />
        </Pressable>
      </SignUpSection>
      <BirthDatePicker
        maximumDate={new Date()}
        onCancel={() => setBirthdayPickerVisible(false)}
        onConfirm={(date) => {
          setBirthday(date);
          setBirthdayPickerVisible(false);
        }}
        value={birthday ?? defaultBirthday}
        visible={birthdayPickerVisible}
      />
    </SignUpScreenLayout>
  );
}

function FieldIcon({ icon }: { icon: React.ReactNode }) {
  return <View style={styles.fieldIcon}>{icon}</View>;
}

function PasswordVisibilityButton({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  return (
    <IconButton
      accessibilityLabel={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
      icon={
        visible ? (
          <EyeIcon color={colors.textNavigator} height={18} width={18} />
        ) : (
          <EyeCloseIcon color={colors.textNavigator} height={18} width={18} />
        )
      }
      onPress={onPress}
      size={44}
      style={styles.eyeButton}
    />
  );
}

interface GenderButtonProps {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onPress: () => void;
}

function GenderButton({ label, icon, selected, onPress }: GenderButtonProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.genderButton,
        selected && styles.genderButtonSelected,
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text style={[styles.genderButtonText, selected && styles.genderButtonTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 10,
  },
  textFieldInput: {
    fontSize: 15,
    lineHeight: 19,
  },
  fieldIcon: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  eyeButton: {
    marginRight: -11,
  },
  selectField: {
    gap: 10,
    paddingHorizontal: 10,
  },
  selectFieldText: {
    fontSize: 15,
    lineHeight: 19,
  },
  genderField: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    height: 56,
    justifyContent: 'space-between',
    paddingHorizontal: 7,
  },
  genderLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 19,
    marginLeft: spacing.sm,
  },
  genderActions: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'flex-end',
    marginLeft: spacing.md,
    maxWidth: 205,
  },
  genderButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 40,
    justifyContent: 'center',
    maxWidth: 100,
  },
  genderButtonSelected: {
    borderColor: colors.primary,
  },
  genderButtonText: {
    ...typography.body,
    color: colors.textNavigator,
    fontFamily: typography.label.fontFamily,
    fontSize: 15,
    lineHeight: 19,
  },
  genderButtonTextSelected: {
    color: colors.primary,
  },
  termsField: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    height: 50,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  termsLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  checkbox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.textSecondary,
    borderRadius: radius.xs,
    borderWidth: 1,
    height: 15,
    justifyContent: 'center',
    width: 15,
  },
  checkboxSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  termsText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.75,
  },
});
