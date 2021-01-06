/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import "./ModelsTree.scss";
import * as React from "react";
import { BeEvent, Id64String } from "@bentley/bentleyjs-core";
import { IModelConnection, PerModelCategoryVisibility, Viewport } from "@bentley/imodeljs-frontend";
import {
  ContentFlags, DescriptorOverrides, ECClassGroupingNodeKey, GroupingNodeKey, Keys, KeySet, NodeKey, Ruleset,
} from "@bentley/presentation-common";
import { ContentDataProvider, IPresentationTreeDataProvider, usePresentationTreeNodeLoader } from "@bentley/presentation-components";
import { ControlledTree, SelectionMode, TreeNodeItem, useVisibleTreeNodes } from "@bentley/ui-components";
import { useDisposable, useOptionalDisposable } from "@bentley/ui-core";
import { connectIModelConnection } from "../../../ui-framework/redux/connectIModel";
import { UiFramework } from "../../../ui-framework/UiFramework";
import { ClassGroupingOption, VisibilityTreeFilterInfo } from "../Common";
import { IVisibilityHandler, VisibilityChangeListener, VisibilityStatus, VisibilityTreeEventHandler } from "../VisibilityTreeEventHandler";
import { useVisibilityTreeFiltering, useVisibilityTreeRenderer, VisibilityTreeNoFilteredData } from "../VisibilityTreeRenderer";

const PAGING_SIZE = 20;

/** @internal */
export const RULESET_MODELS: Ruleset = require("./Hierarchy.json"); // eslint-disable-line @typescript-eslint/no-var-requires
/** @internal */
export const RULESET_MODELS_GROUPED_BY_CLASS: Ruleset = require("./Hierarchy.GroupedByClass.json"); // eslint-disable-line @typescript-eslint/no-var-requires

const RULESET_MODELS_SEARCH: Ruleset = require("./ModelsTreeSearch.json"); // eslint-disable-line @typescript-eslint/no-var-requires

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
   * Should the tree group displayed element nodes by class.
   * @beta
   */
  enableElementsClassGrouping?: ClassGroupingOption;
  /**
   * Auto-update the hierarchy when data in the iModel changes.
   * @alpha
   */
  enableHierarchyAutoUpdate?: boolean;
  /**
   * Custom visibility handler.
   * @alpha
   */
  modelsVisibilityHandler?: ModelsVisibilityHandler;
  /**
   * Custom data provider to use for testing
   * @internal
   */
  dataProvider?: IPresentationTreeDataProvider;
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
    ruleset: (!props.enableElementsClassGrouping) ? RULESET_MODELS : /* istanbul ignore next */ RULESET_MODELS_GROUPED_BY_CLASS,
    appendChildrenCountForGroupingNodes: (props.enableElementsClassGrouping === ClassGroupingOption.YesWithCounts),
    pagingSize: PAGING_SIZE,
    enableHierarchyAutoUpdate: props.enableHierarchyAutoUpdate,
  });
  const searchNodeLoader = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    dataProvider: props.dataProvider,
    ruleset: RULESET_MODELS_SEARCH,
    pagingSize: PAGING_SIZE,
    preloadingEnabled: props.enablePreloading,
    enableHierarchyAutoUpdate: props.enableHierarchyAutoUpdate,
  });

  const nodeLoaderInUse = props.filterInfo?.filter ? searchNodeLoader : nodeLoader;
  const { filteredNodeLoader, isFiltering, nodeHighlightingProps } = useVisibilityTreeFiltering(nodeLoaderInUse, props.filterInfo, props.onFilterApplied);
  const filterApplied = filteredNodeLoader !== nodeLoaderInUse;
  const filteredDataProvider = filterApplied ? filteredNodeLoader.dataProvider : undefined;

  const { activeView, modelsVisibilityHandler, selectionPredicate } = props;
  const nodeSelectionPredicate = React.useCallback((key: NodeKey, node: TreeNodeItem) => {
    return !selectionPredicate ? true : selectionPredicate(key, getNodeType(node, nodeLoader.dataProvider));
  }, [selectionPredicate, nodeLoader.dataProvider]);

  const visibilityHandler = useVisibilityHandler(nodeLoaderInUse.dataProvider.rulesetId, activeView, modelsVisibilityHandler, filteredDataProvider);
  const eventHandler = useDisposable(React.useCallback(() => new VisibilityTreeEventHandler({
    nodeLoader: filteredNodeLoader,
    visibilityHandler,
    collapsedChildrenDisposalEnabled: true,
    selectionPredicate: nodeSelectionPredicate,
  }), [filteredNodeLoader, visibilityHandler, nodeSelectionPredicate]));

  const visibleNodes = useVisibleTreeNodes(filteredNodeLoader.modelSource);
  const treeRenderer = useVisibilityTreeRenderer(true, false);

  const overlay = isFiltering ? <div className="filteredTreeOverlay" /> : undefined;

  // istanbul ignore next
  const noFilteredDataRenderer = React.useCallback(() => {
    return <VisibilityTreeNoFilteredData
      title={UiFramework.i18n.translate("UiFramework:modelTree.noModelFound")}
      message={UiFramework.i18n.translate("UiFramework:modelTree.noMatchingModelNames")}
    />;
  }, []);

  return (
    <div className="ui-fw-models-tree" ref={props.rootElementRef}>
      <ControlledTree
        nodeLoader={filteredNodeLoader}
        visibleNodes={visibleNodes}
        selectionMode={props.selectionMode || SelectionMode.None}
        treeEvents={eventHandler}
        treeRenderer={treeRenderer}
        nodeHighlightingProps={nodeHighlightingProps}
        noDataRenderer={filterApplied ? noFilteredDataRenderer : undefined}
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
export const IModelConnectedModelsTree = connectIModelConnection(null, null)(ModelsTree); // eslint-disable-line @typescript-eslint/naming-convention

const useVisibilityHandler = (rulesetId: string, activeView?: Viewport, visibilityHandler?: ModelsVisibilityHandler, filteredDataProvider?: IPresentationTreeDataProvider) => {
  const defaultVisibilityHandler = useOptionalDisposable(React.useCallback(() => {
    return visibilityHandler ? undefined : createVisibilityHandler(rulesetId, activeView);
  }, [visibilityHandler, rulesetId, activeView]));

  const handler = visibilityHandler ?? defaultVisibilityHandler;

  React.useEffect(() => {
    handler && handler.setFilteredDataProvider(filteredDataProvider);
  }, [handler, filteredDataProvider]);

  return handler;
};

const createVisibilityHandler = (rulesetId: string, activeView?: Viewport): ModelsVisibilityHandler | undefined => {
  // istanbul ignore next
  return activeView ? new ModelsVisibilityHandler({ rulesetId, viewport: activeView }) : undefined;
};

const getNodeType = (item: TreeNodeItem, dataProvider: IPresentationTreeDataProvider) => {
  if (NodeKey.isClassGroupingNodeKey(dataProvider.getNodeKey(item)))
    return ModelsTreeNodeType.Grouping;

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
  const statusStringId = `UiFramework:modelTree.status.${status}`;
  const statusString = UiFramework.i18n.translate(statusStringId);
  if (!tooltipStringId)
    return statusString;

  tooltipStringId = `UiFramework:modelTree.tooltips.${tooltipStringId}`;
  const tooltipString = UiFramework.i18n.translate(tooltipStringId);
  return `${statusString}: ${tooltipString}`;
};

const isSubjectNode = (node: TreeNodeItem) => (node.extendedData && node.extendedData.isSubject);
const isModelNode = (node: TreeNodeItem) => (node.extendedData && node.extendedData.isModel);
const isCategoryNode = (node: TreeNodeItem) => (node.extendedData && node.extendedData.isCategory);

/**
 * Props for [[ModelsVisibilityHandler]]
 * @alpha
 */
export interface ModelsVisibilityHandlerProps {
  rulesetId: string;
  viewport: Viewport;
}

/**
 * Visibility handler used by [[ModelsTree]] to control visibility of the tree items.
 * @alpha
 */
export class ModelsVisibilityHandler implements IVisibilityHandler {
  private _props: ModelsVisibilityHandlerProps;
  private _pendingVisibilityChange: any | undefined;
  private _subjectModelIdsCache: SubjectModelIdsCache;
  private _filteredDataProvider?: IPresentationTreeDataProvider;

  constructor(props: ModelsVisibilityHandlerProps) {
    this._props = props;
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

  public onVisibilityChange = new BeEvent<VisibilityChangeListener>();

  /** Sets data provider that is used to get filtered tree hierarchy. */
  public setFilteredDataProvider(provider: IPresentationTreeDataProvider | undefined) { this._filteredDataProvider = provider; }

  /** Returns visibility status of the tree node. */
  public getVisibilityStatus(node: TreeNodeItem, nodeKey: NodeKey): VisibilityStatus | Promise<VisibilityStatus> {
    if (NodeKey.isClassGroupingNodeKey(nodeKey))
      return this.getElementGroupingNodeDisplayStatus(node.id, nodeKey);

    if (!NodeKey.isInstancesNodeKey(nodeKey))
      return { state: "hidden", isDisabled: true };

    if (isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this.getSubjectNodeVisibility(nodeKey.instanceKeys.map((key) => key.id), node);
    }
    if (isModelNode(node))
      return this.getModelDisplayStatus(nodeKey.instanceKeys[0].id);
    if (isCategoryNode(node))
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

    if (isSubjectNode(node)) {
      await this.changeSubjectNodeState(nodeKey.instanceKeys.map((key) => key.id), node, on);
    } else if (isModelNode(node)) {
      await this.changeModelState(nodeKey.instanceKeys[0].id, on);
    } else if (isCategoryNode(node)) {
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

  private async getFilteredSubjectDisplayStatus(provider: IPresentationTreeDataProvider, ids: Id64String[], node: TreeNodeItem): Promise<VisibilityStatus> {
    const children = await provider.getNodes(node);
    if (children.length === 0)
      return this.getSubjectDisplayStatus(ids);

    const hiddenModelIds = await this.getSubjectHiddenModelIds(ids);
    if (hiddenModelIds.some((modelId) => this.getModelDisplayStatus(modelId).state === "visible"))
      return { state: "visible", tooltip: createTooltip("visible", "subject.atLeastOneModelVisible") };

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
    const { modelId, categoryId, elementIds } = await this.getGroupedElementIds(this._props.rulesetId, key);

    if (!modelId || !this._props.viewport.view.viewsModel(modelId))
      return { isDisabled: true, state: "hidden", tooltip: createTooltip("disabled", "element.modelNotDisplayed") };

    const atLeastOneElementForceDisplayed = (this._props.viewport.alwaysDrawn !== undefined)
      && elementIds.some((elementId) => this._props.viewport.alwaysDrawn!.has(elementId));
    if (atLeastOneElementForceDisplayed)
      return { state: "visible", tooltip: createTooltip("visible", "element.displayedThroughAlwaysDrawnList") };

    if (this._props.viewport.alwaysDrawn !== undefined && this._props.viewport.alwaysDrawn.size !== 0 && this._props.viewport.isAlwaysDrawnExclusive)
      return { state: "hidden", tooltip: createTooltip("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn") };

    const allElementsForceHidden = (this._props.viewport.neverDrawn !== undefined)
      && elementIds.every((elementId) => this._props.viewport.neverDrawn!.has(elementId));
    if (allElementsForceHidden)
      return { state: "hidden", tooltip: createTooltip("visible", "element.hiddenThroughNeverDrawnList") };

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

  private async changeFilteredSubjectState(provider: IPresentationTreeDataProvider, ids: Id64String[], node: TreeNodeItem, on: boolean) {
    const children = await provider.getNodes(node);
    if (children.length === 0)
      return this.changeSubjectState(ids, on);

    const hiddenModels = await this.getSubjectHiddenModelIds(ids);
    const childrenPromises = children.map(async (childNode) => this.changeVisibility(childNode, provider.getNodeKey(childNode), on));
    return Promise.all([this.changeModelsVisibility(hiddenModels, on), ...childrenPromises]);
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
    const { modelId, categoryId, elementIds } = await this.getGroupedElementIds(this._props.rulesetId, key);
    this.changeElementsState(modelId, categoryId, elementIds, on);
  }

  protected async changeElementState(id: Id64String, modelId: Id64String | undefined, categoryId: Id64String | undefined, on: boolean) {
    this.changeElementsState(modelId, categoryId, [id, ...await this.getAssemblyElementIds(this._props.rulesetId, id)], on);
  }

  protected changeElementsState(modelId: Id64String | undefined, categoryId: Id64String | undefined, elementIds: Id64String[], on: boolean) {
    const isDisplayedByDefault = modelId && this.getModelDisplayStatus(modelId).state === "visible"
      && categoryId && this.getCategoryDisplayStatus(categoryId, modelId).state === "visible";
    const isHiddenDueToExclusiveAlwaysDrawnElements = this._props.viewport.isAlwaysDrawnExclusive && this._props.viewport.alwaysDrawn && 0 !== this._props.viewport.alwaysDrawn.size;
    const currNeverDrawn = new Set(this._props.viewport.neverDrawn ? this._props.viewport.neverDrawn : []);
    const currAlwaysDrawn = new Set(this._props.viewport.alwaysDrawn ?
      this._props.viewport.alwaysDrawn : /* istanbul ignore next */[],
    );
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

  private async getSubjectHiddenModelIds(subjectIds: Id64String[]) {
    return (await Promise.all(subjectIds.map(async (id) => this._subjectModelIdsCache.getSubjectHiddenModels(id))))
      .reduce((modelIds: Id64String[], currIds: Id64String[]) => [...modelIds, ...currIds]);
  }

  // istanbul ignore next
  private async getAssemblyElementIds(rulesetId: string, assemblyId: Id64String) {
    const provider = new AssemblyElementIdsProvider(this._props.viewport.iModel, rulesetId, assemblyId);
    return provider.getElementIds();
  }

  // istanbul ignore next
  private async getGroupedElementIds(rulesetId: string, groupingNodeKey: GroupingNodeKey) {
    const provider = new GroupedElementIdsProvider(this._props.viewport.iModel, rulesetId, groupingNodeKey);
    return provider.getElementIds();
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
      SELECT p.ECInstanceId id, s.ECInstanceId subjectId, json_extract(p.JsonProperties, '$.PhysicalPartition.Model.Content') content
      FROM bis.InformationPartitionElement p
      INNER JOIN bis.GeometricModel3d m ON m.ModeledElement.Id = p.ECInstanceId
      INNER JOIN bis.Subject s ON (s.ECInstanceId = p.Parent.Id OR json_extract(s.JsonProperties, '$.Subject.Model.TargetPartition') = printf('0x%x', p.ECInstanceId))
      WHERE NOT m.IsPrivate`;
    const result = this._imodel.query(ecsql);
    for await (const row of result) {
      let list = this._subjectModels.get(row.subjectId);
      if (!list) {
        list = [];
        this._subjectModels.set(row.subjectId, list);
      }
      const isHidden = row.content !== undefined;
      list.push({ id: row.id, isHidden });
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

  public async getSubjectHiddenModels(subjectId: Id64String): Promise<Id64String[]> {
    await this.initCache();
    const subjectModels = this._subjectModels!.get(subjectId);
    return subjectModels ? subjectModels.filter((info) => info.isHidden).map((info) => info.id) : /* istanbul ignore next */[];
  }
}

// istanbul ignore next
class RulesetDrivenIdsProvider extends ContentDataProvider {
  constructor(imodel: IModelConnection, rulesetId: string, displayType: string, inputKeys: Keys) {
    super({ imodel, ruleset: rulesetId, displayType });
    this.keys = new KeySet(inputKeys);
  }
  protected shouldConfigureContentDescriptor() { return false; }
  protected getDescriptorOverrides(): DescriptorOverrides {
    return {
      displayType: this.displayType,
      contentFlags: ContentFlags.KeysOnly,
      hiddenFieldNames: [],
    };
  }
  protected async getResultIds() {
    const content = await this.getContent();
    if (!content)
      return [];

    const result: string[] = [];
    content.contentSet.forEach((item) => {
      result.push(...item.primaryKeys.map((k) => k.id));
    });
    return result;
  }
}

// istanbul ignore next
class AssemblyElementIdsProvider extends RulesetDrivenIdsProvider {
  constructor(imodel: IModelConnection, rulesetId: string, assemblyId: Id64String) {
    super(imodel, rulesetId, "AssemblyElementsRequest", [{ className: "BisCore:Element", id: assemblyId }]);
  }
  public async getElementIds() {
    return this.getResultIds();
  }
}

// istanbul ignore next
class GroupedElementIdsProvider extends RulesetDrivenIdsProvider {
  constructor(imodel: IModelConnection, rulesetId: string, groupingNodeKey: GroupingNodeKey) {
    super(imodel, rulesetId, "AssemblyElementsRequest", [groupingNodeKey]);
  }
  public async getElementIds(): Promise<{ modelId?: Id64String, categoryId?: Id64String, elementIds: Id64String[] }> {
    const elementIds = await this.getResultIds();
    let modelId, categoryId;
    const query = `SELECT Model.Id AS modelId, Category.Id AS categoryId FROM bis.GeometricElement3d WHERE ECInstanceId = ? LIMIT 1`;
    for await (const modelAndCategoryIds of this.imodel.query(query, [elementIds[0]])) {
      modelId = modelAndCategoryIds.modelId;
      categoryId = modelAndCategoryIds.categoryId;
    }
    return { modelId, categoryId, elementIds };
  }
}
