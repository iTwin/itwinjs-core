/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import * as React from "react";
import { Id64String, IDisposable } from "@bentley/bentleyjs-core";
import { useDisposable } from "@bentley/ui-core";
import { IModelConnection, Viewport, PerModelCategoryVisibility } from "@bentley/imodeljs-frontend";
import { NodeKey, Ruleset, InstanceKey, KeySet, DescriptorOverrides, ContentFlags } from "@bentley/presentation-common";
import { ContentDataProvider, usePresentationTreeNodeLoader, IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { TreeNodeItem, ControlledTree, useVisibleTreeNodes, SelectionMode } from "@bentley/ui-components";
import { UiFramework } from "../../../ui-framework/UiFramework";
import { connectIModelConnection } from "../../../ui-framework/redux/connectIModel";
import { IVisibilityHandler, VisibilityStatus, VisibilityTreeEventHandler, VisibilityTreeFilterInfo } from "../VisibilityTreeEventHandler";
import { useVisibilityTreeRenderer, useVisibilityTreeFiltering } from "../VisibilityTreeRenderer";

import "./ModelsTree.scss";

const PAGING_SIZE = 20;

/**
 * Presentation rules used by [[ModelsTree]] component.
 * @internal
 */
export const RULESET_MODELS: Ruleset = require("./Hierarchy.json"); // tslint:disable-line: no-var-requires

const RULESET_MODELS_SEARCH: Ruleset = require("./ModelsTreeSearch.json"); // tslint:disable-line: no-var-requires

/**
 * Visibility tree node types.
 * @alpha
 */
export enum ModelsTreeNodeType {
  Unknown,
  Subject,
  Model,
  Category,
  Element,
}

/**
 * Type definition of predicate used to decide if node can be selected
 * @alpha
 */
export type ModelsTreeSelectionPredicate = (key: NodeKey, type: ModelsTreeNodeType) => boolean;

/** Props for [[ModelsTree]] component
 * @public
 */
export interface ModelsTreeProps {
  /**
   * An IModel to pull data from
   */
  iModel: IModelConnection;
  /**
   * Selection mode in the tree
   */
  selectionMode?: SelectionMode;
  /**
   * Predicate which indicates whether node can be selected or no
   * @alpha
   */
  selectionPredicate?: ModelsTreeSelectionPredicate;
  /**
   * Start loading hierarchy as soon as the component is created
   */
  enablePreloading?: boolean;
  /**
   * Active view used to determine and control visibility
   */
  activeView?: Viewport;
  /**
   * Ref to the root HTML element used by this component
   */
  rootElementRef?: React.Ref<HTMLDivElement>;
  /**
   * Information for tree filtering.
   * @alpha
   */
  filterInfo?: VisibilityTreeFilterInfo;
  /**
   * Callback invoked when tree is filtered.
   */
  onFilterApplied?: (filteredDataProvider: IPresentationTreeDataProvider, matchesCount: number) => void;
  /**
   * Custom data provider to use for testing
   * @internal
   */
  dataProvider?: IPresentationTreeDataProvider;
  /**
   * Custom visibility handler to use for testing
   * @internal
   */
  modelsVisibilityHandler?: VisibilityHandler;
}

/**
 * A tree component that shows a subject - model - category - element
 * hierarchy along with checkboxes that represent and allow changing
 * the display of those instances.
 * @public
 */
export function ModelsTree(props: ModelsTreeProps) {
  const nodeLoader = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    dataProvider: props.dataProvider,
    ruleset: RULESET_MODELS,
    pageSize: PAGING_SIZE,
    preloadingEnabled: props.enablePreloading,
  });
  const searchNodeLoader = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    dataProvider: props.dataProvider,
    ruleset: RULESET_MODELS_SEARCH,
    pageSize: PAGING_SIZE,
  });

  const nodeLoaderInUse = props.filterInfo?.filter ? searchNodeLoader : nodeLoader;
  const { filteredNodeLoader, isFiltering, nodeHighlightingProps } = useVisibilityTreeFiltering(nodeLoaderInUse, props.filterInfo, props.onFilterApplied);

  const { activeView, modelsVisibilityHandler, selectionPredicate } = props;
  const nodeSelectionPredicate = React.useCallback((key: NodeKey, node: TreeNodeItem) => {
    return !selectionPredicate ? true : selectionPredicate(key, getNodeType(node));
  }, [selectionPredicate]);

  const visibilityHandler = useVisibilityHandler(activeView, modelsVisibilityHandler);
  const eventHandler = useDisposable(React.useCallback(() => new VisibilityTreeEventHandler({
    nodeLoader: filteredNodeLoader,
    visibilityHandler,
    collapsedChildrenDisposalEnabled: true,
    selectionPredicate: nodeSelectionPredicate,
  }), [filteredNodeLoader, visibilityHandler, nodeSelectionPredicate]));

  const visibleNodes = useVisibleTreeNodes(filteredNodeLoader.modelSource);
  const treeRenderer = useVisibilityTreeRenderer(true, false);

  const overlay = isFiltering ? <div className="filteredTreeOverlay" /> : undefined;

  return (
    <div className="ui-fw-models-tree" ref={props.rootElementRef}>
      <ControlledTree
        nodeLoader={filteredNodeLoader}
        visibleNodes={visibleNodes}
        selectionMode={props.selectionMode || SelectionMode.None}
        treeEvents={eventHandler}
        treeRenderer={treeRenderer}
        nodeHighlightingProps={nodeHighlightingProps}
      />
      {overlay}
    </div>
  );
}

/**
 * ModelsTree that is connected to the IModelConnection property in the Redux store. The
 * application must set up the Redux store and include the FrameworkReducer.
 * @alpha
 */
export const IModelConnectedModelsTree = connectIModelConnection(null, null)(ModelsTree); // tslint:disable-line:variable-name

const useVisibilityHandler = (activeView?: Viewport, visibilityHandler?: VisibilityHandler) => {
  const previous = React.useRef<IDisposable>();

  React.useEffect(() => () => previous.current?.dispose(), []);

  return React.useMemo(() => {
    if (previous.current)
      previous.current.dispose;

    const handler = visibilityHandler ?? createVisibilityHandler(activeView);
    previous.current = handler;
    return handler;
  }, [activeView, visibilityHandler]);
};

const createVisibilityHandler = (activeView?: Viewport): IVisibilityHandler | undefined => {
  return activeView ? new VisibilityHandler({ viewport: activeView }) : undefined;
};

const getNodeType = (item: TreeNodeItem) => {
  if (!item.extendedData)
    return ModelsTreeNodeType.Unknown;

  if (isSubjectNode(item))
    return ModelsTreeNodeType.Subject;
  if (isModelNode(item))
    return ModelsTreeNodeType.Model;
  if (isCategoryNode(item))
    return ModelsTreeNodeType.Category;
  return ModelsTreeNodeType.Element;
};

const createTooltip = (status: "visible" | "hidden" | "disabled", tooltipStringId: string | undefined): string => {
  const statusStringId = `UiFramework:visibilityTree.status.${status}`;
  const statusString = UiFramework.i18n.translate(statusStringId);
  if (!tooltipStringId)
    return statusString;

  tooltipStringId = `UiFramework:visibilityTree.tooltips.${tooltipStringId}`;
  const tooltipString = UiFramework.i18n.translate(tooltipStringId);
  return `${statusString}: ${tooltipString}`;
};

const isSubjectNode = (node: TreeNodeItem) => (node.extendedData && node.extendedData.isSubject);
const isModelNode = (node: TreeNodeItem) => (node.extendedData && node.extendedData.isModel);
const isCategoryNode = (node: TreeNodeItem) => (node.extendedData && node.extendedData.isCategory);

/** @internal */
export interface VisibilityHandlerProps {
  viewport: Viewport;
  onVisibilityChange?: () => void;
}

/** @internal */
export class VisibilityHandler implements IVisibilityHandler {

  private _props: VisibilityHandlerProps;
  private _pendingVisibilityChange: any | undefined;
  private _subjectModelIdsCache: SubjectModelIdsCache;
  private _onVisibilityChange?: () => void;

  constructor(props: VisibilityHandlerProps) {
    this._props = props;
    this._onVisibilityChange = props.onVisibilityChange;
    this._subjectModelIdsCache = new SubjectModelIdsCache(this._props.viewport.iModel);
    this._props.viewport.onViewedCategoriesPerModelChanged.addListener(this.onViewChanged);
    this._props.viewport.onViewedCategoriesChanged.addListener(this.onViewChanged);
    this._props.viewport.onViewedModelsChanged.addListener(this.onViewChanged);
    this._props.viewport.onAlwaysDrawnChanged.addListener(this.onElementAlwaysDrawnChanged);
    this._props.viewport.onNeverDrawnChanged.addListener(this.onElementNeverDrawnChanged);
  }

  public dispose() {
    this._props.viewport.onViewedCategoriesPerModelChanged.removeListener(this.onViewChanged);
    this._props.viewport.onViewedCategoriesChanged.removeListener(this.onViewChanged);
    this._props.viewport.onViewedModelsChanged.removeListener(this.onViewChanged);
    this._props.viewport.onAlwaysDrawnChanged.removeListener(this.onElementAlwaysDrawnChanged);
    this._props.viewport.onNeverDrawnChanged.removeListener(this.onElementNeverDrawnChanged);
    clearTimeout(this._pendingVisibilityChange);
  }

  public get onVisibilityChange() { return this._onVisibilityChange; }
  public set onVisibilityChange(callback: (() => void) | undefined) { this._onVisibilityChange = callback; }

  public getVisibilityStatus(node: TreeNodeItem, nodeKey: NodeKey): VisibilityStatus | Promise<VisibilityStatus> {
    if (!NodeKey.isInstancesNodeKey(nodeKey))
      return { isDisplayed: false, isDisabled: true };

    if (isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this.getSubjectDisplayStatus(nodeKey.instanceKeys.map((k) => k.id));
    }
    if (isModelNode(node))
      return this.getModelDisplayStatus(nodeKey.instanceKeys[0].id);
    if (isCategoryNode(node))
      return this.getCategoryDisplayStatus(nodeKey.instanceKeys[0].id, this.getCategoryParentModelId(node));
    return this.getElementDisplayStatus(nodeKey.instanceKeys[0].id, this.getElementModelId(node), this.getElementCategoryId(node));
  }

  public async changeVisibility(node: TreeNodeItem, nodeKey: NodeKey, on: boolean) {
    if (!NodeKey.isInstancesNodeKey(nodeKey))
      return;

    if (isSubjectNode(node)) {
      await this.changeSubjectState(nodeKey.instanceKeys.map((k) => k.id), on);
    } else if (isModelNode(node)) {
      await this.changeModelState(nodeKey.instanceKeys[0].id, on);
    } else if (isCategoryNode(node)) {
      this.changeCategoryState(nodeKey.instanceKeys[0].id, this.getCategoryParentModelId(node), on);
    } else {
      await this.changeElementState(nodeKey.instanceKeys[0].id, this.getElementModelId(node), this.getElementCategoryId(node), on);
    }
  }

  private getCategoryParentModelId(categoryNode: TreeNodeItem): Id64String | undefined {
    return categoryNode.extendedData ? categoryNode.extendedData.modelId : undefined;
  }

  private getElementModelId(elementNode: TreeNodeItem): Id64String | undefined {
    return elementNode.extendedData ? elementNode.extendedData.modelId : undefined;
  }

  private getElementCategoryId(elementNode: TreeNodeItem): Id64String | undefined {
    return elementNode.extendedData ? elementNode.extendedData.categoryId : undefined;
  }

  private async getSubjectDisplayStatus(ids: Id64String[]): Promise<VisibilityStatus> {
    if (!this._props.viewport.view.isSpatialView())
      return { isDisabled: true, isDisplayed: false, tooltip: createTooltip("disabled", "subject.nonSpatialView") };
    const modelIds = await this.getSubjectModelIds(ids);
    const isDisplayed = modelIds.some((modelId) => this.getModelDisplayStatus(modelId).isDisplayed);
    if (isDisplayed)
      return { isDisplayed, tooltip: createTooltip("visible", "subject.atLeastOneModelVisible") };
    return { isDisplayed, tooltip: createTooltip("hidden", "subject.allModelsHidden") };
  }

  private getModelDisplayStatus(id: Id64String): VisibilityStatus {
    if (!this._props.viewport.view.isSpatialView())
      return { isDisabled: true, isDisplayed: false, tooltip: createTooltip("disabled", "model.nonSpatialView") };
    const isDisplayed = this._props.viewport.view.viewsModel(id);
    return { isDisplayed, tooltip: createTooltip(isDisplayed ? "visible" : "hidden", undefined) };
  }

  private getCategoryDisplayStatus(id: Id64String, parentModelId: Id64String | undefined): VisibilityStatus {
    if (parentModelId) {
      if (!this.getModelDisplayStatus(parentModelId).isDisplayed)
        return { isDisplayed: false, isDisabled: true, tooltip: createTooltip("disabled", "category.modelNotDisplayed") };

      const override = this._props.viewport.perModelCategoryVisibility.getOverride(parentModelId, id);
      switch (override) {
        case PerModelCategoryVisibility.Override.Show:
          return { isDisplayed: true, tooltip: createTooltip("visible", "category.displayedThroughPerModelOverride") };
        case PerModelCategoryVisibility.Override.Hide:
          return { isDisplayed: false, tooltip: createTooltip("hidden", "category.hiddenThroughPerModelOverride") };
      }
    }
    const isDisplayed = this._props.viewport.view.viewsCategory(id);
    return {
      isDisplayed,
      tooltip: isDisplayed
        ? createTooltip("visible", "category.displayedThroughCategorySelector")
        : createTooltip("hidden", "category.hiddenThroughCategorySelector"),
    };
  }

  private getElementDisplayStatus(elementId: Id64String, modelId: Id64String | undefined, categoryId: Id64String | undefined): VisibilityStatus {
    if (!modelId || !this._props.viewport.view.viewsModel(modelId))
      return { isDisabled: true, isDisplayed: false, tooltip: createTooltip("disabled", "element.modelNotDisplayed") };
    if (this._props.viewport.neverDrawn !== undefined && this._props.viewport.neverDrawn.has(elementId))
      return { isDisplayed: false, tooltip: createTooltip("hidden", "element.hiddenThroughNeverDrawnList") };
    if (this._props.viewport.alwaysDrawn !== undefined) {
      if (this._props.viewport.alwaysDrawn.has(elementId))
        return { isDisplayed: true, tooltip: createTooltip("visible", "element.displayedThroughAlwaysDrawnList") };
      if (this._props.viewport.alwaysDrawn.size !== 0 && this._props.viewport.isAlwaysDrawnExclusive)
        return { isDisplayed: false, tooltip: createTooltip("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn") };
    }
    if (categoryId && this.getCategoryDisplayStatus(categoryId, modelId).isDisplayed)
      return { isDisplayed: true, tooltip: createTooltip("visible", undefined) };
    return { isDisplayed: false, tooltip: createTooltip("hidden", "element.hiddenThroughCategory") };
  }

  private async changeSubjectState(ids: Id64String[], on: boolean) {
    if (!this._props.viewport.view.isSpatialView())
      return;

    const modelIds = await this.getSubjectModelIds(ids);
    return this.changeModelsVisibility(modelIds, on);
  }

  private async changeModelState(id: Id64String, on: boolean) {
    if (!this._props.viewport.view.isSpatialView())
      return;

    return this.changeModelsVisibility([id], on);
  }

  private async changeModelsVisibility(ids: Id64String[], visible: boolean) {
    if (visible)
      return this._props.viewport.addViewedModels(ids);
    else
      this._props.viewport.changeModelDisplay(ids, false);
  }

  private changeCategoryState(categoryId: Id64String, parentModelId: Id64String | undefined, on: boolean) {
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

  private async changeElementState(id: Id64String, modelId: Id64String | undefined, categoryId: Id64String | undefined, on: boolean) {
    const elementIds = [id, ...await this.getAssemblyElementIds(id)];
    const isDisplayedByDefault = modelId && this.getModelDisplayStatus(modelId).isDisplayed
      && categoryId && this.getCategoryDisplayStatus(categoryId, modelId).isDisplayed;
    const isHiddenDueToExclusiveAlwaysDrawnElements = this._props.viewport.isAlwaysDrawnExclusive && this._props.viewport.alwaysDrawn && 0 !== this._props.viewport.alwaysDrawn.size;
    const currNeverDrawn = new Set(this._props.viewport.neverDrawn ? this._props.viewport.neverDrawn : []);
    const currAlwaysDrawn = new Set(this._props.viewport.alwaysDrawn ? this._props.viewport.alwaysDrawn : []);
    elementIds.forEach((elementId) => {
      if (on) {
        currNeverDrawn.delete(elementId);
        if (!isDisplayedByDefault || isHiddenDueToExclusiveAlwaysDrawnElements)
          currAlwaysDrawn.add(elementId);
      } else {
        currAlwaysDrawn.delete(elementId);
        if (isDisplayedByDefault && !isHiddenDueToExclusiveAlwaysDrawnElements)
          currNeverDrawn.add(elementId);
      }
    });
    this._props.viewport.setNeverDrawn(currNeverDrawn);
    this._props.viewport.setAlwaysDrawn(currAlwaysDrawn, this._props.viewport.isAlwaysDrawnExclusive);
  }

  private onVisibilityChangeInternal() {
    if (this._pendingVisibilityChange)
      return;

    this._pendingVisibilityChange = setTimeout(() => {
      this._onVisibilityChange && this._onVisibilityChange();
      this._pendingVisibilityChange = undefined;
    }, 0);
  }

  // tslint:disable-next-line: naming-convention
  private onViewChanged = (_vp: Viewport) => {
    this.onVisibilityChangeInternal();
  }

  // tslint:disable-next-line: naming-convention
  private onElementAlwaysDrawnChanged = () => {
    this.onVisibilityChangeInternal();
  }

  // tslint:disable-next-line: naming-convention
  private onElementNeverDrawnChanged = () => {
    this.onVisibilityChangeInternal();
  }

  private async getSubjectModelIds(subjectIds: Id64String[]): Promise<Id64String[]> {
    return (await Promise.all(subjectIds.map((id) => this._subjectModelIdsCache.getSubjectModelIds(id))))
      .reduce((allModelIds: Id64String[], curr: Id64String[]) => [...allModelIds, ...curr], []);
  }

  private async getAssemblyElementIds(assemblyId: Id64String): Promise<Id64String[]> {
    const provider = new AssemblyElementIdsProvider(this._props.viewport.iModel, assemblyId);
    return provider.getElementIds();
  }
}

class SubjectModelIdsCache {
  private _imodel: IModelConnection;
  private _subjectsHierarchy: Map<Id64String, Id64String[]> | undefined;
  private _subjectModels: Map<Id64String, Id64String[]> | undefined;
  private _init: Promise<void> | undefined;

  constructor(imodel: IModelConnection) {
    this._imodel = imodel;
  }

  private async initSubjectsHierarchy() {
    this._subjectsHierarchy = new Map();
    const ecsql = `SELECT ECInstanceId id, Parent.Id parentId FROM bis.Subject WHERE Parent IS NOT NULL`;
    const result = this._imodel.query(ecsql);
    for await (const row of result) {
      let list = this._subjectsHierarchy.get(row.parentId);
      if (!list) {
        list = [];
        this._subjectsHierarchy.set(row.parentId, list);
      }
      list.push(row.id);
    }
  }

  private async initSubjectModels() {
    this._subjectModels = new Map();
    const ecsql = `
      SELECT p.ECInstanceId id, p.Parent.Id subjectId
        FROM bis.InformationPartitionElement p
        INNER JOIN bis.GeometricModel3d m ON m.ModeledElement.Id = p.ECInstanceId
       WHERE NOT m.IsPrivate`;
    const result = this._imodel.query(ecsql);
    for await (const row of result) {
      let list = this._subjectModels.get(row.subjectId);
      if (!list) {
        list = [];
        this._subjectModels.set(row.subjectId, list);
      }
      list.push(row.id);
    }
  }

  private async initCache() {
    if (!this._init) {
      this._init = Promise.all([this.initSubjectModels(), this.initSubjectsHierarchy()]).then(() => { });
    }
    return this._init;
  }

  private appendSubjectModelsRecursively(modelIds: Id64String[], subjectId: Id64String) {
    const subjectModelIds = this._subjectModels!.get(subjectId);
    if (subjectModelIds)
      modelIds.push(...subjectModelIds);

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

class RulesetDrivenRecursiveIdsProvider extends ContentDataProvider {
  constructor(imodel: IModelConnection, displayType: string, parentKey: InstanceKey) {
    super({ imodel, ruleset: RULESET_MODELS.id, displayType });
    this.keys = new KeySet([parentKey]);
  }
  protected shouldConfigureContentDescriptor() { return false; }
  protected getDescriptorOverrides(): DescriptorOverrides {
    return {
      displayType: this.displayType,
      contentFlags: ContentFlags.KeysOnly,
      hiddenFieldNames: [],
    };
  }
  protected async getChildrenIds() {
    const content = await this.getContent();
    return content ? content.contentSet.map((item) => item.primaryKeys[0].id) : [];
  }
}

class AssemblyElementIdsProvider extends RulesetDrivenRecursiveIdsProvider {
  constructor(imodel: IModelConnection, assemblyId: Id64String) {
    super(imodel, "AssemblyElementsRequest", { className: "BisCore:Element", id: assemblyId });
  }
  public async getElementIds() {
    return this.getChildrenIds();
  }
}
