/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import { TreeNodeItem } from "@itwin/components-react";
import { BeEvent, Id64String } from "@itwin/core-bentley";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { IModelConnection, PerModelCategoryVisibility, Viewport } from "@itwin/core-frontend";
import { ECClassGroupingNodeKey, GroupingNodeKey, Keys, KeySet, NodeKey } from "@itwin/presentation-common";
import { IFilteredPresentationTreeDataProvider, IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import { UiFramework } from "../../UiFramework";
import { IVisibilityHandler, VisibilityChangeListener, VisibilityStatus } from "../VisibilityTreeEventHandler";

/**
 * Visibility tree node types.
 * @beta
 */
export enum ModelsTreeNodeType {
  Unknown,
  Subject,
  Model,
  Category,
  Element,
  Grouping,
}

/**
 * Type definition of predicate used to decide if node can be selected
 * @beta
 */
export type ModelsTreeSelectionPredicate = (key: NodeKey, type: ModelsTreeNodeType) => boolean;

/**
 * Props for [[ModelsVisibilityHandler]]
 * @alpha
 */
export interface ModelsVisibilityHandlerProps {
  rulesetId: string;
  viewport: Viewport;
  hierarchyAutoUpdateEnabled?: boolean;
}

/**
 * Visibility handler used by [[ModelsTree]] to control visibility of the tree items.
 * @alpha
 */
export class ModelsVisibilityHandler implements IVisibilityHandler {
  private _props: ModelsVisibilityHandlerProps;
  private _pendingVisibilityChange: any | undefined;
  private _subjectModelIdsCache: SubjectModelIdsCache;
  private _filteredDataProvider?: IFilteredPresentationTreeDataProvider;
  private _elementIdsCache: ElementIdsCache;
  private _listeners = new Array<() => void>();

  constructor(props: ModelsVisibilityHandlerProps) {
    this._props = props;
    this._subjectModelIdsCache = new SubjectModelIdsCache(this._props.viewport.iModel);
    this._elementIdsCache = new ElementIdsCache(this._props.viewport.iModel, this._props.rulesetId);
    this._listeners.push(this._props.viewport.onViewedCategoriesPerModelChanged.addListener(this.onViewChanged));
    this._listeners.push(this._props.viewport.onViewedCategoriesChanged.addListener(this.onViewChanged));
    this._listeners.push(this._props.viewport.onViewedModelsChanged.addListener(this.onViewChanged));
    this._listeners.push(this._props.viewport.onAlwaysDrawnChanged.addListener(this.onElementAlwaysDrawnChanged));
    this._listeners.push(this._props.viewport.onNeverDrawnChanged.addListener(this.onElementNeverDrawnChanged));
    if (this._props.hierarchyAutoUpdateEnabled) {
      this._listeners.push(Presentation.presentation.onIModelHierarchyChanged.addListener(/* istanbul ignore next */() => this._elementIdsCache.clear()));
    }
  }

  public dispose() {
    this._listeners.forEach((remove) => remove());
    clearTimeout(this._pendingVisibilityChange);
  }

  public onVisibilityChange = new BeEvent<VisibilityChangeListener>();

  /** Sets data provider that is used to get filtered tree hierarchy. */
  public setFilteredDataProvider(provider: IFilteredPresentationTreeDataProvider | undefined) { this._filteredDataProvider = provider; }

  public static getNodeType(item: TreeNodeItem, dataProvider: IPresentationTreeDataProvider) {
    if (NodeKey.isClassGroupingNodeKey(dataProvider.getNodeKey(item)))
      return ModelsTreeNodeType.Grouping;

    if (!item.extendedData)
      return ModelsTreeNodeType.Unknown;

    if (this.isSubjectNode(item))
      return ModelsTreeNodeType.Subject;
    if (this.isModelNode(item))
      return ModelsTreeNodeType.Model;
    if (this.isCategoryNode(item))
      return ModelsTreeNodeType.Category;
    return ModelsTreeNodeType.Element;
  }

  public static isSubjectNode(node: TreeNodeItem) {
    return node.extendedData && node.extendedData.isSubject;
  }
  public static isModelNode(node: TreeNodeItem) {
    return node.extendedData && node.extendedData.isModel;
  }
  public static isCategoryNode(node: TreeNodeItem) {
    return node.extendedData && node.extendedData.isCategory;
  }

  /** Returns visibility status of the tree node. */
  public getVisibilityStatus(node: TreeNodeItem, nodeKey: NodeKey): VisibilityStatus | Promise<VisibilityStatus> {
    if (NodeKey.isClassGroupingNodeKey(nodeKey))
      return this.getElementGroupingNodeDisplayStatus(node.id, nodeKey);

    if (!NodeKey.isInstancesNodeKey(nodeKey))
      return { state: "hidden", isDisabled: true };

    if (ModelsVisibilityHandler.isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this.getSubjectNodeVisibility(nodeKey.instanceKeys.map((key) => key.id), node);
    }
    if (ModelsVisibilityHandler.isModelNode(node))
      return this.getModelDisplayStatus(nodeKey.instanceKeys[0].id);
    if (ModelsVisibilityHandler.isCategoryNode(node))
      return this.getCategoryDisplayStatus(nodeKey.instanceKeys[0].id, this.getCategoryParentModelId(node));
    return this.getElementDisplayStatus(nodeKey.instanceKeys[0].id, this.getElementModelId(node), this.getElementCategoryId(node));
  }

  /** Changes visibility of the items represented by the tree node. */
  public async changeVisibility(node: TreeNodeItem, nodeKey: NodeKey, on: boolean) {
    if (NodeKey.isClassGroupingNodeKey(nodeKey)) {
      await this.changeElementGroupingNodeState(nodeKey, on);
      return;
    }

    if (!NodeKey.isInstancesNodeKey(nodeKey))
      return;

    if (ModelsVisibilityHandler.isSubjectNode(node)) {
      await this.changeSubjectNodeState(nodeKey.instanceKeys.map((key) => key.id), node, on);
    } else if (ModelsVisibilityHandler.isModelNode(node)) {
      await this.changeModelState(nodeKey.instanceKeys[0].id, on);
    } else if (ModelsVisibilityHandler.isCategoryNode(node)) {
      this.changeCategoryState(nodeKey.instanceKeys[0].id, this.getCategoryParentModelId(node), on);
    } else {
      await this.changeElementState(nodeKey.instanceKeys[0].id, this.getElementModelId(node), this.getElementCategoryId(node), on);
    }
  }

  protected async getSubjectNodeVisibility(ids: Id64String[], node: TreeNodeItem): Promise<VisibilityStatus> {
    if (!this._props.viewport.view.isSpatialView())
      return { isDisabled: true, state: "hidden", tooltip: createTooltip("disabled", "subject.nonSpatialView") };

    if (this._filteredDataProvider)
      return this.getFilteredSubjectDisplayStatus(this._filteredDataProvider, ids, node);

    return this.getSubjectDisplayStatus(ids);
  }

  private async getSubjectDisplayStatus(ids: Id64String[]): Promise<VisibilityStatus> {
    const modelIds = await this.getSubjectModelIds(ids);
    const isDisplayed = modelIds.some((modelId) => this.getModelDisplayStatus(modelId).state === "visible");
    if (isDisplayed)
      return { state: "visible", tooltip: createTooltip("visible", "subject.atLeastOneModelVisible") };
    return { state: "hidden", tooltip: createTooltip("hidden", "subject.allModelsHidden") };
  }

  private async getFilteredSubjectDisplayStatus(provider: IFilteredPresentationTreeDataProvider, ids: Id64String[], node: TreeNodeItem): Promise<VisibilityStatus> {
    if (provider.nodeMatchesFilter(node))
      return this.getSubjectDisplayStatus(ids);

    const children = await provider.getNodes(node);
    const childrenDisplayStatuses = await Promise.all(children.map((childNode) => this.getVisibilityStatus(childNode, provider.getNodeKey(childNode))));
    if (childrenDisplayStatuses.some((status) => status.state === "visible"))
      return { state: "visible", tooltip: createTooltip("visible", "subject.atLeastOneModelVisible") };
    return { state: "hidden", tooltip: createTooltip("hidden", "subject.allModelsHidden") };
  }

  protected getModelDisplayStatus(id: Id64String): VisibilityStatus {
    if (!this._props.viewport.view.isSpatialView())
      return { isDisabled: true, state: "hidden", tooltip: createTooltip("disabled", "model.nonSpatialView") };
    const isDisplayed = this._props.viewport.view.viewsModel(id);
    return { state: isDisplayed ? "visible" : "hidden", tooltip: createTooltip(isDisplayed ? "visible" : "hidden", undefined) };
  }

  protected getCategoryDisplayStatus(id: Id64String, parentModelId: Id64String | undefined): VisibilityStatus {
    if (parentModelId) {
      if (this.getModelDisplayStatus(parentModelId).state === "hidden")
        return { state: "hidden", isDisabled: true, tooltip: createTooltip("disabled", "category.modelNotDisplayed") };

      const override = this._props.viewport.perModelCategoryVisibility.getOverride(parentModelId, id);
      switch (override) {
        case PerModelCategoryVisibility.Override.Show:
          return { state: "visible", tooltip: createTooltip("visible", "category.displayedThroughPerModelOverride") };
        case PerModelCategoryVisibility.Override.Hide:
          return { state: "hidden", tooltip: createTooltip("hidden", "category.hiddenThroughPerModelOverride") };
      }
    }
    const isDisplayed = this._props.viewport.view.viewsCategory(id);
    return {
      state: isDisplayed ? "visible" : "hidden",
      tooltip: isDisplayed
        ? createTooltip("visible", "category.displayedThroughCategorySelector")
        : createTooltip("hidden", "category.hiddenThroughCategorySelector"),
    };
  }

  protected async getElementGroupingNodeDisplayStatus(_id: string, key: ECClassGroupingNodeKey): Promise<VisibilityStatus> {
    const { modelId, categoryId, elementIds } = await this.getGroupedElementIds(key);

    if (!modelId || !this._props.viewport.view.viewsModel(modelId))
      return { isDisabled: true, state: "hidden", tooltip: createTooltip("disabled", "element.modelNotDisplayed") };

    if (this._props.viewport.alwaysDrawn !== undefined && this._props.viewport.alwaysDrawn.size > 0) {
      let atLeastOneElementForceDisplayed = false;
      for await (const elementId of elementIds.getElementIds()) {
        if (this._props.viewport.alwaysDrawn.has(elementId)) {
          atLeastOneElementForceDisplayed = true;
          break;
        }
      }
      if (atLeastOneElementForceDisplayed)
        return { state: "visible", tooltip: createTooltip("visible", "element.displayedThroughAlwaysDrawnList") };
    }

    if (this._props.viewport.alwaysDrawn !== undefined && this._props.viewport.alwaysDrawn.size !== 0 && this._props.viewport.isAlwaysDrawnExclusive)
      return { state: "hidden", tooltip: createTooltip("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn") };

    if (this._props.viewport.neverDrawn !== undefined && this._props.viewport.neverDrawn.size > 0) {
      let allElementsForceHidden = true;
      for await (const elementId of elementIds.getElementIds()) {
        if (!this._props.viewport.neverDrawn.has(elementId)) {
          allElementsForceHidden = false;
          break;
        }
      }
      if (allElementsForceHidden)
        return { state: "hidden", tooltip: createTooltip("visible", "element.hiddenThroughNeverDrawnList") };
    }

    if (categoryId && this.getCategoryDisplayStatus(categoryId, modelId).state === "visible")
      return { state: "visible", tooltip: createTooltip("visible", undefined) };

    return { state: "hidden", tooltip: createTooltip("hidden", "element.hiddenThroughCategory") };
  }

  protected getElementDisplayStatus(elementId: Id64String, modelId: Id64String | undefined, categoryId: Id64String | undefined): VisibilityStatus {
    if (!modelId || !this._props.viewport.view.viewsModel(modelId))
      return { isDisabled: true, state: "hidden", tooltip: createTooltip("disabled", "element.modelNotDisplayed") };
    if (this._props.viewport.neverDrawn !== undefined && this._props.viewport.neverDrawn.has(elementId))
      return { state: "hidden", tooltip: createTooltip("hidden", "element.hiddenThroughNeverDrawnList") };
    if (this._props.viewport.alwaysDrawn !== undefined) {
      if (this._props.viewport.alwaysDrawn.has(elementId))
        return { state: "visible", tooltip: createTooltip("visible", "element.displayedThroughAlwaysDrawnList") };
      if (this._props.viewport.alwaysDrawn.size !== 0 && this._props.viewport.isAlwaysDrawnExclusive)
        return { state: "hidden", tooltip: createTooltip("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn") };
    }
    if (categoryId && this.getCategoryDisplayStatus(categoryId, modelId).state === "visible")
      return { state: "visible", tooltip: createTooltip("visible", undefined) };
    return { state: "hidden", tooltip: createTooltip("hidden", "element.hiddenThroughCategory") };
  }

  protected async changeSubjectNodeState(ids: Id64String[], node: TreeNodeItem, on: boolean) {
    if (!this._props.viewport.view.isSpatialView())
      return;

    if (this._filteredDataProvider)
      return this.changeFilteredSubjectState(this._filteredDataProvider, ids, node, on);

    return this.changeSubjectState(ids, on);
  }

  private async changeFilteredSubjectState(provider: IFilteredPresentationTreeDataProvider, ids: Id64String[], node: TreeNodeItem, on: boolean) {
    if (provider.nodeMatchesFilter(node))
      return this.changeSubjectState(ids, on);

    const children = await provider.getNodes(node);
    return Promise.all(children.map(async (childNode) => this.changeVisibility(childNode, provider.getNodeKey(childNode), on)));
  }

  private async changeSubjectState(ids: Id64String[], on: boolean) {
    const modelIds = await this.getSubjectModelIds(ids);
    return this.changeModelsVisibility(modelIds, on);
  }

  protected async changeModelState(id: Id64String, on: boolean) {
    if (!this._props.viewport.view.isSpatialView())
      return;

    return this.changeModelsVisibility([id], on);
  }

  protected async changeModelsVisibility(ids: Id64String[], visible: boolean) {
    if (visible)
      return this._props.viewport.addViewedModels(ids);
    else
      this._props.viewport.changeModelDisplay(ids, false);
  }

  protected changeCategoryState(categoryId: Id64String, parentModelId: Id64String | undefined, on: boolean) {
    if (parentModelId) {
      const isDisplayedInSelector = this._props.viewport.view.viewsCategory(categoryId);
      const ovr = (on === isDisplayedInSelector) ? PerModelCategoryVisibility.Override.None
        : on ? PerModelCategoryVisibility.Override.Show : PerModelCategoryVisibility.Override.Hide;
      this._props.viewport.perModelCategoryVisibility.setOverride(parentModelId, categoryId, ovr);
      if (ovr === PerModelCategoryVisibility.Override.None && on) {
        // we took off the override which means the category is displayed in selector, but
        // doesn't mean all its subcategories are displayed - this call ensures that
        this._props.viewport.changeCategoryDisplay([categoryId], true, true);
      }
      return;
    }
    this._props.viewport.changeCategoryDisplay([categoryId], on, on ? true : false);
  }

  protected async changeElementGroupingNodeState(key: ECClassGroupingNodeKey, on: boolean) {
    const { modelId, categoryId, elementIds } = await this.getGroupedElementIds(key);
    await this.changeElementsState(modelId, categoryId, elementIds.getElementIds(), on);
  }

  protected async changeElementState(id: Id64String, modelId: Id64String | undefined, categoryId: Id64String | undefined, on: boolean) {
    const childIdsContainer = this.getAssemblyElementIds(id);
    async function* elementIds() {
      yield id;
      for await (const childId of childIdsContainer.getElementIds())
        yield childId;
    }
    await this.changeElementsState(modelId, categoryId, elementIds(), on);
  }

  protected async changeElementsState(modelId: Id64String | undefined, categoryId: Id64String | undefined, elementIds: AsyncGenerator<Id64String>, on: boolean) {
    const isDisplayedByDefault = modelId && this.getModelDisplayStatus(modelId).state === "visible"
      && categoryId && this.getCategoryDisplayStatus(categoryId, modelId).state === "visible";
    const isHiddenDueToExclusiveAlwaysDrawnElements = this._props.viewport.isAlwaysDrawnExclusive && this._props.viewport.alwaysDrawn && 0 !== this._props.viewport.alwaysDrawn.size;
    const currNeverDrawn = new Set(this._props.viewport.neverDrawn ? this._props.viewport.neverDrawn : []);
    const currAlwaysDrawn = new Set(this._props.viewport.alwaysDrawn ?
      this._props.viewport.alwaysDrawn : /* istanbul ignore next */[],
    );
    for await (const elementId of elementIds) {
      if (on) {
        currNeverDrawn.delete(elementId);
        if (!isDisplayedByDefault || isHiddenDueToExclusiveAlwaysDrawnElements)
          currAlwaysDrawn.add(elementId);
      } else {
        currAlwaysDrawn.delete(elementId);
        if (isDisplayedByDefault && !isHiddenDueToExclusiveAlwaysDrawnElements)
          currNeverDrawn.add(elementId);
      }
    }
    this._props.viewport.setNeverDrawn(currNeverDrawn);
    this._props.viewport.setAlwaysDrawn(currAlwaysDrawn, this._props.viewport.isAlwaysDrawnExclusive);
  }

  private onVisibilityChangeInternal() {
    if (this._pendingVisibilityChange)
      return;

    this._pendingVisibilityChange = setTimeout(() => {
      this.onVisibilityChange.raiseEvent();
      this._pendingVisibilityChange = undefined;
    }, 0);
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private onViewChanged = (_vp: Viewport) => {
    this.onVisibilityChangeInternal();
  };

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private onElementAlwaysDrawnChanged = () => {
    this.onVisibilityChangeInternal();
  };

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private onElementNeverDrawnChanged = () => {
    this.onVisibilityChangeInternal();
  };

  private getCategoryParentModelId(categoryNode: TreeNodeItem): Id64String | undefined {
    return categoryNode.extendedData ? categoryNode.extendedData.modelId : /* istanbul ignore next */ undefined;
  }

  private getElementModelId(elementNode: TreeNodeItem): Id64String | undefined {
    return elementNode.extendedData ? elementNode.extendedData.modelId : /* istanbul ignore next */ undefined;
  }

  private getElementCategoryId(elementNode: TreeNodeItem): Id64String | undefined {
    return elementNode.extendedData ? elementNode.extendedData.categoryId : /* istanbul ignore next */ undefined;
  }

  private async getSubjectModelIds(subjectIds: Id64String[]) {
    return (await Promise.all(subjectIds.map(async (id) => this._subjectModelIdsCache.getSubjectModelIds(id))))
      .reduce((allModelIds: Id64String[], curr: Id64String[]) => [...allModelIds, ...curr], []);
  }

  // istanbul ignore next
  private getAssemblyElementIds(assemblyId: Id64String) {
    return this._elementIdsCache.getAssemblyElementIds(assemblyId);
  }

  // istanbul ignore next
  private async getGroupedElementIds(groupingNodeKey: GroupingNodeKey) {
    return this._elementIdsCache.getGroupedElementIds(groupingNodeKey);
  }
}

interface ModelInfo {
  id: Id64String;
  isHidden: boolean;
}

class SubjectModelIdsCache {
  private _imodel: IModelConnection;
  private _subjectsHierarchy: Map<Id64String, Id64String[]> | undefined;
  private _subjectModels: Map<Id64String, ModelInfo[]> | undefined;
  private _init: Promise<void> | undefined;

  constructor(imodel: IModelConnection) {
    this._imodel = imodel;
  }

  private async initSubjectModels() {
    const querySubjects = (): AsyncIterableIterator<{ id: Id64String, parentId?: Id64String, targetPartitionId?: Id64String }> => {
      const subjectsQuery = `
        SELECT ECInstanceId id, Parent.Id parentId, json_extract(JsonProperties, '$.Subject.Model.TargetPartition') targetPartitionId
        FROM bis.Subject
      `;
      return this._imodel.query(subjectsQuery, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
    };
    const queryModels = (): AsyncIterableIterator<{ id: Id64String, parentId: Id64String, content?: string }> => {
      const modelsQuery = `
        SELECT p.ECInstanceId id, p.Parent.Id parentId, json_extract(p.JsonProperties, '$.PhysicalPartition.Model.Content') content
        FROM bis.InformationPartitionElement p
        INNER JOIN bis.GeometricModel3d m ON m.ModeledElement.Id = p.ECInstanceId
        WHERE NOT m.IsPrivate
      `;
      return this._imodel.query(modelsQuery, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
    };

    function pushToMap<TKey, TValue>(map: Map<TKey, TValue[]>, key: TKey, value: TValue) {
      let list = map.get(key);
      if (!list) {
        list = [];
        map.set(key, list);
      }
      list.push(value);
    }

    this._subjectsHierarchy = new Map();
    const targetPartitionSubjects = new Map<Id64String, Id64String[]>();
    for await (const subject of querySubjects()) {
      if (subject.parentId)
        pushToMap(this._subjectsHierarchy, subject.parentId, subject.id);
      if (subject.targetPartitionId)
        pushToMap(targetPartitionSubjects, subject.targetPartitionId, subject.id);
    }

    this._subjectModels = new Map();
    for await (const model of queryModels()) {
      const subjectIds = targetPartitionSubjects.get(model.id) ?? [];
      if (!subjectIds.includes(model.parentId))
        subjectIds.push(model.parentId);

      const v = { id: model.id, isHidden: (model.content !== undefined) };
      subjectIds.forEach((subjectId) => {
        pushToMap(this._subjectModels!, subjectId, v);
      });
    }
  }

  private async initCache() {
    if (!this._init) {
      this._init = this.initSubjectModels().then(() => { });
    }
    return this._init;
  }

  private appendSubjectModelsRecursively(modelIds: Id64String[], subjectId: Id64String) {
    const subjectModelIds = this._subjectModels!.get(subjectId);
    if (subjectModelIds)
      modelIds.push(...subjectModelIds.map((info) => info.id));

    const childSubjectIds = this._subjectsHierarchy!.get(subjectId);
    if (childSubjectIds)
      childSubjectIds.forEach((cs) => this.appendSubjectModelsRecursively(modelIds, cs));
  }

  public async getSubjectModelIds(subjectId: Id64String): Promise<Id64String[]> {
    await this.initCache();
    const modelIds = new Array<Id64String>();
    this.appendSubjectModelsRecursively(modelIds, subjectId);
    return modelIds;
  }
}

interface GroupedElementIds {
  modelId?: string;
  categoryId?: string;
  elementIds: CachingElementIdsContainer;
}

// istanbul ignore next
class ElementIdsCache {
  private _assemblyElementIdsCache = new Map<string, CachingElementIdsContainer>();
  private _groupedElementIdsCache = new Map<string, GroupedElementIds>();

  constructor(private _imodel: IModelConnection, private _rulesetId: string) {
  }

  public clear() {
    this._assemblyElementIdsCache.clear();
    this._groupedElementIdsCache.clear();
  }

  public getAssemblyElementIds(assemblyId: Id64String) {
    const ids = this._assemblyElementIdsCache.get(assemblyId);
    if (ids)
      return ids;

    const container = createAssemblyElementIdsContainer(this._imodel, this._rulesetId, assemblyId);
    this._assemblyElementIdsCache.set(assemblyId, container);
    return container;
  }

  public async getGroupedElementIds(groupingNodeKey: GroupingNodeKey): Promise<GroupedElementIds> {
    const keyString = JSON.stringify(groupingNodeKey);
    const ids = this._groupedElementIdsCache.get(keyString);
    if (ids)
      return ids;
    const info = await createGroupedElementsInfo(this._imodel, this._rulesetId, groupingNodeKey);
    this._groupedElementIdsCache.set(keyString, info);
    return info;
  }
}

async function* createInstanceIdsGenerator(imodel: IModelConnection, rulesetId: string, displayType: string, inputKeys: Keys) {
  const res = await Presentation.presentation.getContentInstanceKeys({
    imodel,
    rulesetOrId: rulesetId,
    displayType,
    keys: new KeySet(inputKeys),
  });
  for await (const key of res.items()) {
    yield key.id;
  }
}

// istanbul ignore next
class CachingElementIdsContainer {
  private _generator;
  private _ids;
  constructor(generator: AsyncGenerator<Id64String>) {
    this._generator = generator;
    this._ids = new Array<Id64String>();
  }
  public async* getElementIds() {
    for (const id of this._ids) {
      yield id;
    }
    for await (const id of this._generator) {
      this._ids.push(id);
      yield id;
    }
  }
}

function createAssemblyElementIdsContainer(imodel: IModelConnection, rulesetId: string, assemblyId: Id64String) {
  return new CachingElementIdsContainer(createInstanceIdsGenerator(imodel, rulesetId, "AssemblyElementsRequest", [{ className: "BisCore:Element", id: assemblyId }]));
}

async function createGroupedElementsInfo(imodel: IModelConnection, rulesetId: string, groupingNodeKey: GroupingNodeKey) {
  const groupedElementIdsContainer = new CachingElementIdsContainer(createInstanceIdsGenerator(imodel, rulesetId, "AssemblyElementsRequest", [groupingNodeKey]));
  const elementId = await groupedElementIdsContainer.getElementIds().next();
  if (elementId.done)
    throw new Error("Invalid grouping node key");

  let modelId, categoryId;
  const query = `SELECT Model.Id AS modelId, Category.Id AS categoryId FROM bis.GeometricElement3d WHERE ECInstanceId = ? LIMIT 1`;
  for await (const modelAndCategoryIds of imodel.query(query, QueryBinder.from([elementId.value]), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
    modelId = modelAndCategoryIds.modelId;
    categoryId = modelAndCategoryIds.categoryId;
    break;
  }
  return { modelId, categoryId, elementIds: groupedElementIdsContainer };
}

const createTooltip = (status: "visible" | "hidden" | "disabled", tooltipStringId: string | undefined): string => {
  const statusStringId = `UiFramework:modelTree.status.${status}`;
  const statusString = UiFramework.localization.getLocalizedString(statusStringId);
  if (!tooltipStringId)
    return statusString;

  tooltipStringId = `UiFramework:modelTree.tooltips.${tooltipStringId}`;
  const tooltipString = UiFramework.localization.getLocalizedString(tooltipStringId);
  return `${statusString}: ${tooltipString}`;
};
