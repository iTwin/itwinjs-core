/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@itwin/core-bentley";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";

export interface ECClassInfo {
  id: Id64String;
  name: string;
  schemaName: string;
}

export interface ECClassHierarchyInfo extends ECClassInfo {
  baseClasses: ECClassInfo[];
  derivedClasses: ECClassInfo[];
  leafDerivedClasses: ECClassInfo[];
}

export class ECClassHierarchy {
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
  public async getClassInfoById(id: Id64String): Promise<ECClassHierarchyInfo> {
    const info = this._classInfos.get(id)!;
    return {
      ...info,
      baseClasses: this.getAllBaseClassInfos(id),
      derivedClasses: this.getAllDerivedClassInfos(id, false),
      leafDerivedClasses: this.getAllDerivedClassInfos(id, true),
    };
  }
  public async getClassInfo(schemaName: string, className: string): Promise<ECClassHierarchyInfo> {
    const classQuery = `SELECT c.ECInstanceId FROM meta.ECClassDef c JOIN meta.ECSchemaDef s ON s.ECInstanceId = c.Schema.Id WHERE c.Name = ? AND s.Name = ?`;
    const result = await this._imodel.createQueryReader(classQuery, QueryBinder.from([className, schemaName]), { rowFormat: QueryRowFormat.UseJsPropertyNames }).toArray();
    const { id } = result[0];
    return this.getClassInfoById(id);
  }
}
