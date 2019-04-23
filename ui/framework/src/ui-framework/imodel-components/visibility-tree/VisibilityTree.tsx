/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelComponents */

import * as React from "react";
import { Id64String, IDisposable } from "@bentley/bentleyjs-core";
import { IModelConnection, Viewport, PerModelCategoryVisibility } from "@bentley/imodeljs-frontend";
import { KeySet, isInstanceNodeKey, Ruleset, InstanceKey, RegisteredRuleset, ContentFlags, DescriptorOverrides } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { IPresentationTreeDataProvider, PresentationTreeDataProvider, treeWithUnifiedSelection, ContentDataProvider } from "@bentley/presentation-components";
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

  // tslint:disable-next-line: naming-convention
  private getLoadedNode = (id: string): TreeNodeItem | undefined => {
    if (!this._treeRef.current)
      return undefined;
    return this._treeRef.current.getLoadedNode(id);
  }

  private createVisibilityHandler(viewport: Viewport): VisibilityHandler {
    return new VisibilityHandler({
      viewport,
      dataProvider: this.state.dataProvider,
      getLoadedNode: this.getLoadedNode,
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
  private onCheckboxStateChange = async (node: TreeNodeItem, state: CheckBoxState) => {
    if (!this._visibilityHandler)
      return;

    // tslint:disable-next-line: no-floating-promises
    this._visibilityHandler.changeVisibility(node, state === CheckBoxState.On);
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
  getLoadedNode: (id: string) => TreeNodeItem | undefined;
  onVisibilityChange: () => void;
}

/** @internal */
export class VisibilityHandler implements IDisposable {

  private _props: VisibilityHandlerProps;
  private _onVisibilityChange: () => void;
  private _subjectModelIdsCache = new Map<Id64String, Id64String[]>();
  private _elementDisplayCache = new Map<Id64String, VisibilityStatus | Promise<VisibilityStatus>>();
  private _elementCategoryAndModelLoader: ElementCategoryAndModelRequestor;

  constructor(props: VisibilityHandlerProps) {
    this._props = props;
    this._onVisibilityChange = props.onVisibilityChange;
    this._elementCategoryAndModelLoader = new ElementCategoryAndModelRequestor(this._props.viewport.iModel);
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
    if (isInstanceNodeKey(key)) {
      switch (key.instanceKey.className) {
        case "BisCore:Subject":
          return this.getSubjectDisplayStatus(key.instanceKey.id);
        case "BisCore:PhysicalModel":
          return this.getModelDisplayStatus(key.instanceKey.id);
        case "BisCore:SpatialCategory":
        case "BisCore:DrawingCategory":
          return this.getCategoryDisplayStatus(key.instanceKey.id, this.getCategoryParentModelId(node));
        default:
          return this.getElementDisplayStatus(key.instanceKey.id);
      }
    }
    return { isDisplayed: false, isDisabled: true };
  }

  private getCategoryParentModelId(categoryNode: TreeNodeItem): Id64String | undefined {
    if (!categoryNode.parentId) {
      return undefined;
    }

    const parentNode = this._props.getLoadedNode(categoryNode.parentId);
    if (!parentNode) {
      return undefined;
    }

    const parentNodeKey = this._props.dataProvider.getNodeKey(parentNode);
    if (!isInstanceNodeKey(parentNodeKey)) {
      return undefined;
    }

    return parentNodeKey.instanceKey.id;
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

  private getElementDisplayStatus(id: Id64String): VisibilityStatus | Promise<VisibilityStatus> {
    let result = this._elementDisplayCache.get(id);
    if (undefined === result) {
      result = this._elementCategoryAndModelLoader.getCategoryAndModelId(id).then((props) => {
        if (!this._props.viewport.view.viewsModel(props.modelId))
          return { isDisabled: true, isDisplayed: false, tooltip: createTooltip("disabled", "element.modelNotDisplayed") };
        if (this._props.viewport.neverDrawn !== undefined && this._props.viewport.neverDrawn.has(id))
          return { isDisplayed: false, tooltip: createTooltip("hidden", "element.hiddenThroughNeverDrawnList") };
        if (this._props.viewport.alwaysDrawn !== undefined && this._props.viewport.alwaysDrawn.has(id))
          return { isDisplayed: true, tooltip: createTooltip("visible", "element.displayedThroughAlwaysDrawnList") };
        const categoryDisplayStatus = this.getCategoryDisplayStatus(props.categoryId, props.modelId);
        if (categoryDisplayStatus.isDisplayed)
          return { isDisplayed: true, tooltip: createTooltip("visible", undefined) };
        return { isDisplayed: false, tooltip: createTooltip("hidden", "element.hiddenThroughCategory") };
      }).then((value) => {
        this._elementDisplayCache.set(id, value); // replace promise with an actual value
        return value;
      });
      this._elementDisplayCache.set(id, result);
    }
    return result;
  }

  public async changeVisibility(node: TreeNodeItem, on: boolean) {
    const key = this._props.dataProvider.getNodeKey(node);
    if (isInstanceNodeKey(key)) {
      switch (key.instanceKey.className) {
        case "BisCore:Subject":
          await this.changeSubjectState(key.instanceKey.id, on);
          break;
        case "BisCore:PhysicalModel":
          this.changeModelState(key.instanceKey.id, on);
          break;
        case "BisCore:SpatialCategory":
        case "BisCore:DrawingCategory":
          this.changeCategoryState(key.instanceKey.id, this.getCategoryParentModelId(node), on);
          break;
        default:
          await this.changeElementState(key.instanceKey.id, on);
      }
    }
    return false;
  }

  private async changeSubjectState(id: Id64String, on: boolean) {
    if (!this._props.viewport.view.isSpatialView())
      return;

    const modelIds = await this.getSubjectModelIds(id);
    this._props.viewport.changeModelDisplay(modelIds, on);
  }

  private changeModelState(id: Id64String, on: boolean) {
    if (!this._props.viewport.view.isSpatialView())
      return;

    this._props.viewport.changeModelDisplay([id], on);
  }

  private changeCategoryState(categoryId: Id64String, parentModelId: Id64String | undefined, on: boolean) {
    if (parentModelId) {
      const isDisplayedInSelector = this._props.viewport.view.viewsCategory(categoryId);
      const ovr = (on === isDisplayedInSelector) ? PerModelCategoryVisibility.Override.None
        : on ? PerModelCategoryVisibility.Override.Show : PerModelCategoryVisibility.Override.Hide;
      this._props.viewport.perModelCategoryVisibility.setOverride(parentModelId, categoryId, ovr);
    }
    this._props.viewport.changeCategoryDisplay([categoryId], on);
  }

  private async areElementCategoryAndModelDisplayed(elementId: Id64String): Promise<boolean> {
    return this._elementCategoryAndModelLoader.getCategoryAndModelId(elementId).then((props) => {
      return this.getModelDisplayStatus(props.modelId).isDisplayed
        && this.getCategoryDisplayStatus(props.categoryId, props.modelId).isDisplayed;
    });
  }

  private async changeElementState(id: Id64String, on: boolean) {
    const isDisplayedByDefault = await this.areElementCategoryAndModelDisplayed(id);
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
    this.clearDisplayCache();
    this._onVisibilityChange();
  }

  // tslint:disable-next-line: naming-convention
  private onElementAlwaysDrawnChanged = () => {
    this.clearDisplayCache();
    this._onVisibilityChange();
  }

  // tslint:disable-next-line: naming-convention
  private onElementNeverDrawnChanged = () => {
    this.clearDisplayCache();
    this._onVisibilityChange();
  }

  private clearDisplayCache() {
    this._elementDisplayCache.clear();
  }

  private async getSubjectModelIds(subjectId: Id64String): Promise<Id64String[]> {
    if (!this._subjectModelIdsCache.has(subjectId)) {
      const modelIdsProvider = new SubjectModelIdsProvider(this._props.viewport.iModel, subjectId);
      this._subjectModelIdsCache.set(subjectId, await modelIdsProvider.getModelIds());
    }
    return this._subjectModelIdsCache.get(subjectId)!;
  }

  private async getAssemblyElementIds(assemblyId: Id64String): Promise<Id64String[]> {
    const provider = new AssemblyElementIdsProvider(this._props.viewport.iModel, assemblyId);
    return provider.getElementIds();
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

class SubjectModelIdsProvider extends RulesetDrivenRecursiveIdsProvider {
  constructor(imodel: IModelConnection, subjectId: Id64String) {
    super(imodel, "SubjectModelsRequest", { className: "BisCore:Subject", id: subjectId });
  }
  public async getModelIds() {
    return this.getChildrenIds();
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

abstract class DelayedRequestor<TParam, TResult> {
  protected _imodel: IModelConnection;
  private _params = new Array<TParam>();
  private _activeRequest?: Promise<Map<TParam, TResult>>;
  public constructor(imodel: IModelConnection) {
    this._imodel = imodel;
  }
  protected async getResult(param: TParam): Promise<TResult> {
    this._params.push(param);
    const res = await this.aggregateResult;
    return res.get(param)!;
  }
  protected abstract createResultIterator(params: TParam[]): AsyncIterableIterator<{ id: TParam } & TResult>;
  private async createResult(): Promise<Map<TParam, TResult>> {
    const map = new Map<TParam, TResult>();
    if (this._params.length === 0) {
      return map;
    }
    const iter = this.createResultIterator(this._params);
    for await (const row of iter) {
      map.set(row.id, row);
    }
    return map;
  }
  // tslint:disable-next-line: naming-convention
  private get aggregateResult(): Promise<Map<TParam, TResult>> {
    if (!this._activeRequest) {
      this._activeRequest = new Promise((resolve: (result: Map<TParam, TResult>) => void) => {
        setTimeout(() => {
          // tslint:disable-next-line: no-floating-promises
          this.createResult().then(resolve);
          this._params = [];
          this._activeRequest = undefined;
        }, 0);
      });
    }
    return this._activeRequest;
  }
}

interface CategoryAndModelId {
  categoryId: Id64String;
  modelId: Id64String;
}

// cSpell:ignore printf

class ElementCategoryAndModelRequestor extends DelayedRequestor<Id64String, CategoryAndModelId> {
  protected createResultIterator(elementIds: Id64String[]): AsyncIterableIterator<{ id: Id64String, modelId: Id64String, categoryId: Id64String }> {
    const q = `
      SELECT e.ECInstanceId id, e.Model.Id modelId, printf('0x%x', COALESCE(ge3d.Category.Id, ge2d.Category.Id)) categoryId
      FROM [bis].Element e
      LEFT JOIN [bis].[GeometricElement3d] ge3d ON ge3d.ECInstanceId = e.ECInstanceId
      LEFT JOIN [bis].[GeometricElement2d] ge2d ON ge2d.ECInstanceId = e.ECInstanceId
      WHERE e.ECInstanceId IN (${new Array(elementIds.length).fill("?").join(",")})`;
    return this._imodel.query(q, elementIds);
  }
  public getCategoryAndModelId = async (elementId: Id64String) => this.getResult(elementId);
}
