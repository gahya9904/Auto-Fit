import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

const TEMP_ADJUSTMENT_DURATION_MS = 3000;

/**
 * TEMP: Replace this simulated progress with the real exercise-adjustment process/API progress.
 */
export function useTemporaryAdjustmentProgress() {
  const [animation] = useState(() => new Animated.Value(0));
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    animation.stopAnimation();
    animation.setValue(0);

    const listenerId = animation.addListener(({ value }) => {
      setProgress(Math.max(0, Math.min(1, value)));
    });
    const progressAnimation = Animated.timing(animation, {
      duration: TEMP_ADJUSTMENT_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
      toValue: 1,
      useNativeDriver: false,
    });

    progressAnimation.start(({ finished }) => {
      if (finished) setProgress(1);
    });

    return () => {
      progressAnimation.stop();
      animation.removeListener(listenerId);
    };
  }, [animation]);

  return progress;
}
