/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelComponents */

import * as React from "react";
import { Id64String, IDisposable } from "@bentley/bentleyjs-core";
import { IModelConnection, Viewport } from "@bentley/imodeljs-frontend";
import { KeySet, isInstanceNodeKey, Ruleset, InstanceKey, RegisteredRuleset, ContentFlags, DescriptorOverrides } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { IPresentationTreeDataProvider, PresentationTreeDataProvider, treeWithUnifiedSelection, ContentDataProvider } from "@bentley/presentation-components";
import {
  CheckBoxInfo, CheckBoxState, isPromiseLike, ImageCheckBox, NodeCheckboxRenderProps,
} from "@bentley/ui-core";
import { Tree as BasicTree, SelectionMode, TreeNodeItem } from "@bentley/ui-components";
import "./VisibilityTree.scss";

// tslint:disable-next-line:variable-name naming-convention
const Tree = treeWithUnifiedSelection(BasicTree);

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

  private _visibilityHandler?: VisibilityHandler;
  private _rulesetRegistration?: RegisteredRuleset;

  public constructor(props: VisibilityTreeProps) {
    super(props);
    if (props.visibilityHandler) {
      this._visibilityHandler = props.visibilityHandler;
      this._visibilityHandler.onVisibilityChange = this.onVisibilityChange;
    } else if (props.activeView) {
      this._visibilityHandler = new VisibilityHandler(props.activeView, this.onVisibilityChange);
    }
    this.state = {
      prevProps: props,
      ruleset: RULESET,
      dataProvider: props.dataProvider ? props.dataProvider : new PresentationTreeDataProvider(props.imodel, RULESET.id),
      checkboxInfo: this.createCheckBoxInfoCallback(),
    };
    this.registerRuleset(); // tslint:disable-line:no-floating-promises
  }

  public static getDerivedStateFromProps(nextProps: VisibilityTreeProps, state: VisibilityTreeState) {
    const base = { ...state, prevProps: nextProps };
    if (nextProps.imodel !== state.prevProps.imodel || nextProps.dataProvider !== state.prevProps.dataProvider)
      return { ...base, dataProvider: nextProps.dataProvider ? nextProps.dataProvider : new PresentationTreeDataProvider(nextProps.imodel, RULESET.id) };
    return base;
  }

  public componentDidUpdate(prevProps: VisibilityTreeProps, _prevState: VisibilityTreeState) {
    if (!this.props.visibilityHandler && this.props.activeView !== prevProps.activeView) {
      if (this._visibilityHandler) {
        this._visibilityHandler.dispose();
        this._visibilityHandler = undefined;
      }
      if (this.props.activeView)
        this._visibilityHandler = new VisibilityHandler(this.props.activeView, this.onVisibilityChange);
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
      return { isDisabled: true, state: CheckBoxState.Off };

    const key = this.state.dataProvider.getNodeKey(node);
    if (isInstanceNodeKey(key)) {
      const result = this._visibilityHandler.isDisplayed(key.instanceKey);
      if (isPromiseLike(result))
        return result.then((isDisplayed) => ({ state: isDisplayed ? CheckBoxState.On : CheckBoxState.Off }));
      return { state: result ? CheckBoxState.On : CheckBoxState.Off };
    }

    return { isVisible: false };
  }

  // tslint:disable-next-line: naming-convention
  private onCheckboxStateChange = async (node: TreeNodeItem, state: CheckBoxState) => {
    if (!this._visibilityHandler)
      return;

    const key = this.state.dataProvider.getNodeKey(node);
    if (isInstanceNodeKey(key))
      await this._visibilityHandler.changeVisibility(key.instanceKey, state === CheckBoxState.On);
  }

  // tslint:disable-next-line: naming-convention
  private renderNodeCheckbox = (props: NodeCheckboxRenderProps): React.ReactNode => (
    <ImageCheckBox
      checked={props.checked}
      disabled={props.disabled}
      imageOn="icon-visibility"
      imageOff="icon-visibility-hide-2"
      onClick={props.onChange}
    />
  )

  public render() {
    return (
      <div className="fw-visibility-tree">
        <Tree
          dataProvider={this.state.dataProvider}
          selectionMode={this.props.selectionMode}
          checkboxInfo={this.state.checkboxInfo}
          onCheckboxClick={this.onCheckboxStateChange}
          showIcons={true}
          renderOverrides={{ renderCheckbox: this.renderNodeCheckbox }}
          pageSize={20}
        />
      </div>
    );
  }
}

/** @internal */
export class VisibilityHandler implements IDisposable {

  private _vp: Viewport;
  private _onVisibilityChange: () => void;
  private _subjectModelIdsCache = new Map<Id64String, Id64String[]>();
  private _elementDisplayCache = new Map<Id64String, boolean | Promise<boolean>>();
  private _elementCategoryAndModelLoader: ElementCategoryAndModelRequestor;
  private _currentSelectorsState: ViewSelectorsState;

  constructor(vp: Viewport, onVisibilityChange: () => void) {
    this._vp = vp;
    this._onVisibilityChange = onVisibilityChange;
    this._elementCategoryAndModelLoader = new ElementCategoryAndModelRequestor(vp.iModel);
    this._currentSelectorsState = new ViewSelectorsState(vp);
    vp.onViewChanged.addListener(this.onViewChanged);
    vp.onAlwaysDrawnChanged.addListener(this.onElementAlwaysDrawnChanged);
    vp.onNeverDrawnChanged.addListener(this.onElementNeverDrawnChanged);
  }

  public dispose() {
    this._vp.onViewChanged.removeListener(this.onViewChanged);
    this._vp.onAlwaysDrawnChanged.removeListener(this.onElementAlwaysDrawnChanged);
    this._vp.onNeverDrawnChanged.removeListener(this.onElementNeverDrawnChanged);
  }

  public get onVisibilityChange() { return this._onVisibilityChange; }
  public set onVisibilityChange(callback: () => void) { this._onVisibilityChange = callback; }

  public isDisplayed(key: InstanceKey): boolean | Promise<boolean> {
    switch (key.className) {
      case "BisCore:Subject":
        return this.isSubjectDisplayed(key.id);
      case "BisCore:PhysicalModel":
        return this.isModelDisplayed(key.id);
      case "BisCore:SpatialCategory":
      case "BisCore:DrawingCategory":
        return this.isCategoryDisplayed(key.id);
      default:
        return this.isElementDisplayed(key.id);
    }
  }

  private async isSubjectDisplayed(id: Id64String): Promise<boolean> {
    const modelIds = await this.getSubjectModelIds(id);
    return modelIds.some((modelId) => this.isModelDisplayed(modelId));
  }

  private isModelDisplayed(id: Id64String): boolean {
    return this._vp.view.isSpatialView() && this._vp.view.viewsModel(id);
  }

  private isCategoryDisplayed(id: Id64String): boolean {
    return this._vp.view.viewsCategory(id);
  }

  private isElementDisplayed(id: Id64String): boolean | Promise<boolean> {
    let result = this._elementDisplayCache.get(id);
    if (undefined === result) {
      if (this._vp.neverDrawn !== undefined && this._vp.neverDrawn.has(id)) {
        result = false;
      } else {
        result = this._elementCategoryAndModelLoader.getCategoryAndModelId(id).then((props) => {
          if (!this._vp.view.viewsModel(props.modelId))
            return false;
          if (this._vp.alwaysDrawn !== undefined && this._vp.alwaysDrawn.has(id))
            return true;
          return this._vp.view.viewsCategory(props.categoryId);
        }).then((isDisplayed: boolean) => {
          this._elementDisplayCache.set(id, isDisplayed); // replace promise with an actual value
          return isDisplayed;
        });
      }
      this._elementDisplayCache.set(id, result);
    }
    return result;
  }

  public async changeVisibility(key: InstanceKey, on: boolean) {
    switch (key.className) {
      case "BisCore:Subject":
        await this.changeSubjectState(key.id, on);
        break;
      case "BisCore:PhysicalModel":
        this.changeModelState(key.id, on);
        break;
      case "BisCore:SpatialCategory":
      case "BisCore:DrawingCategory":
        this.changeCategoryState(key.id, on);
        break;
      default:
        await this.changeElementState(key.id, on);
    }
  }

  private async changeSubjectState(id: Id64String, on: boolean) {
    if (!this._vp.view.isSpatialView())
      return;

    const viewState = this._vp.view.clone();
    const modelIds = await this.getSubjectModelIds(id);
    modelIds.forEach((modelId) => {
      if (on)
        viewState.addViewedModel(modelId);
      else
        viewState.removeViewedModel(modelId);
    });
    this._vp.changeView(viewState);
  }

  private changeModelState(id: Id64String, on: boolean) {
    if (!this._vp.view.isSpatialView())
      return;

    const viewState = this._vp.view.clone();
    if (on)
      viewState.addViewedModel(id);
    else
      viewState.removeViewedModel(id);
    this._vp.changeView(viewState);
  }

  private changeCategoryState(id: Id64String, on: boolean) {
    const viewState = this._vp.view.clone();
    viewState.categorySelector.changeCategoryDisplay(id, on);
    this._vp.changeView(viewState);
  }

  private async changeElementState(id: Id64String, on: boolean) {
    const currNeverDrawn = new Set(this._vp.neverDrawn ? this._vp.neverDrawn : []);
    const currAlwaysDrawn = new Set(this._vp.alwaysDrawn ? this._vp.alwaysDrawn : []);
    const elementIds = [id, ...await this.getAssemblyElementIds(id)];
    elementIds.forEach((elementId) => {
      if (on) {
        currNeverDrawn.delete(elementId);
        currAlwaysDrawn.add(elementId);
      } else {
        currAlwaysDrawn.delete(elementId);
        currNeverDrawn.add(elementId);
      }
    });
    this._vp.setNeverDrawn(currNeverDrawn);
    this._vp.setAlwaysDrawn(currAlwaysDrawn);
  }

  // tslint:disable-next-line: naming-convention
  private onViewChanged = (vp: Viewport) => {
    // note: this event is fired way too much than we need - need to filter out
    // cases where model or category state changes
    const newSelectorsState = new ViewSelectorsState(vp);
    if (newSelectorsState.equals(this._currentSelectorsState))
      return;

    this._currentSelectorsState = newSelectorsState;
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
      const modelIdsProvider = new SubjectModelIdsProvider(this._vp.iModel, subjectId);
      this._subjectModelIdsCache.set(subjectId, await modelIdsProvider.getModelIds());
    }
    return this._subjectModelIdsCache.get(subjectId)!;
  }

  private async getAssemblyElementIds(assemblyId: Id64String): Promise<Id64String[]> {
    const provider = new AssemblyElementIdsProvider(this._vp.iModel, assemblyId);
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

class ViewSelectorsState {
  public readonly categorySelector: Set<Id64String>;
  public readonly modelSelector: Set<Id64String>;

  public constructor(vp?: Viewport) {
    this.categorySelector = new Set(vp ? vp.view.categorySelector.categories : []);
    this.modelSelector = new Set(vp && vp.view.isSpatialView() ? vp.view.modelSelector.models : []);
  }

  public equals(other: ViewSelectorsState) {
    return areSetsEqual(this.categorySelector, other.categorySelector)
      && areSetsEqual(this.modelSelector, other.modelSelector);
  }
}

function areSetsEqual<TValue>(lhs: Set<TValue>, rhs: Set<TValue>) {
  if (lhs.size !== rhs.size)
    return false;
  for (const value of lhs) {
    if (!rhs.has(value))
      return false;
  }
  return true;
}
