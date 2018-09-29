/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Node } from "@bentley/presentation-common";

/** @hidden */
export interface ColorMap {
  [name: string]: number;
}

const colors: ColorMap = {
  AliceBlue: 0xF0F8FFFF,
  AntiqueWhite: 0xFAEBD7FF,
  Aqua: 0x00FFFFFF,
  Aquamarine: 0x7FFFD4FF,
  Azure: 0xF0FFFFFF,
  Beige: 0xF5F5DCFF,
  Bisque: 0xFFE4C4FF,
  Black: 0x000000FF,
  BlanchedAlmond: 0xFFEBCDFF,
  Blue: 0x0000FFFF,
  BlueViolet: 0x8A2BE2FF,
  Brown: 0xA52A2AFF,
  BurlyWood: 0xDEB887FF,
  CadetBlue: 0x5F9EA0FF,
  Chartreuse: 0x7FFF00FF,
  Chocolate: 0xD2691EFF,
  Coral: 0xFF7F50FF,
  CornflowerBlue: 0x6495EDFF,
  Cornsilk: 0xFFF8DCFF,
  Crimson: 0xDC143CFF,
  Cyan: 0x00FFFFFF,
  DarkBlue: 0x00008BFF,
  DarkCyan: 0x008B8BFF,
  DarkGoldenrod: 0xB8860BFF,
  DarkGray: 0xA9A9A9FF,
  DarkGreen: 0x006400FF,
  DarkKhaki: 0xBDB76BFF,
  DarkMagenta: 0x8B008BFF,
  DarkOliveGreen: 0x556B2FFF,
  DarkOrange: 0xFF8C00FF,
  DarkOrchid: 0x9932CCFF,
  DarkRed: 0x8B0000FF,
  DarkSalmon: 0xE9967AFF,
  DarkSeaGreen: 0x8FBC8BFF,
  DarkSlateBlue: 0x483D8BFF,
  DarkSlateGray: 0x2F4F4FFF,
  DarkTurquoise: 0x00CED1FF,
  DarkViolet: 0x9400D3FF,
  DeepPink: 0xFF1493FF,
  DeepSkyBlue: 0x00BFFFFF,
  DimGray: 0x696969FF,
  DodgerBlue: 0x1E90FFFF,
  Firebrick: 0xB22222FF,
  FloralWhite: 0xFFFAF0FF,
  ForestGreen: 0x228B22FF,
  Fuchsia: 0xFF00FFFF,
  Gainsboro: 0xDCDCDCFF,
  GhostWhite: 0xF8F8FFFF,
  Gold: 0xFFD700FF,
  Goldenrod: 0xDAA520FF,
  Gray: 0x808080FF,
  Green: 0x008000FF,
  GreenYellow: 0xADFF2FFF,
  Honeydew: 0xF0FFF0FF,
  HotPink: 0xFF69B4FF,
  IndianRed: 0xCD5C5CFF,
  Indigo: 0x4B0082FF,
  Ivory: 0xFFFFF0FF,
  Khaki: 0xF0E68CFF,
  Lavender: 0xE6E6FAFF,
  LavenderBlush: 0xFFF0F5FF,
  LawnGreen: 0x7CFC00FF,
  LemonChiffon: 0xFFFACDFF,
  LightBlue: 0xADD8E6FF,
  LightCoral: 0xF08080FF,
  LightCyan: 0xE0FFFFFF,
  LightGoldenrodYellow: 0xFAFAD2FF,
  LightGray: 0xD3D3D3FF,
  LightGreen: 0x90EE90FF,
  LightPink: 0xFFB6C1FF,
  LightSalmon: 0xFFA07AFF,
  LightSeaGreen: 0x20B2AAFF,
  LightSkyBlue: 0x87CEFAFF,
  LightSlateGray: 0x778899FF,
  LightSteelBlue: 0xB0C4DEFF,
  LightYellow: 0xFFFFE0FF,
  Lime: 0x00FF00FF,
  LimeGreen: 0x32CD32FF,
  Linen: 0xFAF0E6FF,
  Magenta: 0xFF00FFFF,
  Maroon: 0x800000FF,
  MediumAquamarine: 0x66CDAAFF,
  MediumBlue: 0x0000CDFF,
  MediumOrchid: 0xBA55D3FF,
  MediumPurple: 0x9370DBFF,
  MediumSeaGreen: 0x3CB371FF,
  MediumSlateBlue: 0x7B68EEFF,
  MediumSpringGreen: 0x00FA9AFF,
  MediumTurquoise: 0x48D1CCFF,
  MediumVioletRed: 0xC71585FF,
  MidnightBlue: 0x191970FF,
  MintCream: 0xF5FFFAFF,
  MistyRose: 0xFFE4E1FF,
  Moccasin: 0xFFE4B5FF,
  NavajoWhite: 0xFFDEADFF,
  Navy: 0x000080FF,
  OldLace: 0xFDF5E6FF,
  Olive: 0x808000FF,
  OliveDrab: 0x6B8E23FF,
  Orange: 0xFFA500FF,
  OrangeRed: 0xFF4500FF,
  Orchid: 0xDA70D6FF,
  PaleGoldenrod: 0xEEE8AAFF,
  PaleGreen: 0x98FB98FF,
  PaleTurquoise: 0xAFEEEEFF,
  PaleVioletRed: 0xDB7093FF,
  PapayaWhip: 0xFFEFD5FF,
  PeachPuff: 0xFFDAB9FF,
  Peru: 0xCD853FFF,
  Pink: 0xFFC0CBFF,
  Plum: 0xDDA0DDFF,
  PowderBlue: 0xB0E0E6FF,
  Purple: 0x800080FF,
  Red: 0xFF0000FF,
  RosyBrown: 0xBC8F8FFF,
  RoyalBlue: 0x4169E1FF,
  SaddleBrown: 0x8B4513FF,
  Salmon: 0xFA8072FF,
  SandyBrown: 0xF4A460FF,
  SeaGreen: 0x2E8B57FF,
  SeaShell: 0xFFF5EEFF,
  Sienna: 0xA0522DFF,
  Silver: 0xC0C0C0FF,
  SkyBlue: 0x87CEEBFF,
  SlateBlue: 0x6A5ACDFF,
  SlateGray: 0x708090FF,
  Snow: 0xFFFAFAFF,
  SpringGreen: 0x00FF7FFF,
  SteelBlue: 0x4682B4FF,
  Tan: 0xD2B48CFF,
  Teal: 0x008080FF,
  Thistle: 0xD8BFD8FF,
  Tomato: 0xFF6347FF,
  Transparent: 0xFFFFFFFF,
  Turquoise: 0x40E0D0FF,
  Violet: 0xEE82EEFF,
  Wheat: 0xF5DEB3FF,
  White: 0xFFFFFFFF,
  WhiteSmoke: 0xF5F5F5FF,
  Yellow: 0xFFFF00FF,
  YellowGreen: 0x9ACD32FF,
};

/** @hidden */
export default class StyleHelper {
  public static get availableColors(): ColorMap { return colors; }

  private static getColor(name: string): number {
    name = name.trim();
    if (name.indexOf("#") === 0 && name.length === 7)
      return StyleHelper.getColorFromHex(name);
    else if (name.toUpperCase().indexOf("RGB(") === 0)
      return StyleHelper.getColorFromRGB(name);
    return StyleHelper.getColorFromColorName(name);
  }

  private static getColorFromColorName(name: string): number {
    if (colors.hasOwnProperty(name))
      return colors[name];
    throw new Error("Invalid color name");
  }

  private static getColorFromRGB(name: string): number {
    name = name.substring(name.indexOf("(") + 1, name.indexOf(")"));
    const components = name.split(",");
    const r: number = Number(components[0]);
    const g: number = Number(components[1]);
    const b: number = Number(components[2]);
    return r << 24 | g << 16 | b << 8 | 255;
  }

  private static getColorFromHex(name: string): number {
    name = name.substr(1, 7);
    let color: number = parseInt("0x" + name, 16);
    color = color << 8 | 255;
    return color;
  }

  public static isBold(node: Node): boolean { return node.fontStyle ? (node.fontStyle.indexOf("Bold") !== -1) : false; }
  public static isItalic(node: Node): boolean { return node.fontStyle ? (node.fontStyle.indexOf("Italic") !== -1) : false; }
  public static getForeColor(node: Node): number | undefined { return node.foreColor ? StyleHelper.getColor(node.foreColor) : undefined; }
  public static getBackColor(node: Node): number | undefined { return node.backColor ? StyleHelper.getColor(node.backColor) : undefined; }
}
