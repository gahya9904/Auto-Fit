import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radius, spacing, typography } from '@/src/theme';

interface BirthDatePickerProps {
  maximumDate: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
  value: Date;
  visible: boolean;
}

const twoDigits = (value: number) => String(value).padStart(2, '0');

export function BirthDatePicker({
  maximumDate,
  onCancel,
  onConfirm,
  value,
  visible,
}: BirthDatePickerProps) {
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');

  useEffect(() => {
    if (!visible) return;

    setYear(String(value.getFullYear()));
    setMonth(twoDigits(value.getMonth() + 1));
    setDay(twoDigits(value.getDate()));
  }, [value, visible]);

  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  const parsedDay = Number(day);
  const selectedDate = new Date(parsedYear, parsedMonth - 1, parsedDay);
  const isValidDate =
    year.length === 4 &&
    month.length > 0 &&
    day.length > 0 &&
    selectedDate.getFullYear() === parsedYear &&
    selectedDate.getMonth() === parsedMonth - 1 &&
    selectedDate.getDate() === parsedDay &&
    selectedDate <= maximumDate;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>생년월일 선택</Text>
          <View style={styles.dateFields}>
            <TextInput
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={(text) => setYear(text.replace(/\D/g, ''))}
              style={styles.yearField}
              value={year}
            />
            <Text style={styles.separator}>.</Text>
            <TextInput
              keyboardType="number-pad"
              maxLength={2}
              onChangeText={(text) => setMonth(text.replace(/\D/g, ''))}
              style={styles.dateField}
              value={month}
            />
            <Text style={styles.separator}>.</Text>
            <TextInput
              keyboardType="number-pad"
              maxLength={2}
              onChangeText={(text) => setDay(text.replace(/\D/g, ''))}
              style={styles.dateField}
              value={day}
            />
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.action}>
              <Text style={styles.cancel}>취소</Text>
            </Pressable>
            <Pressable
              disabled={!isValidDate}
              onPress={() => onConfirm(selectedDate)}
              style={styles.action}
            >
              <Text style={[styles.confirm, !isValidDate && styles.disabled]}>완료</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: colors.overlay, flex: 1, justifyContent: 'center', padding: spacing.xl },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.lg, gap: spacing.lg, padding: spacing.lg, width: 300 },
  title: { color: colors.textBody, fontFamily: typography.sectionTitle.fontFamily, fontSize: 16 },
  dateFields: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  yearField: { borderBottomColor: colors.border, borderBottomWidth: 1, color: colors.textBody, fontFamily: typography.body.fontFamily, fontSize: 18, padding: spacing.xs, textAlign: 'center', width: 78 },
  dateField: { borderBottomColor: colors.border, borderBottomWidth: 1, color: colors.textBody, fontFamily: typography.body.fontFamily, fontSize: 18, padding: spacing.xs, textAlign: 'center', width: 48 },
  separator: { color: colors.textSecondary, fontSize: 18, marginHorizontal: 3 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  action: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md },
  cancel: { color: colors.textSecondary, fontFamily: typography.label.fontFamily },
  confirm: { color: colors.primaryDark, fontFamily: typography.label.fontFamily },
  disabled: { color: colors.textDisabled },
});
