import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

interface BirthDatePickerProps {
  maximumDate: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
  value: Date;
  visible: boolean;
}

export function BirthDatePicker({
  maximumDate,
  onCancel,
  onConfirm,
  value,
  visible,
}: BirthDatePickerProps) {
  if (!visible) return null;

  const handleChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (event.type === 'set' && selectedDate) onConfirm(selectedDate);
    else onCancel();
  };

  return (
    <DateTimePicker
      maximumDate={maximumDate}
      mode="date"
      onChange={handleChange}
      value={value}
    />
  );
}
