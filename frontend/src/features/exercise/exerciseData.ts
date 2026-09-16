export type ExerciseDayStatus = 'not-created' | 'ready' | 'completed';
export type ExerciseLocation = 'gym' | 'home' | 'outdoor' | 'other';
export type ExerciseEquipment = 'machine' | 'band' | 'dumbbell' | 'bodyweight' | 'other';

export interface ExerciseCondition {
  availableMinutes: number | null;
  location: ExerciseLocation | null;
  equipment: ExerciseEquipment[];
  condition: string;
  discomfortArea: string;
}

export interface ExerciseItem {
  caloriesBurned: number | null;
  demoVideoUrl: string | null;
  durationMinutes: number | null;
  executionType: string | null;
  id: string;
  instruction: string | null;
  intensity: string | null;
  name: string;
  prescription: string;
  recommendationId: string | null;
  repetitions: number | null;
  restSeconds: number | null;
  sequenceOrder: number | null;
  sets: number | null;
  targetDurationSeconds: number | null;
  targetWeightKg: number | null;
  thumbnailUrl: string | null;
}

export interface ExerciseRoutine {
  id: string | null;
  title: string;
  subtitle: string;
  intensity: string;
  estimatedCalories: number | null;
  totalDurationMinutes: number | null;
  exercises: ExerciseItem[];
  reasons: string[];
}

export const initialExerciseCondition: ExerciseCondition = {
  availableMinutes: null,
  location: null,
  equipment: [],
  condition: '',
  discomfortArea: '',
};

export const exerciseLocationLabels: Record<ExerciseLocation, string> = {
  gym: '헬스장',
  home: '집',
  outdoor: '야외',
  other: '기타',
};

export const exerciseEquipmentLabels: Record<ExerciseEquipment, string> = {
  machine: '머신',
  band: '밴드',
  dumbbell: '덤벨',
  bodyweight: '맨몸',
  other: '기타',
};
