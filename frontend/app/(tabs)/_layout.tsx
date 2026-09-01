import { useCallback, useState } from 'react';
import { Tabs, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DraggableAIChatButton } from '@/src/components/home';
import { BottomNavigation, type BottomNavigationLayout } from '@/src/components/navigation';

export default function TabLayout() {
  const pathname = usePathname();
  const [navigationLayout, setNavigationLayout] = useState<BottomNavigationLayout>();
  const handleNavigationLayout = useCallback((layout: BottomNavigationLayout) => {
    setNavigationLayout((current) =>
      current &&
      current.height === layout.height &&
      current.width === layout.width &&
      current.x === layout.x &&
      current.y === layout.y
        ? current
        : layout,
    );
  }, []);

  return (
    <View style={styles.root}>
      <Tabs
        tabBar={(props) => (
          <BottomNavigation {...props} onNavigationLayout={handleNavigationLayout} />
        )}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="home" options={{ title: '홈' }} />
        <Tabs.Screen name="diet" options={{ title: '식단' }} />
        <Tabs.Screen name="exercise" options={{ title: '운동' }} />
        <Tabs.Screen name="my" options={{ title: '마이' }} />
      </Tabs>
      <DraggableAIChatButton
        navigationLayout={navigationLayout}
        onPress={() => undefined}
        visible={pathname.endsWith('/home')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
