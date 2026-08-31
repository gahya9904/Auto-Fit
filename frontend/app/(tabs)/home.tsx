import { useState } from 'react';
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AIChatButton,
  HealthScore,
  HomeGreeting,
  WeeklyProgressCard,
} from '@/src/components/home';
import { colors } from '@/src/theme';

const homeBackground = require('../../assets/images/backgrounds/3_Home.png');

const referenceWidth = 412;
const referenceContentHeight = 829;
const referenceScreenHeight = 917;
const referenceGreetingTop = 76;
const minimumContentScale = 0.76;

const homeMockData = {
  userName: 'OO',
  greetingMessage: '오늘도 당신의 건강한 변화를 응원해요!',
  healthScore: 86,
  totalScore: 100,
  healthStatus: '우수',
  weeklyChange: 5,
  weeklyMessage: '꾸준한 관리가 좋은 결과로 이어지고 있어요.',
} as const;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [contentSize, setContentSize] = useState({
    height: referenceContentHeight,
    width: referenceWidth,
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setContentSize((current) =>
      current.height === height && current.width === width ? current : { height, width },
    );
  };

  const availableWidth = Math.max(0, contentSize.width - insets.left - insets.right);
  const fitScale = Math.min(
    1,
    availableWidth / referenceWidth,
    contentSize.height / referenceContentHeight,
  );
  const contentScale = Math.max(minimumContentScale, fitScale);
  const scaledWidth = referenceWidth * contentScale;
  const scaledHeight = referenceContentHeight * contentScale;
  const centeredTop = (contentSize.height - scaledHeight) / 2;
  const canvasTop = Math.max(centeredTop, insets.top - referenceGreetingTop * contentScale);
  const canvasLeft = insets.left + (availableWidth - scaledWidth) / 2;
  const backgroundHeight = Math.max(
    contentSize.height,
    referenceScreenHeight * (contentSize.width / referenceWidth),
  );

  return (
    <View onLayout={handleLayout} style={styles.root}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        source={homeBackground}
        style={[styles.background, { height: backgroundHeight }]}
      />

      <View
        style={[
          styles.designCanvas,
          {
            left: canvasLeft,
            top: canvasTop,
            transform: [{ scale: contentScale }],
          },
        ]}
      >
        <HomeGreeting
          message={homeMockData.greetingMessage}
          style={styles.greeting}
          userName={homeMockData.userName}
        />
        <HealthScore
          score={homeMockData.healthScore}
          status={homeMockData.healthStatus}
          style={styles.healthScore}
          totalScore={homeMockData.totalScore}
        />
        <WeeklyProgressCard
          change={homeMockData.weeklyChange}
          message={homeMockData.weeklyMessage}
          style={styles.weeklyProgress}
        />
        <AIChatButton onPress={() => undefined} style={styles.aiChat} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
    overflow: 'hidden',
  },
  background: {
    left: 0,
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  designCanvas: {
    height: referenceContentHeight,
    position: 'absolute',
    transformOrigin: 'top left',
    width: referenceWidth,
  },
  greeting: {
    left: 21,
    position: 'absolute',
    top: 76,
  },
  healthScore: {
    left: 31,
    position: 'absolute',
    top: 268,
  },
  weeklyProgress: {
    left: 56,
    position: 'absolute',
    top: 631,
  },
  aiChat: {
    left: 326,
    position: 'absolute',
    top: 742,
  },
});
