import { type ReactNode, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import CameraIcon from '@/assets/icons/system/Camera.svg';
import DocumentIcon from '@/assets/icons/system/Document.svg';
import { AppBottomSheet } from '@/src/components/common';
import { HealthUploadOptionCard } from '@/src/features/health-data/HealthUploadOptionCard';
import {
  type SelectedHealthFile,
  useHealthFilePicker,
} from '@/src/features/health-data/useHealthFilePicker';

type Props = {
  children?: ReactNode;
  isBusy?: boolean;
  onClose: () => void;
  onSelectFile: (file: SelectedHealthFile) => Promise<void> | void;
  visible: boolean;
};

export function HealthDataUploadBottomSheet({
  children,
  isBusy = false,
  onClose,
  onSelectFile,
  visible,
}: Props) {
  const { isSelecting, pickDocument, takePhoto } = useHealthFilePicker();
  const select = useCallback(
    async (selectFile: () => Promise<SelectedHealthFile | null>) => {
      if (isBusy) return;
      const file = await selectFile();
      if (file) await onSelectFile(file);
    },
    [isBusy, onSelectFile],
  );

  return (
    <AppBottomSheet
      contentStyle={styles.content}
      handleStyle={styles.handle}
      onClose={onClose}
      overlayStyle={styles.overlay}
      separateAnimations
      sheetStyle={styles.sheet}
      visible={visible}
    >
      <View style={styles.options}>
        <HealthUploadOptionCard
          buttonLabel="카메라 열기"
          description={['처방전, 검진 결과, 체성분', '리포트 등을 촬영하여', '업로드할 수 있어요.']}
          disabled={isSelecting || isBusy}
          Icon={CameraIcon}
          onPress={() => void select(takePhoto)}
          style={styles.optionCard}
          title="카메라로 촬영하기"
        />
        <HealthUploadOptionCard
          buttonLabel="파일 선택"
          description={['이미지, PDF, CSV 파일을', '선택하여 여러 개의 파일을', '한 번에 업로드할 수 있어요.']}
          disabled={isSelecting || isBusy}
          Icon={DocumentIcon}
          onPress={() => void select(pickDocument)}
          secondary
          style={styles.optionCard}
          title="문서/파일 선택하기"
        />
      </View>
      {children}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 0, paddingHorizontal: 16, paddingTop: 36 },
  handle: { backgroundColor: '#D9D9D9', height: 4, marginTop: 11, width: 40 },
  optionCard: { flex: 1, maxWidth: 180, width: 'auto' },
  options: { flexDirection: 'row', gap: 20, justifyContent: 'center', width: '100%' },
  overlay: { backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, minHeight: 300 },
});
