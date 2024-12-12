/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { DbResult, FontFamilyDescriptor, FontId, FontProps } from "@itwin/core-common";
import { _implementationProhibited, _nativeDb } from "./Symbols";
import { FontFile } from "../FontFile";
import { IModelDb } from "../IModelDb";
import { EmbedFontFileArgs, IModelDbFonts } from "../IModelDbFonts";
import { FontFileImpl } from "./FontFileImpl";
import { assert } from "@itwin/core-bentley";

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

  public queryFontFiles(): Iterable<FontFileImpl> {
    // ###TODO
    return [];
  }

  public async embedFontFile(args: EmbedFontFileArgs): Promise<void> {
    const file = args.file;
    if (!(file instanceof FontFileImpl)) {
      throw new Error("invalid FontFile");
    }

    for (const existing of this.queryFontFiles()) {
      if (existing.key === file.key) {
        // Already embedded - it's a no-op.
        return;
      }
    }

    // ###TODO Add a new CodeService method to reserve (or look up a previously-reserved) Id for
    // this FontFile, if CodeService is configured for the iModel.

    // CodeService not configured - schema lock required to prevent conflicting Ids in be_Prop table.
    await this._db.acquireSchemaLock();
    let id = 0;
    this._db.withSqliteStatement(`SELECT MAX(Id) FROM be_Prop WHERE Namespace="dgn_Font" AND Name="EmbeddedFaceData"`, (stmt) => {
      const result = stmt.step();
      assert(result === DbResult.BE_SQLITE_ROW);
      id = stmt.getValueInteger(0) + 1;
    });
    
    assert(id > 0);
    
    const data = file.getData();
    this._db[_nativeDb].embedFontFile(id, file.faceProps, data, true);

    if (args.dontAllocateFontIds) {
      return;
    }

    // ###TODO allocate font Id for each family in file.
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
