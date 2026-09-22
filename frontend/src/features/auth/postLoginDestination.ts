import { getHealthDocuments } from '@/src/api/healthDocuments';

export type PostLoginDestination = '/home' | '/upload';

export async function getPostLoginDestination(): Promise<PostLoginDestination> {
  const response = await getHealthDocuments({ limit: 1, status: 'confirmed' });
  return response.items.length > 0 ? '/home' : '/upload';
}
