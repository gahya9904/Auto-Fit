import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FileIcon from '@/assets/icons/deco/ClipboardText.svg';
import BodyFatIcon from '@/assets/icons/data/BodyFat_Percentage.svg';
import PlusIcon from '@/assets/icons/deco/Plus.svg';
import ShieldCheckIcon from '@/assets/icons/system/ShieldCheck.svg';
import {
  getAllHealthDocuments,
  getHealthDocumentErrorMessage,
  uploadHealthDocument,
  type HealthDocumentListItem,
} from '@/src/api/healthDocuments';
import { HealthDataUploadBottomSheet } from '@/src/components/health-data/HealthDataUploadBottomSheet';
import { BackButton } from '@/src/components/common/BackButton';
import type { OCRUploadRouteItem } from '@/src/features/health-data/ocrResults';
import type { SelectedHealthFile } from '@/src/features/health-data/useHealthFilePicker';
import { colors, fontFamilies, radius } from '@/src/theme';

const dataIllustration = require('../assets/images/illustrations/data/Data.png');

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function documentTitle(item: HealthDocumentListItem) {
  return item.document_type === 'body_composition' ? '체성분 분석 결과' : '건강검진 결과표';
}

function documentSubtitle(item: HealthDocumentListItem) {
  return `${formatDate(item.uploaded_at)} · ${item.document_type === 'body_composition' ? '체성분 분석' : '건강검진'}`;
}

function documentStatusLabel(status: HealthDocumentListItem['status']) {
  if (status === 'confirmed') return '확정됨';
  if (status === 'failed') return '처리 실패';
  return '확인 대기';
}

export default function HealthDataManagementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [documents, setDocuments] = useState<HealthDocumentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadSheetOpen, setIsUploadSheetOpen] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setDocuments(await getAllHealthDocuments());
    } catch (error) {
      Alert.alert('건강 데이터를 불러오지 못했어요.', getHealthDocumentErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleUpload = useCallback(
    async (file: SelectedHealthFile) => {
      if (isUploading) return;
      setIsUploading(true);
      try {
        const response = await uploadHealthDocument(file);
        const uploads: OCRUploadRouteItem[] = [
          {
            file: {
              height: file.height,
              mimeType: file.mimeType,
              name: file.name,
              size: file.size,
              source: file.source,
              uri: file.uri,
              width: file.width,
            },
            uploadedFileId: response.uploaded_file_id,
          },
        ];
        setIsUploadSheetOpen(false);
        router.push({
          pathname: '/ocr-result',
          params: { source: 'healthDataManagement', uploads: JSON.stringify(uploads) },
        });
      } catch (error) {
        Alert.alert('건강 데이터 업로드에 실패했어요.', getHealthDocumentErrorMessage(error));
      } finally {
        setIsUploading(false);
      }
    },
    [isUploading, router],
  );

  const bodyCompositionCount = documents.filter((item) => item.document_type === 'body_composition').length;
  const checkupCount = documents.length - bodyCompositionCount;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { height: insets.top + 52, paddingTop: insets.top + 4 }]}>
        <View style={styles.headerRow}>
          <BackButton onPress={() => router.back()} size={44} style={styles.back} />
          <Text style={styles.headerTitle}>건강 데이터 관리</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <View>
            <Text style={styles.introTitle}>내 건강 데이터를{`\n`}안전하게 관리하세요</Text>
            <Text style={styles.introDescription}>업로드한 검사 결과를 바탕으로{`\n`}더 정확한 건강 분석을 제공해요.</Text>
          </View>
          <Image resizeMode="contain" source={dataIllustration} style={styles.illustration} />
        </View>

        <View style={styles.summaryCard}>
          <SummaryItem count={documents.length} label="전체 데이터" sublabel="모든 데이터" Icon={FileIcon} />
          <View style={styles.summaryDivider} />
          <SummaryItem count={checkupCount} label="건강 검진" sublabel="건강검진 결과" Icon={FileIcon} />
          <View style={styles.summaryDivider} />
          <SummaryItem count={bodyCompositionCount} label="체성분 분석" sublabel="체성분 분석" Icon={BodyFatIcon} />
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.sectionTitle}>업로드한 데이터</Text>
          <Text style={styles.sortText}>최신순</Text>
        </View>
        {isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
        ) : documents.length === 0 ? (
          <View style={styles.emptyCard}><Text style={styles.emptyText}>업로드한 건강 데이터가 없어요.</Text></View>
        ) : (
          <View style={styles.list}>
            {documents.map((item) => {
              const Icon = item.document_type === 'body_composition' ? BodyFatIcon : FileIcon;
              return (
                <View key={item.uploaded_file_id} style={styles.documentCard}>
                  <View style={styles.documentIcon}><Icon color={colors.primary} height={22} width={22} /></View>
                  <View style={styles.documentText}><Text style={styles.documentTitle}>{documentTitle(item)}</Text><Text style={styles.documentSubtitle}>{documentSubtitle(item)}</Text></View>
                  <Text style={[styles.documentStatus, item.status === 'failed' && styles.failedStatus]}>{documentStatusLabel(item.status)}</Text>
                </View>
              );
            })}
          </View>
        )}
        <View style={styles.security}><ShieldCheckIcon color={colors.primary} height={17} width={17} /><Text style={styles.securityText}>업로드한 모든 데이터는 암호화되어 안전하게 관리됩니다.</Text></View>
        <Pressable onPress={() => setIsUploadSheetOpen(true)} style={styles.uploadButton}>
          <View style={styles.uploadIcon}><PlusIcon color={colors.surface} height={15} width={15} /></View><Text style={styles.uploadText}>데이터 업로드</Text>
        </Pressable>
      </ScrollView>
      <HealthDataUploadBottomSheet isBusy={isUploading} onClose={() => setIsUploadSheetOpen(false)} onSelectFile={handleUpload} visible={isUploadSheetOpen} />
    </View>
  );
}

function SummaryItem({ count, label, sublabel, Icon }: { count: number; label: string; sublabel: string; Icon: typeof FileIcon }) {
  return <View style={styles.summaryItem}><View style={styles.summaryIcon}><Icon color={colors.primary} height={22} width={22} /></View><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryCount}>{count}<Text style={styles.summaryUnit}>건</Text></Text><Text style={styles.summarySubLabel}>{sublabel}</Text></View>;
}

const styles = StyleSheet.create({
  back: { left: 10, position: 'absolute', top: 0 },
  content: { paddingBottom: 40, paddingHorizontal: 21, paddingTop: 22 },
  documentCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', height: 60, paddingHorizontal: 13 },
  documentIcon: { alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.round, height: 30, justifyContent: 'center', width: 30 },
  documentSubtitle: { color: colors.textSecondary, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 13, includeFontPadding: false, lineHeight: 16 },
  documentStatus: { color: colors.primaryDark, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 12, includeFontPadding: false, lineHeight: 16 },
  documentText: { flex: 1, gap: 5, marginLeft: 9, minWidth: 0 },
  documentTitle: { color: colors.textBody, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 15, includeFontPadding: false, lineHeight: 18 },
  emptyCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, height: 60, justifyContent: 'center' },
  emptyText: { color: colors.textSecondary, fontFamily: fontFamilies.pretendardMedium, fontSize: 14 },
  failedStatus: { color: colors.danger },
  header: { backgroundColor: colors.background },
  headerRow: { alignItems: 'center', height: 44, justifyContent: 'center', position: 'relative' },
  headerTitle: { color: colors.textBody, fontFamily: fontFamilies.pretendardBold, fontSize: 15, letterSpacing: 1.5, lineHeight: 20 },
  illustration: { height: 108, width: 108 },
  intro: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  introDescription: { color: colors.textSecondary, fontFamily: fontFamilies.pretendardMedium, fontSize: 14, includeFontPadding: false, lineHeight: 20, marginTop: 14 },
  introTitle: { color: colors.textBody, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 22, includeFontPadding: false, lineHeight: 28 },
  list: { gap: 12 },
  listHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 29, marginBottom: 7 },
  loading: { alignItems: 'center', height: 80, justifyContent: 'center' },
  root: { backgroundColor: colors.background, flex: 1 },
  security: { alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.sm, flexDirection: 'row', gap: 8, marginTop: 12, paddingHorizontal: 10, paddingVertical: 6 },
  securityText: { color: colors.textBody, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 13, includeFontPadding: false, lineHeight: 17 },
  sectionTitle: { color: colors.textBody, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 18, includeFontPadding: false, lineHeight: 22 },
  sortText: { color: colors.textBody, fontFamily: fontFamilies.pretendardRegular, fontSize: 14 },
  summaryCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', height: 140, justifyContent: 'space-evenly', marginTop: 16, paddingHorizontal: 8 },
  summaryCount: { color: colors.textBody, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 20, includeFontPadding: false, lineHeight: 24 },
  summaryDivider: { backgroundColor: colors.border, height: 75, width: StyleSheet.hairlineWidth },
  summaryIcon: { alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.round, height: 30, justifyContent: 'center', width: 30 },
  summaryItem: { alignItems: 'center', flex: 1, gap: 5 },
  summaryLabel: { color: colors.textBody, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 14, includeFontPadding: false, lineHeight: 18, textAlign: 'center' },
  summarySubLabel: { color: colors.textSecondary, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 11, includeFontPadding: false, lineHeight: 15, textAlign: 'center' },
  summaryUnit: { fontSize: 14 },
  uploadButton: { alignItems: 'center', alignSelf: 'flex-end', flexDirection: 'row', gap: 3, marginTop: 12, paddingHorizontal: 10, paddingVertical: 5 },
  uploadIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.round, height: 20, justifyContent: 'center', width: 20 },
  uploadText: { color: colors.primary, fontFamily: fontFamilies.pretendardSemiBold, fontSize: 15, includeFontPadding: false, lineHeight: 20 },
});
