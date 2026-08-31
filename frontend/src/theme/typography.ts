import type { TextStyle } from 'react-native';

import { fontFamilies } from './fonts';

type TypographyToken = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'>;

export const typography = {
  display: {
    fontFamily: fontFamilies.gmarketMedium,
    fontSize: 40,
    lineHeight: 50,
    letterSpacing: 2,
  },
  heading: {
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 32,
    lineHeight: 40,
  },
  body: {
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 14,
    lineHeight: 22,
  },
  title: {
    fontFamily: fontFamilies.pretendardBold,
    fontSize: 20,
    lineHeight: 28,
  },
  sectionTitle: {
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyEmphasis: {
    fontFamily: fontFamilies.pretendardSemiBold,
    fontSize: 14,
    lineHeight: 22,
  },
  bodySmall: {
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  caption: {
    fontFamily: fontFamilies.pretendardRegular,
    fontSize: 11,
    lineHeight: 16,
  },
  button: {
    fontFamily: fontFamilies.pretendardMedium,
    fontSize: 16,
    lineHeight: 22,
  },
} satisfies Record<string, TypographyToken>;
