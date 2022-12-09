/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

/** The type of a font.
 * @public
 * @extensions
 */
export enum FontType { TrueType = 1, Rsc = 2, Shx = 3 }

/** An iModel-local identifier for a font.
 * @public
 * @extensions
 */
export type FontId = number;

/** The properties of a Font.
 * @public
 */
export interface FontProps {
  /** the Id, within an iModel, of this font. */
  id: FontId;
  /** The type of font */
  type: FontType;
  /** The name of the font. */
  name: string;
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
  /** look up a font by name or number and return its FontProps */
  public getFont(arg: string | FontId): FontProps | undefined {
    if (typeof arg === "number")
      return this.fonts.get(arg);

    for (const font of this.fonts.values())
      if (font.name === arg)
        return font;

    return undefined;
  }
}
