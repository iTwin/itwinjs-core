/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { NavNode } from "../../common/Hierarchy";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";

export default class StyleHelper {
  private static getColor(name: string): number {
    name = name.trim();
    if (name.indexOf("#") === 0 && name.length === 7)
      return StyleHelper.getColorFromHex(name);
    else if (name.toUpperCase().indexOf("RGB(") === 0)
      return StyleHelper.getColorFromRGB(name);
    return StyleHelper.getColorFromColorName(name);
  }

  private static getColorFromColorName(name: string): number {
    switch (name) {
      case "AliceBlue": return 0xF0F8FFFF;
      case "AntiqueWhite": return 0xFAEBD7FF;
      case "Aqua": return 0x00FFFFFF;
      case "Aquamarine": return 0x7FFFD4FF;
      case "Azure": return 0xF0FFFFFF;
      case "Beige": return 0xF5F5DCFF;
      case "Bisque": return 0xFFE4C4FF;
      case "Black": return 0x000000FF;
      case "BlanchedAlmond": return 0xFFEBCDFF;
      case "Blue": return 0x0000FFFF;
      case "BlueViolet": return 0x8A2BE2FF;
      case "Brown": return 0xA52A2AFF;
      case "BurlyWood": return 0xDEB887FF;
      case "CadetBlue": return 0x5F9EA0FF;
      case "Chartreuse": return 0x7FFF00FF;
      case "Chocolate": return 0xD2691EFF;
      case "Coral": return 0xFF7F50FF;
      case "CornflowerBlue": return 0x6495EDFF;
      case "Cornsilk": return 0xFFF8DCFF;
      case "Crimson": return 0xDC143CFF;
      case "Cyan": return 0x00FFFFFF;
      case "DarkBlue": return 0x00008BFF;
      case "DarkCyan": return 0x008B8BFF;
      case "DarkGoldenrod": return 0xB8860BFF;
      case "DarkGray": return 0xA9A9A9FF;
      case "DarkGreen": return 0x006400FF;
      case "DarkKhaki": return 0xBDB76BFF;
      case "DarkMagenta": return 0x8B008BFF;
      case "DarkOliveGreen": return 0x556B2FFF;
      case "DarkOrange": return 0xFF8C00FF;
      case "DarkOrchid": return 0x9932CCFF;
      case "DarkRed": return 0x8B0000FF;
      case "DarkSalmon": return 0xE9967AFF;
      case "DarkSeaGreen": return 0x8FBC8BFF;
      case "DarkSlateBlue": return 0x483D8BFF;
      case "DarkSlateGray": return 0x2F4F4FFF;
      case "DarkTurquoise": return 0x00CED1FF;
      case "DarkViolet": return 0x9400D3FF;
      case "DeepPink": return 0xFF1493FF;
      case "DeepSkyBlue": return 0x00BFFFFF;
      case "DimGray": return 0x696969FF;
      case "DodgerBlue": return 0x1E90FFFF;
      case "Firebrick": return 0xB22222FF;
      case "FloralWhite": return 0xFFFAF0FF;
      case "ForestGreen": return 0x228B22FF;
      case "Fuchsia": return 0xFF00FFFF;
      case "Gainsboro": return 0xDCDCDCFF;
      case "GhostWhite": return 0xF8F8FFFF;
      case "Gold": return 0xFFD700FF;
      case "Goldenrod": return 0xDAA520FF;
      case "Gray": return 0x808080FF;
      case "Green": return 0x008000FF;
      case "GreenYellow": return 0xADFF2FFF;
      case "Honeydew": return 0xF0FFF0FF;
      case "HotPink": return 0xFF69B4FF;
      case "IndianRed": return 0xCD5C5CFF;
      case "Indigo": return 0x4B0082FF;
      case "Ivory": return 0xFFFFF0FF;
      case "Khaki": return 0xF0E68CFF;
      case "Lavender": return 0xE6E6FAFF;
      case "LavenderBlush": return 0xFFF0F5FF;
      case "LawnGreen": return 0x7CFC00FF;
      case "LemonChiffon": return 0xFFFACDFF;
      case "LightBlue": return 0xADD8E6FF;
      case "LightCoral": return 0xF08080FF;
      case "LightCyan": return 0xE0FFFFFF;
      case "LightGoldenrodYellow": return 0xFAFAD2FF;
      case "LightGray": return 0xD3D3D3FF;
      case "LightGreen": return 0x90EE90FF;
      case "LightPink": return 0xFFB6C1FF;
      case "LightSalmon": return 0xFFA07AFF;
      case "LightSeaGreen": return 0x20B2AAFF;
      case "LightSkyBlue": return 0x87CEFAFF;
      case "LightSlateGray": return 0x778899FF;
      case "LightSteelBlue": return 0xB0C4DEFF;
      case "LightYellow": return 0xFFFFE0FF;
      case "Lime": return 0x00FF00FF;
      case "LimeGreen": return 0x32CD32FF;
      case "Linen": return 0xFAF0E6FF;
      case "Magenta": return 0xFF00FFFF;
      case "Maroon": return 0x800000FF;
      case "MediumAquamarine": return 0x66CDAAFF;
      case "MediumBlue": return 0x0000CDFF;
      case "MediumOrchid": return 0xBA55D3FF;
      case "MediumPurple": return 0x9370DBFF;
      case "MediumSeaGreen": return 0x3CB371FF;
      case "MediumSlateBlue": return 0x7B68EEFF;
      case "MediumSpringGreen": return 0x00FA9AFF;
      case "MediumTurquoise": return 0x48D1CCFF;
      case "MediumVioletRed": return 0xC71585FF;
      case "MidnightBlue": return 0x191970FF;
      case "MintCream": return 0xF5FFFAFF;
      case "MistyRose": return 0xFFE4E1FF;
      case "Moccasin": return 0xFFE4B5FF;
      case "NavajoWhite": return 0xFFDEADFF;
      case "Navy": return 0x000080FF;
      case "OldLace": return 0xFDF5E6FF;
      case "Olive": return 0x808000FF;
      case "OliveDrab": return 0x6B8E23FF;
      case "Orange": return 0xFFA500FF;
      case "OrangeRed": return 0xFF4500FF;
      case "Orchid": return 0xDA70D6FF;
      case "PaleGoldenrod": return 0xEEE8AAFF;
      case "PaleGreen": return 0x98FB98FF;
      case "PaleTurquoise": return 0xAFEEEEFF;
      case "PaleVioletRed": return 0xDB7093FF;
      case "PapayaWhip": return 0xFFEFD5FF;
      case "PeachPuff": return 0xFFDAB9FF;
      case "Peru": return 0xCD853FFF;
      case "Pink": return 0xFFC0CBFF;
      case "Plum": return 0xDDA0DDFF;
      case "PowderBlue": return 0xB0E0E6FF;
      case "Purple": return 0x800080FF;
      case "Red": return 0xFF0000FF;
      case "RosyBrown": return 0xBC8F8FFF;
      case "RoyalBlue": return 0x4169E1FF;
      case "SaddleBrown": return 0x8B4513FF;
      case "Salmon": return 0xFA8072FF;
      case "SandyBrown": return 0xF4A460FF;
      case "SeaGreen": return 0x2E8B57FF;
      case "SeaShell": return 0xFFF5EEFF;
      case "Sienna": return 0xA0522DFF;
      case "Silver": return 0xC0C0C0FF;
      case "SkyBlue": return 0x87CEEBFF;
      case "SlateBlue": return 0x6A5ACDFF;
      case "SlateGray": return 0x708090FF;
      case "Snow": return 0xFFFAFAFF;
      case "SpringGreen": return 0x00FF7FFF;
      case "SteelBlue": return 0x4682B4FF;
      case "Tan": return 0xD2B48CFF;
      case "Teal": return 0x008080FF;
      case "Thistle": return 0xD8BFD8FF;
      case "Tomato": return 0xFF6347FF;
      case "Transparent": return 0xFFFFFFFF;
      case "Turquoise": return 0x40E0D0FF;
      case "Violet": return 0xEE82EEFF;
      case "Wheat": return 0xF5DEB3FF;
      case "White": return 0xFFFFFFFF;
      case "WhiteSmoke": return 0xF5F5F5FF;
      case "Yellow": return 0xFFFF00FF;
      case "YellowGreen": return 0x9ACD32FF;
    }
    assert(false, "Invalid color name: " + name);
    return 0x0;
  }

  private static getColorFromRGB(name: string): number {
    name = name.substring(name.indexOf("(") + 1, name.indexOf(")"));
    const splitedString = name.split(",");
    const r: number = Number(splitedString[0]);
    const g: number = Number(splitedString[1]);
    const b: number = Number(splitedString[2]);
    return r << 24 | g << 16 | b << 8 | 255;
  }

  private static getColorFromHex(name: string): number {
    name = name.substr(1, 7);
    let color: number = parseInt("0x" + name, 16);
    color = color << 8 | 255;
    return color;
  }

  public static isBold(node: NavNode): boolean { return node.fontStyle ? (node.fontStyle.indexOf("Bold") !== -1) : false; }
  public static isItalic(node: NavNode): boolean { return node.fontStyle ? (node.fontStyle.indexOf("Italic") !== -1) : false; }
  public static getForeColor(node: NavNode): number | null { return node.foreColor ? StyleHelper.getColor(node.foreColor) : null; }
  public static getBackColor(node: NavNode): number | null { return node.backColor ? StyleHelper.getColor(node.backColor) : null; }
}
