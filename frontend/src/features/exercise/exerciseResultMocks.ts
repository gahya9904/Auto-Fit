import type { ExerciseSessionSummary } from '@/src/features/exercise/ExerciseRoutineContext';

export type ExerciseDifficulty = 1 | 2 | 3 | 4 | 5;
export type ExercisePostState = 'very-good' | 'good' | 'neutral' | 'tired' | 'very-tired';
export type ExerciseDiscomfortArea = 'shoulder' | 'waist' | 'knee' | 'ankle' | 'none';

export type ExerciseResultRecord = {
  difficulty: ExerciseDifficulty;
  discomfortAreas: ExerciseDiscomfortArea[];
  postState: ExercisePostState;
};

export const exercisePostStates: readonly {
  key: ExercisePostState;
  label: string;
}[] = [
  { key: 'very-tired', label: '매우 나쁨' },
  { key: 'tired', label: '나쁨' },
  { key: 'neutral', label: '보통' },
  { key: 'good', label: '좋음' },
  { key: 'very-good', label: '매우 좋음' },
];

export const exerciseDiscomfortAreas: readonly {
  key: ExerciseDiscomfortArea;
  label: string;
}[] = [
  { key: 'shoulder', label: '어깨' },
  { key: 'waist', label: '허리' },
  { key: 'knee', label: '무릎' },
  { key: 'ankle', label: '발목' },
  { key: 'none', label: '없음' },
];

export function createInitialExerciseResultRecord(): ExerciseResultRecord {
  return {
    difficulty: 3,
    discomfortAreas: ['none'],
    postState: 'good',
  };
}

export type ExerciseAiReport = {
  insight: {
    description: string;
    title: string;
  };
  metrics: readonly {
    description: string;
    label: string;
    value: string;
  }[];
  nextWorkout: readonly {
    description?: string;
    title: string;
  }[];
};

/**
 * TODO: Replace this development display model when an exercise-analysis API
 * is added. It intentionally has no network dependency today.
 */
export function createMockExerciseAiReport(
  summary: ExerciseSessionSummary | null,
): ExerciseAiReport {
  const duration = summary?.durationMinutes ? `${summary.durationMinutes}분` : '35분';

  return {
    insight: {
      title: '오늘 운동을 잘 수행하셨어요!',
      description:
        '전반적으로 안정적인 강도로 운동을 완료했어요.\n코어 안정성을 위해 안정화 운동 비중을 소폭 늘리면\n더 큰 효과를 기대할 수 있어요.\n지금의 페이스를 유지하며 꾸준히 진행해봐요!',
    },
    metrics: [
      {
        label: '수행률',
        value: '100%',
        description: '계획한 운동을 모두 완료했어요!',
      },
      {
        label: '체감 난이도',
        value: '보통',
        description: '적절한 난이도로 수행했어요.',
      },
      {
        label: '운동 후 상태',
        value: '좋아짐',
        description: '몸 상태가 긍정적이에요!',
      },
      {
        label: '불편감',
        value: '없음',
        description: '불편했던 부위가 없어요.',
      },
    ],
    nextWorkout: [
      { title: '운동 강도 유지' },
      { title: '운동 시간', description: `${duration} → 20분` },
      { title: '운동 구성 일부 변경', description: '(안정화 운동 비중 소폭 증가)' },
    ],
  };
}
