import { ApiError, apiRequest, getApiErrorMessage } from '@/src/api/client';

export type ExerciseApiLocation = 'gym' | 'home' | 'outdoor' | 'other';
export type ExerciseApiEquipment = 'machine' | 'band' | 'dumbbell' | 'mat' | 'other';

export type ExerciseRecommendationContextInput = {
  availableEquipment: ExerciseApiEquipment[];
  availableMinutes: number;
  conditionLevel: string;
  conditionNote: string | null;
  discomfortAreas: string[];
  location: ExerciseApiLocation;
};

type ExerciseApiResponse = Record<string, unknown>;

export function getLatestExerciseRecommendation() {
  return apiRequest<ExerciseApiResponse>('/api/exercise/recommendations/latest');
}

export function getLatestExerciseSession() {
  return apiRequest<ExerciseApiResponse>('/api/exercise/sessions/latest');
}

export function getExerciseSummary() {
  return apiRequest<ExerciseApiResponse>('/api/exercise/summary');
}

export function getActiveExerciseGoal() {
  return apiRequest<ExerciseApiResponse>('/api/exercise/goals/active');
}

export function getExerciseProgress() {
  return apiRequest<ExerciseApiResponse>('/api/exercise/progress');
}

export function getExercisePreferences() {
  return apiRequest<ExerciseApiResponse>('/api/exercise/preferences');
}

export function saveExerciseRecommendationContext(input: ExerciseRecommendationContextInput) {
  return apiRequest<ExerciseApiResponse>('/api/exercise/recommendation-contexts', {
    body: JSON.stringify({
      available_equipment: input.availableEquipment,
      available_minutes: input.availableMinutes,
      condition_level: input.conditionLevel,
      condition_note: input.conditionNote,
      discomfort_areas: input.discomfortAreas,
      location: input.location,
    }),
    method: 'POST',
  });
}

export function generateExerciseRecommendation() {
  return apiRequest<ExerciseApiResponse>('/api/exercise/recommendations/generate', {
    body: JSON.stringify({}),
    method: 'POST',
  });
}

export function startExerciseSession() {
  return apiRequest<ExerciseApiResponse>('/api/exercise/sessions/start', {
    body: JSON.stringify({}),
    method: 'POST',
  });
}

export function getExerciseApiErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      return '운동 정보 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.';
    }

    switch (error.status) {
      case 0:
        return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
      case 401:
        return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
      case 404:
        return '운동 정보를 찾지 못했어요.';
      case 409:
        return '이미 처리 중인 운동 요청이 있어요. 잠시 후 다시 시도해 주세요.';
      case 422:
        return '운동 조건 또는 현재 설정을 다시 확인해 주세요.';
      default:
        return getApiErrorMessage(error);
    }
  }

  return getApiErrorMessage(error);
}
