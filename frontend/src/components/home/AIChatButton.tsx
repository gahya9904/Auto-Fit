import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import RobotIcon from '@/assets/icons/feature/Robot_Fill.svg';
import { colors, fontFamilies, radius } from '@/src/theme';

interface AIChatButtonProps {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function AIChatButton({ onPress, style }: AIChatButtonProps) {
  return (
    <Pressable
      accessibilityLabel="AI 채팅"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
    >
      <View style={styles.robotIcon}>
        <RobotIcon color={colors.surface} fill={colors.surface} height={45} width={45} />
      </View>
      <Text style={styles.label}>AI</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.round,
    elevation: 5,
    height: 70,
    shadowColor: '#000000',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    width: 70,
  },
  robotIcon: {
    height: 45,
    position: 'absolute',
    top: 4,
    width: 45,
  },
  label: {
    color: colors.surface,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 17,
    includeFontPadding: false,
    letterSpacing: 1.7,
    lineHeight: 21,
    position: 'absolute',
    top: 48,
  },
  pressed: {
    opacity: 0.78,
  },
});
