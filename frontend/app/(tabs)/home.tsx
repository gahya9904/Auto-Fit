import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getHealthScorePreview,
  getHomeApiErrorMessage,
  getProfile,
  getProfileName,
} from '@/src/api/home';
import { HealthScore, HomeGreeting, WeeklyProgressCard } from '@/src/components/home';
import {
  BOTTOM_NAVIGATION_MIN_BOTTOM_GAP,
  getBottomNavigationVisualHeight,
} from '@/src/components/navigation';
import { colors } from '@/src/theme';
import { getSupabaseClient } from '@/src/lib/supabase';

const homeBackground = require('../../assets/images/backgrounds/3_Home.png');

const referenceWidth = 412;
const referenceScreenHeight = 917;
const referenceGreetingTop = 76;
const referenceHealthScoreTop = 268;
const referenceHealthScoreSize = 350;
const referenceGraphCardGap = 13;
const referenceWeeklyProgressHeight = 70;
const referenceCardToNavigationGap = 129;
const minimumVerticalPositionScale = 0.86;

const greetingMessage = '오늘도 당신의 건강한 변화를 응원해요!';
const fallbackUserName = '회원';

type ApiRecord = Record<string, unknown>;

type HomeHealthScore = {
  score: number;
  status: string;
  totalScore: number;
};

type HomeWeeklyProgress = {
  change: number;
  message: string;
};

type HomeLoadState = 'empty' | 'error' | 'loading' | 'ready';

function isApiRecord(value: unknown): value is ApiRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readNumber(record: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

function readString(record: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

// The documented preview response guarantees only answer.content (natural language).
// Never parse that text. These values are used only when the server explicitly returns
// structured fields alongside it in a future compatible response.
function getStructuredHealthScore(answer: unknown): HomeHealthScore | null {
  if (!isApiRecord(answer)) return null;
  const score = readNumber(answer, ['health_score', 'score']);
  const totalScore = readNumber(answer, ['max_score', 'total_score']);
  const status = readString(answer, ['health_status', 'status']);
  if (score === undefined || totalScore === undefined || !status) return null;
  return { score, status, totalScore };
}

function getStructuredWeeklyProgress(answer: unknown): HomeWeeklyProgress | null {
  if (!isApiRecord(answer)) return null;
  const change = readNumber(answer, ['change', 'health_score_change', 'weekly_change']);
  const message = readString(answer, ['change_message', 'message', 'weekly_message']);
  if (change === undefined || !message) return null;
  return { change, message };
}

async function getSessionUserName() {
  try {
    const {
      data: { session },
    } = await getSupabaseClient().auth.getSession();
    const metadata = session?.user?.user_metadata;
    if (!isApiRecord(metadata)) return undefined;
    return readString(metadata, ['full_name', 'name']);
  } catch {
    return undefined;
  }
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [healthScore, setHealthScore] = useState<HomeHealthScore | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<HomeLoadState>('loading');
  const [userName, setUserName] = useState(fallbackUserName);
  const [weeklyProgress, setWeeklyProgress] = useState<HomeWeeklyProgress | null>(null);
  const isMountedRef = useRef(true);
  const requestInFlightRef = useRef(false);

  const loadHomeData = useCallback(async () => {
    if (requestInFlightRef.current) return;

    requestInFlightRef.current = true;
    setLoadError(null);
    setLoadState('loading');

    const [latestResult, changeResult, profileResult, sessionUserNameResult] =
      await Promise.allSettled([
        getHealthScorePreview('latest', false),
        getHealthScorePreview('change', true),
        getProfile(),
        getSessionUserName(),
      ]);

    requestInFlightRef.current = false;
    if (!isMountedRef.current) return;

    const nextHealthScore =
      latestResult.status === 'fulfilled'
        ? getStructuredHealthScore(latestResult.value.answer)
        : null;
    const nextWeeklyProgress =
      changeResult.status === 'fulfilled'
        ? getStructuredWeeklyProgress(changeResult.value.answer)
        : null;
    const profileName =
      profileResult.status === 'fulfilled' ? getProfileName(profileResult.value) : undefined;
    const sessionUserName =
      sessionUserNameResult.status === 'fulfilled' ? sessionUserNameResult.value : undefined;
    const previewErrors = [latestResult, changeResult].filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    setHealthScore(nextHealthScore);
    setWeeklyProgress(nextWeeklyProgress);
    setUserName(profileName ?? sessionUserName ?? fallbackUserName);

    if (previewErrors.length > 0) {
      console.error('Home health-score preview request failed:', previewErrors);
      setLoadError(getHomeApiErrorMessage(previewErrors[0].reason));
      setLoadState('error');
      return;
    }

    if (nextHealthScore || nextWeeklyProgress) {
      setLoadState('ready');
      return;
    }

    // TODO(backend): expose structured score/status/change/message fields for the Home cards.
    setLoadState('empty');
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const frame = requestAnimationFrame(() => {
      void loadHomeData();
    });

    return () => {
      isMountedRef.current = false;
      cancelAnimationFrame(frame);
    };
  }, [loadHomeData]);

  const bottomNavigationVisualHeight = getBottomNavigationVisualHeight(windowHeight);
  const bottomClearance = Math.max(insets.bottom, BOTTOM_NAVIGATION_MIN_BOTTOM_GAP);
  const availableWidth = Math.max(0, windowWidth - insets.left - insets.right);
  const widthScale = Math.min(1, availableWidth / referenceWidth);
  const scaledWidth = referenceWidth * widthScale;
  const bottomNavigationTop = windowHeight - bottomClearance - bottomNavigationVisualHeight;
  const graphSectionHeight =
    referenceHealthScoreSize + referenceGraphCardGap + referenceWeeklyProgressHeight;
  const maximumGraphSectionTop =
    bottomNavigationTop / widthScale - graphSectionHeight - referenceCardToNavigationGap;
  const graphSectionTop = Math.max(
    referenceHealthScoreTop * minimumVerticalPositionScale,
    Math.min(referenceHealthScoreTop, maximumGraphSectionTop),
  );
  const verticalPositionScale = graphSectionTop / referenceHealthScoreTop;
  const canvasTop = Math.max(
    0,
    insets.top - referenceGreetingTop * verticalPositionScale * widthScale,
  );
  const canvasLeft = insets.left + (availableWidth - scaledWidth) / 2;
  const backgroundHeight = Math.max(
    windowHeight,
    referenceScreenHeight * (windowWidth / referenceWidth),
  );

  return (
    <View style={styles.root}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        source={homeBackground}
        style={[styles.background, { height: backgroundHeight }]}
      />

      <View
        style={[
          styles.designCanvas,
          {
            left: canvasLeft,
            top: canvasTop,
            transform: [{ scale: widthScale }],
          },
        ]}
      >
        <HomeGreeting
          message={greetingMessage}
          style={[styles.greeting, { top: referenceGreetingTop * verticalPositionScale }]}
          userName={userName}
        />
        <View style={[styles.scoreSection, { top: graphSectionTop }]}>
          {healthScore ? (
            <HealthScore
              score={healthScore.score}
              status={healthScore.status}
              totalScore={healthScore.totalScore}
            />
          ) : (
            <HomeDataPlaceholder
              error={loadState === 'error' ? loadError : null}
              loading={loadState === 'loading'}
              onRetry={loadHomeData}
              style={styles.scorePlaceholder}
            />
          )}
          {weeklyProgress ? (
            <WeeklyProgressCard
              change={weeklyProgress.change}
              message={weeklyProgress.message}
              style={styles.weeklyProgress}
            />
          ) : (
            <HomeDataPlaceholder
              compact
              error={loadState === 'error' ? loadError : null}
              loading={loadState === 'loading'}
              onRetry={loadHomeData}
              style={styles.weeklyProgress}
            />
          )}
        </View>
      </View>
    </View>
  );
}

function HomeDataPlaceholder({
  compact = false,
  error,
  loading,
  onRetry,
  style,
}: {
  compact?: boolean;
  error: string | null;
  loading: boolean;
  onRetry: () => void;
  style?: object;
}) {
  const message = loading
    ? '건강 정보를 불러오는 중이에요.'
    : (error ?? '표시할 건강 정보가 아직 없어요.');

  return (
    <View style={[compact ? styles.weeklyPlaceholder : styles.scorePlaceholder, style]}>
      <Text style={styles.placeholderText}>{message}</Text>
      {error ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
    overflow: 'hidden',
  },
  background: {
    left: 0,
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  designCanvas: {
    height: referenceScreenHeight,
    position: 'absolute',
    transformOrigin: 'top left',
    width: referenceWidth,
  },
  greeting: {
    left: 21,
    position: 'absolute',
  },
  scoreSection: {
    left: 31,
    position: 'absolute',
  },
  weeklyProgress: {
    alignSelf: 'center',
    marginTop: referenceGraphCardGap,
  },
  scorePlaceholder: {
    alignItems: 'center',
    height: referenceHealthScoreSize,
    justifyContent: 'center',
    width: referenceHealthScoreSize,
  },
  weeklyPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: referenceWeeklyProgressHeight,
    justifyContent: 'center',
    width: 300,
  },
  placeholderText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
  },
  retryText: {
    color: colors.primary,
    fontSize: 13,
  },
});
