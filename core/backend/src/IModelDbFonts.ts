/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { FontFamilyDescriptor, FontId, FontProps } from "@itwin/core-common";
import { _implementationProhibited } from "./internal/Symbols";
import { FontFile } from "./FontFile";

export interface EmbedFontFileArgs {
  file: FontFile;
  dontAllocateFontIds?: boolean;
}

export interface IModelDbFonts {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  queryDescriptors(): Iterable<FontFamilyDescriptor>;

  queryMappedEmbeddedFamilies(): Iterable<FontProps>;

  queryEmbeddedFontFiles(): Iterable<FontFile>;

  embedFontFile(args: EmbedFontFileArgs): Promise<void>;

  findId(descriptor: FontFamilyDescriptor): FontId | undefined;

  findDescriptor(id: FontId): FontFamilyDescriptor | undefined;

  acquireId(descriptor: FontFamilyDescriptor): Promise<FontId>;
}
