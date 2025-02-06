/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { GeometricElement, IModelDb } from "@itwin/core-backend";
import { Id64, Id64Array, Id64String } from "@itwin/core-bentley";
import { QueryBinder } from "@itwin/core-common";
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

  private static async computeElementSelection(iModel: IModelDb, elementIds: Id64String[], ancestorLevel: number) {
    const parentKeys = new KeySet();
    await forEachNonTransientId(elementIds, async (id) => {
      const key = this.getElementKey(iModel, id, ancestorLevel);
      key && parentKeys.add(key);
    });
    return parentKeys;
  }

  private static async computeCategorySelection(iModel: IModelDb, ids: Id64String[]) {
    const categoryKeys = new KeySet();
    await forEachNonTransientId(ids, async (id) => {
      const el = iModel.elements.tryGetElement<GeometricElement>(id);
      const category = el?.category ? iModel.elements.tryGetElementProps(el.category) : undefined;
      if (category) {
        categoryKeys.add({ className: category.classFullName, id: category.id! });
      }
    });
    return categoryKeys;
  }

  private static async computeModelSelection(iModel: IModelDb, ids: Id64String[]) {
    const modelKeys = new KeySet();
    await forEachNonTransientId(ids, async (id) => {
      const el = iModel.elements.tryGetElementProps(id);
      const model = el ? iModel.models.tryGetModelProps(el.model) : undefined;
      if (model) {
        modelKeys.add({ className: model.classFullName, id: model.id! });
      }
    });
    return modelKeys;
  }

  private static async getRelatedFunctionalElementKey(imodel: IModelDb, graphicalElementId: Id64String): Promise<InstanceKey | undefined> {
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

    const bindings = new QueryBinder();
    bindings.bindId(1, graphicalElementId);

    for await (const row of imodel.createQueryReader(query, bindings)) {
      if (row.funcElClassName && row.funcElId) {
        return { className: row.funcElClassName.replace(".", ":"), id: row.funcElId };
      }
    }
    return undefined;
  }

  private static async findFirstRelatedFunctionalElementKey(imodel: IModelDb, graphicalElementId: Id64String): Promise<InstanceKey | undefined> {
    let currId: Id64String | undefined = graphicalElementId;
    while (currId) {
      const relatedFunctionalKey = await this.getRelatedFunctionalElementKey(imodel, currId);
      if (relatedFunctionalKey) {
        return relatedFunctionalKey;
      }
      currId = imodel.elements.tryGetElementProps(currId)?.parent?.id;
    }
    return undefined;
  }

  private static async elementClassDerivesFrom(imodel: IModelDb, elementId: Id64String, baseClassFullName: string): Promise<boolean> {
    const query = `
      SELECT 1
      FROM bis.Element e
      INNER JOIN meta.ClassHasAllBaseClasses baseClassRels ON baseClassRels.SourceECInstanceId = e.ECClassId
      INNER JOIN meta.ECClassDef baseClass ON baseClass.ECInstanceId = baseClassRels.TargetECInstanceId
      INNER JOIN meta.ECSchemaDef baseSchema ON baseSchema.ECInstanceId = baseClass.Schema.Id
      WHERE e.ECInstanceId = ? AND (baseSchema.Name || ':' || baseClass.Name) = ?
    `;

    const bindings = new QueryBinder();
    bindings.bindId(1, elementId);
    bindings.bindString(2, baseClassFullName);

    for await (const _ of imodel.createQueryReader(query, bindings)) {
      return true;
    }
    return false;
  }

  private static async computeFunctionalElementSelection(iModel: IModelDb, ids: Id64String[]) {
    const keys = new KeySet();
    await forEachNonTransientId(ids, async (id) => {
      const is3d = await this.elementClassDerivesFrom(iModel, id, "BisCore.GeometricElement3d");
      if (!is3d) {
        // if the input is not a 3d element, we try to find the first related functional element
        const firstFunctionalKey = await this.findFirstRelatedFunctionalElementKey(iModel, id);
        if (firstFunctionalKey) {
          keys.add(firstFunctionalKey);
          return;
        }
      }
      let keyToAdd: InstanceKey | undefined;
      if (is3d) {
        // if we're computing scope for a 3d element, try to switch to its related functional element
        keyToAdd = await this.getRelatedFunctionalElementKey(iModel, id);
      }
      if (!keyToAdd) {
        keyToAdd = getElementKey(iModel, id);
      }
      keyToAdd && keys.add(keyToAdd);
    });
    return keys;
  }

  private static async computeFunctionalAssemblySelection(iModel: IModelDb, ids: Id64String[]) {
    const keys = new KeySet();
    await forEachNonTransientId(ids, async (id) => {
      let idToGetAssemblyFor = id;
      const is3d = await this.elementClassDerivesFrom(iModel, id, "BisCore.GeometricElement3d");
      if (!is3d) {
        // if the input is not a 3d element, we try to find the first related functional element
        const firstFunctionalKey = await this.findFirstRelatedFunctionalElementKey(iModel, id);
        if (firstFunctionalKey) {
          idToGetAssemblyFor = firstFunctionalKey.id;
        }
      }
      // find the assembly of either the given element or the functional element
      const assemblyKey = this.getElementKey(iModel, idToGetAssemblyFor, 1);
      let keyToAdd = assemblyKey;
      if (is3d && keyToAdd) {
        // if we're computing scope for a 3d element, try to switch to its related functional element
        const relatedFunctionalKey = await this.getRelatedFunctionalElementKey(iModel, keyToAdd.id);
        if (relatedFunctionalKey) {
          keyToAdd = relatedFunctionalKey;
        }
      }
      keyToAdd && keys.add(keyToAdd);
    });
    return keys;
  }

  private static async computeFunctionalTopAssemblySelection(iModel: IModelDb, ids: Id64String[]) {
    const keys = new KeySet();
    await forEachNonTransientId(ids, async (id) => {
      let idToGetAssemblyFor = id;
      const is3d = await this.elementClassDerivesFrom(iModel, id, "BisCore.GeometricElement3d");
      if (!is3d) {
        // if the input is not a 3d element, we try to find the first related functional element
        const firstFunctionalKey = await this.findFirstRelatedFunctionalElementKey(iModel, id);
        if (firstFunctionalKey) {
          idToGetAssemblyFor = firstFunctionalKey.id;
        }
      }
      // find the top assembly of either the given element or the functional element
      const topAssemblyKey = this.getElementKey(iModel, idToGetAssemblyFor, Number.MAX_SAFE_INTEGER);
      let keyToAdd = topAssemblyKey;
      if (is3d && keyToAdd) {
        // if we're computing scope for a 3d element, try to switch to its related functional element
        const relatedFunctionalKey = await this.getRelatedFunctionalElementKey(iModel, keyToAdd.id);
        if (relatedFunctionalKey) {
          keyToAdd = relatedFunctionalKey;
        }
      }
      keyToAdd && keys.add(keyToAdd);
    });
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

async function forEachNonTransientId(ids: Id64Array, callback: (id: Id64String) => Promise<void>): Promise<void> {
  await Promise.all(ids.filter((id) => !Id64.isTransient(id)).map(callback));
}
