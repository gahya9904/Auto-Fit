import { useCallback, useState, type ReactNode } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ClipboardIcon from '@/assets/icons/deco/ClipboardText.svg';
import ChevronRightIcon from '@/assets/icons/common/chevrons/Right.svg';
import PencilIcon from '@/assets/icons/feature/Pencil.svg';
import ChartIcon from '@/assets/icons/graph/ChartLine.svg';
import UserIcon from '@/assets/icons/input/User.svg';
import BellIcon from '@/assets/icons/system/Bell.svg';
import SignOutIcon from '@/assets/icons/system/SignOut.svg';
import WarningIcon from '@/assets/icons/system/WarningCircle.svg';
import { getProfile, getProfileName } from '@/src/api/home';
import {
  BOTTOM_NAVIGATION_MIN_BOTTOM_GAP,
  getBottomNavigationVisualHeight,
} from '@/src/components/navigation/BottomNavigation';
import { getSupabaseClient } from '@/src/lib/supabase';
import { colors, fontFamilies, radius } from '@/src/theme';

const background = require('../../assets/images/backgrounds/5_MyPage_Main.png');
const referenceWidth = 412;

function MenuIcon({ children }: { children: ReactNode }) {
  return <View style={styles.menuIcon}>{children}</View>;
}

export default function MyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const [name, setName] = useState('사용자');
  const isCompactLayout = windowHeight < 840;
  const bottomNavigationSpace =
    getBottomNavigationVisualHeight(windowHeight) +
    Math.max(insets.bottom, BOTTOM_NAVIGATION_MIN_BOTTOM_GAP);

  useFocusEffect(
    useCallback(() => {
      void getProfile()
        .then((response) => setName(getProfileName(response) ?? '사용자'))
        .catch(() => undefined);
    }, []),
  );

  const handleSignOut = useCallback(() => {
    Alert.alert('로그아웃', '로그아웃하시겠어요?', [
      { style: 'cancel', text: '취소' },
      {
        style: 'destructive',
        text: '로그아웃',
        onPress: () => void getSupabaseClient().auth.signOut().then(() => router.replace('/login')),
      },
    ]);
  }, [router]);

  return (
    <View style={styles.root}>
      <Image resizeMode="stretch" source={background} style={styles.background} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              isCompactLayout ? bottomNavigationSpace + 24 : 0,
            paddingTop: insets.top + 10,
          },
        ]}
        scrollEnabled={isCompactLayout}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>마이 페이지</Text>

        <View style={styles.profile}>
          <View style={styles.avatar}>
            <UserIcon color={colors.primaryDark} height={42} width={42} />
          </View>
          <View style={styles.profileText}>
            <Text style={styles.name}>{name}님</Text>
            <Text style={styles.greeting}>건강한 하루, 꾸준한 변화</Text>
            <Pressable style={styles.editButton}>
              <PencilIcon color={colors.primaryDark} height={15} width={15} />
              <Text style={styles.editText}>프로필 수정</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.healthSection}>
          <Text style={styles.sectionTitle}>내 건강</Text>
          <View style={styles.healthCards}>
            <Pressable
              onPress={() => router.push('/health-data-management')}
              style={styles.healthCard}
            >
              <View style={styles.healthIcon}>
                <ClipboardIcon color={colors.primary} height={32} width={32} />
              </View>
              <Text style={styles.cardTitle}>건강 데이터 관리</Text>
              <Text style={styles.cardDescription}>검사 결과 및 건강 데이터를{`\n`}확인하고 관리하세요.</Text>
              <CardFooter label="최근 검사" value="업로드 데이터 확인" />
            </Pressable>
            <View style={styles.healthCard}>
              <View style={[styles.healthIcon, styles.reportIcon]}>
                <ChartIcon color="#8B77E4" height={32} width={32} />
              </View>
              <Text style={styles.cardTitle}>건강 리포트</Text>
              <Text style={styles.cardDescription}>나의 건강 변화와{`\n`}분석 리포트를 확인해 보세요.</Text>
              <CardFooter label="최근 리포트" report value="리포트 준비 중" />
            </View>
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>계정 및 설정</Text>
          <View style={styles.settingsCard}>
            <MenuRow Icon={UserIcon} label="계정 관리" />
            <MenuRow Icon={BellIcon} label="알림 설정" />
            <View style={[styles.menuRow, styles.lastMenuRow]}>
              <View style={styles.menuLeft}>
                <MenuIcon>
                  <WarningIcon color={colors.primary} height={25} width={25} />
                </MenuIcon>
                <Text style={styles.menuLabel}>앱 정보</Text>
              </View>
              <Text style={styles.version}>v.1.0.0</Text>
            </View>
          </View>
        </View>

        <Pressable onPress={handleSignOut} style={styles.logout}>
          <MenuIcon>
            <SignOutIcon color={colors.primary} height={25} width={25} />
          </MenuIcon>
          <Text style={styles.menuLabel}>로그아웃</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function CardFooter({ label, report = false, value }: { label: string; report?: boolean; value: string }) {
  return (
    <View style={styles.cardFooter}>
      <View>
        <Text style={[styles.primaryLabel, report && styles.reportLabel]}>{label}</Text>
        <Text numberOfLines={1} style={styles.cardDate}>{value}</Text>
      </View>
      <View style={[styles.cardArrow, report && styles.reportArrow]}>
        <ChevronRightIcon color={colors.surface} height={12} width={12} />
      </View>
    </View>
  );
}

function MenuRow({ Icon, label }: { Icon: typeof UserIcon; label: string }) {
  return (
    <View style={styles.menuRow}>
      <View style={styles.menuLeft}>
        <MenuIcon>
          <Icon color={colors.primary} height={25} width={25} />
        </MenuIcon>
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <ChevronRightIcon color={colors.textSecondary} height={20} width={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.round, height: 72, justifyContent: 'center', width: 72 },
  background: { ...StyleSheet.absoluteFill, height: '100%', width: '100%' },
  cardArrow: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, height: 20, justifyContent: 'center', width: 20 },
  cardDate: { color: colors.textBody, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 12, lineHeight: 16, maxWidth: 104 },
  cardDescription: { color: colors.textSecondary, fontFamily: fontFamilies.pretendardMedium, fontSize: 13, lineHeight: 16 },
  cardFooter: { alignItems: 'flex-end', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 11 },
  cardTitle: { color: colors.textBody, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 16, lineHeight: 20, marginTop: 11 },
  content: { alignSelf: 'center', paddingHorizontal: 21, width: '100%', maxWidth: referenceWidth },
  editButton: { alignItems: 'center', backgroundColor: colors.primaryLight, borderColor: colors.primaryDark, borderRadius: radius.sm, borderWidth: 0.5, flexDirection: 'row', gap: 3, height: 25, justifyContent: 'center', width: 100 },
  editText: { color: colors.primaryDark, fontFamily: fontFamilies.pretendardMedium, fontSize: 14 },
  greeting: { color: colors.textBody, fontFamily: fontFamilies.pretendardMedium, fontSize: 15 },
  healthCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flex: 1, height: 200, padding: 10 },
  healthCards: { flexDirection: 'row', gap: 10, marginTop: 12 },
  healthSection: { marginTop: 58 },
  healthIcon: { alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.round, height: 45, justifyContent: 'center', width: 45 },
  lastMenuRow: { borderBottomWidth: 0 },
  logout: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: 14, height: 65, marginTop: 21, paddingHorizontal: 10 },
  menuIcon: { alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.sm + 2, height: 35, justifyContent: 'center', width: 35 },
  menuLabel: { color: colors.textBody, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 16 },
  menuLeft: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  menuRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', height: 58, justifyContent: 'space-between' },
  name: { color: colors.textBody, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 22 },
  primaryLabel: { color: colors.primaryDark, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 15, marginBottom: 8 },
  profile: { alignItems: 'center', flexDirection: 'row', gap: 15, marginTop: 32 },
  profileText: { gap: 8 },
  reportArrow: { backgroundColor: '#8B77E4' },
  reportIcon: { backgroundColor: '#FAF3FB' },
  reportLabel: { color: '#8B77E4' },
  root: { backgroundColor: colors.surface, flex: 1 },
  screenTitle: { color: colors.textBody, fontFamily: fontFamilies.pretendardBold, fontSize: 15, letterSpacing: 1.5, lineHeight: 20, textAlign: 'center' },
  sectionTitle: { color: colors.textBody, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 20, lineHeight: 24 },
  settingsCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, marginTop: 12, paddingHorizontal: 10, paddingVertical: 8 },
  settingsSection: { marginTop: 10 },
  version: { color: colors.textSecondary, fontFamily: fontFamilies.pretendardMedium, fontSize: 14 },
});
