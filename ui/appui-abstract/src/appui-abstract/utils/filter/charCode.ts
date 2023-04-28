/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// file copied from https://github.com/microsoft/vscode/blob/master/src/vs/base/common/charCode.ts
/* eslint-disable no-restricted-syntax */

// Names from https://blog.codinghorror.com/ascii-pronunciation-rules-for-programmers/

/**
 * An inlined enum containing useful character codes (to be used with String.charCodeAt).
 * Please leave the const keyword such that it gets inlined when compiled to JavaScript!
 * @internal
 */
export const enum CharCode {
  Null = 0,
  /**
   * The `\b` character.
   */
  Backspace = 8,
  /**
   * The `\t` character.
   */
  Tab = 9,
  /**
   * The `\n` character.
   */
  LineFeed = 10,
  /**
   * The `\r` character.
   */
  CarriageReturn = 13,
  Space = 32,
  /**
   * The `!` character.
   */
  ExclamationMark = 33,
  /**
   * The `"` character.
   */
  DoubleQuote = 34,
  /**
   * The `#` character.
   */
  Hash = 35,
  /**
   * The `$` character.
   */
  DollarSign = 36,
  /**
   * The `%` character.
   */
  PercentSign = 37,
  /**
   * The `&` character.
   */
  Ampersand = 38,
  /**
   * The `'` character.
   */
  SingleQuote = 39,
  /**
   * The `(` character.
   */
  OpenParen = 40,
  /**
   * The `)` character.
   */
  CloseParen = 41,
  /**
   * The `*` character.
   */
  Asterisk = 42,
  /**
   * The `+` character.
   */
  Plus = 43,
  /**
   * The `,` character.
   */
  Comma = 44,
  /**
   * The `-` character.
   */
  Dash = 45,
  /**
   * The `.` character.
   */
  Period = 46,
  /**
   * The `/` character.
   */
  Slash = 47,

  Digit0 = 48,
  Digit1 = 49,
  Digit2 = 50,
  Digit3 = 51,
  Digit4 = 52,
  Digit5 = 53,
  Digit6 = 54,
  Digit7 = 55,
  Digit8 = 56,
  Digit9 = 57,

  /**
   * The `:` character.
   */
  Colon = 58,
  /**
   * The `;` character.
   */
  Semicolon = 59,
  /**
   * The `<` character.
   */
  LessThan = 60,
  /**
   * The `=` character.
   */
  Equals = 61,
  /**
   * The `>` character.
   */
  GreaterThan = 62,
  /**
   * The `?` character.
   */
  QuestionMark = 63,
  /**
   * The `@` character.
   */
  AtSign = 64,

  A = 65,
  B = 66,
  C = 67,
  D = 68,
  E = 69,
  F = 70,
  G = 71,
  H = 72,
  I = 73,
  J = 74,
  K = 75,
  L = 76,
  M = 77,
  N = 78,
  O = 79,
  P = 80,
  Q = 81,
  R = 82,
  S = 83,
  T = 84,
  U = 85,
  V = 86,
  W = 87,
  X = 88,
  Y = 89,
  Z = 90,

  /**
   * The `[` character.
   */
  OpenSquareBracket = 91,
  /**
   * The `\` character.
   */
  Backslash = 92,
  /**
   * The `]` character.
   */
  CloseSquareBracket = 93,
  /**
   * The `^` character.
   */
  Caret = 94,
  /**
   * The `_` character.
   */
  Underline = 95,
  /**
   * The ``(`)`` character.
   */
  BackTick = 96,

  a = 97,
  b = 98,
  c = 99,
  d = 100,
  e = 101,
  f = 102,
  g = 103,
  h = 104,
  i = 105,
  j = 106,
  k = 107,
  l = 108,
  m = 109,
  n = 110,
  o = 111,
  p = 112,
  q = 113,
  r = 114,
  s = 115,
  t = 116,
  u = 117,
  v = 118,
  w = 119,
  x = 120,
  y = 121,
  z = 122,

  /**
   * The `{` character.
   */
  OpenCurlyBrace = 123,
  /**
   * The `|` character.
   */
  Pipe = 124,
  /**
   * The `}` character.
   */
  CloseCurlyBrace = 125,
  /**
   * The `~` character.
   */
  Tilde = 126,

  U_Combining_Grave_Accent = 0x0300, // U+0300Combining Grave Accent
  U_Combining_Acute_Accent = 0x0301, // U+0301Combining Acute Accent
  U_Combining_Circumflex_Accent = 0x0302, // U+0302Combining Circumflex Accent
  U_Combining_Tilde = 0x0303, // U+0303Combining Tilde
  U_Combining_Macron = 0x0304, // U+0304Combining Macron
  U_Combining_Overline = 0x0305, // U+0305Combining Overline
  U_Combining_Breve = 0x0306, // U+0306Combining Breve
  U_Combining_Dot_Above = 0x0307, // U+0307Combining Dot Above
  U_Combining_Diaeresis = 0x0308, // U+0308Combining Diaeresis
  U_Combining_Hook_Above = 0x0309, // U+0309Combining Hook Above
  U_Combining_Ring_Above = 0x030a, // U+030ACombining Ring Above
  U_Combining_Double_Acute_Accent = 0x030b, // U+030BCombining Double Acute Accent
  U_Combining_Caron = 0x030c, // U+030CCombining Caron
  U_Combining_Vertical_Line_Above = 0x030d, // U+030DCombining Vertical Line Above
  U_Combining_Double_Vertical_Line_Above = 0x030e, // U+030ECombining Double Vertical Line Above
  U_Combining_Double_Grave_Accent = 0x030f, // U+030FCombining Double Grave Accent
  U_Combining_Candrabindu = 0x0310, // U+0310Combining Candrabindu
  U_Combining_Inverted_Breve = 0x0311, // U+0311Combining Inverted Breve
  U_Combining_Turned_Comma_Above = 0x0312, // U+0312Combining Turned Comma Above
  U_Combining_Comma_Above = 0x0313, // U+0313Combining Comma Above
  U_Combining_Reversed_Comma_Above = 0x0314, // U+0314Combining Reversed Comma Above
  U_Combining_Comma_Above_Right = 0x0315, // U+0315Combining Comma Above Right
  U_Combining_Grave_Accent_Below = 0x0316, // U+0316Combining Grave Accent Below
  U_Combining_Acute_Accent_Below = 0x0317, // U+0317Combining Acute Accent Below
  U_Combining_Left_Tack_Below = 0x0318, // U+0318Combining Left Tack Below
  U_Combining_Right_Tack_Below = 0x0319, // U+0319Combining Right Tack Below
  U_Combining_Left_Angle_Above = 0x031a, // U+031ACombining Left Angle Above
  U_Combining_Horn = 0x031b, // U+031BCombining Horn
  U_Combining_Left_Half_Ring_Below = 0x031c, // U+031CCombining Left Half Ring Below
  U_Combining_Up_Tack_Below = 0x031d, // U+031DCombining Up Tack Below
  U_Combining_Down_Tack_Below = 0x031e, // U+031ECombining Down Tack Below
  U_Combining_Plus_Sign_Below = 0x031f, // U+031FCombining Plus Sign Below
  U_Combining_Minus_Sign_Below = 0x0320, // U+0320Combining Minus Sign Below
  U_Combining_Palatalized_Hook_Below = 0x0321, // U+0321Combining Palatalized Hook Below
  U_Combining_Retroflex_Hook_Below = 0x0322, // U+0322Combining Retroflex Hook Below
  U_Combining_Dot_Below = 0x0323, // U+0323Combining Dot Below
  U_Combining_Diaeresis_Below = 0x0324, // U+0324Combining Diaeresis Below
  U_Combining_Ring_Below = 0x0325, // U+0325Combining Ring Below
  U_Combining_Comma_Below = 0x0326, // U+0326Combining Comma Below
  U_Combining_Cedilla = 0x0327, // U+0327Combining Cedilla
  U_Combining_Ogonek = 0x0328, // U+0328Combining Ogonek
  U_Combining_Vertical_Line_Below = 0x0329, // U+0329Combining Vertical Line Below
  U_Combining_Bridge_Below = 0x032a, // U+032ACombining Bridge Below
  U_Combining_Inverted_Double_Arch_Below = 0x032b, // U+032BCombining Inverted Double Arch Below
  U_Combining_Caron_Below = 0x032c, // U+032CCombining Caron Below
  U_Combining_Circumflex_Accent_Below = 0x032d, // U+032DCombining Circumflex Accent Below
  U_Combining_Breve_Below = 0x032e, // U+032ECombining Breve Below
  U_Combining_Inverted_Breve_Below = 0x032f, // U+032FCombining Inverted Breve Below
  U_Combining_Tilde_Below = 0x0330, // U+0330Combining Tilde Below
  U_Combining_Macron_Below = 0x0331, // U+0331Combining Macron Below
  U_Combining_Low_Line = 0x0332, // U+0332Combining Low Line
  U_Combining_Double_Low_Line = 0x0333, // U+0333Combining Double Low Line
  U_Combining_Tilde_Overlay = 0x0334, // U+0334Combining Tilde Overlay
  U_Combining_Short_Stroke_Overlay = 0x0335, // U+0335Combining Short Stroke Overlay
  U_Combining_Long_Stroke_Overlay = 0x0336, // U+0336Combining Long Stroke Overlay
  U_Combining_Short_Solidus_Overlay = 0x0337, // U+0337Combining Short Solidus Overlay
  U_Combining_Long_Solidus_Overlay = 0x0338, // U+0338Combining Long Solidus Overlay
  U_Combining_Right_Half_Ring_Below = 0x0339, // U+0339Combining Right Half Ring Below
  U_Combining_Inverted_Bridge_Below = 0x033a, // U+033ACombining Inverted Bridge Below
  U_Combining_Square_Below = 0x033b, // U+033BCombining Square Below
  U_Combining_Seagull_Below = 0x033c, // U+033CCombining Seagull Below
  U_Combining_X_Above = 0x033d, // U+033DCombining X Above
  U_Combining_Vertical_Tilde = 0x033e, // U+033ECombining Vertical Tilde
  U_Combining_Double_Overline = 0x033f, // U+033FCombining Double Overline
  U_Combining_Grave_Tone_Mark = 0x0340, // U+0340Combining Grave Tone Mark
  U_Combining_Acute_Tone_Mark = 0x0341, // U+0341Combining Acute Tone Mark
  U_Combining_Greek_Perispomeni = 0x0342, // U+0342Combining Greek Perispomeni
  U_Combining_Greek_Koronis = 0x0343, // U+0343Combining Greek Koronis
  U_Combining_Greek_Dialytika_Tonos = 0x0344, // U+0344Combining Greek Dialytika Tonos
  U_Combining_Greek_Ypogegrammeni = 0x0345, // U+0345Combining Greek Ypogegrammeni
  U_Combining_Bridge_Above = 0x0346, // U+0346Combining Bridge Above
  U_Combining_Equals_Sign_Below = 0x0347, // U+0347Combining Equals Sign Below
  U_Combining_Double_Vertical_Line_Below = 0x0348, // U+0348Combining Double Vertical Line Below
  U_Combining_Left_Angle_Below = 0x0349, // U+0349Combining Left Angle Below
  U_Combining_Not_Tilde_Above = 0x034a, // U+034ACombining Not Tilde Above
  U_Combining_Homothetic_Above = 0x034b, // U+034BCombining Homothetic Above
  U_Combining_Almost_Equal_To_Above = 0x034c, // U+034CCombining Almost Equal To Above
  U_Combining_Left_Right_Arrow_Below = 0x034d, // U+034DCombining Left Right Arrow Below
  U_Combining_Upwards_Arrow_Below = 0x034e, // U+034ECombining Upwards Arrow Below
  U_Combining_Grapheme_Joiner = 0x034f, // U+034FCombining Grapheme Joiner
  U_Combining_Right_Arrowhead_Above = 0x0350, // U+0350Combining Right Arrowhead Above
  U_Combining_Left_Half_Ring_Above = 0x0351, // U+0351Combining Left Half Ring Above
  U_Combining_Fermata = 0x0352, // U+0352Combining Fermata
  U_Combining_X_Below = 0x0353, // U+0353Combining X Below
  U_Combining_Left_Arrowhead_Below = 0x0354, // U+0354Combining Left Arrowhead Below
  U_Combining_Right_Arrowhead_Below = 0x0355, // U+0355Combining Right Arrowhead Below
  U_Combining_Right_Arrowhead_And_Up_Arrowhead_Below = 0x0356, // U+0356Combining Right Arrowhead And Up Arrowhead Below
  U_Combining_Right_Half_Ring_Above = 0x0357, // U+0357Combining Right Half Ring Above
  U_Combining_Dot_Above_Right = 0x0358, // U+0358Combining Dot Above Right
  U_Combining_Asterisk_Below = 0x0359, // U+0359Combining Asterisk Below
  U_Combining_Double_Ring_Below = 0x035a, // U+035ACombining Double Ring Below
  U_Combining_Zigzag_Above = 0x035b, // U+035BCombining Zigzag Above
  U_Combining_Double_Breve_Below = 0x035c, // U+035CCombining Double Breve Below
  U_Combining_Double_Breve = 0x035d, // U+035DCombining Double Breve
  U_Combining_Double_Macron = 0x035e, // U+035ECombining Double Macron
  U_Combining_Double_Macron_Below = 0x035f, // U+035FCombining Double Macron Below
  U_Combining_Double_Tilde = 0x0360, // U+0360Combining Double Tilde
  U_Combining_Double_Inverted_Breve = 0x0361, // U+0361Combining Double Inverted Breve
  U_Combining_Double_Rightwards_Arrow_Below = 0x0362, // U+0362Combining Double Rightwards Arrow Below
  U_Combining_Latin_Small_Letter_A = 0x0363, // U+0363Combining Latin Small Letter A
  U_Combining_Latin_Small_Letter_E = 0x0364, // U+0364Combining Latin Small Letter E
  U_Combining_Latin_Small_Letter_I = 0x0365, // U+0365Combining Latin Small Letter I
  U_Combining_Latin_Small_Letter_O = 0x0366, // U+0366Combining Latin Small Letter O
  U_Combining_Latin_Small_Letter_U = 0x0367, // U+0367Combining Latin Small Letter U
  U_Combining_Latin_Small_Letter_C = 0x0368, // U+0368Combining Latin Small Letter C
  U_Combining_Latin_Small_Letter_D = 0x0369, // U+0369Combining Latin Small Letter D
  U_Combining_Latin_Small_Letter_H = 0x036a, // U+036ACombining Latin Small Letter H
  U_Combining_Latin_Small_Letter_M = 0x036b, // U+036BCombining Latin Small Letter M
  U_Combining_Latin_Small_Letter_R = 0x036c, // U+036CCombining Latin Small Letter R
  U_Combining_Latin_Small_Letter_T = 0x036d, // U+036DCombining Latin Small Letter T
  U_Combining_Latin_Small_Letter_V = 0x036e, // U+036ECombining Latin Small Letter V
  U_Combining_Latin_Small_Letter_X = 0x036f, // U+036FCombining Latin Small Letter X

  /**
   * Unicode Character 'LINE SEPARATOR' (U+2028)
   * http://www.fileformat.info/info/unicode/char/2028/index.htm
   */
  LINE_SEPARATOR = 0x2028,
  /**
   * Unicode Character 'PARAGRAPH SEPARATOR' (U+2029)
   * http://www.fileformat.info/info/unicode/char/2029/index.htm
   */
  PARAGRAPH_SEPARATOR = 0x2029,
  /**
   * Unicode Character 'NEXT LINE' (U+0085)
   * http://www.fileformat.info/info/unicode/char/0085/index.htm
   */
  NEXT_LINE = 0x0085,

  // http://www.fileformat.info/info/unicode/category/Sk/list.htm
  U_CIRCUMFLEX = 0x005e, // U+005ECIRCUMFLEX
  U_GRAVE_ACCENT = 0x0060, // U+0060GRAVE ACCENT
  U_DIAERESIS = 0x00a8, // U+00A8DIAERESIS
  U_MACRON = 0x00af, // U+00AFMACRON
  U_ACUTE_ACCENT = 0x00b4, // U+00B4ACUTE ACCENT
  U_CEDILLA = 0x00b8, // U+00B8CEDILLA
  U_MODIFIER_LETTER_LEFT_ARROWHEAD = 0x02c2, // U+02C2MODIFIER LETTER LEFT ARROWHEAD
  U_MODIFIER_LETTER_RIGHT_ARROWHEAD = 0x02c3, // U+02C3MODIFIER LETTER RIGHT ARROWHEAD
  U_MODIFIER_LETTER_UP_ARROWHEAD = 0x02c4, // U+02C4MODIFIER LETTER UP ARROWHEAD
  U_MODIFIER_LETTER_DOWN_ARROWHEAD = 0x02c5, // U+02C5MODIFIER LETTER DOWN ARROWHEAD
  U_MODIFIER_LETTER_CENTRED_RIGHT_HALF_RING = 0x02d2, // U+02D2MODIFIER LETTER CENTRED RIGHT HALF RING
  U_MODIFIER_LETTER_CENTRED_LEFT_HALF_RING = 0x02d3, // U+02D3MODIFIER LETTER CENTRED LEFT HALF RING
  U_MODIFIER_LETTER_UP_TACK = 0x02d4, // U+02D4MODIFIER LETTER UP TACK
  U_MODIFIER_LETTER_DOWN_TACK = 0x02d5, // U+02D5MODIFIER LETTER DOWN TACK
  U_MODIFIER_LETTER_PLUS_SIGN = 0x02d6, // U+02D6MODIFIER LETTER PLUS SIGN
  U_MODIFIER_LETTER_MINUS_SIGN = 0x02d7, // U+02D7MODIFIER LETTER MINUS SIGN
  U_BREVE = 0x02d8, // U+02D8BREVE
  U_DOT_ABOVE = 0x02d9, // U+02D9DOT ABOVE
  U_RING_ABOVE = 0x02da, // U+02DARING ABOVE
  U_OGONEK = 0x02db, // U+02DBOGONEK
  U_SMALL_TILDE = 0x02dc, // U+02DCSMALL TILDE
  U_DOUBLE_ACUTE_ACCENT = 0x02dd, // U+02DDDOUBLE ACUTE ACCENT
  U_MODIFIER_LETTER_RHOTIC_HOOK = 0x02de, // U+02DEMODIFIER LETTER RHOTIC HOOK
  U_MODIFIER_LETTER_CROSS_ACCENT = 0x02df, // U+02DFMODIFIER LETTER CROSS ACCENT
  U_MODIFIER_LETTER_EXTRA_HIGH_TONE_BAR = 0x02e5, // U+02E5MODIFIER LETTER EXTRA-HIGH TONE BAR
  U_MODIFIER_LETTER_HIGH_TONE_BAR = 0x02e6, // U+02E6MODIFIER LETTER HIGH TONE BAR
  U_MODIFIER_LETTER_MID_TONE_BAR = 0x02e7, // U+02E7MODIFIER LETTER MID TONE BAR
  U_MODIFIER_LETTER_LOW_TONE_BAR = 0x02e8, // U+02E8MODIFIER LETTER LOW TONE BAR
  U_MODIFIER_LETTER_EXTRA_LOW_TONE_BAR = 0x02e9, // U+02E9MODIFIER LETTER EXTRA-LOW TONE BAR
  U_MODIFIER_LETTER_YIN_DEPARTING_TONE_MARK = 0x02ea, // U+02EAMODIFIER LETTER YIN DEPARTING TONE MARK
  U_MODIFIER_LETTER_YANG_DEPARTING_TONE_MARK = 0x02eb, // U+02EBMODIFIER LETTER YANG DEPARTING TONE MARK
  U_MODIFIER_LETTER_UNASPIRATED = 0x02ed, // U+02EDMODIFIER LETTER UNASPIRATED
  U_MODIFIER_LETTER_LOW_DOWN_ARROWHEAD = 0x02ef, // U+02EFMODIFIER LETTER LOW DOWN ARROWHEAD
  U_MODIFIER_LETTER_LOW_UP_ARROWHEAD = 0x02f0, // U+02F0MODIFIER LETTER LOW UP ARROWHEAD
  U_MODIFIER_LETTER_LOW_LEFT_ARROWHEAD = 0x02f1, // U+02F1MODIFIER LETTER LOW LEFT ARROWHEAD
  U_MODIFIER_LETTER_LOW_RIGHT_ARROWHEAD = 0x02f2, // U+02F2MODIFIER LETTER LOW RIGHT ARROWHEAD
  U_MODIFIER_LETTER_LOW_RING = 0x02f3, // U+02F3MODIFIER LETTER LOW RING
  U_MODIFIER_LETTER_MIDDLE_GRAVE_ACCENT = 0x02f4, // U+02F4MODIFIER LETTER MIDDLE GRAVE ACCENT
  U_MODIFIER_LETTER_MIDDLE_DOUBLE_GRAVE_ACCENT = 0x02f5, // U+02F5MODIFIER LETTER MIDDLE DOUBLE GRAVE ACCENT
  U_MODIFIER_LETTER_MIDDLE_DOUBLE_ACUTE_ACCENT = 0x02f6, // U+02F6MODIFIER LETTER MIDDLE DOUBLE ACUTE ACCENT
  U_MODIFIER_LETTER_LOW_TILDE = 0x02f7, // U+02F7MODIFIER LETTER LOW TILDE
  U_MODIFIER_LETTER_RAISED_COLON = 0x02f8, // U+02F8MODIFIER LETTER RAISED COLON
  U_MODIFIER_LETTER_BEGIN_HIGH_TONE = 0x02f9, // U+02F9MODIFIER LETTER BEGIN HIGH TONE
  U_MODIFIER_LETTER_END_HIGH_TONE = 0x02fa, // U+02FAMODIFIER LETTER END HIGH TONE
  U_MODIFIER_LETTER_BEGIN_LOW_TONE = 0x02fb, // U+02FBMODIFIER LETTER BEGIN LOW TONE
  U_MODIFIER_LETTER_END_LOW_TONE = 0x02fc, // U+02FCMODIFIER LETTER END LOW TONE
  U_MODIFIER_LETTER_SHELF = 0x02fd, // U+02FDMODIFIER LETTER SHELF
  U_MODIFIER_LETTER_OPEN_SHELF = 0x02fe, // U+02FEMODIFIER LETTER OPEN SHELF
  U_MODIFIER_LETTER_LOW_LEFT_ARROW = 0x02ff, // U+02FFMODIFIER LETTER LOW LEFT ARROW
  U_GREEK_LOWER_NUMERAL_SIGN = 0x0375, // U+0375GREEK LOWER NUMERAL SIGN
  U_GREEK_TONOS = 0x0384, // U+0384GREEK TONOS
  U_GREEK_DIALYTIKA_TONOS = 0x0385, // U+0385GREEK DIALYTIKA TONOS
  U_GREEK_KORONIS = 0x1fbd, // U+1FBDGREEK KORONIS
  U_GREEK_PSILI = 0x1fbf, // U+1FBFGREEK PSILI
  U_GREEK_PERISPOMENI = 0x1fc0, // U+1FC0GREEK PERISPOMENI
  U_GREEK_DIALYTIKA_AND_PERISPOMENI = 0x1fc1, // U+1FC1GREEK DIALYTIKA AND PERISPOMENI
  U_GREEK_PSILI_AND_VARIA = 0x1fcd, // U+1FCDGREEK PSILI AND VARIA
  U_GREEK_PSILI_AND_OXIA = 0x1fce, // U+1FCEGREEK PSILI AND OXIA
  U_GREEK_PSILI_AND_PERISPOMENI = 0x1fcf, // U+1FCFGREEK PSILI AND PERISPOMENI
  U_GREEK_DASIA_AND_VARIA = 0x1fdd, // U+1FDDGREEK DASIA AND VARIA
  U_GREEK_DASIA_AND_OXIA = 0x1fde, // U+1FDEGREEK DASIA AND OXIA
  U_GREEK_DASIA_AND_PERISPOMENI = 0x1fdf, // U+1FDFGREEK DASIA AND PERISPOMENI
  U_GREEK_DIALYTIKA_AND_VARIA = 0x1fed, // U+1FEDGREEK DIALYTIKA AND VARIA
  U_GREEK_DIALYTIKA_AND_OXIA = 0x1fee, // U+1FEEGREEK DIALYTIKA AND OXIA
  U_GREEK_VARIA = 0x1fef, // U+1FEFGREEK VARIA
  U_GREEK_OXIA = 0x1ffd, // U+1FFDGREEK OXIA
  U_GREEK_DASIA = 0x1ffe, // U+1FFEGREEK DASIA

  U_OVERLINE = 0x203e, // Unicode Character 'OVERLINE'

  /**
   * UTF-8 BOM
   * Unicode Character 'ZERO WIDTH NO-BREAK SPACE' (U+FEFF)
   * http://www.fileformat.info/info/unicode/char/feff/index.htm
   */
  UTF8_BOM = 65279,
}
