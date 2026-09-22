import type { Href } from 'expo-router';

import { getHealthDocuments } from '@/src/api/healthDocuments';
import { getOnboardingStatus } from '@/src/api/onboarding';

export type PostLoginDestination = Href;

export async function getPostLoginDestination(): Promise<PostLoginDestination> {
  const onboarding = await getOnboardingStatus();
  if (!onboarding.completed) {
    return {
      pathname: '/signup/step1',
      params: { flow: 'post-login' },
    };
  }

  const response = await getHealthDocuments({ limit: 1, status: 'confirmed' });
  return response.items.length > 0 ? '/home' : '/upload';
}
