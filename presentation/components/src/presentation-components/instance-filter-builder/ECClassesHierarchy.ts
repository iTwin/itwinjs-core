/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@itwin/core-bentley";
import { QueryRowFormat } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import { ClassId } from "@itwin/presentation-common";

/** @internal */
export class ClassHierarchy {
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

/** @internal */
export class ClassHierarchiesSet {
  constructor(private _classSets: ClassHierarchy[]) {}

  public has(classId: Id64String, options: {isDerived?: boolean, isBase?: boolean}) {
    return this._classSets.some((idsSet) => idsSet.is(classId, options));
  }
}

/** @internal */
export class ECClassHierarchyProvider {
  private _classHierarchyCache = new Map<Id64String, ClassHierarchy>();

  public constructor(
    private _classes: Set<Id64String>,
    private _baseClasses: Map<Id64String, Id64String[]>,
    private _derivedClasses: Map<Id64String, Id64String[]>) {
  }

  /* istanbul ignore next */
  public static async create(imodel: IModelConnection) {
    const classes = new Set<Id64String>();
    const classesQuery =
      `SELECT
        c.ECInstanceId AS ClassId
      FROM
        meta.ECClassDef c
      `;
    for await (const row of imodel.query(classesQuery, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      classes.add(row.classId);
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

    return new ECClassHierarchyProvider(classes, baseClassHierarchy, derivedClassHierarchy);
  }

  private getAllBaseClassIds(classId: Id64String): Id64String[] {
    const baseClassIds = this._baseClasses.get(classId) ?? [];
    return baseClassIds.reduce<Id64String[]>((arr, id) => {
      arr.push(id,...this.getAllBaseClassIds(id));
      return arr;
    }, []);
  }

  private getAllDerivedClassIds(baseClassId: Id64String): ClassId[] {
    const derivedClassIds = this._derivedClasses.get(baseClassId) ?? [];
    return derivedClassIds.reduce<Id64String[]>((arr, id) => {
      arr.push(id, ...this.getAllDerivedClassIds(id));
      return arr;
    }, []);
  }

  public getClassHierarchy(id: Id64String) {
    let set = this._classHierarchyCache.get(id);
    if (!set) {
      set = this._classes.has(id)
        ? new ClassHierarchy(id, new Set<Id64String>(this.getAllBaseClassIds(id)), new Set<Id64String>(this.getAllDerivedClassIds(id)))
        : /* istanbul ignore next */ new ClassHierarchy(id, new Set(), new Set());
      this._classHierarchyCache.set(id, set);
    }
    return set;
  }

  public getClassHierarchiesSet(ids: Id64String[]) {
    return new ClassHierarchiesSet(ids.map((id) => this.getClassHierarchy(id)));
  }
}
