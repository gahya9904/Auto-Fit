import type { ComponentType } from 'react';

export interface BirthDatePickerProps {
  maximumDate: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
  value: Date;
  visible: boolean;
}

export const BirthDatePicker: ComponentType<BirthDatePickerProps>;
