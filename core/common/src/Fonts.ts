/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

/** The [FontFile]($backend) encodings understood by iTwin.js.
 * [[FontType.Rsc]] and [[FontType.Shx]] are primitive formats originating in the early days of computer-aided drafting. They describe glyphs as simple shapes
 * (e.g., collections of line strings - hence the moniker "stick font").
 * [[FontType.TrueType]] is far more prevalent and generally preferred for more aesthetically pleasing text.
 * @see [FontFile]($backend) to work with fonts in these formats.
 * @public
 * @extensions
 */
export enum FontType {
  /** [OpenType](https://en.wikipedia.org/wiki/OpenType) format, derived from and compatible with the earlier [TrueType](https://en.wikipedia.org/wiki/TrueType) format.
   * The vast majority of modern, scalable, aesthetically-pleasing fonts are delivered in this format.
   * OpenType files typically use one of the following suffixes: .ttf, .ttc, .otf, and .otc.
   * @see [FontFile.createFromTrueTypeFileName]($backend) to work with font files in this format.
   */
  TrueType = 1,
  /** [RSC](https://docs.bentley.com/LiveContent/web/MicroStation%20Help-v27/en/GUID-FC78484C-E42F-30BF-BF68-2B2C025AE040.html) is a simple font format
   * originating in [MicroStation](https://en.wikipedia.org/wiki/MicroStation). In MicroStation, they are defined in "resource files" with a ".rsc" suffix.
   * In iModels, they are encoded in a binary format. Currently, no APIs exist to convert to this binary format, but some [connectors]($docs/learning/imodel-connectors.md) can
   * perform the conversion.
   */
  Rsc = 2,
  /** [SHX](https://help.autodesk.com/view/OARX/2024/ENU/?guid=GUID-DE941DB5-7044-433C-AA68-2A9AE98A5713) is a simple font format originating in
   * [AutoCAD](https://en.wikipedia.org/wiki/AutoCAD). SHX fonts are generally distributed as files with a ".shx" suffix.
   * @see [FontFile.createFromShxFontFileBlob]($backend) to work with font files in this format.
   */
  Shx = 3,
}

/** An unsigned integer uniquely identifying a font family in the context of an [[IModel]].
 * The iModel stores a mapping between `FontId`s and [[FontFamilyDescriptor]]s.
 * [[TextString]]s refer to fonts by the their `FontId`s.
 * @see [IModelDbFonts]($backend) to work with font Ids.
 * @public
 * @extensions
 */
export type FontId = number;

/** Uniquely describes one or more [[FontFace]]s sharing the same name and type.
 * blah blah blah
 * @public
 */
export interface FontFamilyDescriptor {
  type: FontType;
  name: string;
}

/** ###TODO
 * @public
 */
export interface FontProps extends FontFamilyDescriptor {
  id: FontId;
}

export interface FontFace {
  familyName: string;
  isBold: boolean;
  isItalic: boolean;
}

export interface RscFontEncodingProps {
  codePage?: number;
  degree?: number;
  plusMinus?: number;
  diameter?: number;
}

/** The properties of a FontMap
 * @public
 * @extensions
 */
export interface FontMapProps { fonts: FontProps[] }

/**
 * A FontMap holds the set of font names available in an iModel.
 * Within the GeometryStream of an Element, a specific font is referenced by its FontId that is local to the iModel.
 * This class maps FontIds to FontProps.
 * @note The font map is generally established when the iModel is first created to specify the set of fonts available
 * for editors. Adding new entries requires that the schema lock be held.
 * @public
 */
export class FontMap {
  public readonly fonts = new Map<FontId, FontProps>();
  constructor(props?: FontMapProps) {
    if (undefined !== props)
      this.addFonts(props.fonts);
  }
  public addFonts(fonts: FontProps[]) {
    fonts.forEach((font) => this.fonts.set(font.id, font));
  }
  public toJSON(): FontMapProps {
    const fonts: FontProps[] = [];
    this.fonts.forEach((font) => fonts.push(font));
    return { fonts };
  }
  /** look up a font by case insensitive name or number and return its FontProps */
  public getFont(arg: string | FontId): FontProps | undefined {
    if (typeof arg === "number")
      return this.fonts.get(arg);

    for (const font of this.fonts.values())
      if (font.name.toLowerCase() === arg.toLowerCase())
        return font;

    return undefined;
  }
}
