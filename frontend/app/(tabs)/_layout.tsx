import { Tabs } from 'expo-router';

import { BottomNavigation } from '@/src/components/navigation';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomNavigation {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="home" options={{ title: '홈' }} />
      <Tabs.Screen name="diet" options={{ title: '식단' }} />
      <Tabs.Screen name="exercise" options={{ title: '운동' }} />
      <Tabs.Screen name="my" options={{ title: '마이' }} />
    </Tabs>
  );
}
