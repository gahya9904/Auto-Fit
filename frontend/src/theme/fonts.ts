export const fontFamilies = {
  gmarketMedium: 'GmarketSans-Medium',
  pretendardLight: 'Pretendard-Light',
  pretendardRegular: 'Pretendard-Regular',
  pretendardMedium: 'Pretendard-Medium',
  pretendardSemiBold: 'Pretendard-SemiBold',
  pretendardBold: 'Pretendard-Bold',
  pretendardExtraBold: 'Pretendard-ExtraBold',
} as const;

export const fontAssets = {
  [fontFamilies.gmarketMedium]: require('../../assets/fonts/GmarketSansTTFMedium.ttf'),
  [fontFamilies.pretendardLight]: require('../../assets/fonts/Pretendard-Light.otf'),
  [fontFamilies.pretendardRegular]: require('../../assets/fonts/Pretendard-Regular.otf'),
  [fontFamilies.pretendardMedium]: require('../../assets/fonts/Pretendard-Medium.otf'),
  [fontFamilies.pretendardSemiBold]: require('../../assets/fonts/Pretendard-SemiBold.otf'),
  [fontFamilies.pretendardBold]: require('../../assets/fonts/Pretendard-Bold.otf'),
  [fontFamilies.pretendardExtraBold]: require('../../assets/fonts/Pretendard-ExtraBold.otf'),
} as const;
