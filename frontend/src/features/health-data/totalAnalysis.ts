export type HealthSummaryType = 'good' | 'warning';

export type HealthMetricKey =
  | 'bodyFatPercentage'
  | 'skeletalMuscleMass'
  | 'bmi'
  | 'bloodPressure'
  | 'fastingBloodSugar';

export interface HealthSummaryItem {
  description: string;
  id: string;
  status: string;
  title: string;
  type: HealthSummaryType;
}

export interface HealthMetricItem {
  id: string;
  key: HealthMetricKey;
  label: string;
  status: string;
  unit?: string;
  value: string;
}

export interface TotalAnalysisResult {
  aiComment: string;
  healthMetrics: HealthMetricItem[];
  healthSummaries: HealthSummaryItem[];
  overall: {
    description: string;
    score: number;
    status: string;
    summaryHighlight: string;
    summaryLead: string;
    summaryTail: string;
  };
  userName: string;
}

export const mockTotalAnalysis: TotalAnalysisResult = {
  userName: 'OO',
  overall: {
    score: 82,
    status: '우수',
    summaryLead: '전반적으로 건강 상태가',
    summaryHighlight: '우수한 편',
    summaryTail: '이에요.',
    description: '몇 가지 생활 습관을 개선하면\n더 건강한 상태로 발전할 수 있어요.',
  },
  healthSummaries: [
    {
      id: 'weight-management',
      type: 'warning',
      title: '체중 관리가 필요해요',
      description: '체지방률이 권장 범위보다 높아요.',
      status: '개선 필요',
    },
    {
      id: 'muscle-maintenance',
      type: 'good',
      title: '근육량은 좋은 편이에요',
      description: '골격근량이 평균 이상이에요.',
      status: '유지',
    },
    {
      id: 'lifestyle-improvement',
      type: 'warning',
      title: '생활 습관 개선이 필요해요',
      description: '활동량과 식습관 관리가 필요해요.',
      status: '개선 필요',
    },
  ],
  healthMetrics: [
    {
      id: 'body-fat-percentage',
      key: 'bodyFatPercentage',
      label: '체지방률',
      value: '28',
      unit: '%',
      status: '높음',
    },
    {
      id: 'skeletal-muscle-mass',
      key: 'skeletalMuscleMass',
      label: '골격근량',
      value: '24.5',
      unit: 'kg',
      status: '양호',
    },
    {
      id: 'bmi',
      key: 'bmi',
      label: 'BMI',
      value: '22.3',
      status: '정상',
    },
    {
      id: 'blood-pressure',
      key: 'bloodPressure',
      label: '혈압',
      value: '120/80',
      status: '정상',
    },
    {
      id: 'fasting-blood-sugar',
      key: 'fastingBloodSugar',
      label: '혈당',
      value: '92',
      unit: 'mg/dL',
      status: '정상',
    },
  ],
  aiComment:
    '체지방 감소와 활동량 증가를 함께 관리하면\n더욱 건강한 상태를 유지할 수 있어요.\n균형 잡힌 식단과 규칙적인 운동을 추천드려요!',
};
