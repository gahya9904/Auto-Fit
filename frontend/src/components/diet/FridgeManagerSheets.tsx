import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  type KeyboardEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Platform,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CloseIcon from '@/assets/icons/common/X.svg';
import TrashIcon from '@/assets/icons/common/Trash.svg';
import BeanIcon from '@/assets/icons/food/Bean.svg';
import EggsIcon from '@/assets/icons/food/Eggs.svg';
import AppleIcon from '@/assets/icons/food/Apple.svg';
import MeatIcon from '@/assets/icons/food/Meat.svg';
import VegetableIcon from '@/assets/icons/food/Vegetable.svg';
import CheckIcon from '@/assets/icons/system/Check.svg';
import LightbulbIcon from '@/assets/icons/system/Lightbulb.svg';
import PlusCircleIcon from '@/assets/icons/system/PlusCircle.svg';
import { AppBottomSheet } from '@/src/components/common';
import { colors, fontFamilies } from '@/src/theme';

const ingredientCardAspectRatio = 86.5 / 121;

export type DietSheet = null | 'fridge' | 'addIngredient';
export type IngredientIcon = 'meat' | 'egg' | 'bean' | 'fruit' | 'vegetable';

export type FridgeIngredient = {
  id: string;
  name: string;
  icon: IngredientIcon;
};

type FridgeManagerSheetsProps = {
  activeSheet: DietSheet;
  ingredients: FridgeIngredient[];
  onActiveSheetChange: (sheet: DietSheet) => void;
  onIngredientsChange: (ingredients: FridgeIngredient[]) => void;
};

const iconByType = {
  meat: MeatIcon,
  egg: EggsIcon,
  bean: BeanIcon,
  fruit: AppleIcon,
  vegetable: VegetableIcon,
} as const;

function IngredientItem({
  ingredient,
  selected,
  onPress,
}: {
  ingredient: FridgeIngredient;
  selected: boolean;
  onPress: () => void;
}) {
  const Icon = iconByType[ingredient.icon];

  return (
    <Pressable
      accessibilityLabel={`${ingredient.name} ${selected ? '선택 해제' : '선택'}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.ingredientItem,
        selected && styles.ingredientItemSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.ingredientIconCircle}>
        <Icon color={colors.primary} height={24} width={24} />
      </View>
      <Text numberOfLines={1} style={styles.ingredientName}>
        {ingredient.name}
      </Text>
      {selected ? (
        <View style={styles.checkBadge}>
          <CheckIcon color={colors.surface} fill={colors.surface} height={10} width={10} />
        </View>
      ) : null}
    </Pressable>
  );
}

function SheetHeader({
  title,
  description,
  onClose,
}: {
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <View style={styles.headerBlock}>
      <View style={styles.handleArea}>
        <View style={styles.handle} />
      </View>
      <View style={styles.sheetHeader}>
        <View style={styles.headerCopy}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Text style={styles.sheetDescription}>{description}</Text>
        </View>
        <Pressable
          accessibilityLabel="닫기"
          accessibilityRole="button"
          hitSlop={7}
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <CloseIcon color={colors.primary} fill={colors.primary} height={17} width={17} />
        </Pressable>
      </View>
    </View>
  );
}

function DeleteConfirmationDialog({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <View style={styles.dialogOverlay}>
        <Pressable
          accessibilityLabel="삭제 확인창 닫기"
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.dialog}>
          <View style={styles.trashCircle}>
            <TrashIcon color={colors.danger} fill={colors.danger} height={22} width={22} />
          </View>
          <Text style={styles.dialogTitle}>선택한 재료를 삭제하시겠어요?</Text>
          <Text style={styles.dialogDescription}>삭제된 재료는 복구할 수 없어요.</Text>
          <View style={styles.dialogActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelLabel}>취소</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [styles.deleteConfirmButton, pressed && styles.pressed]}
            >
              <Text style={styles.deleteConfirmLabel}>삭제</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function FridgeManagerSheets({
  activeSheet,
  ingredients,
  onActiveSheetChange,
  onIngredientsChange,
}: FridgeManagerSheetsProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<Set<string>>(() => new Set());
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [ingredientName, setIngredientName] = useState('');
  const [keyboardContentInset, setKeyboardContentInset] = useState(0);
  const [closingSheet, setClosingSheet] = useState<Exclude<DietSheet, null>>('fridge');
  const [keyboardOffset] = useState(() => new Animated.Value(0));
  const nextIngredientId = useRef(1);
  const renderedSheet = activeSheet ?? closingSheet;

  const selectedCount = selectedIngredientIds.size;
  const ingredientRows = useMemo(() => {
    const rows: FridgeIngredient[][] = [];
    for (let index = 0; index < ingredients.length; index += 4) {
      rows.push(ingredients.slice(index, index + 4));
    }
    return rows;
  }, [ingredients]);
  const minimumTopGap = Math.max(28, insets.top + 8);
  const sheetHeight = Math.min(
    renderedSheet === 'addIngredient' ? 400 : 630,
    windowHeight - minimumTopGap,
  );
  const bottomInset = Math.max(insets.bottom, 20);

  useEffect(() => {
    if (renderedSheet !== 'addIngredient' || Platform.OS === 'web') {
      keyboardOffset.setValue(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const safeTop = Math.max(insets.top, 12) + 8;

    const handleKeyboardShow = (event: KeyboardEvent) => {
      const keyboardHeight = event.endCoordinates.height;
      const screenBottom = event.endCoordinates.screenY + keyboardHeight;
      const baseSheetTop = screenBottom - sheetHeight;
      const maxKeyboardOffset = Math.max(0, baseSheetTop - safeTop);
      const nextKeyboardOffset = Math.min(keyboardHeight, maxKeyboardOffset);
      const remainingOverlap = Math.max(0, keyboardHeight - nextKeyboardOffset);

      setKeyboardContentInset(remainingOverlap > 0 ? remainingOverlap + 16 : 0);
      Animated.timing(keyboardOffset, {
        duration: Platform.OS === 'ios' ? (event.duration ?? 240) : 220,
        easing: Easing.out(Easing.cubic),
        toValue: nextKeyboardOffset,
        useNativeDriver: true,
      }).start();
    };

    const handleKeyboardHide = (event: KeyboardEvent) => {
      setKeyboardContentInset(0);
      Animated.timing(keyboardOffset, {
        duration: Platform.OS === 'ios' ? (event.duration ?? 200) : 200,
        easing: Easing.inOut(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }).start();
    };

    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      keyboardOffset.stopAnimation();
      keyboardOffset.setValue(0);
    };
  }, [insets.top, keyboardOffset, renderedSheet, sheetHeight]);

  const closeSheet = () => {
    setClosingSheet(renderedSheet);
    setSelectedIngredientIds(new Set());
    setDeleteDialogVisible(false);
    setIngredientName('');
    if (renderedSheet === 'addIngredient') {
      Keyboard.dismiss();
      setKeyboardContentInset(0);
      Animated.timing(keyboardOffset, {
        duration: 200,
        easing: Easing.inOut(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
    onActiveSheetChange(null);
  };

  const selectedNames = useMemo(
    () => ingredients.filter((item) => selectedIngredientIds.has(item.id)),
    [ingredients, selectedIngredientIds],
  );

  const toggleIngredient = (id: string) => {
    setSelectedIngredientIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmDelete = () => {
    const selectedIds = selectedIngredientIds;
    onIngredientsChange(ingredients.filter((item) => !selectedIds.has(item.id)));
    setSelectedIngredientIds(new Set());
    setDeleteDialogVisible(false);
  };

  const openAddIngredient = () => {
    setClosingSheet('addIngredient');
    setSelectedIngredientIds(new Set());
    setIngredientName('');
    setKeyboardContentInset(0);
    onActiveSheetChange('addIngredient');
  };

  const addIngredient = () => {
    const nextName = ingredientName.trim();
    if (!nextName) return;

    onIngredientsChange([
      ...ingredients,
      {
        id: `custom-${Date.now()}-${nextIngredientId.current++}`,
        icon: 'vegetable',
        name: nextName,
      },
    ]);
    setIngredientName('');
    setKeyboardContentInset(0);
    Keyboard.dismiss();
    onActiveSheetChange('fridge');
  };

  return (
    <>
      <AppBottomSheet
        animationDistance={630}
        contentStyle={styles.bottomSheetContent}
        lockBackgroundScroll
        minimumTopGap={28}
        onClose={closeSheet}
        overlayStyle={styles.sheetOverlay}
        separateAnimations
        sheetOffset={renderedSheet === 'addIngredient' ? keyboardOffset : undefined}
        sheetStyle={[styles.sheet, { height: sheetHeight, paddingBottom: bottomInset }]}
        showHandle={false}
        visible={activeSheet !== null}
      >
        {renderedSheet === 'fridge' ? (
          <View style={styles.fridgeContent}>
            <View>
              <SheetHeader
                description="보유한 재료를 관리하고 식단 추천에 반영해요."
                onClose={closeSheet}
                title="냉장고 재료 관리"
              />
              <Pressable
                accessibilityRole="button"
                onPress={openAddIngredient}
                style={({ pressed }) => [styles.addOutlineButton, pressed && styles.pressed]}
              >
                <PlusCircleIcon
                  color={colors.primary}
                  fill={colors.primary}
                  height={20}
                  width={20}
                />
                <Text style={styles.addOutlineLabel}>재료 추가하기</Text>
              </Pressable>
            </View>

            <View style={styles.inventorySection}>
              <View style={styles.inventoryHeading}>
                <Text style={styles.inventoryTitle}>보유 재료</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{ingredients.length}</Text>
                </View>
              </View>
              <ScrollView
                contentContainerStyle={styles.ingredientGrid}
                keyboardShouldPersistTaps="always"
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {ingredientRows.map((row, rowIndex) => (
                  <View key={row[0]?.id ?? `row-${rowIndex}`} style={styles.ingredientRow}>
                    {row.map((ingredient) => (
                      <IngredientItem
                        ingredient={ingredient}
                        key={ingredient.id}
                        onPress={() => toggleIngredient(ingredient.id)}
                        selected={selectedIngredientIds.has(ingredient.id)}
                      />
                    ))}
                    {Array.from({ length: 4 - row.length }, (_, index) => (
                      <View
                        key={`empty-${rowIndex}-${index}`}
                        style={styles.ingredientPlaceholder}
                      />
                    ))}
                  </View>
                ))}
              </ScrollView>
            </View>

            {selectedCount > 0 ? (
              <View style={styles.selectionAction}>
                <Text style={styles.selectionText}>
                  <Text style={styles.selectionCount}>{selectedCount}개</Text> 선택됨
                </Text>
                <Pressable
                  accessibilityLabel={`${selectedCount}개 재료 삭제`}
                  accessibilityRole="button"
                  onPress={() => setDeleteDialogVisible(true)}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                >
                  <Text style={styles.deleteButtonLabel}>삭제</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.tipCard}>
                <LightbulbIcon
                  color={colors.primary}
                  fill={colors.primary}
                  height={22}
                  width={22}
                />
                <View style={styles.tipCopy}>
                  <Text style={styles.tipLabel}>TIP</Text>
                  <Text style={styles.tipDescription}>
                    재료를 선택하면 한 번에 삭제할 수 있어요.
                  </Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.addIngredientContent,
              keyboardContentInset > 0 && { paddingBottom: keyboardContentInset },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.addIngredientScroll}
          >
            <View style={styles.addIngredientInner}>
              <SheetHeader
                description="새로운 재료를 추가하고 식단 추천에 반영해요."
                onClose={closeSheet}
                title="재료 추가"
              />
              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>재료명</Text>
                  <Text style={styles.required}>*</Text>
                </View>
                <TextInput
                  accessibilityLabel="재료명"
                  autoFocus
                  onChangeText={setIngredientName}
                  onSubmitEditing={addIngredient}
                  placeholder="재료명을 입력해주세요"
                  placeholderTextColor={colors.textDisabled}
                  returnKeyType="done"
                  style={styles.input}
                  value={ingredientName}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={addIngredient}
                style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              >
                <Text style={styles.addButtonLabel}>재료 추가</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </AppBottomSheet>

      <DeleteConfirmationDialog
        onCancel={() => setDeleteDialogVisible(false)}
        onConfirm={confirmDelete}
        visible={deleteDialogVisible && selectedNames.length > 0}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bottomSheetContent: { flex: 1, paddingHorizontal: 21, paddingVertical: 0 },
  sheetOverlay: { backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    paddingTop: 5,
  },
  fridgeContent: { flex: 1, justifyContent: 'space-between' },
  headerBlock: { flexShrink: 0 },
  handleArea: { alignItems: 'center', height: 16, justifyContent: 'center' },
  handle: { backgroundColor: '#D9D9D9', borderRadius: 2, height: 4, width: 40 },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 35,
  },
  headerCopy: { flex: 1, gap: 5, paddingRight: 8 },
  sheetTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 22,
    lineHeight: 27,
  },
  sheetDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 17,
    lineHeight: 22,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 16,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { height: 2, width: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2.5,
    width: 30,
  },
  addOutlineButton: {
    alignItems: 'center',
    backgroundColor: '#EBFFFA',
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
    marginTop: 35,
  },
  addOutlineLabel: {
    color: colors.primary,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 17,
  },
  inventorySection: { flex: 1, marginTop: 39, minHeight: 0 },
  inventoryHeading: { alignItems: 'center', flexDirection: 'row', gap: 5, marginBottom: 10 },
  inventoryTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
  },
  countBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 11,
    height: 22,
    justifyContent: 'center',
    minWidth: 22,
    paddingHorizontal: 4,
  },
  countBadgeText: {
    color: colors.surface,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 16,
  },
  ingredientGrid: {
    gap: 8,
    paddingBottom: 4,
  },
  ingredientRow: { flexDirection: 'row', gap: 8, width: '100%' },
  ingredientItem: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: '#EEEEEE',
    borderRadius: 13,
    borderWidth: 1,
    aspectRatio: ingredientCardAspectRatio,
    flex: 1,
    gap: 5,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 10,
    position: 'relative',
  },
  ingredientPlaceholder: { aspectRatio: ingredientCardAspectRatio, flex: 1, minWidth: 0 },
  ingredientItemSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  ingredientIconCircle: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  ingredientName: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
    maxWidth: '100%',
    textAlign: 'center',
  },
  checkBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: 5,
    top: 5,
    width: 18,
  },
  tipCard: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    height: 55,
    paddingHorizontal: 15,
  },
  tipCopy: { flex: 1 },
  tipLabel: {
    color: colors.primary,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 12,
  },
  tipDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 15,
    marginTop: 1,
  },
  selectionAction: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    height: 55,
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  selectionText: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
  },
  selectionCount: { color: colors.primary, fontFamily: fontFamilies.pretendardBold },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderColor: '#F5A5A5',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  deleteButtonLabel: {
    color: '#E57373',
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
  },
  addIngredientContent: { flexGrow: 1 },
  addIngredientScroll: { flex: 1 },
  addIngredientInner: { flex: 1, justifyContent: 'space-between', minHeight: 375 },
  fieldGroup: { gap: 8 },
  fieldLabelRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  fieldLabel: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
  },
  required: { color: '#E57373', fontFamily: fontFamilies.pretendardSemiBold, fontSize: 18 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 14,
    height: 44,
    paddingHorizontal: 14,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
  },
  addButtonLabel: {
    color: colors.surface,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
  },
  dialogOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flex: 1,
    justifyContent: 'center',
  },
  dialog: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    height: 200,
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    shadowColor: '#000000',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    width: 300,
  },
  trashCircle: {
    alignItems: 'center',
    backgroundColor: '#FFF1F1',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  dialogTitle: {
    color: colors.textBody,
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 18,
    marginTop: 12,
    textAlign: 'center',
  },
  dialogDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 16,
    marginTop: 2,
    textAlign: 'center',
  },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 12, width: '100%' },
  cancelButton: {
    alignItems: 'center',
    borderColor: '#D9D9D9',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  cancelLabel: { color: '#6C757D', fontFamily: fontFamilies.pretendardSemiBold, fontSize: 17 },
  deleteConfirmButton: {
    alignItems: 'center',
    backgroundColor: '#FF4D4F',
    borderRadius: 12,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  deleteConfirmLabel: {
    color: colors.surface,
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 17,
  },
  pressed: { opacity: 0.72 },
});
