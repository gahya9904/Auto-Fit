import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import {
  Alert,
  BackHandler,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import RightIcon from '@/assets/icons/common/chevrons/Right.svg';
import BarbellIcon from '@/assets/icons/deco/Barbell.svg';
import FireIcon from '@/assets/icons/deco/Fire.svg';
import ClockIcon from '@/assets/icons/input/Clock.svg';
import LightbulbIcon from '@/assets/icons/system/Lightbulb.svg';
import CheckIcon from '@/assets/icons/system/Check.svg';
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
import {
  getMockExerciseBodyParts,
  type ExerciseBodyPart,
} from '@/src/features/exercise/exerciseData';
import { colors, fontFamilies } from '@/src/theme';

const fallbackExerciseImage = require('@/assets/images/illustrations/temp/Image_Exercise.png');
const finishOneImage = require('@/assets/images/illustrations/exercise/finishes/Finish_One.png');
const finishAllImage = require('@/assets/images/illustrations/exercise/finishes/Finish_All.png');
const skipAllImage = require('@/assets/images/illustrations/exercise/finishes/Skip_All.png');
const completeBadgeImage = require('@/assets/images/illustrations/exercise/Complete_Badge.png');
const skipBadgeImage = require('@/assets/images/illustrations/exercise/Skip_Badge.png');

const referenceHeight = 917;
const minimumScreenHeight = 740;

type DiscomfortFeedbackType = 'pain' | 'fatigue' | 'dizziness' | 'other';
type FollowUpChoice = 'adjust' | 'end';

const discomfortFeedbackOptions: { label: string; value: DiscomfortFeedbackType }[] = [
  { label: '통증 증가', value: 'pain' },
  { label: '피로 증가', value: 'fatigue' },
  { label: '어지럼', value: 'dizziness' },
  { label: '기타', value: 'other' },
];

const painAreaOptions = ['무릎', '허리', '어깨', '가슴', '전신', '기타'];

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
  const [discomfortRecordVisible, setDiscomfortRecordVisible] = useState(false);
  const responsiveHeight = Platform.OS === 'web' ? windowHeight : Dimensions.get('screen').height;
  const heightProgress = Math.max(
    0,
    Math.min(1, (responsiveHeight - minimumScreenHeight) / (referenceHeight - minimumScreenHeight)),
  );
  const verticalValue = (expanded: number, compact: number) =>
    compact + (expanded - compact) * heightProgress;
  const layout = {
    buttonsTop: verticalValue(800, 730),
    completionButtonTop: verticalValue(800, 740),
    completionCardHeight: 110,
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
      else if (discomfortRecordVisible) setDiscomfortRecordVisible(false);
      else openExitConfirmation();
      return true;
    });
    return () => subscription.remove();
  }, [
    closeExitConfirmation,
    closeSkipConfirmation,
    discomfortRecordVisible,
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
        onRecordDiscomfort={() => setDiscomfortRecordVisible(true)}
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
      {discomfortRecordVisible ? (
        <DiscomfortRecordModal
          contentHeight={layout.contentHeight}
          onClose={() => setDiscomfortRecordVisible(false)}
        />
      ) : null}
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
  completionCardHeight: number;
  completionButtonTop: number;
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
  onRecordDiscomfort,
  onSkip,
  session,
  toggleGuide,
  togglePause,
}: {
  completeCurrentSet: () => void;
  cycleCountSpeed: () => void;
  exercise: ExerciseSessionExercise;
  layout: SessionLayout;
  onRecordDiscomfort: () => void;
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
        onRecordDiscomfort={onRecordDiscomfort}
        onSkip={onSkip}
        set={session.currentSet}
        totalSets={exercise.totalSets}
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
  top,
}: {
  exercise: ExerciseSessionExercise;
  guideEnabled: boolean;
  height: number;
  imageHeight: number;
  onToggleGuide: () => void;
  top: number;
}) {
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);
  const remoteSource = exercise.thumbnailUrl?.trim();
  const imageSource: ImageSourcePropType =
    remoteSource && remoteSource !== failedImageUri ? { uri: remoteSource } : fallbackExerciseImage;
  const bodyParts = getMockExerciseBodyParts(exercise.name);

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
              {bodyParts.map((bodyPart) => (
                <ExerciseBodyPartBadge bodyPart={bodyPart} key={bodyPart} />
              ))}
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
      </View>
    </View>
  );
}

function ExerciseBodyPartBadge({ bodyPart }: { bodyPart: ExerciseBodyPart }) {
  const useGoldBadge = bodyPart === '둔근' || bodyPart === '종아리';
  return (
    <View style={useGoldBadge ? styles.goldTag : styles.blueTag}>
      <Text style={useGoldBadge ? styles.goldTagText : styles.blueTagText}>{bodyPart}</Text>
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
  onRecordDiscomfort,
  onSkip,
  set,
  totalSets,
  top,
}: {
  onCompleteSet: () => void;
  onRecordDiscomfort: () => void;
  onSkip: () => void;
  set: number;
  totalSets: number;
  top: number;
}) {
  const isLastSet = set === totalSets;

  return (
    <View style={[styles.controls, { top }]}>
      <View style={styles.controlRow}>
        <Pressable onPress={onRecordDiscomfort} style={styles.secondaryControl}>
          <Text style={styles.secondaryControlText}>불편함 기록</Text>
        </Pressable>
        <Pressable onPress={onCompleteSet} style={styles.primaryControl}>
          <Text style={styles.primaryControlText}>{isLastSet ? '세트 완료' : '다음'}</Text>
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
  const progress =
    session.restTotalMs > 0
      ? Math.max(0, Math.min(1, session.restRemainingMs / session.restTotalMs))
      : 0;
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
        <Svg
          height={250}
          pointerEvents="none"
          style={styles.restProgressRing}
          viewBox="0 0 250 250"
          width={250}
        >
          <Circle cx="125" cy="125" fill="none" r={radius} stroke="#EEEEEE" strokeWidth="12" />
          <Circle
            cx="125"
            cy="125"
            fill="none"
            originX="125"
            originY="125"
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
        <Text ellipsizeMode="tail" numberOfLines={1} style={styles.completionTitle}>
          {exercise.name} 완료!
        </Text>
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
      <View
        style={[
          styles.resultCard,
          { height: layout.completionCardHeight, top: layout.completionCardTop },
        ]}
      >
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
      <View style={[styles.completionButton, { top: layout.completionButtonTop }]}>
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

function DiscomfortRecordModal({
  contentHeight,
  onClose,
}: {
  contentHeight: number;
  onClose: () => void;
}) {
  const [selectedFeedbackType, setSelectedFeedbackType] = useState<DiscomfortFeedbackType>('pain');
  const [selectedPainAreas, setSelectedPainAreas] = useState<string[]>([]);
  const [customPainArea, setCustomPainArea] = useState('');
  const [customPainAreaDialogVisible, setCustomPainAreaDialogVisible] = useState(false);
  const [painLevel, setPainLevel] = useState(6);
  const [fatigueLevel, setFatigueLevel] = useState(6);
  const [dizzinessLevel, setDizzinessLevel] = useState(6);
  const [otherDescription, setOtherDescription] = useState('');
  const [followUpChoice, setFollowUpChoice] = useState<FollowUpChoice>('adjust');

  const selectFeedbackType = (type: DiscomfortFeedbackType) => {
    setSelectedFeedbackType(type);
    setSelectedPainAreas([]);
    setCustomPainArea('');
    setPainLevel(6);
    setFatigueLevel(6);
    setDizzinessLevel(6);
    setOtherDescription('');
  };

  const togglePainArea = (area: string) => {
    if (area === '기타') {
      setCustomPainAreaDialogVisible(true);
      return;
    }

    setSelectedPainAreas((current) =>
      current.includes(area) ? current.filter((value) => value !== area) : [...current, area],
    );
  };

  const confirmCustomPainArea = () => {
    const trimmedArea = customPainArea.trim();
    if (!trimmedArea) {
      Alert.alert('부위를 입력해 주세요.');
      return;
    }

    setSelectedPainAreas((current) => [
      ...current.filter((area) => area !== '기타'),
      '기타',
    ]);
    setCustomPainAreaDialogVisible(false);
  };

  const hasCustomPainArea = selectedPainAreas.includes('기타');
  const feedbackLevel =
    selectedFeedbackType === 'pain'
      ? painLevel
      : selectedFeedbackType === 'fatigue'
        ? fatigueLevel
        : dizzinessLevel;
  const feedbackLevelLabel =
    selectedFeedbackType === 'pain'
      ? '현재 통증 정도'
      : selectedFeedbackType === 'fatigue'
        ? '현재 피로 정도'
        : '현재 불편한 정도';
  const startLabel = selectedFeedbackType === 'pain' ? '통증 없음' : selectedFeedbackType === 'fatigue' ? '피로 없음' : '불편하지 않음';
  const endLabel = selectedFeedbackType === 'pain' ? '매우 심함' : selectedFeedbackType === 'fatigue' ? '매우 피곤함' : '매우 불편함';
  const setFeedbackLevel =
    selectedFeedbackType === 'pain'
      ? setPainLevel
      : selectedFeedbackType === 'fatigue'
        ? setFatigueLevel
        : setDizzinessLevel;

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ android: 'height', ios: 'padding' })}
      style={[styles.discomfortModalLayer, { height: contentHeight }]}
    >
      <Pressable onPress={onClose} style={styles.modalDim} />
      <View style={[styles.discomfortModalCard, { height: Math.max(700, contentHeight - 60) }]}>
        <View style={styles.discomfortModalHeader}>
          <Text style={styles.discomfortModalEyebrow}>운동 중 상태 변화</Text>
          <Text style={styles.discomfortModalTitle}>지금 달라진 상태를{`\n`}알려주세요</Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.discomfortModalContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <DiscomfortSectionTitle title="어떤 변화가 있나요?" />
          <View style={styles.discomfortTypeGrid}>
            {discomfortFeedbackOptions.map((option) => {
              const selected = selectedFeedbackType === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => selectFeedbackType(option.value)}
                  style={[styles.discomfortTypeChip, selected && styles.discomfortTypeChipSelected]}
                >
                  {selected ? <CheckIcon color={colors.primaryDark} height={13} width={13} /> : null}
                  <Text
                    style={[
                      styles.discomfortTypeChipText,
                      selected && styles.discomfortTypeChipTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {selectedFeedbackType === 'other' ? (
            <View style={styles.discomfortSection}>
              <DiscomfortSectionTitle title="어떤 변화가 있었나요?" />
              <TextInput
                maxLength={100}
                multiline
                onChangeText={setOtherDescription}
                placeholder="느껴지는 불편함을 입력해주세요."
                placeholderTextColor={colors.textDisabled}
                style={styles.discomfortTextInput}
                textAlignVertical="top"
                value={otherDescription}
              />
              <Text style={styles.discomfortInputHint}>
                예시 : 메스꺼움, 식은땀, 두근거림, 손발 저림 등
              </Text>
              <Text style={styles.discomfortCharacterCount}>{otherDescription.length} / 100</Text>
            </View>
          ) : (
            <View style={styles.discomfortSection}>
              <View style={styles.discomfortLevelHeader}>
                <DiscomfortSectionTitle title={feedbackLevelLabel} />
                <Text style={styles.discomfortLevelValue}>{feedbackLevel}</Text>
              </View>
              <DiscomfortLevelSlider
                endLabel={endLabel}
                onChange={setFeedbackLevel}
                startLabel={startLabel}
                value={feedbackLevel}
              />
              {selectedFeedbackType === 'pain' ? (
                <View style={styles.painAreaSection}>
                  <View style={styles.painAreaHeading}>
                    <DiscomfortSectionTitle title="변화가 느껴지는 부위" />
                    <Text style={styles.painAreaSubheading}>(복수 선택 가능)</Text>
                  </View>
                  <View style={styles.painAreaGrid}>
                    {painAreaOptions.map((area) => {
                      const selected = selectedPainAreas.includes(area);
                      const displayLabel =
                        area === '기타' && hasCustomPainArea
                          ? `기타 · ${customPainArea}`
                          : area;
                      return (
                        <Pressable
                          key={area}
                          onPress={() => togglePainArea(area)}
                          style={[styles.painAreaChip, selected && styles.painAreaChipSelected]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[styles.painAreaChipText, selected && styles.painAreaChipTextSelected]}
                          >
                            {displayLabel}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          )}

          <View style={styles.discomfortSection}>
            <DiscomfortSectionTitle title="남은 운동을 어떻게 할까요?" />
            <View style={styles.followUpChoices}>
              <FollowUpChoiceButton
                label="운동 조정하기"
                onPress={() => setFollowUpChoice('adjust')}
                selected={followUpChoice === 'adjust'}
              />
              <FollowUpChoiceButton
                label="오늘 운동 종료"
                onPress={() => setFollowUpChoice('end')}
                selected={followUpChoice === 'end'}
              />
            </View>
          </View>
          <View style={styles.discomfortInfoCard}>
            <View style={styles.discomfortInfoIcon}>
              <LightbulbIcon color={colors.primaryDark} height={25} width={25} />
            </View>
            <View style={styles.discomfortInfoCopy}>
              <Text style={styles.discomfortInfoTitle}>맞춤 조정 안내</Text>
              <Text style={styles.discomfortInfoText}>
                입력 내용 기반으로 남은 운동 강도와 횟수를 자동으로 조정해드려요.
              </Text>
            </View>
          </View>
        </ScrollView>
        <Pressable onPress={onClose} style={styles.discomfortSubmitButton}>
          <View style={styles.discomfortSubmitIcon}>
            <CheckIcon color={colors.primaryDark} height={13} width={13} />
          </View>
          <Text style={styles.discomfortSubmitText}>
            {followUpChoice === 'adjust' ? '남은 운동 조정하기' : '오늘 운동 종료'}
          </Text>
        </Pressable>
      </View>
      {customPainAreaDialogVisible ? (
        <View style={styles.customPainAreaLayer}>
          <Pressable
            onPress={() => setCustomPainAreaDialogVisible(false)}
            style={styles.customPainAreaDim}
          />
          <View style={styles.customPainAreaDialog}>
            <Text style={styles.customPainAreaTitle}>불편한 부위를 입력해주세요</Text>
            <Text style={styles.customPainAreaDescription}>
              목록에 없는 부위를 직접 입력할 수 있어요.
            </Text>
            <TextInput
              autoFocus
              maxLength={20}
              onChangeText={setCustomPainArea}
              placeholder="예: 손목, 팔꿈치, 목"
              placeholderTextColor={colors.textDisabled}
              style={styles.customPainAreaInput}
              value={customPainArea}
            />
            <Text style={styles.customPainAreaCount}>{customPainArea.length} / 20</Text>
            <View style={styles.customPainAreaButtons}>
              <Pressable
                onPress={() => setCustomPainAreaDialogVisible(false)}
                style={styles.customPainAreaCancelButton}
              >
                <Text style={styles.customPainAreaCancelText}>취소</Text>
              </Pressable>
              <Pressable onPress={confirmCustomPainArea} style={styles.customPainAreaConfirmButton}>
                <Text style={styles.customPainAreaConfirmText}>확인</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function DiscomfortSectionTitle({ title }: { title: string }) {
  return <Text style={styles.discomfortSectionTitle}>{title}</Text>;
}

function DiscomfortLevelSlider({
  endLabel,
  onChange,
  startLabel,
  value,
}: {
  endLabel: string;
  onChange: (value: number) => void;
  startLabel: string;
  value: number;
}) {
  const percentage = ((value - 1) / 9) * 100;
  return (
    <View>
      <View style={styles.discomfortSliderTrack}>
        <View style={[styles.discomfortSliderFill, { width: `${percentage}%` }]} />
        <View pointerEvents="none" style={[styles.discomfortSliderThumb, { left: `${percentage}%` }]} />
        <View style={styles.discomfortSliderTouches}>
          {Array.from({ length: 10 }, (_, index) => (
            <Pressable key={index + 1} onPress={() => onChange(index + 1)} style={styles.discomfortSliderTouch} />
          ))}
        </View>
      </View>
      <View style={styles.discomfortSliderLabels}>
        <Text style={styles.discomfortSliderLabel}>{startLabel}</Text>
        <Text style={styles.discomfortSliderLabel}>{endLabel}</Text>
      </View>
    </View>
  );
}

function FollowUpChoiceButton({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.followUpChoice, selected && styles.followUpChoiceSelected]}>
      {selected ? <CheckIcon color={colors.primaryDark} height={16} width={16} /> : null}
      <Text style={[styles.followUpChoiceText, selected && styles.followUpChoiceTextSelected]}>{label}</Text>
    </Pressable>
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
    width: '100%',
  },
  controlRow: { flexDirection: 'row', gap: 10, width: '100%' },
  customPainAreaButtons: { flexDirection: 'row', gap: 10, marginTop: 12, width: '100%' },
  customPainAreaCancelButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    height: 42,
    justifyContent: 'center',
  },
  customPainAreaCancelText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 14,
  },
  customPainAreaConfirmButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    flex: 1,
    height: 42,
    justifyContent: 'center',
  },
  customPainAreaConfirmText: {
    color: colors.surface,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 14,
  },
  customPainAreaCount: {
    alignSelf: 'flex-end',
    color: colors.textDisabled,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 11,
    marginTop: 4,
  },
  customPainAreaDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  customPainAreaDialog: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 22,
    left: 32,
    paddingHorizontal: 20,
    paddingTop: 25,
    position: 'absolute',
    top: '33%',
    width: 348,
  },
  customPainAreaDim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.15)' },
  customPainAreaInput: {
    backgroundColor: '#FAFAFA',
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
    height: 52,
    marginTop: 18,
    paddingHorizontal: 16,
    width: '100%',
  },
  customPainAreaLayer: { ...StyleSheet.absoluteFill, zIndex: 70 },
  customPainAreaTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 17,
    textAlign: 'center',
  },
  controls: { alignItems: 'flex-end', gap: 17, left: 21, position: 'absolute', width: 370 },
  disabled: { opacity: 0.65 },
  discomfortCharacterCount: {
    alignSelf: 'flex-end',
    color: colors.textDisabled,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 11,
    marginTop: 4,
  },
  discomfortInfoCard: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    width: '100%',
  },
  discomfortInfoCopy: { flex: 1, gap: 2 },
  discomfortInfoIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  discomfortInfoText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  discomfortInfoTitle: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 13,
  },
  discomfortInputHint: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 7,
  },
  discomfortLevelHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  discomfortLevelValue: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
  },
  discomfortModalCard: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 25,
    left: 16,
    overflow: 'hidden',
    position: 'absolute',
    top: 30,
    width: 380,
  },
  discomfortModalContent: { gap: 20, padding: 20, paddingBottom: 110 },
  discomfortModalEyebrow: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 13,
    textAlign: 'center',
  },
  discomfortModalHeader: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    gap: 6,
    paddingBottom: 18,
    paddingTop: 22,
  },
  discomfortModalLayer: { left: 0, position: 'absolute', top: 0, width: 412, zIndex: 60 },
  discomfortModalTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 22,
    lineHeight: 29,
    textAlign: 'center',
  },
  discomfortSection: { gap: 10, width: '100%' },
  discomfortSectionTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
  },
  discomfortSliderFill: {
    backgroundColor: colors.primary,
    borderRadius: 3,
    height: 6,
    left: 0,
    position: 'absolute',
    top: 7,
  },
  discomfortSliderLabel: {
    color: colors.textDisabled,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
  },
  discomfortSliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  discomfortSliderThumb: {
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    marginLeft: -10,
    position: 'absolute',
    shadowColor: colors.primaryDark,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    top: 0,
    width: 20,
  },
  discomfortSliderTouches: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  discomfortSliderTouch: { flex: 1 },
  discomfortSliderTrack: {
    backgroundColor: '#E5EAE9',
    borderRadius: 3,
    height: 20,
    marginTop: 2,
    position: 'relative',
    width: '100%',
  },
  discomfortSubmitButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 50,
    bottom: 20,
    flexDirection: 'row',
    gap: 10,
    height: 45,
    justifyContent: 'center',
    left: 15,
    position: 'absolute',
    shadowColor: colors.primaryDark,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    width: 350,
  },
  discomfortSubmitIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  discomfortSubmitText: {
    color: colors.surface,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 16,
  },
  discomfortTextInput: {
    backgroundColor: '#FAFAFA',
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
    height: 104,
    padding: 14,
    width: '100%',
  },
  discomfortTypeChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    height: 36,
    justifyContent: 'center',
    minWidth: '30%',
    paddingHorizontal: 8,
  },
  discomfortTypeChipSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  discomfortTypeChipText: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
  },
  discomfortTypeChipTextSelected: { color: colors.primaryDark, fontFamily: fontFamilies.pretendardSemiBold },
  discomfortTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, width: '100%' },
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
  followUpChoice: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 45,
    justifyContent: 'center',
  },
  followUpChoiceSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  followUpChoiceText: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 14,
  },
  followUpChoiceTextSelected: { color: colors.primaryDark, fontFamily: fontFamilies.pretendardSemiBold },
  followUpChoices: { flexDirection: 'row', gap: 7, width: '100%' },
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
  painAreaChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    height: 36,
    justifyContent: 'center',
    minWidth: '30%',
    paddingHorizontal: 8,
  },
  painAreaChipSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  painAreaChipText: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
  },
  painAreaChipTextSelected: { color: colors.primaryDark, fontFamily: fontFamilies.pretendardSemiBold },
  painAreaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, width: '100%' },
  painAreaHeading: { alignItems: 'baseline', flexDirection: 'row', gap: 6 },
  painAreaSection: { gap: 10, marginTop: 14 },
  painAreaSubheading: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
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
  restProgressRing: { height: 250, position: 'absolute', width: 250 },
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
    height: 110,
    left: 21,
    paddingBottom: 12,
    paddingTop: 12,
    position: 'absolute',
    width: 370,
  },
  resultDivider: { borderRightColor: colors.border, borderRightWidth: 1 },
  resultFactor: { alignItems: 'center', flex: 1, gap: 7, height: 82 },
  resultLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 13,
  },
  resultValue: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 20,
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
