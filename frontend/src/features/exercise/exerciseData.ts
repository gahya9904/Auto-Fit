export type ExerciseDayStatus = 'not-created' | 'ready' | 'completed';
export type ExerciseLocation = 'gym' | 'home' | 'outdoor' | 'other';
export type ExerciseEquipment = 'machine' | 'band' | 'dumbbell' | 'bodyweight' | 'other';

export interface ExerciseCondition {
  availableMinutes: number;
  location: ExerciseLocation;
  equipment: ExerciseEquipment[];
  condition: string;
  discomfortArea: string;
}

export interface ExerciseItem {
  id: string;
  name: string;
  prescription: string;
}

export interface ExerciseRoutine {
  title: string;
  subtitle: string;
  intensity: string;
  estimatedCalories: number;
  exercises: ExerciseItem[];
  reasons: string[];
}

export const initialExerciseCondition: ExerciseCondition = {
  availableMinutes: 60,
  location: 'gym',
  equipment: ['machine', 'band', 'bodyweight'],
  condition: '',
  discomfortArea: '',
};

export const mockExerciseRoutine: ExerciseRoutine = {
  title: '허리 컨디셔닝 / 기능회복',
  subtitle: '+ 코어 안정성',
  intensity: '보통',
  estimatedCalories: 320,
  exercises: [
    { id: 'lat-pulldown', name: '랫풀다운', prescription: '12회 × 4세트 · 40kg' },
    { id: 'seated-row', name: '시티드 로우', prescription: '12회 × 4세트 · 35kg' },
    { id: 'dumbbell-row', name: '덤벨 로우', prescription: '12회 × 3세트 · 12kg' },
    { id: 'plank', name: '플랭크', prescription: '30초 × 3세트' },
    { id: 'bird-dog', name: '버드독', prescription: '좌우 10회 × 3세트' },
  ],
  reasons: [
    '오늘 허리 상태를 안정적으로 회복할 수 있어요.',
    '코어 근육을 강화해 자세 안정성에 도움이 돼요.',
    '가벼운 강도로 진행되어 부담이 적어요.',
    '일상 속 움직임이 더 편안해질 거예요.',
  ],
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
