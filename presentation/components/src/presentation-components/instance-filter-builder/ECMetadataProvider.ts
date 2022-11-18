/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { compareStrings, Id64, Id64String, LRUDictionary } from "@itwin/core-bentley";
import { QueryBinder, QueryOptions, QueryRowFormat } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";

// istanbul ignore file

/** @internal */
export class ECClassInfo {
  constructor(
    public readonly id: Id64String,
    public readonly name: string,
    public readonly label: string,
    private _baseClasses: Set<Id64String>,
    private _derivedClasses: Set<Id64String>,
  ) {
  }

  public get baseClassIds(): Array<Id64String> { return Array.from(this._baseClasses); }
  public get derivedClassIds(): Array<Id64String> { return Array.from(this._derivedClasses); }

  public isBaseOf(idOrInfo: Id64String | ECClassInfo): boolean {
    if (typeof idOrInfo === "string")
      return idOrInfo === this.id || this._derivedClasses.has(idOrInfo);
    return idOrInfo.id === this.id || this._derivedClasses.has(idOrInfo.id);
  }

  public isDerivedFrom(idOrInfo: Id64String | ECClassInfo): boolean {
    if (typeof idOrInfo === "string")
      return idOrInfo === this.id || this._baseClasses.has(idOrInfo);
    return idOrInfo.id === this.id || this._baseClasses.has(idOrInfo.id);
  }
}

/** @internal */
export class ECMetadataProvider {
  private _classInfoCache = new LRUDictionary<CacheKey, ECClassInfo>(50, compareKeys);

  constructor(private _queryRunner: (ecsql: string, params?: QueryBinder, options?: QueryOptions) => AsyncIterableIterator<any>) {
  }

  public async getECClassInfo(idOrFullName: Id64String | string): Promise<ECClassInfo | undefined>;
  public async getECClassInfo(schemaName: string, className: string): Promise<ECClassInfo | undefined>;
  public async getECClassInfo(idNameOrSchema: Id64String | string, className?: string): Promise<ECClassInfo | undefined> {
    // load class info using class id
    if (Id64.isId64(idNameOrSchema)) {
      return this.getClassInfoById(idNameOrSchema);
    }

    // load class info using class full name: <schemaName>:<className>
    const fullName = className ? `${idNameOrSchema}:${className}` : idNameOrSchema;
    return this.getClassInfoByFullName(fullName);
  }

  private async getClassInfoById(id: Id64String): Promise<ECClassInfo | undefined> {
    let classInfo = this._classInfoCache.get({ id, name: "" });
    if (!classInfo) {
      const classQuery = `
        ${classQueryBase}
        WHERE classDef.ECInstanceId = :id
      `;
      classInfo = await this.createECClassInfo(this._queryRunner(classQuery, QueryBinder.from({ id }), { rowFormat: QueryRowFormat.UseJsPropertyNames }));
      classInfo && this._classInfoCache.set({ id: classInfo.id, name: classInfo.name }, classInfo);
    }
    return classInfo;
  }

  private async getClassInfoByFullName(name: string): Promise<ECClassInfo | undefined> {
    let classInfo = this._classInfoCache.get({ id: "", name });
    if (!classInfo) {
      const classQuery = `
        ${classQueryBase}
        WHERE classDef.Name = :className AND schemaDef.Name = :schemaName
      `;
      const [schemaName, className] = this.splitFullClassName(name);
      classInfo = await this.createECClassInfo(this._queryRunner(classQuery, QueryBinder.from({ schemaName, className }), { rowFormat: QueryRowFormat.UseJsPropertyNames }));
      classInfo && this._classInfoCache.set({ id: classInfo.id, name: classInfo.name }, classInfo);
    }
    return classInfo;
  }

  private async createECClassInfo(rowsIterator: AsyncIterableIterator<any>) {
    for await (const row of rowsIterator) {
      const classHierarchy = await this.queryClassHierarchyInfo(row.id);
      return new ECClassInfo(row.id, row.name, row.label, classHierarchy.baseClasses, classHierarchy.derivedClasses);
    }
    return undefined;
  }

  private async queryClassHierarchyInfo(id: Id64String): Promise<{ baseClasses: Set<Id64String>, derivedClasses: Set<Id64String> }> {
    const classHierarchyQuery = `
      SELECT chc.TargetECInstanceId baseId, chc.SourceECInstanceId derivedId
      FROM meta.ClassHasAllBaseClasses chc
      WHERE chc.SourceECInstanceId = :id OR chc.TargetECInstanceId = :id
    `;

    const hierarchy = { baseClasses: new Set<Id64String>(), derivedClasses: new Set<Id64String>() };
    for await (const row of this._queryRunner(classHierarchyQuery, QueryBinder.from({ id }), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      if (row.baseId === id)
        hierarchy.derivedClasses.add(row.derivedId);
      if (row.derivedId === id)
        hierarchy.baseClasses.add(row.baseId);
    }
    return hierarchy;
  }

  private splitFullClassName(fullName: string): [string, string] {
    const [schemaName, className] = fullName.split(fullName.includes(".") ? "." : ":");
    return [schemaName, className];
  }
}

const classQueryBase = `
  SELECT classDef.ECInstanceId id, (schemaDef.Name || ':' || classDef.Name) name, COALESCE(classDef.DisplayLabel, classDef.name) label
  FROM meta.ECClassDef classDef
  JOIN meta.ECSChemaDef schemaDef ON classDef.Schema.Id = schemaDef.ECInstanceId
`;

const metadataProviders = new Map<string, ECMetadataProvider>();
/** @internal */
export function getImodelMetadataProvider(imodel: IModelConnection) {
  let metadataProvider = metadataProviders.get(imodel.key);
  if (!metadataProvider) {
    metadataProvider = new ECMetadataProvider(imodel.query.bind(imodel));
    metadataProviders.set(imodel.key, metadataProvider);
    // istanbul ignore next
    imodel.onClose.addOnce(() => {
      metadataProviders.delete(imodel.key);
    });
  }
  return metadataProvider;
}

interface CacheKey {
  id: Id64String;
  name: string;
}

function compareKeys(lhs: CacheKey, rhs: CacheKey) {
  if (lhs.id.length !== 0 && rhs.id.length !== 0) {
    return compareStrings(lhs.id, rhs.id);
  }
  return compareStrings(lhs.name, rhs.name);
}
