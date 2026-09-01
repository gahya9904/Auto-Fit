import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useEffect, useState} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HealthScore, HomeGreeting, WeeklyProgressCard } from '@/src/components/home';
import {
  BOTTOM_NAVIGATION_MIN_BOTTOM_GAP,
  getBottomNavigationVisualHeight,
} from '@/src/components/navigation';
import { colors } from '@/src/theme';

const homeBackground = require('../../assets/images/backgrounds/3_Home.png');

const referenceWidth = 412;
const referenceScreenHeight = 917;
const referenceGreetingTop = 76;
const referenceHealthScoreTop = 268;
const referenceHealthScoreSize = 350;
const referenceGraphCardGap = 13;
const referenceWeeklyProgressHeight = 70;
const referenceCardToNavigationGap = 129;
const minimumVerticalPositionScale = 0.86;

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
  //const [healthScore, setHealthScore] = useState(homeMockData.healthScore);

  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  /*
  useEffect(() => {
    const fetchHealthScore = async () => {
      try {
        const response = await fetch('http://백엔드주소/api/home')

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();

        setHealthScore(data.health_score);
      } catch (error) {
        console.error('건강 점수 조회 실패:', error);
      }
    };

    fetchHealthScore();
  }, []);
  */

  const bottomNavigationVisualHeight = getBottomNavigationVisualHeight(windowHeight);
  const bottomClearance = Math.max(insets.bottom, BOTTOM_NAVIGATION_MIN_BOTTOM_GAP);
  const availableWidth = Math.max(0, windowWidth - insets.left - insets.right);
  const widthScale = Math.min(1, availableWidth / referenceWidth);
  const scaledWidth = referenceWidth * widthScale;
  const bottomNavigationTop = windowHeight - bottomClearance - bottomNavigationVisualHeight;
  const graphSectionHeight =
    referenceHealthScoreSize + referenceGraphCardGap + referenceWeeklyProgressHeight;
  const maximumGraphSectionTop =
    bottomNavigationTop / widthScale - graphSectionHeight - referenceCardToNavigationGap;
  const graphSectionTop = Math.max(
    referenceHealthScoreTop * minimumVerticalPositionScale,
    Math.min(referenceHealthScoreTop, maximumGraphSectionTop),
  );
  const verticalPositionScale = graphSectionTop / referenceHealthScoreTop;
  const canvasTop = Math.max(
    0,
    insets.top - referenceGreetingTop * verticalPositionScale * widthScale,
  );
  const canvasLeft = insets.left + (availableWidth - scaledWidth) / 2;
  const backgroundHeight = Math.max(
    windowHeight,
    referenceScreenHeight * (windowWidth / referenceWidth),
  );

  return (
    <View style={styles.root}>
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
            transform: [{ scale: widthScale }],
          },
        ]}
      >
        <HomeGreeting
          message={homeMockData.greetingMessage}
          style={[styles.greeting, { top: referenceGreetingTop * verticalPositionScale }]}
          userName={homeMockData.userName}
        />
        <View style={[styles.scoreSection, { top: graphSectionTop }]}>
          <HealthScore
            //score={healthScore}
            score={homeMockData.healthScore}
            status={homeMockData.healthStatus}
            totalScore={homeMockData.totalScore}
          />
          <WeeklyProgressCard
            change={homeMockData.weeklyChange}
            message={homeMockData.weeklyMessage}
            style={styles.weeklyProgress}
          />
        </View>
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
    height: referenceScreenHeight,
    position: 'absolute',
    transformOrigin: 'top left',
    width: referenceWidth,
  },
  greeting: {
    left: 21,
    position: 'absolute',
  },
  scoreSection: {
    left: 31,
    position: 'absolute',
  },
  weeklyProgress: {
    alignSelf: 'center',
    marginTop: referenceGraphCardGap,
  },
});
