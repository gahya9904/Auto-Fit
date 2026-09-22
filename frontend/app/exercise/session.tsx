import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import {
  Alert,
  BackHandler,
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import RightIcon from '@/assets/icons/common/chevrons/Right.svg';
import BarbellIcon from '@/assets/icons/deco/Barbell.svg';
import FireIcon from '@/assets/icons/deco/Fire.svg';
import ClockIcon from '@/assets/icons/input/Clock.svg';
import ExpandIcon from '@/assets/icons/system/Expand.svg';
import LightbulbIcon from '@/assets/icons/system/Lightbulb.svg';
import SpeakerHighIcon from '@/assets/icons/system/SpeakerSimpleHigh.svg';
import SpeakerSlashIcon from '@/assets/icons/system/SpeakerSimpleSlash.svg';
import WarningIcon from '@/assets/icons/system/WarningCircle.svg';
import PauseIcon from '@/assets/icons/feature/Pause_Fill.svg';
import PencilIcon from '@/assets/icons/feature/Pencil_Line.svg';
import PlayIcon from '@/assets/icons/feature/Play_Fill.svg';
import { getExerciseApiErrorMessage } from '@/src/api/exercise';
import { BackButton } from '@/src/components/common/BackButton';
import { ExerciseActionButton } from '@/src/components/exercise/ExerciseActionButton';
import { ExerciseScreenFrame } from '@/src/components/exercise/ExerciseScreenFrame';
import { useExerciseRoutine } from '@/src/features/exercise/ExerciseRoutineContext';
import {
  useExerciseSession,
  type ExerciseCountSpeed,
  type ExerciseSessionExercise,
  type ExerciseSessionState,
} from '@/src/features/exercise/ExerciseSessionContext';
import { colors, fontFamilies } from '@/src/theme';

const fallbackExerciseImage = require('@/assets/images/illustrations/temp/Image_Exercise.png');
const finishOneImage = require('@/assets/images/illustrations/exercise/finishes/Finish_One.png');
const finishAllImage = require('@/assets/images/illustrations/exercise/finishes/Finish_All.png');
const skipAllImage = require('@/assets/images/illustrations/exercise/finishes/Skip_All.png');
const completeBadgeImage = require('@/assets/images/illustrations/exercise/Complete_Badge.png');
const skipBadgeImage = require('@/assets/images/illustrations/exercise/Skip_Badge.png');

const referenceHeight = 917;
const minimumScreenHeight = 740;

function formatClock(totalSeconds: number, spaced = false) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const seconds = String(safeSeconds % 60).padStart(2, '0');
  return spaced ? `${minutes} : ${seconds}` : `${minutes}:${seconds}`;
}

function speedCopy(speed: ExerciseCountSpeed) {
  if (speed === 'fast') return { badge: '1.5x', label: '빠름' };
  if (speed === 'slow') return { badge: '0.75x', label: '느림' };
  return { badge: '1.0x', label: '일반' };
}

export default function ExerciseSessionScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const { markRoutineCompleted } = useExerciseRoutine();
  const {
    addRestSeconds,
    clearSession,
    closeExitConfirmation,
    closeSkipConfirmation,
    completeCurrentSet,
    completeSession,
    currentExercise,
    cycleCountSpeed,
    goToNextExercise,
    openExitConfirmation,
    openSkipConfirmation,
    session,
    skipRest,
    skipCurrentExercise,
    summary,
    toggleGuide,
    togglePause,
  } = useExerciseSession();
  const [isCompleting, setIsCompleting] = useState(false);
  const responsiveHeight = Platform.OS === 'web' ? windowHeight : Dimensions.get('screen').height;
  const heightProgress = Math.max(
    0,
    Math.min(1, (responsiveHeight - minimumScreenHeight) / (referenceHeight - minimumScreenHeight)),
  );
  const verticalValue = (expanded: number, compact: number) =>
    compact + (expanded - compact) * heightProgress;
  const layout = {
    buttonsTop: verticalValue(800, 730),
    completionCardTop: verticalValue(676, 620),
    completionImageSize: verticalValue(320, 285),
    completionImageTop: verticalValue(268, 225),
    completionTitleTop: verticalValue(165, 140),
    contentHeight: verticalValue(900, 815),
    counterTop: verticalValue(450, 396),
    mediaHeight: verticalValue(310, 270),
    mediaImageHeight: verticalValue(210, 175),
    mediaTop: verticalValue(125, 110),
    restCircleTop: verticalValue(313, 260),
    restTitleTop: verticalValue(160, 135),
    tipHeight: verticalValue(150, 120),
    tipTop: verticalValue(635, 570),
    timedCounterTop: verticalValue(480, 410),
  };
  const hasSession = session !== null;
  const exitConfirmationVisible = session?.exitConfirmationVisible ?? false;
  const skipConfirmationVisible = session?.skipConfirmationVisible ?? false;

  useEffect(() => {
    if (session) return undefined;
    const frame = requestAnimationFrame(() => router.replace('/exercise/summary'));
    return () => cancelAnimationFrame(frame);
  }, [router, session]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !hasSession) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (skipConfirmationVisible) closeSkipConfirmation();
      else if (exitConfirmationVisible) closeExitConfirmation();
      else openExitConfirmation();
      return true;
    });
    return () => subscription.remove();
  }, [
    closeExitConfirmation,
    closeSkipConfirmation,
    exitConfirmationVisible,
    hasSession,
    openExitConfirmation,
    skipConfirmationVisible,
  ]);

  if (!session || !currentExercise) {
    return <ExerciseScreenFrame contentHeight={layout.contentHeight}>{null}</ExerciseScreenFrame>;
  }

  const leaveSession = () => {
    clearSession();
    requestAnimationFrame(() => router.dismissTo('/exercise/summary'));
  };

  const finishAndReturnHome = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      const completedSummary = await completeSession();
      markRoutineCompleted({
        calories: completedSummary.calories,
        durationMinutes: completedSummary.durationMinutes,
        itemCount: completedSummary.completedCount,
      });
      clearSession();
      requestAnimationFrame(() => router.replace('/exercise'));
    } catch (error) {
      console.error('Exercise session completion failed:', error);
      Alert.alert('운동 결과 저장 실패', getExerciseApiErrorMessage(error));
    } finally {
      setIsCompleting(false);
    }
  };

  let content: ReactNode;
  if (session.phase === 'rest') {
    content = (
      <RestContent
        addRestSeconds={addRestSeconds}
        layout={layout}
        onSkip={openSkipConfirmation}
        session={session}
        skipRest={skipRest}
        togglePause={togglePause}
      />
    );
  } else if (session.phase === 'exercise-completed') {
    content = (
      <ExerciseCompletedContent
        exercise={currentExercise}
        layout={layout}
        onNext={goToNextExercise}
        session={session}
      />
    );
  } else if (session.phase === 'all-completed' || session.phase === 'all-skipped') {
    content = (
      <AllCompletedContent
        allSkipped={session.phase === 'all-skipped'}
        disabled={isCompleting}
        layout={layout}
        onFinish={() => void finishAndReturnHome()}
        session={session}
        summary={summary}
      />
    );
  } else {
    content = (
      <ExerciseContent
        completeCurrentSet={completeCurrentSet}
        cycleCountSpeed={cycleCountSpeed}
        exercise={currentExercise}
        layout={layout}
        onSkip={openSkipConfirmation}
        session={session}
        toggleGuide={toggleGuide}
        togglePause={togglePause}
      />
    );
  }

  return (
    <ExerciseScreenFrame contentHeight={layout.contentHeight}>
      <SessionHeader
        exercise={currentExercise}
        onBack={openExitConfirmation}
        session={session}
        togglePause={togglePause}
      />
      {content}
      {session.skipConfirmationVisible ? (
        <ConfirmationModal
          cancelLabel="취소"
          contentHeight={layout.contentHeight}
          confirmLabel="건너뛰기"
          description={'현재 운동의 진행 내용은 저장되지 않아요.\n다음 운동으로 이동할까요?'}
          onCancel={closeSkipConfirmation}
          onConfirm={skipCurrentExercise}
          title="이 운동을 건너뛸까요?"
        />
      ) : null}
      {session.exitConfirmationVisible ? (
        <ConfirmationModal
          contentHeight={layout.contentHeight}
          confirmLabel="운동 중단"
          description={'지금 나가면 현재 진행중인 운동이\n기록되지 않을 수 있어요.'}
          onCancel={closeExitConfirmation}
          onConfirm={leaveSession}
          title="운동을 중단하시겠어요?"
        />
      ) : null}
    </ExerciseScreenFrame>
  );
}

type SessionLayout = {
  buttonsTop: number;
  completionCardTop: number;
  completionImageSize: number;
  completionImageTop: number;
  completionTitleTop: number;
  contentHeight: number;
  counterTop: number;
  mediaHeight: number;
  mediaImageHeight: number;
  mediaTop: number;
  restCircleTop: number;
  restTitleTop: number;
  tipHeight: number;
  tipTop: number;
  timedCounterTop: number;
};

function SessionHeader({
  exercise,
  onBack,
  session,
  togglePause,
}: {
  exercise: ExerciseSessionExercise;
  onBack: () => void;
  session: ExerciseSessionState;
  togglePause: () => void;
}) {
  const showTimer = session.phase === 'exercise';
  const progress = (session.currentExerciseIndex + 1) / session.exercises.length;
  return (
    <>
      <BackButton onPress={onBack} style={styles.back} />
      <Text style={styles.screenTitle}>운동 수행</Text>
      {showTimer ? (
        <Pressable onPress={togglePause} style={styles.topTimer}>
          <View style={styles.timerDot} />
          <Text style={styles.topTimerText}>
            {formatClock(Math.floor(session.elapsedExerciseMs / 1000))}
          </Text>
          {session.paused ? (
            <PlayIcon color={colors.primary} height={25} width={25} />
          ) : (
            <PauseIcon color={colors.primary} height={25} width={25} />
          )}
        </Pressable>
      ) : null}
      <View style={styles.progressRow}>
        <Text style={styles.progressCurrent}>{session.currentExerciseIndex + 1}</Text>
        <Text style={styles.progressTotal}> / {session.exercises.length}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
      <Text accessibilityElementsHidden style={styles.hiddenExerciseName}>
        {exercise.name}
      </Text>
    </>
  );
}

function ExerciseContent({
  completeCurrentSet,
  cycleCountSpeed,
  exercise,
  layout,
  onSkip,
  session,
  toggleGuide,
  togglePause,
}: {
  completeCurrentSet: () => void;
  cycleCountSpeed: () => void;
  exercise: ExerciseSessionExercise;
  layout: SessionLayout;
  onSkip: () => void;
  session: ExerciseSessionState;
  toggleGuide: () => void;
  togglePause: () => void;
}) {
  return (
    <>
      <ExerciseMediaCard
        exercise={exercise}
        guideEnabled={session.guideEnabled}
        height={layout.mediaHeight}
        imageHeight={layout.mediaImageHeight}
        onToggleGuide={toggleGuide}
        speed={session.countSpeed}
        top={layout.mediaTop}
      />
      {exercise.mode === 'timed' ? (
        <TimedProgress
          exercise={exercise}
          onPress={togglePause}
          paused={session.paused}
          remainingSeconds={Math.ceil(session.setRemainingMs / 1000)}
          set={session.currentSet}
          top={layout.timedCounterTop}
        />
      ) : (
        <RepProgress
          currentRep={session.currentRep}
          exercise={exercise}
          onCycleSpeed={cycleCountSpeed}
          set={session.currentSet}
          speed={session.countSpeed}
          top={layout.counterTop}
        />
      )}
      <TipCard height={layout.tipHeight} instruction={exercise.instruction} top={layout.tipTop} />
      <ExerciseControls
        onCompleteSet={completeCurrentSet}
        onSkip={onSkip}
        set={session.currentSet}
        top={layout.buttonsTop}
      />
    </>
  );
}

function ExerciseMediaCard({
  exercise,
  guideEnabled,
  height,
  imageHeight,
  onToggleGuide,
  speed,
  top,
}: {
  exercise: ExerciseSessionExercise;
  guideEnabled: boolean;
  height: number;
  imageHeight: number;
  onToggleGuide: () => void;
  speed: ExerciseCountSpeed;
  top: number;
}) {
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);
  const remoteSource = exercise.thumbnailUrl?.trim();
  const imageSource: ImageSourcePropType =
    remoteSource && remoteSource !== failedImageUri ? { uri: remoteSource } : fallbackExerciseImage;
  const speedState = speedCopy(speed);
  const modeTag = exercise.mode === 'timed' ? '시간' : '횟수';

  return (
    <View style={[styles.mediaCard, { height, top }]}>
      <View style={styles.mediaHeader}>
        <View style={styles.exerciseIdentity}>
          <View style={styles.exerciseNumber}>
            <Text style={styles.exerciseNumberText}>{exercise.sequenceOrder ?? ''}</Text>
          </View>
          <View style={styles.exerciseHeading}>
            <Text numberOfLines={1} style={styles.exerciseName}>
              {exercise.name}
            </Text>
            <View style={styles.tagRow}>
              <View style={styles.blueTag}>
                <Text style={styles.blueTagText}>{modeTag}</Text>
              </View>
              {exercise.intensity ? (
                <View style={styles.goldTag}>
                  <Text style={styles.goldTagText}>{exercise.intensity}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        <Pressable onPress={onToggleGuide} style={styles.guideButton}>
          <Text style={styles.guideText}>{guideEnabled ? 'Guide ON' : 'Guide OFF'}</Text>
          <View style={styles.guideIcon}>
            {guideEnabled ? (
              <SpeakerHighIcon color="#FFFFFF" height={18} width={18} />
            ) : (
              <SpeakerSlashIcon color="#FFFFFF" height={18} width={18} />
            )}
          </View>
        </Pressable>
      </View>
      <View style={[styles.mediaImageArea, { height: imageHeight }]}>
        <Image
          onError={() => setFailedImageUri(remoteSource ?? null)}
          resizeMode="cover"
          source={imageSource}
          style={styles.mediaImage}
        />
        <View pointerEvents="none" style={styles.playCircle}>
          <PlayIcon color={colors.primary} height={30} width={30} />
        </View>
        <View style={styles.mediaSpeedBadge}>
          <Text style={styles.mediaSpeedText}>{speedState.badge}</Text>
        </View>
        <View style={styles.expandBadge}>
          <ExpandIcon color={colors.textBody} height={15} width={15} />
        </View>
      </View>
    </View>
  );
}

function RepProgress({
  currentRep,
  exercise,
  onCycleSpeed,
  set,
  speed,
  top,
}: {
  currentRep: number;
  exercise: ExerciseSessionExercise;
  onCycleSpeed: () => void;
  set: number;
  speed: ExerciseCountSpeed;
  top: number;
}) {
  const speedState = speedCopy(speed);
  return (
    <View style={[styles.repProgress, { top }]}>
      <Text style={styles.repCount}>
        {currentRep}
        <Text style={styles.repGoal}> / {exercise.targetRepetitions}회</Text>
      </Text>
      <View style={styles.setDescription}>
        <Text style={styles.setActive}>{set}세트 진행중</Text>
        <View style={styles.shortDivider} />
        <Text style={styles.setTotal}>
          총 {exercise.totalSets}세트, {exercise.targetRepetitions}회
        </Text>
      </View>
      <Pressable onPress={onCycleSpeed} style={styles.speedButton}>
        <Text style={styles.speedButtonText}>속도 {speedState.label}</Text>
        <PencilIcon color={colors.primaryDark} height={20} width={20} />
      </Pressable>
    </View>
  );
}

function TimedProgress({
  exercise,
  onPress,
  paused,
  remainingSeconds,
  set,
  top,
}: {
  exercise: ExerciseSessionExercise;
  onPress: () => void;
  paused: boolean;
  remainingSeconds: number;
  set: number;
  top: number;
}) {
  return (
    <View style={[styles.timedProgress, { top }]}>
      <Pressable onPress={onPress} style={styles.timedButton}>
        <Text style={styles.timedText}>{formatClock(remainingSeconds)}</Text>
        {paused ? (
          <PlayIcon color="#FFFFFF" height={32} width={32} />
        ) : (
          <PauseIcon color="#FFFFFF" height={32} width={32} />
        )}
      </Pressable>
      <View style={styles.setDescription}>
        <Text style={styles.setActive}>{set}세트 진행중</Text>
        <View style={styles.shortDivider} />
        <Text style={styles.setTotal}>
          총 {exercise.totalSets}세트, {exercise.targetSeconds}초
        </Text>
      </View>
    </View>
  );
}

function TipCard({
  height,
  instruction,
  top,
}: {
  height: number;
  instruction: string | null;
  top: number;
}) {
  return (
    <View style={[styles.tipCard, { height, top }]}>
      <View style={styles.tipIconCircle}>
        <LightbulbIcon color={colors.primaryDark} height={27} width={27} />
      </View>
      <View style={styles.tipCopy}>
        <Text style={styles.tipTitle}>TIP</Text>
        <Text style={styles.tipText}>{instruction ?? '자세를 확인하고 천천히 움직여 주세요.'}</Text>
      </View>
    </View>
  );
}

function ExerciseControls({
  onCompleteSet,
  onSkip,
  set,
  top,
}: {
  onCompleteSet: () => void;
  onSkip: () => void;
  set: number;
  top: number;
}) {
  return (
    <View style={[styles.controls, { top }]}>
      <View style={styles.controlRow}>
        <View style={styles.secondaryControl}>
          <Text style={styles.secondaryControlText}>불편함 기록</Text>
        </View>
        <Pressable onPress={onCompleteSet} style={styles.primaryControl}>
          <Text style={styles.primaryControlText}>{set}세트 완료</Text>
        </Pressable>
      </View>
      <Pressable onPress={onSkip} style={styles.skipLink}>
        <Text style={styles.skipLinkText}>지금 운동 건너뛰기</Text>
        <RightIcon color={colors.primaryDark} height={22} width={22} />
      </Pressable>
    </View>
  );
}

function RestContent({
  addRestSeconds,
  layout,
  onSkip,
  session,
  skipRest,
  togglePause,
}: {
  addRestSeconds: (seconds: number) => void;
  layout: SessionLayout;
  onSkip: () => void;
  session: ExerciseSessionState;
  skipRest: () => void;
  togglePause: () => void;
}) {
  const remainingSeconds = Math.ceil(session.restRemainingMs / 1000);
  const progress = session.restTotalMs > 0 ? session.restRemainingMs / session.restTotalMs : 0;
  const radius = 119;
  const circumference = 2 * Math.PI * radius;
  return (
    <>
      <View style={[styles.restHeading, { top: layout.restTitleTop }]}>
        <Text style={styles.restTitle}>휴식</Text>
        <Text style={styles.restDescription}>다음 세트를 위해{`\n`}휴식을 취하세요.</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={togglePause}
        style={[styles.restCircle, { top: layout.restCircleTop }]}
      >
        <Svg height={250} style={StyleSheet.absoluteFill} viewBox="0 0 250 250" width={250}>
          <Circle cx="125" cy="125" fill="none" r={radius} stroke="#EEEEEE" strokeWidth="12" />
          <Circle
            cx="125"
            cy="125"
            fill="none"
            r={radius}
            rotation="-90"
            stroke={colors.primary}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
            strokeWidth="12"
            x="0"
            y="0"
          />
        </Svg>
        <Text style={styles.restTimer}>{formatClock(remainingSeconds, true)}</Text>
        {session.paused ? (
          <PlayIcon color={colors.primary} height={49} width={49} />
        ) : (
          <PauseIcon color={colors.primary} height={49} width={49} />
        )}
      </Pressable>
      <Pressable
        onPress={() => addRestSeconds(10)}
        style={[styles.addRestButton, { top: layout.restCircleTop + 275 }]}
      >
        <Text style={styles.addRestText}>+ 10초</Text>
      </Pressable>
      <View style={[styles.restControls, { top: layout.buttonsTop }]}>
        <Pressable onPress={skipRest} style={styles.restSkipButton}>
          <Text style={styles.restSkipText}>휴식 건너뛰기</Text>
        </Pressable>
        <Pressable onPress={onSkip} style={styles.skipLink}>
          <Text style={styles.skipLinkText}>지금 운동 건너뛰기</Text>
          <RightIcon color={colors.primaryDark} height={22} width={22} />
        </Pressable>
      </View>
    </>
  );
}

function ExerciseCompletedContent({
  exercise,
  layout,
  onNext,
  session,
}: {
  exercise: ExerciseSessionExercise;
  layout: SessionLayout;
  onNext: () => void;
  session: ExerciseSessionState;
}) {
  const result = session.results[session.results.length - 1];
  return (
    <>
      <View style={[styles.completionHeading, { top: layout.completionTitleTop }]}>
        <Text style={styles.completionTitle}>{exercise.name} 완료!</Text>
        <Text style={styles.completionDescription}>
          {session.currentExerciseIndex + 1}번째 운동을 완료했어요.
        </Text>
      </View>
      <Image
        resizeMode="contain"
        source={finishOneImage}
        style={[
          styles.completionImage,
          {
            height: layout.completionImageSize,
            top: layout.completionImageTop,
            width: layout.completionImageSize,
          },
        ]}
      />
      <View style={[styles.resultCard, { top: layout.completionCardTop }]}>
        <ResultFactor
          Icon={ClockIcon}
          label="운동 시간"
          value={formatClock(result?.elapsedSeconds ?? 0)}
        />
        <ResultFactor
          Icon={BarbellIcon}
          label="완료 세트"
          value={`${result?.completedSets ?? exercise.totalSets}세트`}
        />
        <ResultFactor
          Icon={FireIcon}
          last
          label="소모 칼로리"
          value={result?.caloriesBurned === null ? '-' : `${result?.caloriesBurned ?? '-'} kcal`}
        />
      </View>
      <View style={[styles.completionButton, { top: layout.buttonsTop }]}>
        <ExerciseActionButton
          borderRadius={10}
          gap={0}
          gradient
          icon={<View />}
          labelStyle={styles.completionButtonText}
          onPress={onNext}
          title="다음"
        />
      </View>
    </>
  );
}

function ResultFactor({
  Icon,
  label,
  last = false,
  value,
}: {
  Icon: typeof ClockIcon;
  label: string;
  last?: boolean;
  value: string;
}) {
  return (
    <View style={[styles.resultFactor, !last && styles.resultDivider]}>
      <Icon color={colors.primary} height={27} width={27} />
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{value}</Text>
    </View>
  );
}

function AllCompletedContent({
  allSkipped,
  disabled,
  layout,
  onFinish,
  session,
  summary,
}: {
  allSkipped: boolean;
  disabled: boolean;
  layout: SessionLayout;
  onFinish: () => void;
  session: ExerciseSessionState;
  summary: { completedCount: number; skippedCount: number };
}) {
  const description = allSkipped
    ? `건너뛴 운동 ${summary.skippedCount}개`
    : summary.skippedCount > 0
      ? `완료 ${summary.completedCount}개 · 건너뜀 ${summary.skippedCount}개`
      : '모든 운동을 완료했어요.';
  return (
    <>
      <View style={[styles.completionHeading, { top: layout.completionTitleTop }]}>
        <Text style={styles.completionTitle}>
          {allSkipped ? '오늘 운동을 종료했어요' : '오늘의 운동 완료!'}
        </Text>
        <Text style={styles.completionDescription}>{description}</Text>
      </View>
      <Image
        resizeMode="contain"
        source={allSkipped ? skipAllImage : finishAllImage}
        style={[
          styles.completionImage,
          {
            height: layout.completionImageSize,
            top: layout.completionImageTop,
            width: layout.completionImageSize,
          },
        ]}
      />
      <View style={[styles.encouragementCard, { top: layout.completionCardTop }]}>
        <Image
          resizeMode="contain"
          source={allSkipped ? skipBadgeImage : completeBadgeImage}
          style={styles.encouragementImage}
        />
        <View style={styles.encouragementCopy}>
          <Text style={styles.encouragementTitle}>
            {allSkipped ? '오늘은 수행한 운동이 없어요.' : '정말 멋져요!'}
          </Text>
          <Text style={styles.encouragementText}>
            {allSkipped
              ? '컨디션을 확인하고 다음 운동을 준비해보세요.'
              : '꾸준한 운동 습관이 더 건강한 내일을 만듭니다.\n내일도 함께해요!'}
          </Text>
        </View>
      </View>
      <View
        pointerEvents={disabled ? 'none' : 'auto'}
        style={[styles.completionButton, { top: layout.buttonsTop }, disabled && styles.disabled]}
      >
        <ExerciseActionButton
          borderRadius={10}
          gap={0}
          gradient
          icon={<View />}
          labelStyle={styles.completionButtonText}
          onPress={onFinish}
          title={allSkipped ? '운동 홈으로' : '운동 결과 기록하기'}
        />
      </View>
      <Text accessibilityElementsHidden style={styles.hiddenExerciseName}>
        {session.exercises.length}
      </Text>
    </>
  );
}

function ConfirmationModal({
  cancelLabel = '계속하기',
  confirmLabel,
  contentHeight,
  description,
  onCancel,
  onConfirm,
  title,
}: {
  cancelLabel?: string;
  confirmLabel: string;
  contentHeight: number;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <View style={[styles.modalLayer, { height: contentHeight }]}>
      <View style={styles.modalDim} />
      <View style={styles.modalCard}>
        <View style={styles.modalIcon}>
          <WarningIcon color={colors.primaryDark} height={30} width={30} />
        </View>
        <Text style={styles.modalTitle}>{title}</Text>
        <Text style={styles.modalDescription}>{description}</Text>
        <View style={styles.modalButtons}>
          <Pressable onPress={onCancel} style={styles.modalCancelButton}>
            <Text style={styles.modalCancelText}>{cancelLabel}</Text>
          </Pressable>
          <Pressable onPress={onConfirm} style={styles.modalConfirmButton}>
            <Text style={styles.modalConfirmText}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  addRestButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 7,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    width: 80,
  },
  addRestText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 20,
  },
  back: { left: 21, position: 'absolute', top: 31 },
  blueTag: {
    backgroundColor: '#EEF4FF',
    borderColor: '#AFC8FF',
    borderRadius: 10,
    borderWidth: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  blueTagText: {
    color: '#4F7FE8',
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
  },
  completionButton: { left: 21, position: 'absolute', width: 370 },
  completionButtonText: {
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 20,
    lineHeight: 24,
  },
  completionDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
    marginTop: 13,
  },
  completionHeading: {
    alignItems: 'center',
    left: 21,
    position: 'absolute',
    width: 370,
  },
  completionImage: { alignSelf: 'center', position: 'absolute' },
  completionTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 36,
    includeFontPadding: false,
    textAlign: 'center',
  },
  controlRow: { flexDirection: 'row', gap: 10, width: '100%' },
  controls: { alignItems: 'flex-end', gap: 17, left: 21, position: 'absolute', width: 370 },
  disabled: { opacity: 0.65 },
  encouragementCard: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 15,
    flexDirection: 'row',
    height: 100,
    left: 21,
    paddingHorizontal: 10,
    position: 'absolute',
    width: 370,
  },
  encouragementCopy: { flex: 1, gap: 10, marginLeft: 10 },
  encouragementImage: { height: 70, width: 70 },
  encouragementText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  encouragementTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
  },
  exerciseHeading: { gap: 5, maxWidth: 155 },
  exerciseIdentity: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  exerciseName: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
    includeFontPadding: false,
    letterSpacing: 1,
  },
  exerciseNumber: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  exerciseNumberText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 22,
  },
  expandBadge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 7,
    bottom: 7,
    height: 25,
    justifyContent: 'center',
    position: 'absolute',
    right: 7,
    width: 25,
  },
  goldTag: {
    backgroundColor: '#FFF8E8',
    borderColor: '#EED99E',
    borderRadius: 10,
    borderWidth: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  goldTagText: {
    color: '#C8952F',
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
  },
  guideButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 15,
    flexDirection: 'row',
    paddingLeft: 8,
  },
  guideIcon: {
    alignItems: 'center',
    backgroundColor: colors.primaryMedium,
    borderRadius: 999,
    height: 27,
    justifyContent: 'center',
    marginLeft: 5,
    width: 27,
  },
  guideText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 14,
  },
  hiddenExerciseName: { height: 0, opacity: 0, position: 'absolute', width: 0 },
  mediaCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'space-between',
    left: 21,
    paddingBottom: 22,
    paddingHorizontal: 17,
    paddingTop: 18,
    position: 'absolute',
    width: 370,
  },
  mediaHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  mediaImage: { height: '100%', width: '100%' },
  mediaImageArea: {
    backgroundColor: '#EEF5F3',
    borderRadius: 15,
    overflow: 'hidden',
    position: 'relative',
    width: 334,
  },
  mediaSpeedBadge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 7,
    bottom: 7,
    height: 25,
    justifyContent: 'center',
    left: 7,
    position: 'absolute',
    width: 42,
  },
  mediaSpeedText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 11,
  },
  modalButtons: { flexDirection: 'row', gap: 10, width: '100%' },
  modalCancelButton: {
    alignItems: 'center',
    borderColor: '#D9D9D9',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#6C757D',
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 14,
  },
  modalCard: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    gap: 15,
    height: 230,
    justifyContent: 'center',
    left: 56,
    paddingHorizontal: 24,
    position: 'absolute',
    top: '37%',
    width: 300,
  },
  modalConfirmButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: colors.surface,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 14,
  },
  modalDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  modalDim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalIcon: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  modalLayer: { left: 0, position: 'absolute', top: 0, width: 412, zIndex: 50 },
  modalTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
    textAlign: 'center',
  },
  playCircle: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    height: 55,
    justifyContent: 'center',
    left: 139,
    position: 'absolute',
    top: '37%',
    width: 55,
  },
  primaryControl: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 45,
    justifyContent: 'center',
    width: 180,
  },
  primaryControlText: {
    color: colors.surface,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 20,
  },
  progressCurrent: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
    letterSpacing: 2,
  },
  progressFill: { backgroundColor: colors.primary, borderRadius: 4, height: 7 },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    left: 21,
    position: 'absolute',
    top: 77,
    width: 370,
  },
  progressTotal: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 15,
  },
  progressTrack: {
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
    flex: 1,
    height: 7,
    marginLeft: 13,
    overflow: 'hidden',
  },
  repCount: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 55,
    letterSpacing: 3,
  },
  repGoal: { fontSize: 25, letterSpacing: 1 },
  repProgress: {
    alignItems: 'center',
    gap: 25,
    left: 21,
    position: 'absolute',
    width: 370,
  },
  restCircle: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 250,
    justifyContent: 'center',
    position: 'absolute',
    width: 250,
  },
  restControls: { alignItems: 'flex-end', gap: 17, left: 21, position: 'absolute', width: 370 },
  restDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
    lineHeight: 20,
    marginTop: 13,
    textAlign: 'center',
  },
  restHeading: { alignItems: 'center', left: 21, position: 'absolute', width: 370 },
  restSkipButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    height: 45,
    justifyContent: 'center',
    width: '100%',
  },
  restSkipText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 20,
  },
  restTimer: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 35,
    letterSpacing: -1,
    marginBottom: 12,
  },
  restTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 36,
  },
  resultCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    height: 100,
    left: 21,
    position: 'absolute',
    width: 370,
  },
  resultDivider: { borderRightColor: colors.border, borderRightWidth: 1 },
  resultFactor: { alignItems: 'center', flex: 1, gap: 7, height: 60 },
  resultLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 11,
  },
  resultValue: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 18,
  },
  screenTitle: {
    alignSelf: 'center',
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
    letterSpacing: 1.5,
    position: 'absolute',
    top: 38,
  },
  secondaryControl: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    height: 45,
    justifyContent: 'center',
    width: 180,
  },
  secondaryControlText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 20,
  },
  setActive: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 20,
  },
  setDescription: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  setTotal: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 20,
  },
  shortDivider: { backgroundColor: colors.border, height: 20, width: 1 },
  skipLink: { alignItems: 'center', flexDirection: 'row' },
  skipLinkText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
  },
  speedButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 5,
    height: 30,
    paddingHorizontal: 10,
  },
  speedButtonText: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 18,
  },
  tagRow: { flexDirection: 'row', gap: 5 },
  timedButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryMedium,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 10,
    height: 60,
    justifyContent: 'center',
    width: 230,
  },
  timedProgress: {
    alignItems: 'center',
    gap: 25,
    left: 21,
    position: 'absolute',
    width: 370,
  },
  timedText: {
    color: colors.surface,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 30,
    letterSpacing: 3,
  },
  timerDot: { backgroundColor: colors.primary, borderRadius: 999, height: 10, width: 10 },
  tipCard: {
    alignItems: 'center',
    backgroundColor: '#EBF4F2',
    borderRadius: 15,
    flexDirection: 'row',
    gap: 15,
    left: 21,
    paddingHorizontal: 15,
    position: 'absolute',
    width: 370,
  },
  tipCopy: { flex: 1, gap: 5 },
  tipIconCircle: {
    alignItems: 'center',
    backgroundColor: '#D1EBE5',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  tipText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  tipTitle: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 15,
  },
  topTimer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    right: 21,
    top: 31,
  },
  topTimerText: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 20,
    letterSpacing: 2,
  },
});
