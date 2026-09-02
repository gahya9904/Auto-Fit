import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CameraIcon from '@/assets/icons/system/Camera.svg';
import DocumentIcon from '@/assets/icons/system/Document.svg';
import FolderIcon from '@/assets/icons/system/Folder.svg';
import TrashIcon from '@/assets/icons/common/Trash.svg';
import { AppCard } from '@/src/components/common';
import { HealthUploadOptionCard } from '@/src/features/health-data/HealthUploadOptionCard';
import {
  type SelectedHealthFile,
  useHealthFilePicker,
} from '@/src/features/health-data/useHealthFilePicker';
import { colors, fontFamilies, radius } from '@/src/theme';

const uploadBackground = require('../../assets/images/backgrounds/4_Upload.png');
const uploadIllustration = require('../../assets/images/illustrations/data/Data.png');

const referenceWidth = 412;
const referenceHeight = 917;
const referenceTitleTop = 38;
const referenceSelectedFileTop = 708;
const referenceNextButtonTop = 830;
const selectedFileRowHeight = 50;
const selectedFileRowGap = 8;

interface GuideItemProps {
  description: string[];
  Icon: typeof CameraIcon;
  title: string;
}

function GuideItem({ description, Icon, title }: GuideItemProps) {
  return (
    <View style={styles.guideRow}>
      <View style={styles.guideIconBox}>
        <Icon fill={colors.primary} height={25} width={25} />
      </View>
      <View style={styles.guideTextGroup}>
        <Text style={styles.guideItemTitle}>{title}</Text>
        <Text style={styles.guideDescription}>
          {description.map((line, index) => (
            <Text key={line}>
              {line}
              {index < description.length - 1 ? '\n' : ''}
            </Text>
          ))}
        </Text>
      </View>
    </View>
  );
}

interface SelectedFileContentProps {
  onRemove: (index: number) => void;
  selectedFiles: SelectedHealthFile[];
}

function SelectedFileContent({ onRemove, selectedFiles }: SelectedFileContentProps) {
  return (
    <AppCard bordered padding="none" style={styles.selectedFileCard}>
      <View style={styles.selectedFileContent}>
        <View style={styles.selectedFileHeader}>
          <Text style={styles.selectedFileTitle}>업로드된 파일</Text>
          <Text style={styles.selectedFileCount}>{selectedFiles.length}개</Text>
        </View>
        {selectedFiles.length > 0 ? (
          <View style={styles.selectedFileList}>
            {selectedFiles.map((file, index) => (
              <View key={`${file.uri}-${index}`} style={styles.selectedFileInner}>
                <FolderIcon fill={colors.textDisabled} height={30} width={30} />
                <View style={styles.selectedNameGroup}>
                  <Text numberOfLines={1} style={styles.selectedName}>
                    {file.name}
                  </Text>
                  <Text style={styles.selectedSource}>
                    {file.source === 'camera' ? '카메라 촬영 파일' : '선택된 파일'}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={`${file.name} 삭제`}
                  accessibilityRole="button"
                  hitSlop={2}
                  onPress={() => onRemove(index)}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && styles.deleteButtonPressed,
                  ]}
                >
                  <TrashIcon fill={colors.textSecondary} height={18} width={18} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.selectedFileInner}>
            <FolderIcon fill={colors.textDisabled} height={30} width={30} />
            <Text style={styles.emptyFileText}>
              아직 업로드된 파일이 없어요.{`\n`}위의 버튼을 눌러 데이터를 업로드 해주세요.
            </Text>
          </View>
        )}
      </View>
    </AppCard>
  );
}

export default function HealthDataUploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { isSelecting, pickDocument, removeFile, selectedFiles, takePhoto } = useHealthFilePicker();

  const availableWidth = Math.max(0, windowWidth - insets.left - insets.right);
  const scale = Math.min(1, availableWidth / referenceWidth);
  const safeTopAdjustment = Math.max(0, insets.top + 8 - referenceTitleTop * scale);
  const additionalFileListHeight =
    Math.max(0, selectedFiles.length - 1) * (selectedFileRowHeight + selectedFileRowGap);
  const canvasHeight = (referenceHeight + additionalFileListHeight) * scale;
  const nextButtonTop = referenceNextButtonTop + additionalFileListHeight;

  const handleContinue = useCallback(() => {
    if (selectedFiles.length === 0) return;

    console.log('selectedFiles', selectedFiles);
    // TODO: OCR API 연동
    const selectedFile = selectedFiles[0];
    router.push({
      pathname: '/ocr-result',
      params: {
        fileMimeType: selectedFile.mimeType ?? '',
        fileName: selectedFile.name,
        fileSource: selectedFile.source,
        fileUri: selectedFile.uri,
      },
    });
  }, [router, selectedFiles]);

  return (
    <View style={styles.root}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="stretch"
        source={uploadBackground}
        style={styles.background}
      />
      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            minHeight: windowHeight,
            paddingBottom: insets.bottom,
            paddingTop: safeTopAdjustment,
          },
        ]}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: canvasHeight, width: referenceWidth * scale }}>
          <View style={[styles.canvas, { transform: [{ scale }] }]}>
            <Text style={styles.screenTitle}>건강 데이터 업로드</Text>

            <View style={styles.intro}>
              <View style={styles.introTextGroup}>
                <Text style={styles.introTitle}>건강 데이터를{`\n`}업로드 해주세요</Text>
                <Text style={styles.introDescription}>
                  정확한 분석과 <Text style={styles.emphasis}>맞춤 추천</Text>을 위해{`\n`}
                  다양한 건강 데이터를 활용합니다.
                </Text>
              </View>
              <Image
                accessibilityIgnoresInvertColors
                resizeMode="contain"
                source={uploadIllustration}
                style={styles.illustration}
              />
            </View>

            <View style={styles.uploadCards}>
              <HealthUploadOptionCard
                buttonLabel="카메라 열기"
                description={[
                  '처방전, 검진 결과, 체성분',
                  '리포트 등을 촬영하여',
                  '업로드할 수 있어요.',
                ]}
                disabled={isSelecting}
                Icon={CameraIcon}
                onPress={takePhoto}
                title="카메라로 촬영하기"
              />
              <HealthUploadOptionCard
                buttonLabel="파일 선택"
                description={[
                  '이미지, PDF, CSV 파일을',
                  '선택하여 여러 개의 파일을',
                  '한 번에 업로드할 수 있어요.',
                ]}
                disabled={isSelecting}
                Icon={DocumentIcon}
                onPress={pickDocument}
                secondary
                title="문서/파일 선택하기"
              />
            </View>

            <View style={styles.guideSection}>
              <Text style={styles.guideTitle}>업로드 가이드</Text>
              <GuideItem
                description={[
                  '체성분, 건강검진 결과를 업로드하면',
                  '더 정밀한 맞춤 추천을 받을 수 있어요.',
                ]}
                Icon={CameraIcon}
                title="다양한 데이터가 더 정확한 분석을 도와줘요."
              />
              <GuideItem
                description={['이미지 (JPG, PNG), PDF, CSV 파일을 지원해요.']}
                Icon={DocumentIcon}
                title="지원 형식"
              />
              <GuideItem
                description={[
                  '업로드된 모든 데이터는 암호화하여 안전하게 관리되며,',
                  '외부에 공유되지 않아요.',
                ]}
                Icon={DocumentIcon}
                title="개인 정보는 안전하게 보호돼요."
              />
            </View>

            <View style={styles.selectedFilePosition}>
              <SelectedFileContent onRemove={removeFile} selectedFiles={selectedFiles} />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: selectedFiles.length === 0 }}
              disabled={selectedFiles.length === 0}
              onPress={handleContinue}
              style={({ pressed }) => [
                styles.nextButton,
                { top: nextButtonTop },
                selectedFiles.length === 0 && styles.nextButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.nextButtonLabel}>다음</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFill,
    height: '100%',
    width: '100%',
  },
  scrollContent: {
    alignItems: 'center',
  },
  canvas: {
    height: referenceHeight,
    position: 'absolute',
    transformOrigin: 'top left',
    width: referenceWidth,
  },
  screenTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 15,
    left: 21,
    letterSpacing: 1.5,
    lineHeight: 20,
    position: 'absolute',
    right: 21,
    textAlign: 'center',
    top: 38,
  },
  intro: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 67,
    left: 23,
    position: 'absolute',
    top: 82,
  },
  introTextGroup: {
    gap: 14,
    width: 180,
  },
  introTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 22,
    includeFontPadding: false,
    lineHeight: 27,
  },
  introDescription: {
    color: '#000000',
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    includeFontPadding: false,
    lineHeight: 20,
  },
  emphasis: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.pretendardSemiBold,
  },
  illustration: {
    height: 120,
    width: 120,
  },
  uploadCards: {
    flexDirection: 'row',
    gap: 12,
    left: 20,
    position: 'absolute',
    top: 231,
  },
  guideSection: {
    gap: 12,
    left: 21,
    position: 'absolute',
    top: 483,
    width: 370,
  },
  guideTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 14,
    includeFontPadding: false,
    lineHeight: 19,
  },
  guideRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  guideIconBox: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  guideTextGroup: {
    gap: 6,
    maxWidth: 315,
  },
  guideItemTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 12,
    includeFontPadding: false,
    lineHeight: 16,
  },
  guideDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 11,
    includeFontPadding: false,
    lineHeight: 15,
  },
  selectedFilePosition: {
    left: 21,
    position: 'absolute',
    top: referenceSelectedFileTop,
  },
  selectedFileCard: {
    borderRadius: radius.md,
    minHeight: 100,
    width: 370,
  },
  selectedFileContent: {
    gap: 9,
    padding: 12,
    width: '100%',
  },
  selectedFileHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectedFileTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 13,
    includeFontPadding: false,
    lineHeight: 17,
  },
  selectedFileCount: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 13,
    includeFontPadding: false,
    lineHeight: 17,
  },
  selectedFileInner: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 7,
    flexDirection: 'row',
    gap: 9,
    height: 50,
    paddingLeft: 12,
    paddingRight: 3,
  },
  selectedFileList: {
    gap: selectedFileRowGap,
  },
  emptyFileText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 9,
    includeFontPadding: false,
    lineHeight: 14,
  },
  selectedNameGroup: {
    flex: 1,
  },
  selectedName: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 11,
    includeFontPadding: false,
    lineHeight: 15,
  },
  selectedSource: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 9,
    includeFontPadding: false,
    lineHeight: 13,
  },
  deleteButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  deleteButtonPressed: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.round,
  },
  nextButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 45,
    justifyContent: 'center',
    left: 21,
    position: 'absolute',
    width: 370,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonLabel: {
    color: colors.surface,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 16,
    includeFontPadding: false,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.78,
  },
});
