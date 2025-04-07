/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { FontFamilyDescriptor, FontFamilySelector, FontId, FontProps } from "@itwin/core-common";
import { _implementationProhibited } from "./internal/Symbols.js";
import { FontFile } from "./FontFile.js";

/** Arguments supplied to [[IModelDbFonts.embedFontFile]].
 * @beta
 */
export interface EmbedFontFileArgs {
  /** The file to embed. */
  file: FontFile;
  /** Unless true, [[IModelDbFonts.acquireId]] will be used to ensure that every font family in [[file]] is assigned a [FontId]($common). */
  skipFontIdAllocation?: boolean;
}

/** Arguments supplied to [[IModelDbFonts.queryMappedFamilies]].
 * @beta
 */
export interface QueryMappedFamiliesArgs {
  /** If true, include families that have been assigned a [FontId]($common) but for which no [FontFace]($common)s have been embedded. */
  includeNonEmbedded?: boolean;
}

/** Provides read-write access to the [font-related information]($docs/learning/backend/Fonts.md) stored in an [[IModelDb]].
 * @see [[IModelDb.fonts]] to access the fonts for a specific iModel.
 * @beta
 */
export interface IModelDbFonts {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  /** Obtain the collection of font families that have been assigned a [FontId]($common).
   * By default, font families with no corresponding embedded font faces are omitted.
   */
  queryMappedFamilies(args?: QueryMappedFamiliesArgs): Iterable<FontProps>;

  /** Obtain the collection of [[FontFile]]s embedded in the iModel.
   * A FontFile obtained from one iModel can be embedded into another iModel using [[embedFontFile]], but the source iModel must remain open
   */
  queryEmbeddedFontFiles(): Iterable<FontFile>;

  /** Store a [[FontFile]] in the iModel. By default, this method also ensures a [FontId]($common) is assigned to each font family in the file. */
  embedFontFile(args: EmbedFontFileArgs): Promise<void>;

  /** Returns the Id assigned to the specified font family, or `undefined` if no Id has been assigned.
   * If only a name is supplied instead of a descriptor, and more than one family with the same name but different types exist, then
   * [FontType.TrueType]($common) will be preferred over [FontType.Rsc]($common), and [FontType.Rsc]($common) over [FontType.Shx]($common).
   * @see [[acquireId]] to assign an Id.
   * @see [[findDescriptor]] to perform a reverse lookup.
   */
  findId(selector: FontFamilySelector): FontId | undefined;

  /** Returns the font family associated with the specified Id, or `undefined` if no such mapping exists.
   * @see [[findId]] to perform a reverse lookup.
   */
  findDescriptor(id: FontId): FontFamilyDescriptor | undefined;

  /** Look up the Id assigned to the specified font family, allocating a new Id if one has not already been assigned. */
  acquireId(descriptor: FontFamilyDescriptor): Promise<FontId>;
}
