/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { DbResult, FontFamilyDescriptor, FontId, FontProps, FontType } from "@itwin/core-common";
import { _faceProps, _getData, _key, _implementationProhibited, _nativeDb } from "./Symbols";
import { IModelDb } from "../IModelDb";
import { EmbedFontFileArgs, IModelDbFonts } from "../IModelDbFonts";
import { EmbeddedFontFile } from "./FontFileImpl";
import { assert } from "@itwin/core-bentley";
import type { IModelJsNative } from "@bentley/imodeljs-native";
import { FontFile } from "../FontFile";

class IModelDbFontsImpl implements IModelDbFonts {
  public readonly [_implementationProhibited] = undefined;
  readonly #db: IModelDb;

  public constructor(iModel: IModelDb) {
    this.#db = iModel;
  }

  public queryDescriptors(): Iterable<FontFamilyDescriptor> {
    return this.#queryFontTable().filter((x) => { return { name: x.name, type: x.type } });
  }

  public queryMappedEmbeddedFamilies(): Iterable<FontProps> {
    const fontProps = this.#queryFontTable();
    const fontNames = this.#getEmbeddedFontNames();
    return fontProps.filter((x) => fontNames.includes(x.name));
  }

  public queryEmbeddedFontFiles(): Iterable<FontFile> {
    let files: FontFile[] = [];
    this.#db.withSqliteStatement(`SELECT Id,StrData FROM be_Prop WHERE Namespace="dgn_Font" AND Name="EmbeddedFaceData"`, (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        let faces;
        try {
          faces = JSON.parse(stmt.getValueString(1)) as IModelJsNative.FontFaceProps[];
        } catch (_) {
          //
        }

        if (!Array.isArray(faces) || faces.length === 0) {
          continue;
        }

        let type = faces[0].type;
        if (type !== FontType.Rsc && type !== FontType.Shx) {
          type = FontType.TrueType;
        }

        files.push(new EmbeddedFontFile(this.#db, stmt.getValueInteger(0), type, faces));
      }
    });

    return files;
  }

  public async embedFontFile(args: EmbedFontFileArgs): Promise<void> {
    this.#requireWritable();

    if (!args.file.isEmbeddable) {
      throw new Error("Font does not permit embedding");
    }

    const file = args.file;
    for (const existing of this.queryEmbeddedFontFiles()) {
      if (existing[_key] === file[_key]) {
        // Already embedded - it's a no-op.
        return;
      }
    }

    let id = 0;
    if (false) {
    // ###TODO Add a new CodeService method to reserve (or look up a previously-reserved) Id for
    // this FontFile, if CodeService is configured for the iModel.
    } else {
      // CodeService not configured - schema lock required to prevent conflicting Ids in be_Prop table.
      await this.#db.acquireSchemaLock();
      const sql = `SELECT MAX(Id) FROM be_Prop WHERE Namespace="dgn_Font" AND Name="EmbeddedFaceData"`;
      id = this.#db.withSqliteStatement(sql, (stmt) => stmt.nextRow() ? stmt.getValueInteger(0) + 1 : 1);
    }
    
    assert(id > 0);
    const data = file[_getData]();
    this.#db[_nativeDb].embedFontFile(id, file[_faceProps], data, true);

    if (args.dontAllocateFontIds) {
      return;
    }

    const familyNames = new Set<string>(args.file.faces.map((x) => x.familyName));
    const acquireIds = Array.from(familyNames).map((x) => this.#acquireId({ name: x, type: args.file.type }, true).catch());
    await Promise.allSettled(acquireIds);
  }

  public findId(descriptor: FontFamilyDescriptor): FontId | undefined {
    let id;
    this.#db.withPreparedSqliteStatement("SELECT Id FROM dgn_Font WHERE Name=? AND Type=?", (stmt) => {
      stmt.bindString(1, descriptor.name);
      stmt.bindInteger(2, descriptor.type);
      if (DbResult.BE_SQLITE_ROW === stmt.step()) {
        id = stmt.getValueInteger(0);
      }
    });

    return id;
  }

  public findDescriptor(id: FontId): FontFamilyDescriptor | undefined {
    let name, type;
    this.#db.withPreparedSqliteStatement("SELECT Name,Type FROM dgn_Font WHERE Id=?", (stmt) => {
      stmt.bindInteger(1, id);
      if (DbResult.BE_SQLITE_ROW === stmt.step()) {
        const stmtName = stmt.getValueString(0);
        if (stmtName.length > 0) {
          name = stmtName;
          const typeCode = stmt.getValueInteger(1);
          type = (typeCode === FontType.Shx || typeCode === FontType.Rsc) ? typeCode : FontType.TrueType;
        }
      }
    });

    return undefined !== name && undefined !== type ? { name, type } : undefined;
  }

  public async acquireId(descriptor: FontFamilyDescriptor): Promise<FontId> {
    this.#requireWritable();
    return this.#acquireId(descriptor, false);
  }

  async #acquireId(descriptor: FontFamilyDescriptor, embeddingFaceData: boolean): Promise<FontId> {
    let id = this.findId(descriptor);
    if (undefined !== id) {
      return id;
    }

    const codes = this.#db.codeService?.internalCodes;
    if (codes) {
      id = await codes.writeLocker.reserveFontId({ fontName: descriptor.name, fontType: descriptor.type });
    } else {
      // If we're being called from `embedFontFile` then the schema lock is already held, don't bother re-acquiring it.
      if (!embeddingFaceData) {
        // No CodeService configured. We must obtain the schema lock and use the next available Id.
        await this.#db.acquireSchemaLock();
      }
      
      id = this.#db.withSqliteStatement(`SELECT MAX(Id) FROM dgn_Font`, (stmt) => stmt.nextRow() ? stmt.getValueInteger(0) + 1 : 1);
    }

    this.#db.withSqliteStatement(`INSERT INTO dgn_Font (Id,Type,Name) VALUES (?,?,?)`, (stmt) => {
      stmt.bindInteger(1, id);
      stmt.bindInteger(2, descriptor.type);
      stmt.bindString(3, descriptor.name);

      if (DbResult.BE_SQLITE_DONE !== stmt.step()) {
        throw new Error("Failed to insert font Id mapping");
      }
    });

    return id;
  }

  #requireWritable(): void {
    if (this.#db.isReadonly) {
      throw new Error("iModel is read-only");
    }
  }

  #getEmbeddedFontNames(): string[] {
    const names: string[] = [];

    const sql = `select DISTINCT json_extract(face.value, '$.familyName') from be_Prop, json_each(be_Prop.StrData) as face where namespace="dgn_Font" and name="EmbeddedFaceData"`;
    this.#db.withPreparedSqliteStatement(sql, (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        names.push(stmt.getValueString(0));
      }
    });

    return names;
  }

  #queryFontTable(): Array<FontProps> {
    const fonts: FontProps[] = [];
    const sql = `SELECT Id,Name,Type FROM dgn_Font`;
    this.#db.withPreparedSqliteStatement(sql, (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        const name = stmt.getValueString(1);
        const typeCode = stmt.getValueInteger(2);
        const type = (typeCode === FontType.Shx || typeCode === FontType.Rsc) ? typeCode : FontType.TrueType;
        if (name.length > 0) {
          fonts.push({
            name,
            type,
            id: stmt.getValueInteger(0),
          });
        }
      }
    });

    return fonts;
  }
}

export function createIModelDbFonts(db: IModelDb): IModelDbFonts {
  return new IModelDbFontsImpl(db);
}
