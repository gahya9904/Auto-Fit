import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';

import BloodPressureIcon from '@/assets/icons/data/BloodPressure.svg';
import BmiIcon from '@/assets/icons/data/BMI.svg';
import BmrIcon from '@/assets/icons/data/BMR.svg';
import BodyFatIcon from '@/assets/icons/data/BodyFat_Percentage.svg';
import CholesterolIcon from '@/assets/icons/data/Cholesterol.svg';
import DiabetesIcon from '@/assets/icons/data/Diabetes.svg';
import MuscleIcon from '@/assets/icons/data/Muscle.svg';
import WeightIcon from '@/assets/icons/data/Weight.svg';
import ClockIcon from '@/assets/icons/input/Clock.svg';
import UserIcon from '@/assets/icons/input/User.svg';

export type AnalysisIcon = ComponentType<SvgProps>;
export type AnalysisTone = 'normal' | 'warning' | 'danger';

export interface AnalysisMetric {
  id: string;
  name: string;
  value: string;
  unit?: string;
  status?: string;
  tone?: AnalysisTone;
  description: string;
  icon: AnalysisIcon;
}

export interface AnalysisReason {
  id: string;
  title: string;
  description: string;
  icon: AnalysisIcon;
  metricSummary: string;
  additionalMetrics: AnalysisMetric[];
  sheetTitle: string;
  sheetDescription: string;
  interpretation: string;
}

export interface CriterionRange {
  id: string;
  label: string;
  value: string;
  tone: AnalysisTone;
  isCurrent?: boolean;
}

export interface MetricCriterion {
  id: string;
  metricName: string;
  value: string;
  unit?: string;
  status: string;
  tone: AnalysisTone;
  icon: AnalysisIcon;
  summary: string;
  appliedRule: string;
  ranges: CriterionRange[];
  referenceId: string;
}

export interface ReferenceSource {
  id: string;
  title: string;
  description: string;
  organization: string;
  documentName: string;
  publishedAt: string;
  appliedItems: string[];
  appliedSummary: string;
  originalUrl?: string;
}

const bodyCompositionMetrics: AnalysisMetric[] = [
  {
    id: 'bmi',
    name: 'BMI',
    value: '22.3',
    status: '정상',
    tone: 'normal',
    description: '체중만 보면 정상 범위예요.',
    icon: BmiIcon,
  },
  {
    id: 'weight',
    name: '체중',
    value: '68.4',
    unit: 'kg',
    description: '체중 수치만으로는 체성분 상태를 충분히 설명하기 어려워요.',
    icon: WeightIcon,
  },
  {
    id: 'body-fat-mass',
    name: '체지방량',
    value: '21.9',
    unit: 'kg',
    status: '높음',
    tone: 'danger',
    description: '체지방이 많은 편이라 체중보다 체성분 개선을 우선했어요.',
    icon: BodyFatIcon,
  },
];

const metabolicMetrics: AnalysisMetric[] = [
  {
    id: 'bmr',
    name: '기초대사량',
    value: '1,326',
    unit: 'kcal',
    status: '참고',
    tone: 'normal',
    description: '감량 속도를 정할 때 현재 에너지 소비 수준을 함께 고려했어요.',
    icon: BmrIcon,
  },
];

const bloodSugarMetrics: AnalysisMetric[] = [
  {
    id: 'triglycerides',
    name: '중성지방',
    value: '172',
    unit: 'mg/dL',
    status: '주의',
    tone: 'warning',
    description: '식사 구성과 대사 건강을 함께 판단하는 데 참고했어요.',
    icon: CholesterolIcon,
  },
  {
    id: 'waist',
    name: '허리둘레',
    value: '86.0',
    unit: 'cm',
    status: '주의',
    tone: 'warning',
    description: '복부 지방 위험을 함께 확인했어요.',
    icon: WeightIcon,
  },
  {
    id: 'hdl',
    name: 'HDL 콜레스테롤',
    value: '42',
    unit: 'mg/dL',
    status: '주의',
    tone: 'warning',
    description: '심혈관·대사 건강 판단에 참고했어요.',
    icon: CholesterolIcon,
  },
  {
    id: 'fasting-glucose-extra',
    name: '공복혈당',
    value: '108',
    unit: 'mg/dL',
    status: '주의',
    tone: 'warning',
    description: '식사 구성과 활동량 조정에 반영했어요.',
    icon: DiabetesIcon,
  },
  {
    id: 'blood-pressure',
    name: '혈압',
    value: '120 / 80',
    unit: 'mmHg',
    status: '정상',
    tone: 'normal',
    description: '운동 강도와 전반적인 건강 상태 판단에 참고했어요.',
    icon: BloodPressureIcon,
  },
];

export const analysisReasons: AnalysisReason[] = [
  {
    id: 'body-composition',
    title: '체중보다 체성분을 우선했어요',
    description: '체지방률이 높고 골격근량이 낮아,\n체중 수치보다 체성분 개선을 우선했어요.',
    icon: UserIcon,
    metricSummary: 'BMI · 체중 · 체지방량',
    additionalMetrics: bodyCompositionMetrics,
    sheetTitle: '체성분 관련 추가 지표',
    sheetDescription: '핵심 지표와 함께 참고한 보조 수치예요.',
    interpretation:
      'BMI는 정상 범위일 수 있지만, 체지방량과 골격근량을 함께 보면 체중 감소보다 체성분 개선이 더 중요한 상태예요.',
  },
  {
    id: 'pace',
    title: '빠른 감량 속도는 조정했어요',
    description: '현재 상태에서는 빠른 감량이 근육 손실로 이어질 수 있어,\n감량 속도를 조정했어요.',
    icon: ClockIcon,
    metricSummary: '기초대사량',
    additionalMetrics: metabolicMetrics,
    sheetTitle: '감량 속도 관련 추가 지표',
    sheetDescription: '감량 속도를 정할 때 함께 참고한 보조 수치예요.',
    interpretation:
      '현재 에너지 소비 수준과 근육량을 함께 고려하면 빠른 감량보다 지속 가능한 속도로 조정하는 편이 적절해요.',
  },
  {
    id: 'blood-sugar',
    title: '감량과 혈당 관리를 함께 고려했어요',
    description: '공복혈당이 관리가 필요한 범위라,\n식사 구성과 활동량을 함께 반영했어요.',
    icon: DiabetesIcon,
    metricSummary: '중성지방 · 허리둘레 · HDL 콜레스테롤',
    additionalMetrics: bloodSugarMetrics,
    sheetTitle: '대사 건강 관련 추가 지표',
    sheetDescription: '혈당과 대사 건강 판단에 함께 참고한 보조 수치예요.',
    interpretation:
      '공복혈당뿐 아니라 지질과 복부 지방 지표를 함께 보면 식사 구성과 활동량 관리가 중요한 상태예요.',
  },
];

export const metricCriteria: MetricCriterion[] = [
  {
    id: 'body-fat-percentage',
    metricName: '체지방률',
    value: '32.0',
    unit: '%',
    status: '높음',
    tone: 'danger',
    icon: BodyFatIcon,
    summary: '성별·연령 등 사용자 조건을 반영한 체지방률 판정 기준 적용',
    appliedRule: '성별·연령 등 사용자 조건을 반영한 체지방률 판정 기준을 적용했어요.',
    ranges: [
      { id: 'normal', label: '정상', value: '18.0% ~ 27.9%', tone: 'normal' },
      { id: 'warning', label: '주의', value: '28.0% ~ 31.9%', tone: 'warning' },
      { id: 'high', label: '높음', value: '32.0% 이상', tone: 'danger', isCurrent: true },
    ],
    referenceId: 'national-screening',
  },
  {
    id: 'skeletal-muscle',
    metricName: '골격근량',
    value: '21.0',
    unit: 'kg',
    status: '낮음',
    tone: 'danger',
    icon: MuscleIcon,
    summary: '사용자 신체 조건을 고려한 체성분 판정 기준 적용',
    appliedRule: '성별·연령과 신체 조건을 반영한 골격근량 판정 기준을 적용했어요.',
    ranges: [
      { id: 'low', label: '낮음', value: '23.0kg 미만', tone: 'danger', isCurrent: true },
      { id: 'warning', label: '주의', value: '23.0kg ~ 25.9kg', tone: 'warning' },
      { id: 'normal', label: '정상', value: '26.0kg 이상', tone: 'normal' },
    ],
    referenceId: 'body-composition',
  },
  {
    id: 'fasting-glucose',
    metricName: '공복혈당',
    value: '108',
    unit: 'mg/dL',
    status: '주의',
    tone: 'warning',
    icon: DiabetesIcon,
    summary: '건강검진 공복혈당 판정 기준 적용',
    appliedRule: '건강검진 공복혈당 판정 기준을 적용했어요.',
    ranges: [
      { id: 'normal', label: '정상', value: '70 ~ 99mg/dL', tone: 'normal' },
      { id: 'warning', label: '주의', value: '100 ~ 125mg/dL', tone: 'warning', isCurrent: true },
      { id: 'high', label: '높음', value: '126mg/dL 이상', tone: 'danger' },
    ],
    referenceId: 'diabetes',
  },
];

export const references: ReferenceSource[] = [
  {
    id: 'national-screening',
    title: '건강검진 관련 공식 기준',
    description: '국가건강검진 및 건강검진 결과 해석 관련 기준',
    organization: '국가건강검진 관련 공식 기준',
    documentName: '건강검진 결과 해석 가이드',
    publishedAt: '2026',
    appliedItems: ['공복혈당 판정', '혈압 판정', '건강검진 결과 해석'],
    appliedSummary: '현재 공복혈당 상태를 해석할 때 참고한 기준이에요.',
    originalUrl: 'https://www.nhis.or.kr/static/html/wbde/c/d/201812_01.pdf',
  },
  {
    id: 'body-composition',
    title: '체성분·비만 관련 전문 기준',
    description: '체지방 및 체성분 상태 판단에 활용한 전문 기준',
    organization: '질병관리청 국가건강정보포털',
    documentName: '비만 건강정보',
    publishedAt: '2025',
    appliedItems: ['BMI 판정', '체지방률 판정', '허리둘레 해석'],
    appliedSummary: '체지방률과 체성분 상태를 함께 해석할 때 참고한 기준이에요.',
    originalUrl:
      'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6694',
  },
  {
    id: 'diabetes',
    title: '혈당 관리 관련 전문 기준',
    description: '공복혈당 상태 해석에 활용한 전문 기준',
    organization: '대한당뇨병학회',
    documentName: '당뇨병 진단 및 혈당 관리 기준',
    publishedAt: '2026',
    appliedItems: ['공복혈당 판정', '혈당 관리 방향', '식사 구성 참고'],
    appliedSummary: '현재 공복혈당 상태와 관리 방향을 해석할 때 참고한 기준이에요.',
    originalUrl: 'https://diabetes.or.kr/bbs/?category=B&code=faq',
  },
];

export const keyMetrics: AnalysisMetric[] = [
  {
    id: 'key-body-fat',
    name: '체지방률',
    value: '32.0',
    unit: '%',
    status: '높음',
    tone: 'danger',
    description: '',
    icon: BodyFatIcon,
  },
  {
    id: 'key-muscle',
    name: '골격근량',
    value: '21.0',
    unit: 'kg',
    status: '낮음',
    tone: 'danger',
    description: '',
    icon: MuscleIcon,
  },
  {
    id: 'key-glucose',
    name: '공복 혈당',
    value: '108',
    unit: 'mg/dL',
    status: '주의',
    tone: 'warning',
    description: '',
    icon: DiabetesIcon,
  },
];
