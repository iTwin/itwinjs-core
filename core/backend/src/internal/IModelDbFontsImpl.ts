/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { FontFamilyDescriptor, FontId, FontProps } from "@itwin/core-common";
import { _implementationProhibited } from "./Symbols";
import { FontFile } from "../FontFile";
import { IModelDb } from "../IModelDb";
import { EmbedFontFileArgs, IModelDbFonts } from "../IModelDbFonts";

class IModelDbFontsImpl implements IModelDbFonts {
  public readonly [_implementationProhibited] = undefined;
  private readonly _db: IModelDb;

  public constructor(iModel: IModelDb) {
    this._db = iModel;
  }

  public queryDescriptors(): Iterable<FontFamilyDescriptor> {
    throw new Error("###TODO");
  }

  public queryEmbeddedFamilies(): Iterable<FontProps> {
    throw new Error("###TODO");
  }

  public queryFontFiles(): Iterable<FontFile> {
    throw new Error("###TODO");
  }

  public async embedFontFile(_args: EmbedFontFileArgs): Promise<void> {
    throw new Error("###TODO");
  }

  public findId(_descriptor: FontFamilyDescriptor): FontId | undefined {
    throw new Error("###TODO");
  }

  public findDescriptor(_id: FontId): FontFamilyDescriptor | undefined {
    throw new Error("###TODO");
  }

  public async acquireId(_descriptor: FontFamilyDescriptor): Promise<FontId> {
    throw new Error("###TODO");
  }
}

export function createIModelDbFonts(db: IModelDb): IModelDbFonts {
  return new IModelDbFontsImpl(db);
}
