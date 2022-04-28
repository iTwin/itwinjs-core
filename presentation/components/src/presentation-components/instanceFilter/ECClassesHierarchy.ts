/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@itwin/core-bentley";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import { ClassId } from "@itwin/presentation-common";

export interface ECClassInfo {
  id: Id64String;
  name: string;
  schemaName: string;
}

export interface ECClassHierarchyInfo extends ECClassInfo {
  baseClasses: ECClassInfo[];
  derivedClasses: ECClassInfo[];
}

export class ECClassSet {
  constructor(
    private _id: Id64String,
    private _baseClassIds: Set<Id64String>,
    private _derivedClassIds: Set<Id64String>
  ) {
  }

  public is(classId: Id64String, {isDerived, isBase}: {isDerived?: boolean, isBase?: boolean}) {
    if (classId === this._id)
      return true;

    if (isDerived && this._derivedClassIds.has(classId))
      return true;

    if (isBase && this._baseClassIds.has(classId))
      return true;

    return false;
  }
}

export class ECClassesSet {
  constructor(private _classSets: ECClassSet[]) {}

  public has(classId: Id64String, options: {isDerived?: boolean, isBase?: boolean}) {
    return this._classSets.some((idsSet) => idsSet.is(classId, options));
  }
}

export class ECClassHierarchy {
  private _classSetCache = new Map<Id64String, ECClassSet>();

  private constructor(
    private _imodel: IModelConnection,
    private _classInfos: Map<Id64String, ECClassInfo>,
    private _baseClasses: Map<Id64String, Id64String[]>,
    private _derivedClasses: Map<Id64String, Id64String[]>) {
  }
  public static async create(imodel: IModelConnection) {
    const classInfosMap = new Map();
    const classesQuery =
      `SELECT
        c.ECInstanceId AS ClassId,
        c.Name AS ClassName,
        s.Name AS SchemaName
      FROM
        meta.ECClassDef c
      JOIN
        meta.ECSchemaDef s on s.ECInstanceId = c.Schema.Id
      `;
    for await (const row of imodel.query(classesQuery, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      const { classId, className, schemaName } = row;
      classInfosMap.set(classId, { id: classId, name: className, schemaName });
    }

    const baseClassHierarchy = new Map();
    const derivedClassHierarchy = new Map();
    const hierarchyQuery =
      `SELECT
        h.TargetECInstanceId AS BaseClassId,
        h.SourceECInstanceId AS ClassId
      FROM
        meta.ClassHasBaseClasses h
      `;
    for await (const row of imodel.query(hierarchyQuery, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      const { baseClassId, classId } = row;

      const baseClasses = baseClassHierarchy.get(classId);
      if (baseClasses)
        baseClasses.push(baseClassId);
      else
        baseClassHierarchy.set(classId, [baseClassId]);

      const derivedClasses = derivedClassHierarchy.get(baseClassId);
      if (derivedClasses)
        derivedClasses.push(classId);
      else
        derivedClassHierarchy.set(baseClassId, [classId]);
    }

    return new ECClassHierarchy(imodel, classInfosMap, baseClassHierarchy, derivedClassHierarchy);
  }
  private getAllBaseClassInfos(classId: Id64String) {
    const baseClassIds = this._baseClasses.get(classId) ?? [];
    return baseClassIds.reduce<ECClassInfo[]>((arr, id) => {
      const info = this._classInfos.get(id);
      if (info)
        arr.push(info);
      arr.push(...this.getAllBaseClassInfos(id));
      return arr;
    }, []);
  }
  private getAllBaseClassIds(classId: Id64String): ClassId[] {
    const baseClassIds = this._baseClasses.get(classId) ?? [];
    return baseClassIds.reduce<ClassId[]>((arr, id) => {
      arr.push(id,...this.getAllBaseClassIds(id));
      return arr;
    }, []);
  }

  private getAllDerivedClassInfos(baseClassId: Id64String, onlyLeaf: boolean) {
    const derivedClassIds = this._derivedClasses.get(baseClassId) ?? [];
    return derivedClassIds.reduce<ECClassInfo[]>((arr, id) => {
      const thisInfo = this._classInfos.get(id)!;
      const derivedInfo = this.getAllDerivedClassInfos(id, onlyLeaf);
      if (onlyLeaf && derivedInfo.length === 0 || !onlyLeaf)
        arr.push(thisInfo);
      arr.push(...derivedInfo);
      return arr;
    }, []);
  }
  private getAllDerivedClassIds(baseClassId: Id64String): ClassId[] {
    const derivedClassIds = this._derivedClasses.get(baseClassId) ?? [];
    return derivedClassIds.reduce<ClassId[]>((arr, id) => {
      arr.push(id, ...this.getAllDerivedClassIds(id));
      return arr;
    }, []);
  }

  public getClassInfoById(id: Id64String): ECClassHierarchyInfo {
    const info = this._classInfos.get(id)!;
    return {
      ...info,
      baseClasses: this.getAllBaseClassInfos(id),
      derivedClasses: this.getAllDerivedClassInfos(id, false),
    };
  }

  public getSingleClassIdsSet(id: Id64String) {
    let set = this._classSetCache.get(id);
    if (!set) {
      set = new ECClassSet(id, new Set<Id64String>(this.getAllBaseClassIds(id)), new Set<Id64String>(this.getAllDerivedClassIds(id)));
      this._classSetCache.set(id, set);
    }
    return set;
  }

  public getMultipleClassIdsSet(ids: Id64String[]) {
    return new ECClassesSet(ids.map((id) => this.getSingleClassIdsSet(id)));
  }

  public async getClassInfo(schemaName: string, className: string): Promise<ECClassHierarchyInfo> {
    const classQuery = `SELECT c.ECInstanceId FROM meta.ECClassDef c JOIN meta.ECSchemaDef s ON s.ECInstanceId = c.Schema.Id WHERE c.Name = ? AND s.Name = ?`;
    const result = await this._imodel.createQueryReader(classQuery, QueryBinder.from([className, schemaName]), { rowFormat: QueryRowFormat.UseJsPropertyNames }).toArray();
    const { id } = result[0];
    return this.getClassInfoById(id);
  }
}
