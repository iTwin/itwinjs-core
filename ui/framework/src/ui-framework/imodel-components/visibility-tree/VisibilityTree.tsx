/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelComponents */

import * as React from "react";
import { Id64String, IDisposable } from "@bentley/bentleyjs-core";
import { IModelConnection, Viewport, PerModelCategoryVisibility } from "@bentley/imodeljs-frontend";
import { KeySet, Ruleset, NodeKey, InstanceKey, RegisteredRuleset, ContentFlags, DescriptorOverrides } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import {
  IPresentationTreeDataProvider, PresentationTreeDataProvider,
  treeWithUnifiedSelection, ContentDataProvider,
} from "@bentley/presentation-components";
import {
  CheckBoxInfo, CheckBoxState, isPromiseLike, ImageCheckBox, NodeCheckboxRenderProps,
} from "@bentley/ui-core";
import { Tree as BasicTree, SelectionMode, TreeNodeItem } from "@bentley/ui-components";
import { UiFramework } from "../../UiFramework";
import "./VisibilityTree.scss";

// tslint:disable-next-line:variable-name naming-convention
const Tree = treeWithUnifiedSelection(BasicTree);

const pageSize = 20;

/** @internal */
export const RULESET: Ruleset = require("./Hierarchy.json"); // tslint:disable-line: no-var-requires
let rulesetRegistered = 0;

/** Props for [[VisibilityTree]] component
 * @public
 */
export interface VisibilityTreeProps {
  /** An IModel to pull data from */
  imodel: IModelConnection;
  /** Active view used to determine and control visibility */
  activeView?: Viewport;
  /** Selection mode in the tree */
  selectionMode?: SelectionMode;
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
}

/** State for [[VisibilityTree]] component
 * @internal
 */
interface VisibilityTreeState {
  prevProps: VisibilityTreeProps;
  ruleset: Ruleset;
  dataProvider: IPresentationTreeDataProvider;
  checkboxInfo: (node: TreeNodeItem) => CheckBoxInfo | Promise<CheckBoxInfo>;
}

/**
 * A tree component that shows a subject - model - category - element
 * hierarchy along with checkboxes that represent and allow changing
 * the display of those instances.
 * @public
 */
export class VisibilityTree extends React.PureComponent<VisibilityTreeProps, VisibilityTreeState> {

  private _treeRef: React.RefObject<BasicTree>;
  private _visibilityHandler?: VisibilityHandler;
  private _rulesetRegistration?: RegisteredRuleset;

  public constructor(props: VisibilityTreeProps) {
    super(props);
    this.state = {
      prevProps: props,
      ruleset: RULESET,
      dataProvider: props.dataProvider ? props.dataProvider : createDataProvider(props.imodel),
      checkboxInfo: this.createCheckBoxInfoCallback(),
    };
    this._treeRef = React.createRef();
    if (props.visibilityHandler) {
      this._visibilityHandler = props.visibilityHandler;
      this._visibilityHandler.onVisibilityChange = this.onVisibilityChange;
    } else if (props.activeView) {
      this._visibilityHandler = this.createVisibilityHandler(props.activeView);
    }
    this.registerRuleset(); // tslint:disable-line:no-floating-promises
  }

  public static getDerivedStateFromProps(nextProps: VisibilityTreeProps, state: VisibilityTreeState): Partial<VisibilityTreeState> | null {
    const base = { ...state, prevProps: nextProps };
    if (nextProps.imodel !== state.prevProps.imodel || nextProps.dataProvider !== state.prevProps.dataProvider)
      return { ...base, dataProvider: nextProps.dataProvider ? nextProps.dataProvider : createDataProvider(nextProps.imodel) };
    return base;
  }

  public componentDidUpdate(prevProps: VisibilityTreeProps, _prevState: VisibilityTreeState) {
    if (!this.props.visibilityHandler && this.props.activeView !== prevProps.activeView) {
      if (this._visibilityHandler) {
        this._visibilityHandler.dispose();
        this._visibilityHandler = undefined;
      }
      if (this.props.activeView) {
        this._visibilityHandler = this.createVisibilityHandler(this.props.activeView);
      }
      this.setState({ checkboxInfo: this.createCheckBoxInfoCallback() });
    }
  }

  public componentWillUnmount() {
    if (this._visibilityHandler) {
      this._visibilityHandler.dispose();
      this._visibilityHandler = undefined;
    }
    this.unregisterRuleset(); // tslint:disable-line:no-floating-promises
  }

  private createVisibilityHandler(viewport: Viewport): VisibilityHandler {
    return new VisibilityHandler({
      viewport,
      dataProvider: this.state.dataProvider,
      onVisibilityChange: this.onVisibilityChange,
    });
  }

  private async registerRuleset() {
    if (rulesetRegistered++ === 0 && !this.props.dataProvider) {
      const result = await Presentation.presentation.rulesets().add(RULESET);
      if (rulesetRegistered > 0) {
        // still more than 0, save the registration
        this._rulesetRegistration = result;
      } else {
        // registrations count already 0 - registration is no more relevant
        await Presentation.presentation.rulesets().remove(result);
      }
    }
  }

  private async unregisterRuleset() {
    if (--rulesetRegistered === 0 && this._rulesetRegistration) {
      await Presentation.presentation.rulesets().remove(this._rulesetRegistration);
    }
  }

  // tslint:disable-next-line: naming-convention
  private onVisibilityChange = () => {
    this.setState({ checkboxInfo: this.createCheckBoxInfoCallback() });
  }

  private createCheckBoxInfoCallback() {
    const combine = (status: CheckBoxInfo) => ({
      isVisible: true,
      ...status,
    });
    return (node: TreeNodeItem): CheckBoxInfo | Promise<CheckBoxInfo> => {
      const status = this.getNodeCheckBoxInfo(node);
      if (isPromiseLike(status))
        return status.then(combine);
      return combine(status);
    };
  }

  private getNodeCheckBoxInfo(node: TreeNodeItem): CheckBoxInfo | Promise<CheckBoxInfo> {
    if (!this._visibilityHandler)
      return { isVisible: false };

    const result = this._visibilityHandler.getDisplayStatus(node);
    if (isPromiseLike(result))
      return result.then(createCheckBoxInfo);
    return createCheckBoxInfo(result);
  }

  // tslint:disable-next-line: naming-convention
  private onCheckboxStateChange = async (stateChanges: Array<{ node: TreeNodeItem, newState: CheckBoxState }>) => {
    if (!this._visibilityHandler)
      return;

    for (const { node, newState } of stateChanges) {
      // tslint:disable-next-line: no-floating-promises
      this._visibilityHandler.changeVisibility(node, newState === CheckBoxState.On);
    }
  }

  // tslint:disable-next-line: naming-convention
  private renderNodeCheckbox = (props: NodeCheckboxRenderProps): React.ReactNode => (
    <ImageCheckBox
      checked={props.checked}
      disabled={props.disabled}
      imageOn="icon-visibility"
      imageOff="icon-visibility-hide-2"
      onClick={props.onChange}
      tooltip={props.title}
    />
  )

  public render() {
    return (
      <div className="fw-visibility-tree">
        <Tree
          ref={this._treeRef}
          dataProvider={this.state.dataProvider}
          selectionMode={this.props.selectionMode}
          checkboxInfo={this.state.checkboxInfo}
          onCheckboxClick={this.onCheckboxStateChange}
          showIcons={true}
          renderOverrides={{ renderCheckbox: this.renderNodeCheckbox }}
          pageSize={pageSize}
        />
      </div>
    );
  }
}

const createDataProvider = (imodel: IModelConnection): IPresentationTreeDataProvider => {
  const provider = new PresentationTreeDataProvider(imodel, RULESET.id);
  provider.pagingSize = pageSize;
  return provider;
};

const createCheckBoxInfo = (status: VisibilityStatus): CheckBoxInfo => ({
  state: status.isDisplayed ? CheckBoxState.On : CheckBoxState.Off,
  isDisabled: status.isDisabled,
  isVisible: true,
  tooltip: status.tooltip,
});

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
  }

  public get onVisibilityChange() { return this._onVisibilityChange; }
  public set onVisibilityChange(callback: () => void) { this._onVisibilityChange = callback; }

  public getDisplayStatus(node: TreeNodeItem): VisibilityStatus | Promise<VisibilityStatus> {
    const key = this._props.dataProvider.getNodeKey(node);
    if (!NodeKey.isInstanceNodeKey(key))
      return { isDisplayed: false, isDisabled: true };

    if (isSubjectNode(node))
      return this.getSubjectDisplayStatus(key.instanceKey.id);
    if (isModelNode(node))
      return this.getModelDisplayStatus(key.instanceKey.id);
    if (isCategoryNode(node))
      return this.getCategoryDisplayStatus(key.instanceKey.id, this.getCategoryParentModelId(node));
    return this.getElementDisplayStatus(key.instanceKey.id, this.getElementModelId(node), this.getElementCategoryId(node));
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

  private async getSubjectDisplayStatus(id: Id64String): Promise<VisibilityStatus> {
    const modelIds = await this.getSubjectModelIds(id);
    const isDisplayed = modelIds.some((modelId) => this.getModelDisplayStatus(modelId).isDisplayed);
    if (isDisplayed)
      return { isDisplayed, tooltip: createTooltip("visible", "subject.atLeastOneModelVisible") };
    return { isDisplayed, tooltip: createTooltip("hidden", "subject.allModelsHidden") };
  }

  private getModelDisplayStatus(id: Id64String): VisibilityStatus {
    const isDisplayed = this._props.viewport.view.isSpatialView() && this._props.viewport.view.viewsModel(id);
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
    if (this._props.viewport.alwaysDrawn !== undefined && this._props.viewport.alwaysDrawn.has(elementId))
      return { isDisplayed: true, tooltip: createTooltip("visible", "element.displayedThroughAlwaysDrawnList") };
    if (categoryId && this.getCategoryDisplayStatus(categoryId, modelId).isDisplayed)
      return { isDisplayed: true, tooltip: createTooltip("visible", undefined) };
    return { isDisplayed: false, tooltip: createTooltip("hidden", "element.hiddenThroughCategory") };
  }

  public async changeVisibility(node: TreeNodeItem, on: boolean) {
    const key = this._props.dataProvider.getNodeKey(node);
    if (!NodeKey.isInstanceNodeKey(key))
      return;

    if (isSubjectNode(node)) {
      await this.changeSubjectState(key.instanceKey.id, on);
    } else if (isModelNode(node)) {
      await this.changeModelState(key.instanceKey.id, on);
    } else if (isCategoryNode(node)) {
      this.changeCategoryState(key.instanceKey.id, this.getCategoryParentModelId(node), on);
    } else {
      await this.changeElementState(key.instanceKey.id, this.getElementModelId(node), this.getElementCategoryId(node), on);
    }
  }

  private async changeSubjectState(id: Id64String, on: boolean) {
    if (!this._props.viewport.view.isSpatialView())
      return;

    const modelIds = await this.getSubjectModelIds(id);
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
    const currNeverDrawn = new Set(this._props.viewport.neverDrawn ? this._props.viewport.neverDrawn : []);
    const currAlwaysDrawn = new Set(this._props.viewport.alwaysDrawn ? this._props.viewport.alwaysDrawn : []);
    const elementIds = [id, ...await this.getAssemblyElementIds(id)];
    elementIds.forEach((elementId) => {
      if (on) {
        currNeverDrawn.delete(elementId);
        if (!isDisplayedByDefault)
          currAlwaysDrawn.add(elementId);
      } else {
        currAlwaysDrawn.delete(elementId);
        if (isDisplayedByDefault)
          currNeverDrawn.add(elementId);
      }
    });
    this._props.viewport.setNeverDrawn(currNeverDrawn);
    this._props.viewport.setAlwaysDrawn(currAlwaysDrawn);
  }

  // tslint:disable-next-line: naming-convention
  private onViewChanged = (_vp: Viewport) => {
    this._onVisibilityChange();
  }

  // tslint:disable-next-line: naming-convention
  private onElementAlwaysDrawnChanged = () => {
    this._onVisibilityChange();
  }

  // tslint:disable-next-line: naming-convention
  private onElementNeverDrawnChanged = () => {
    this._onVisibilityChange();
  }

  private async getSubjectModelIds(subjectId: Id64String): Promise<Id64String[]> {
    return this._subjectModelIdsCache.getSubjectModelIds(subjectId);
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
    const result = this._imodel.query(ecsql, undefined, 1000);
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
    const ecsql = `SELECT p.ECInstanceId id, p.Parent.Id subjectId FROM bis.InformationPartitionElement p JOIN bis.Model m ON m.ModeledElement.Id = p.ECInstanceId`;
    const result = this._imodel.query(ecsql, undefined, 1000);
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
    super(imodel, RULESET.id, displayType);
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
