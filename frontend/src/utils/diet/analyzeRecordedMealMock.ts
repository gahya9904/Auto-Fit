export type RecordedFoodForAnalysis = {
  name: string;
  serving: number;
  amount: number;
  unit: string;
  kcal?: number;
  carbs?: number;
  protein?: number;
  fat?: number;
};

export type RecordedMealAnalysis = {
  kcal: number;
  tags: string[];
  note: string;
  usedIngredients: string[];
  intake: [string, string][];
};

const ingredientKeywords = [
  '닭가슴살',
  '계란',
  '두부',
  '브로콜리',
  '토마토',
  '양파',
  '아보카도',
  '시금치',
  '현미',
  '연어',
  '호두',
  '블루베리',
  '그릭요거트',
  '사과',
  '김치',
];

const highFiberKeywords = ['현미', '샐러드', '브로콜리', '사과', '블루베리', '키위', '채소'];
const healthyFatKeywords = ['연어', '호두', '견과', '아보카도'];

const unique = (values: string[]) => [...new Set(values)];

const formatAmount = (food: RecordedFoodForAnalysis) =>
  food.unit === '인분' ? `${food.serving}인분` : `${food.amount}${food.unit}`;

export function analyzeRecordedMealMock(foods: RecordedFoodForAnalysis[]): RecordedMealAnalysis {
  const knownNutritionFoods = foods.filter((food) =>
    [food.kcal, food.carbs, food.protein, food.fat].some((value) => value !== undefined),
  );
  const totalKcal = foods.reduce((sum, food) => sum + (food.kcal ?? 0), 0);
  const totalCarbs = foods.reduce((sum, food) => sum + (food.carbs ?? 0), 0);
  const totalProtein = foods.reduce((sum, food) => sum + (food.protein ?? 0), 0);
  const names = foods.map((food) => food.name);
  const joinedNames = names.join(' ');
  const usedIngredients = unique(
    ingredientKeywords.filter((ingredient) => joinedNames.includes(ingredient)),
  );
  const intake: [string, string][] = foods.map((food) => [food.name, formatAmount(food)]);

  if (knownNutritionFoods.length === 0) {
    return {
      kcal: 0,
      tags: foods.length > 0 ? ['영양 균형'] : [],
      note: '기록한 음식을 기준으로 식사 구성을 확인했어요',
      usedIngredients,
      intake,
    };
  }

  const tagCandidates: string[] = [];
  if (totalProtein >= 25) tagCandidates.push('고단백', '근육 유지');
  if (highFiberKeywords.some((keyword) => joinedNames.includes(keyword))) {
    tagCandidates.push('식이섬유', '혈당 관리');
  }
  if (healthyFatKeywords.some((keyword) => joinedNames.includes(keyword))) {
    tagCandidates.push('건강한 지방');
  }
  if (foods.length >= 3 && totalProtein > 0 && totalCarbs > 0) tagCandidates.push('영양 균형');

  const tags = unique(tagCandidates).slice(0, 3);
  if (tags.length === 0) tags.push('영양 균형');

  let note = '기록한 음식을 기준으로 식사 구성을 확인했어요';
  if (totalProtein >= 25 && tags.includes('식이섬유')) {
    note = '단백질과 식이섬유를 함께 챙긴 균형 잡힌 구성';
  } else if (totalProtein >= 25 && tags.includes('건강한 지방')) {
    note = '단백질과 건강한 지방을 보충한 구성';
  } else if (totalCarbs > totalProtein * 5) {
    note = '탄수화물 비중이 높은 식사로 단백질 보완이 필요해요';
  } else if (totalProtein >= 25) {
    note = '단백질을 충분히 챙긴 든든한 구성';
  }

  return {
    kcal: Math.round(totalKcal),
    tags,
    note,
    usedIngredients,
    intake,
  };
}
