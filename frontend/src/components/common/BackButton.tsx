import BackIcon from '@/assets/icons/common/chevrons/Left.svg';
import { colors } from '@/src/theme';

import { IconButton, type IconButtonProps } from './IconButton';

export type BackButtonProps = Omit<IconButtonProps, 'accessibilityLabel' | 'icon'> & {
  accessibilityLabel?: string;
};

export function BackButton({ accessibilityLabel = '뒤로 가기', ...props }: BackButtonProps) {
  return (
    <IconButton
      accessibilityLabel={accessibilityLabel}
      icon={<BackIcon color={colors.textBody} height={25} width={25} />}
      {...props}
    />
  );
}
