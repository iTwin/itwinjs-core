/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import * as React from "react";
import { from } from "rxjs/internal/observable/from";
import { map } from "rxjs/internal/operators/map";
import { Id64String, IDisposable } from "@bentley/bentleyjs-core";
import { IModelConnection, Viewport, PerModelCategoryVisibility } from "@bentley/imodeljs-frontend";
import { NodeKey, Ruleset, InstanceKey, KeySet, DescriptorOverrides, ContentFlags } from "@bentley/presentation-common";
import {
  IPresentationTreeDataProvider, usePresentationTreeNodeLoader, useRulesetRegistration,
  UnifiedSelectionTreeEventHandler, UnifiedSelectionTreeEventHandlerParams, ContentDataProvider,
} from "@bentley/presentation-components";
import { useEffectSkipFirst, NodeCheckboxRenderProps, ImageCheckBox, CheckBoxState, isPromiseLike, useDisposable } from "@bentley/ui-core";
import {
  useVisibleTreeNodes, ControlledTree, SelectionMode, TreeNodeRendererProps, TreeNodeRenderer, TreeRendererProps,
  TreeRenderer, CheckBoxInfo, TreeCheckboxStateChangeEventArgs, CheckboxStateChange,
  TreeModelNode, TreeImageLoader, TreeModelChanges, AbstractTreeNodeLoaderWithProvider, TreeNodeItem,
  TreeSelectionModificationEventArgs, TreeSelectionReplacementEventArgs,
} from "@bentley/ui-components";
import { UiFramework } from "../../../ui-framework/UiFramework";
import { connectIModelConnection } from "../../../ui-framework/redux/connectIModel";

import "./ModelsTree.scss";

const PAGING_SIZE = 20;

/** Presentation rules used by [[ModelsTree]] component.
 * @internal
 */
export const RULESET_MODELS: Ruleset = require("./Hierarchy.json"); // tslint:disable-line: no-var-requires

/**
 * Types of nodes in Models tree
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
  /** An IModel to pull data from */
  imodel: IModelConnection;
  /** Active view used to determine and control visibility */
  activeView?: Viewport;
  /** Selection mode in the tree */
  selectionMode?: SelectionMode;
  /**
   * Predicate which indicates whether node can be selected or no
   * @alpha
   */
  selectionPredicate?: ModelsTreeSelectionPredicate;
  /**
   * Custom data provider to use for testing
   * @internal
   */
  dataProvider?: IPresentationTreeDataProvider;
  /**
   * Custom visibility handler to use for testing
   * @internal
   */
  visibilityHandler?: VisibilityHandler;
  /**
   * Ref to the root HTML element used by this component
   */
  rootElementRef?: React.Ref<HTMLDivElement>;
  /**
   * Start loading hierarchy as soon as the component is created
   */
  enablePreloading?: boolean;
}

/**
 * A tree component that shows a subject - model - category - element
 * hierarchy along with checkboxes that represent and allow changing
 * the display of those instances.
 * @public
 */
export function ModelsTree(props: ModelsTreeProps) {
  useRulesetRegistration(RULESET_MODELS);
  const selectionMode = props.selectionMode || SelectionMode.None;
  const nodeLoader = usePresentationTreeNodeLoader({
    imodel: props.imodel,
    ruleset: RULESET_MODELS.id,
    pageSize: PAGING_SIZE,
    preloadingEnabled: props.enablePreloading,
    dataProvider: props.dataProvider,
  });
  const modelSource = nodeLoader.modelSource;

  const visibilityHandler = useVisibilityHandler(props, nodeLoader.dataProvider);

  const eventHandler = useEventHandler(nodeLoader, visibilityHandler, props.selectionPredicate);

  const visibleNodes = useVisibleTreeNodes(modelSource);

  const treeRenderer = useTreeRenderer();

  return (
    <div className="fw-visibility-tree" ref={props.rootElementRef}>
      <ControlledTree
        visibleNodes={visibleNodes}
        nodeLoader={nodeLoader}
        treeEvents={eventHandler}
        selectionMode={selectionMode}
        treeRenderer={treeRenderer}
      />
    </div>
  );
}

/**
 * ModelsTree that is connected to the IModelConnection property in the Redux store. The
 * application must set up the Redux store and include the FrameworkReducer.
 * @alpha
 */
export const IModelConnectedModelsTree = connectIModelConnection(null, null)(ModelsTree); // tslint:disable-line:variable-name

const useTreeRenderer = () => {
  const renderNodeCheckbox = React.useCallback((props: NodeCheckboxRenderProps): React.ReactNode => (
    <ImageCheckBox
      checked={props.checked}
      disabled={props.disabled}
      imageOn="icon-visibility"
      imageOff="icon-visibility-hide-2"
      onClick={props.onChange}
      tooltip={props.title}
    />
  ), []);

  const imageLoader = React.useMemo(() => new TreeImageLoader(), []);
  const nodeRenderer = React.useCallback((props: TreeNodeRendererProps) => (
    <TreeNodeRenderer
      {...props}
      checkboxRenderer={renderNodeCheckbox}
      imageLoader={imageLoader}
    />
  ), [renderNodeCheckbox, imageLoader]);

  return React.useCallback((props: TreeRendererProps) => (
    <TreeRenderer
      {...props}
      nodeRenderer={nodeRenderer}
    />
  ), [nodeRenderer]);
};

const useVisibilityHandler = (props: ModelsTreeProps, dataProvider: IPresentationTreeDataProvider) => {
  const [handler, setHandler] = React.useState(() => createVisibilityHandler(props, dataProvider));

  React.useEffect(() => {
    return () => {
      if (handler)
        handler.dispose();
    };
  }, [handler]);

  useEffectSkipFirst(() => {
    setHandler(createVisibilityHandler(props, dataProvider));
  }, [props.activeView, props.visibilityHandler, dataProvider]);

  return handler;
};

const useEventHandler = (
  nodeLoader: AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>,
  visibilityHandler: VisibilityHandler | undefined,
  selectionPredicate?: ModelsTreeSelectionPredicate) => {
  const createEventHandler = React.useCallback(() => new EventHandler({
    nodeLoader,
    collapsedChildrenDisposalEnabled: true,
    visibilityHandler,
    selectionPredicate,
  }), [nodeLoader, visibilityHandler, selectionPredicate]);

  return useDisposable(createEventHandler);
};

const createVisibilityHandler = (props: ModelsTreeProps, dataProvider: IPresentationTreeDataProvider) => {
  if (props.visibilityHandler)
    return props.visibilityHandler;

  // istanbul ignore else
  if (!props.activeView)
    return undefined;

  // istanbul ignore next
  return new VisibilityHandler({
    viewport: props.activeView,
    dataProvider,
    onVisibilityChange: () => { },
  });
};

interface EventHandlerParams extends UnifiedSelectionTreeEventHandlerParams {
  visibilityHandler: VisibilityHandler | undefined;
  selectionPredicate?: ModelsTreeSelectionPredicate;
}

class EventHandler extends UnifiedSelectionTreeEventHandler {
  private _visibilityHandler: VisibilityHandler | undefined;
  private _selectionPredicate?: ModelsTreeSelectionPredicate;

  private _removeListener: () => void;

  constructor(params: EventHandlerParams) {
    super(params);
    this._visibilityHandler = params.visibilityHandler;
    this._selectionPredicate = params.selectionPredicate;

    if (this._visibilityHandler) {
      this._visibilityHandler.onVisibilityChange = () => this.updateCheckboxes();
    }

    this._removeListener = this.modelSource.onModelChanged.addListener((args) => this.updateCheckboxes(args[1]));
    this.updateCheckboxes(); // tslint:disable-line: no-floating-promises
  }

  public dispose() {
    super.dispose();
    this._removeListener();
  }

  private getNodeType(item: TreeNodeItem) {
    if (!item.extendedData)
      return ModelsTreeNodeType.Unknown;

    if (item.extendedData.isSubject)
      return ModelsTreeNodeType.Subject;
    if (item.extendedData.isModel)
      return ModelsTreeNodeType.Model;
    if (item.extendedData.isCategory)
      return ModelsTreeNodeType.Category;
    return ModelsTreeNodeType.Element;
  }

  private filterSelectionItems(items: TreeNodeItem[]) {
    if (!this._selectionPredicate)
      return items;

    return items.filter((item) => this._selectionPredicate!(this.getNodeKey(item), this.getNodeType(item)));
  }

  public onSelectionModified({ modifications }: TreeSelectionModificationEventArgs) {
    const filteredModification = from(modifications).pipe(
      map(({ selectedNodeItems, deselectedNodeItems }) => {
        return {
          selectedNodeItems: this.filterSelectionItems(selectedNodeItems),
          deselectedNodeItems: this.filterSelectionItems(deselectedNodeItems),
        };
      }),
    );
    return super.onSelectionModified({ modifications: filteredModification });
  }

  public onSelectionReplaced({ replacements }: TreeSelectionReplacementEventArgs) {
    const filteredReplacements = from(replacements).pipe(
      map(({ selectedNodeItems }) => {
        return {
          selectedNodeItems: this.filterSelectionItems(selectedNodeItems),
        };
      }),
    );
    return super.onSelectionReplaced({ replacements: filteredReplacements });
  }

  public onCheckboxStateChanged(event: TreeCheckboxStateChangeEventArgs) {
    event.stateChanges.subscribe({
      next: (changes: CheckboxStateChange[]) => {
        // istanbul ignore if
        if (!this._visibilityHandler)
          return;

        for (const { nodeItem, newState } of changes) {
          this._visibilityHandler.changeVisibility(nodeItem, newState === CheckBoxState.On); // tslint:disable-line: no-floating-promises
        }
      },
      complete: () => {
        this.updateCheckboxes(); // tslint:disable-line: no-floating-promises
      },
    });

    return undefined;
  }

  private async updateCheckboxes(modelChanges?: TreeModelChanges) {
    // if handling model change event only need to update newly added nodes
    const nodeStates = await (modelChanges ? this.collectAddedNodesCheckboxInfos(modelChanges.addedNodeIds) : this.collectAllNodesCheckboxInfos());
    if (nodeStates.size === 0)
      return;

    this.modelSource.modifyModel((model) => {
      for (const [nodeId, checkboxInfo] of nodeStates.entries()) {
        const node = model.getNode(nodeId);
        // istanbul ignore else
        if (node)
          node.checkbox = checkboxInfo;
      }
    });
  }

  private async collectAddedNodesCheckboxInfos(addedNodeIds: string[]) {
    const nodeStates = new Map<string, CheckBoxInfo>();
    for (const nodeId of addedNodeIds) {
      const node = this.modelSource.getModel().getNode(nodeId);
      // istanbul ignore if
      if (!node)
        continue;

      const info = await this.getNodeCheckBoxInfo(node);
      if (info)
        nodeStates.set(nodeId, info);
    }
    return nodeStates;
  }

  private async collectAllNodesCheckboxInfos() {
    const nodeStates = new Map<string, CheckBoxInfo>();
    for (const node of this.modelSource.getModel().iterateTreeModelNodes()) {
      const info = await this.getNodeCheckBoxInfo(node);
      if (info)
        nodeStates.set(node.id, info);
    }
    return nodeStates;
  }

  private async getNodeCheckBoxInfo(node: TreeModelNode): Promise<CheckBoxInfo | undefined> {
    if (!this._visibilityHandler)
      return node.checkbox.isVisible ? { ...node.checkbox, isVisible: false } : undefined;

    const result = this._visibilityHandler.getDisplayStatus(node.item);
    if (isPromiseLike(result))
      return this.createCheckboxInfo(node, await result);
    return this.createCheckboxInfo(node, result);
  }

  private createCheckboxInfo(node: TreeModelNode, status: VisibilityStatus) {
    const newInfo = {
      state: status.isDisplayed ? CheckBoxState.On : CheckBoxState.Off,
      isDisabled: status.isDisabled || false,
      isVisible: true,
      tooltip: status.tooltip,
    };

    if (node.checkbox.state !== newInfo.state || node.checkbox.isDisabled !== newInfo.isDisabled ||
      node.checkbox.isVisible !== newInfo.isVisible || node.checkbox.tooltip !== newInfo.tooltip) {
      return newInfo;
    }

    return undefined;
  }
}

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
export interface VisibilityStatus {
  isDisplayed: boolean;
  isDisabled?: boolean;
  tooltip?: string;
}

/** @internal */
export interface VisibilityHandlerProps {
  viewport: Viewport;
  dataProvider: IPresentationTreeDataProvider;
  onVisibilityChange: () => void;
}

/** @internal */
export class VisibilityHandler implements IDisposable {

  private _props: VisibilityHandlerProps;
  private _onVisibilityChange: () => void;
  private _pendingVisibilityChange: any | undefined;
  private _subjectModelIdsCache: SubjectModelIdsCache;

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
  public set onVisibilityChange(callback: () => void) { this._onVisibilityChange = callback; }

  public getDisplayStatus(node: TreeNodeItem): VisibilityStatus | Promise<VisibilityStatus> {
    const key = this._props.dataProvider.getNodeKey(node);
    if (!NodeKey.isInstancesNodeKey(key))
      return { isDisplayed: false, isDisabled: true };

    if (isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this.getSubjectDisplayStatus(key.instanceKeys.map((k) => k.id));
    }
    if (isModelNode(node))
      return this.getModelDisplayStatus(key.instanceKeys[0].id);
    if (isCategoryNode(node))
      return this.getCategoryDisplayStatus(key.instanceKeys[0].id, this.getCategoryParentModelId(node));
    return this.getElementDisplayStatus(key.instanceKeys[0].id, this.getElementModelId(node), this.getElementCategoryId(node));
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

  public async changeVisibility(node: TreeNodeItem, on: boolean) {
    const key = this._props.dataProvider.getNodeKey(node);
    if (!NodeKey.isInstancesNodeKey(key))
      return;

    if (isSubjectNode(node)) {
      await this.changeSubjectState(key.instanceKeys.map((k) => k.id), on);
    } else if (isModelNode(node)) {
      await this.changeModelState(key.instanceKeys[0].id, on);
    } else if (isCategoryNode(node)) {
      this.changeCategoryState(key.instanceKeys[0].id, this.getCategoryParentModelId(node), on);
    } else {
      await this.changeElementState(key.instanceKeys[0].id, this.getElementModelId(node), this.getElementCategoryId(node), on);
    }
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
    const isDisplayedByDefault = modelId && this.getModelDisplayStatus(modelId).isDisplayed
      && categoryId && this.getCategoryDisplayStatus(categoryId, modelId).isDisplayed;
    const isHiddenDueToExclusiveAlwaysDrawnElements = this._props.viewport.isAlwaysDrawnExclusive && this._props.viewport.alwaysDrawn && 0 !== this._props.viewport.alwaysDrawn.size;
    const currNeverDrawn = new Set(this._props.viewport.neverDrawn ? this._props.viewport.neverDrawn : []);
    const currAlwaysDrawn = new Set(this._props.viewport.alwaysDrawn ? this._props.viewport.alwaysDrawn : []);
    const elementIds = [id, ...await this.getAssemblyElementIds(id)];
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
      this._onVisibilityChange();
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
        JOIN bis.Model m ON m.ModeledElement.Id = p.ECInstanceId
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
