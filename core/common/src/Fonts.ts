/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

/** The [FontFile]($backend) encodings understood by iTwin.js.
 * @see [this article]($docs/learning/backend/Fonts.md) to learn more about fonts in iModels.
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

/** An unsigned integer uniquely identifying a [font family]($docs/learning/backend/Fonts.md) in the context of an [[IModel]].
 * The iModel stores a mapping between `FontId`s and [[FontFamilyDescriptor]]s.
 * [[TextString]]s refer to fonts by the their `FontId`s.
 * A font Id of zero represents an invalid/non-existent font.
 * @see [IModelDbFonts]($backend) to work with font Ids.
 * @public
 * @extensions
 */
export type FontId = number;

/** Uniquely describes one or more [[FontFace]]s sharing the same name and type comprising a single [font family]($docs/learning/backend/Fonts.md).
 * @public
 */
export interface FontFamilyDescriptor {
  /** The encoding in which the font family's faces are stored. */
  type: FontType;
  /** The name of the family. */
  name: string;
}

/** A [[FontFamilyDescriptor]] in which the [[FontType]] is optional, used when querying [[FontId]]s via [IModelDbFonts.findId]($backend).
 * If a font type is provided, this selector exactly identifies a unique font family, just like [[FontFamilyDescriptor]] does.
 * If the type is omitted, then the selector refers to the first font family that matches the specified [[name]]. If multiple families
 * with the same name exist, then a TrueType font will be preferred over a RSC font, and a RSC font preferred over an SHX font.
 * @beta
 */
export interface FontFamilySelector {
  /** The encoding in which the font family's faces are stored. */
  type?: FontType;
  /** The name of the family. */
  name: string;
}

/** Represents a [[FontFamilyDescriptor]] stored in an iModel with a unique numeric Id.
 * @public
 */
export interface FontProps extends FontFamilyDescriptor {
  /** An integer that uniquely identifies this font family in the context of the iModel in which it is stored. */
  id: FontId;
}

/** A specific variation of the glyphs defined by a [font family]($docs/learning/backend/Fonts.md).
 * Each face can be italicized, bolded, both, or neither.
 * Font faces are stored in [FontFile]($backend)s.
 * @beta
 */
export interface FontFace {
  /** The name of the font family to which this face belongs. */
  familyName: string;
  isBold: boolean;
  isItalic: boolean;
}

/** Information about the encoding of a [[FontType.Rsc]] [FontFile]($backend), used when embedding such a font into an iModel.
 * Currently, no public APIs exist to create such fonts.
 * @alpha
 */
export interface RscFontEncodingProps {
  codePage?: number;
  degree?: number;
  plusMinus?: number;
  diameter?: number;
}

/** The properties of a FontMap
 * @public
 * @extensions
 * @deprecated in 5.0.0. Use [IModelDb.fonts]($backend)
 */
export interface FontMapProps { fonts: FontProps[] }

/**
 * A FontMap holds the set of font names available in an iModel.
 * Within the GeometryStream of an Element, a specific font is referenced by its FontId that is local to the iModel.
 * This class maps FontIds to FontProps.
 * @note This API has never worked properly. Don't use it. Use [IModelDb.fonts]($backend) instead.
 * @public
 * @deprecated in 5.0.0. Use [IModelDb.fonts]($backend) instead.
 */
export class FontMap {
  public readonly fonts = new Map<FontId, FontProps>();
  constructor(props?: FontMapProps) { // eslint-disable-line @typescript-eslint/no-deprecated
    if (undefined !== props)
      this.addFonts(props.fonts);
  }
  public addFonts(fonts: FontProps[]) {
    fonts.forEach((font) => this.fonts.set(font.id, font));
  }
  public toJSON(): FontMapProps { // eslint-disable-line @typescript-eslint/no-deprecated
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
