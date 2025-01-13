/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { GeometricElement, GeometricElement3d, IModelDb } from "@itwin/core-backend";
import { DbResult, Id64, Id64String } from "@itwin/core-bentley";
import {
  ComputeSelectionRequestOptions,
  ElementSelectionScopeProps,
  InstanceKey,
  isComputeSelectionRequestOptions,
  KeySet,
  PresentationError,
  PresentationStatus,
  SelectionScope,
  SelectionScopeRequestOptions,
} from "@itwin/presentation-common";
import { getElementKey } from "./Utils";

/**
 * Contains helper methods for computing selection scopes. Will get removed
 * once rules-driven scopes are implemented.
 *
 * @internal
 */
export class SelectionScopesHelper {
  // istanbul ignore next
  private constructor() {}

  public static getSelectionScopes(): SelectionScope[] {
    const createSelectionScope = (scopeId: string, label: string, description: string): SelectionScope => ({
      id: scopeId,
      label,
      description,
    });
    return [
      createSelectionScope("element", "Element", "Select the picked element"),
      createSelectionScope("assembly", "Assembly", "Select parent of the picked element"),
      createSelectionScope("top-assembly", "Top Assembly", "Select the topmost parent of the picked element"),
      // WIP: temporarily comment-out "category" and "model" scopes since we can't hilite contents of them fast enough
      // createSelectionScope("category", "Category", "Select all elements in the picked element's category"),
      // createSelectionScope("model", "Model", "Select all elements in the picked element's model"),
    ];
  }

  private static getElementKey(iModel: IModelDb, elementId: Id64String, ancestorLevel: number) {
    let currId = elementId;
    let parentId = iModel.elements.tryGetElementProps(currId)?.parent?.id;
    while (parentId && ancestorLevel !== 0) {
      currId = parentId;
      parentId = iModel.elements.tryGetElementProps(currId)?.parent?.id;
      --ancestorLevel;
    }
    return getElementKey(iModel, currId);
  }

  private static computeElementSelection(iModel: IModelDb, elementIds: Id64String[], ancestorLevel: number) {
    const parentKeys = new KeySet();
    elementIds.forEach(
      skipTransients((id) => {
        const key = this.getElementKey(iModel, id, ancestorLevel);
        key && parentKeys.add(key);
      }),
    );
    return parentKeys;
  }

  private static computeCategorySelection(iModel: IModelDb, ids: Id64String[]) {
    const categoryKeys = new KeySet();
    ids.forEach(
      skipTransients((id) => {
        const el = iModel.elements.tryGetElement(id);
        if (el instanceof GeometricElement) {
          const category = iModel.elements.tryGetElementProps(el.category);
          if (category) {
            categoryKeys.add({ className: category.classFullName, id: category.id! });
          }
        }
      }),
    );
    return categoryKeys;
  }

  private static computeModelSelection(iModel: IModelDb, ids: Id64String[]) {
    const modelKeys = new KeySet();
    ids.forEach(
      skipTransients((id) => {
        const el = iModel.elements.tryGetElementProps(id);
        const model = el ? iModel.models.tryGetModelProps(el.model) : undefined;
        if (model) {
          modelKeys.add({ className: model.classFullName, id: model.id! });
        }
      }),
    );
    return modelKeys;
  }

  private static getRelatedFunctionalElementKey(imodel: IModelDb, graphicalElementId: Id64String): InstanceKey | undefined {
    const query = `
      SELECT funcSchemaDef.Name || '.' || funcClassDef.Name funcElClassName, fe.ECInstanceId funcElId
        FROM bis.Element e
        LEFT JOIN func.PhysicalElementFulfillsFunction rel1 ON rel1.SourceECInstanceId = e.ECInstanceId
        LEFT JOIN func.DrawingGraphicRepresentsFunctionalElement rel2 ON rel2.SourceECInstanceId = e.ECInstanceId
        LEFT JOIN func.FunctionalElement fe ON fe.ECInstanceId IN (rel1.TargetECInstanceId, rel2.TargetECInstanceId)
        INNER JOIN meta.ECClassDef funcClassDef ON funcClassDef.ECInstanceId = fe.ECClassId
        INNER JOIN meta.ECSchemaDef funcSchemaDef ON funcSchemaDef.ECInstanceId = funcClassDef.Schema.Id
       WHERE e.ECInstanceId = ?
      `;
    return imodel.withPreparedStatement(query, (stmt): InstanceKey | undefined => {
      stmt.bindId(1, graphicalElementId);
      // istanbul ignore else
      if (DbResult.BE_SQLITE_ROW === stmt.step()) {
        const row = stmt.getRow();
        if (row.funcElClassName && row.funcElId) {
          return { className: row.funcElClassName.replace(".", ":"), id: row.funcElId };
        }
      }
      return undefined;
    });
  }

  private static findFirstRelatedFunctionalElementKey(imodel: IModelDb, graphicalElementId: Id64String): InstanceKey | undefined {
    let currId: Id64String | undefined = graphicalElementId;
    while (currId) {
      const relatedFunctionalKey = this.getRelatedFunctionalElementKey(imodel, currId);
      if (relatedFunctionalKey) {
        return relatedFunctionalKey;
      }
      currId = imodel.elements.tryGetElementProps(currId)?.parent?.id;
    }
    return undefined;
  }

  private static elementClassDerivesFrom(imodel: IModelDb, elementId: Id64String, baseClassFullName: string): boolean {
    const query = `
      SELECT 1
      FROM bis.Element e
      INNER JOIN meta.ClassHasAllBaseClasses baseClassRels ON baseClassRels.SourceECInstanceId = e.ECClassId
      INNER JOIN meta.ECClassDef baseClass ON baseClass.ECInstanceId = baseClassRels.TargetECInstanceId
      INNER JOIN meta.ECSchemaDef baseSchema ON baseSchema.ECInstanceId = baseClass.Schema.Id
      WHERE e.ECInstanceId = ? AND (baseSchema.Name || ':' || baseClass.Name) = ?
      `;
    return imodel.withPreparedStatement(query, (stmt): boolean => {
      stmt.bindId(1, elementId);
      stmt.bindString(2, baseClassFullName);
      return DbResult.BE_SQLITE_ROW === stmt.step();
    });
  }

  private static computeFunctionalElementSelection(iModel: IModelDb, ids: Id64String[]) {
    const keys = new KeySet();
    ids.forEach(
      skipTransients((id): void => {
        const is3d = this.elementClassDerivesFrom(iModel, id, GeometricElement3d.classFullName);
        if (!is3d) {
          // if the input is not a 3d element, we try to find the first related functional element
          const firstFunctionalKey = this.findFirstRelatedFunctionalElementKey(iModel, id);
          if (firstFunctionalKey) {
            keys.add(firstFunctionalKey);
            return;
          }
        }
        let keyToAdd: InstanceKey | undefined;
        if (is3d) {
          // if we're computing scope for a 3d element, try to switch to its related functional element
          keyToAdd = this.getRelatedFunctionalElementKey(iModel, id);
        }
        if (!keyToAdd) {
          keyToAdd = getElementKey(iModel, id);
        }
        keyToAdd && keys.add(keyToAdd);
      }),
    );
    return keys;
  }

  private static computeFunctionalAssemblySelection(iModel: IModelDb, ids: Id64String[]) {
    const keys = new KeySet();
    ids.forEach(
      skipTransients((id): void => {
        let idToGetAssemblyFor = id;
        const is3d = this.elementClassDerivesFrom(iModel, id, GeometricElement3d.classFullName);
        if (!is3d) {
          // if the input is not a 3d element, we try to find the first related functional element
          const firstFunctionalKey = this.findFirstRelatedFunctionalElementKey(iModel, id);
          if (firstFunctionalKey) {
            idToGetAssemblyFor = firstFunctionalKey.id;
          }
        }
        // find the assembly of either the given element or the functional element
        const assemblyKey = this.getElementKey(iModel, idToGetAssemblyFor, 1);
        let keyToAdd = assemblyKey;
        if (is3d && keyToAdd) {
          // if we're computing scope for a 3d element, try to switch to its related functional element
          const relatedFunctionalKey = this.getRelatedFunctionalElementKey(iModel, keyToAdd.id);
          if (relatedFunctionalKey) {
            keyToAdd = relatedFunctionalKey;
          }
        }
        keyToAdd && keys.add(keyToAdd);
      }),
    );
    return keys;
  }

  private static computeFunctionalTopAssemblySelection(iModel: IModelDb, ids: Id64String[]) {
    const keys = new KeySet();
    ids.forEach(
      skipTransients((id): void => {
        let idToGetAssemblyFor = id;
        const is3d = this.elementClassDerivesFrom(iModel, id, GeometricElement3d.classFullName);
        if (!is3d) {
          // if the input is not a 3d element, we try to find the first related functional element
          const firstFunctionalKey = this.findFirstRelatedFunctionalElementKey(iModel, id);
          if (firstFunctionalKey) {
            idToGetAssemblyFor = firstFunctionalKey.id;
          }
        }
        // find the top assembly of either the given element or the functional element
        const topAssemblyKey = this.getElementKey(iModel, idToGetAssemblyFor, Number.MAX_SAFE_INTEGER);
        let keyToAdd = topAssemblyKey;
        if (is3d && keyToAdd) {
          // if we're computing scope for a 3d element, try to switch to its related functional element
          const relatedFunctionalKey = this.getRelatedFunctionalElementKey(iModel, keyToAdd.id);
          if (relatedFunctionalKey) {
            keyToAdd = relatedFunctionalKey;
          }
        }
        keyToAdd && keys.add(keyToAdd);
      }),
    );
    return keys;
  }

  public static async computeSelection(requestOptions: SelectionScopeRequestOptions<IModelDb>, ids: Id64String[], scopeId: string): Promise<KeySet>;
  public static async computeSelection(requestOptions: ComputeSelectionRequestOptions<IModelDb>): Promise<KeySet>;
  public static async computeSelection(
    requestOptions: ComputeSelectionRequestOptions<IModelDb> | SelectionScopeRequestOptions<IModelDb>,
    elementIds?: Id64String[],
    scopeId?: string,
  ): Promise<KeySet> {
    if (!isComputeSelectionRequestOptions(requestOptions)) {
      return this.computeSelection({
        ...requestOptions,
        elementIds: elementIds!,
        scope: { id: scopeId! },
      });
    }

    switch (requestOptions.scope.id) {
      case "element":
        return this.computeElementSelection(
          requestOptions.imodel,
          requestOptions.elementIds,
          (requestOptions.scope as ElementSelectionScopeProps).ancestorLevel ?? 0,
        );
      case "assembly":
        return this.computeElementSelection(requestOptions.imodel, requestOptions.elementIds, 1);
      case "top-assembly":
        return this.computeElementSelection(requestOptions.imodel, requestOptions.elementIds, Number.MAX_SAFE_INTEGER);
      case "category":
        return this.computeCategorySelection(requestOptions.imodel, requestOptions.elementIds);
      case "model":
        return this.computeModelSelection(requestOptions.imodel, requestOptions.elementIds);
      case "functional":
      case "functional-element":
        return this.computeFunctionalElementSelection(requestOptions.imodel, requestOptions.elementIds);
      case "functional-assembly":
        return this.computeFunctionalAssemblySelection(requestOptions.imodel, requestOptions.elementIds);
      case "functional-top-assembly":
        return this.computeFunctionalTopAssemblySelection(requestOptions.imodel, requestOptions.elementIds);
    }
    throw new PresentationError(PresentationStatus.InvalidArgument, "scopeId");
  }
}

const skipTransients = (callback: (id: Id64String) => void) => {
  return (id: Id64String) => {
    if (!Id64.isTransient(id)) {
      callback(id);
    }
  };
};
