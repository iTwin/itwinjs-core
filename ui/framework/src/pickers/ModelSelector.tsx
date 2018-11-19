/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Picker */

import * as React from "react";
import * as _ from "lodash";
import classnames from "classnames";
import { ListItem, ListItemType } from "./ListPicker";
import { IModelApp, Viewport, ViewState, SpatialViewState, SpatialModelState, SelectedViewportChangedArgs, IModelConnection } from "@bentley/imodeljs-frontend";
import { ModelQueryParams, ModelProps } from "@bentley/imodeljs-common";
import { UiFramework } from "../UiFramework";
import { ConfigurableUiManager } from "../configurableui/ConfigurableUiManager";
import { ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";
import { WidgetControl } from "../configurableui/WidgetControl";
import { Tree, FilteringInput, TreeNodeItem, PageOptions, DelayLoadedTreeNodeItem, TreeDataChangesListener } from "@bentley/ui-components";
import "./ModelSelector.scss";
import { PresentationTreeDataProvider, withUnifiedSelection, withFilteringSupport, IPresentationTreeDataProvider } from "@bentley/presentation-components/lib/tree";
import { Presentation } from "@bentley/presentation-frontend";
import { RegisteredRuleset, NodeKey, NodePathElement } from "@bentley/presentation-common";
import { CheckBoxState } from "@bentley/ui-core";
import { BeEvent } from "@bentley/bentleyjs-core";

/** Model Group used by [[ModelSelectorWidget]] */
export interface ModelGroup {
  id: string;
  label: string;
  items: ListItem[];
  initialized: boolean;
  updateState: () => void;
  setEnabled: (item: ListItem, enabled: boolean) => void;
}

/** Properties for the [[ModelSelectorWidget]] component */
export interface ModelSelectorWidgetProps {
  imodel: IModelConnection;
  allViewports?: boolean;
}

/** State for the [[ModelSelectorWidget]] component */
export interface ModelSelectorWidgetState {
  expand: boolean;
  activeGroup: ModelGroup;
  showOptions: boolean;
  treeInfo?: {
    ruleset: RegisteredRuleset;
    dataProvider: ModelSelectorDataProvider;
    filter?: string;
    prevProps?: any;
    filtering?: boolean;
    activeMatchIndex?: number;
    matchesCount?: number;
  };
}

class ModelSelectorDataProvider implements IPresentationTreeDataProvider {
  private _baseProvider: PresentationTreeDataProvider;

  constructor(imodel: IModelConnection, rulesetId: string) {
    this._baseProvider = new PresentationTreeDataProvider(imodel, rulesetId);
  }

  /** Id of the ruleset used by this data provider */
  public get rulesetId(): string { return this._baseProvider.rulesetId; }

  /** [[IModelConnection]] used by this data provider */
  public get connection(): IModelConnection { return this._baseProvider.connection; }

  public onTreeNodeChanged = new BeEvent<TreeDataChangesListener>();

  /**
   * Returns a [[NodeKey]] from given [[TreeNodeItem]].
   * **Warning:** the `node` must be created by this data provider.
   */
  public getNodeKey(node: TreeNodeItem): NodeKey {
    return this._baseProvider.getNodeKey(node);
  }

  /**
   * Returns filtered node paths.
   * @param filter Filter.
   */
  public getFilteredNodePaths = async (filter: string): Promise<NodePathElement[]> => {
    return this._baseProvider.getFilteredNodePaths(filter);
  }

  public getNodesCount = _.memoize(async (parentNode?: TreeNodeItem): Promise<number> => {
    return this._baseProvider.getNodesCount(parentNode);
  });

  public getNodes = _.memoize(async (parentNode?: TreeNodeItem, pageOptions?: PageOptions): Promise<DelayLoadedTreeNodeItem[]> => {
    const nodes = await this._baseProvider.getNodes(parentNode, pageOptions);
    nodes.forEach((n) => {
      n.checkBoxState = CheckBoxState.On;
    });
    return nodes;
  });
}

/** Model Selector [[WidgetControl]] */
export class ModelSelectorWidgetControl extends WidgetControl {
  /** Creates a ModelSelectorDemoWidget */
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <ModelSelectorWidget imodel={options.iModelConnection} />;
  }
}

/** Model Selector Widget React component */
export class ModelSelectorWidget extends React.Component<ModelSelectorWidgetProps, ModelSelectorWidgetState> {
  private _removeSelectedViewportChanged?: () => void;
  private _groups: ModelGroup[] = [];
  private _isMounted = false;
  private _modelRuleset?: RegisteredRuleset;
  private _categoryRuleset?: RegisteredRuleset;

  /** Creates a ModelSelectorWidget */
  constructor(props: ModelSelectorWidgetProps) {
    super(props);

    this._initGroups();
    this.state = { expand: false, activeGroup: this._groups[0], showOptions: false };
    this.updateState(); // tslint:disable-line:no-floating-promises
  }

  /** Adds listeners */
  public componentDidMount() {
    this._isMounted = true;

    this._removeSelectedViewportChanged = IModelApp.viewManager.onSelectedViewportChanged.addListener(this._handleSelectedViewportChanged);

    Presentation.presentation.rulesets().add(require("../../rulesets/Models")) // tslint:disable-line:no-floating-promises
      .then((ruleset: RegisteredRuleset) => {
        if (!this._isMounted)
          return;
        this._modelRuleset = ruleset;
        this.setState({
          treeInfo: {
            ruleset,
            dataProvider: new ModelSelectorDataProvider(this.props.imodel, ruleset.id),
            filter: "",
            filtering: false,
            prevProps: this.props,
            activeMatchIndex: 0,
            matchesCount: 0,
          },
          expand: true,
        });
      });

    Presentation.presentation.rulesets().add(require("../../rulesets/Categories")) // tslint:disable-line:no-floating-promises
      .then((ruleset: RegisteredRuleset) => {
        if (!this._isMounted)
          return;
        this._categoryRuleset = ruleset;
      });
  }

  /** Removes listeners */
  public componentWillUnmount() {
    this._isMounted = false;

    if (this.state.treeInfo)
      Presentation.presentation.rulesets().remove(this.state.treeInfo.ruleset); // tslint:disable-line:no-floating-promises

    if (this._removeSelectedViewportChanged)
      this._removeSelectedViewportChanged();
  }

  private _initGroups() {
    this._groups = [];
    this._groups.push({
      id: "Models",
      label: UiFramework.i18n.translate("UiFramework:categoriesModels.models"),
      items: [],
      initialized: false,
      updateState: this.updateModelsState.bind(this),
      setEnabled: this._onModelChecked,
    });
    this._groups.push({
      id: "Categories",
      label: UiFramework.i18n.translate("UiFramework:categoriesModels.categories"),
      items: [],
      initialized: false,
      updateState: this.updateCategoriesState.bind(this),
      setEnabled: this._onCategoryChecked,
    });
  }

  /** Update viewed models on selected viewport changed */
  private _handleSelectedViewportChanged = (args: SelectedViewportChangedArgs) => {
    if (args.current) {
      this._initGroups();
      this.updateState(); // tslint:disable-line:no-floating-promises
    }
  }

  /** expand the selected group */
  private _onExpand = (group: ModelGroup) => {
    if (!this._modelRuleset || !this._categoryRuleset)
      return;

    let activeRuleset;

    if (group.label === UiFramework.i18n.translate("UiFramework:categoriesModels.models"))
      activeRuleset = this._modelRuleset;
    else if (group.label === UiFramework.i18n.translate("UiFramework:categoriesModels.categories"))
      activeRuleset = this._categoryRuleset;
    else
      activeRuleset = this._modelRuleset;

    this.setState({
      treeInfo: {
        ruleset: activeRuleset,
        dataProvider: new ModelSelectorDataProvider(this.props.imodel, activeRuleset.id),
        filter: this.state.treeInfo ? this.state.treeInfo.filter : "",
        filtering: this.state.treeInfo ? this.state.treeInfo.filtering : false,
        activeMatchIndex: this.state.treeInfo ? this.state.treeInfo.activeMatchIndex : 0,
        matchesCount: this.state.treeInfo ? this.state.treeInfo.matchesCount : 0,
      },
      activeGroup: group,
      expand: true,
    });
  }

  /** enable or disable all items */
  private _onSetEnableAll = async (enable: boolean) => {
    for (const item of this.state.activeGroup.items) {
      this.state.activeGroup.setEnabled(item, enable);
    }

    this.state.activeGroup.updateState();
    this.state.treeInfo!.dataProvider.onTreeNodeChanged.raiseEvent();
  }

  private async _updateModelsWithViewport(vp: Viewport) {
    // Query models and add them to state
    if (!(vp.view instanceof SpatialViewState))
      return;

    const spatialView = vp.view as SpatialViewState;
    const modelQueryParams: ModelQueryParams = { from: SpatialModelState.getClassFullName(), wantPrivate: false };
    let curModelProps: ModelProps[] = new Array<ModelProps>();

    if (this.props.imodel)
      curModelProps = await this.props.imodel.models.queryProps(modelQueryParams);

    const models: ListItem[] = [];
    for (const modelProps of curModelProps) {
      const model: ListItem = {
        key: (modelProps.id) ? modelProps.id.toString() : "",
        name: (modelProps.name) ? modelProps.name : "",
        enabled: modelProps.id ? spatialView.modelSelector.has(modelProps.id) : false,
        type: ListItemType.Item,
      };
      models.push(model);
    }

    this._groups[0].items = models;

    vp.changeView(spatialView);

    this.forceUpdate();
  }

  private async _updateCategoriesWithViewport(vp: Viewport) {
    // Query categories and add them to state
    const view: ViewState = vp.view.clone();
    const ecsql = "SELECT ECInstanceId as id, CodeValue as code, UserLabel as label FROM " + (view.is3d() ? "BisCore.SpatialCategory" : "BisCore.DrawingCategory");
    let rows = [];

    if (this.props.imodel)
      rows = await this.props.imodel.executeQuery(ecsql);

    const categories: ListItem[] = [];
    for (const row of rows) {
      const category: ListItem = {
        key: row.id as string,
        name: row.label ? row.label as string : row.code as string,
        enabled: view.categorySelector.has(row.id as string),
        type: ListItemType.Item,
      };
      categories.push(category);
    }

    this._groups[1].items = categories;

    vp.changeView(view);

    this.forceUpdate();
  }

  private _onModelChecked = (item: ListItem, checked: boolean) => {
    if (!IModelApp.viewManager)
      return;

    IModelApp.viewManager.forEachViewport((vp: Viewport) => {
      if (!(vp.view instanceof SpatialViewState))
        return;
      const view: SpatialViewState = vp.view.clone();
      if (checked)
        view.modelSelector.addModels(item.key);
      else
        view.modelSelector.dropModels(item.key);
      vp.changeView(view);
    });
  }

  private _onCategoryChecked = (item: ListItem, checked: boolean) => {
    if (!IModelApp.viewManager || !IModelApp.viewManager.selectedView)
      return;

    const updateViewport = (vp: Viewport) => {
      // Only act on viewports that are both 3D or both 2D. Important if we have multiple viewports opened and we
      // are using 'allViewports' property
      if (IModelApp.viewManager.selectedView && IModelApp.viewManager.selectedView.view.is3d() === vp.view.is3d()) {
        const view: ViewState = vp.view.clone();
        view.categorySelector.changeCategoryDisplay(item.key, checked);
        vp.changeView(view);
      }
    };

    // This property let us act on all viewports or just on the selected one, configurable by the app
    if (this.props.allViewports) {
      IModelApp.viewManager.forEachViewport(updateViewport);
    } else if (IModelApp.viewManager.selectedView) {
      updateViewport(IModelApp.viewManager.selectedView);
    }
    this._updateCategoriesWithViewport(IModelApp.viewManager.selectedView); // tslint:disable-line:no-floating-promises
  }

  /** Add models to current viewport */
  public async updateModelsState() {
    if (!IModelApp.viewManager)
      return;

    const vp = IModelApp.viewManager.getFirstOpenView();
    if (vp)
      this._updateModelsWithViewport(vp); // tslint:disable-line:no-floating-promises
  }

  /** Add categories to current viewport */
  public async updateCategoriesState() {
    if (!IModelApp.viewManager)
      return;

    const vp = IModelApp.viewManager.selectedView;
    if (vp)
      this._updateCategoriesWithViewport(vp); // tslint:disable-line:no-floating-promises
  }

  /** Update state for each group */
  public async updateState() {
    this._groups.forEach((group: ModelGroup) => {
      if (!group.initialized) {
        group.updateState();
        group.initialized = true;
      }
    });
  }

  // tslint:disable-next-line:naming-convention
  private onFilterApplied = (_filter?: string): void => {
    if (this.state.treeInfo && this.state.treeInfo.filtering)
      this.setState({
        treeInfo: {
          ...this.state.treeInfo,
          filtering: false,
        },
      });
  }
  private _onFilterStart = (filter: string) => {
    if (!this.state.treeInfo)
      return;

    this.setState({
      treeInfo: {
        ...this.state.treeInfo,
        filter,
        filtering: true,
      },
    });
  }

  private _onFilterCancel = () => {
    if (!this.state.treeInfo)
      return;

    this.setState({
      treeInfo: {
        ...this.state.treeInfo,
        filter: "",
        filtering: false,
      },
    });
  }

  private _onFilterClear = () => {
    if (!this.state.treeInfo)
      return;

    this.setState({
      treeInfo: {
        ...this.state.treeInfo,
        filter: "",
        filtering: false,
      },
    });
  }

  private _onMatchesCounted = (count: number) => {
    if (this.state.treeInfo && count !== this.state.treeInfo.matchesCount)
      this.setState({
        treeInfo: {
          ...this.state.treeInfo,
          matchesCount: count,
        },
      });
  }

  private _onSelectedMatchChanged = (index: number) => {
    if (!this.state.treeInfo)
      return;

    this.setState({
      treeInfo: {
        ...this.state.treeInfo,
        activeMatchIndex: index,
      },
    });
  }

  /** enable or disable a single item */
  private _onCheckboxClick = (label: string) => {
    const item = this._getItem(label);
    item.enabled = !item.enabled;
    this.state.activeGroup.setEnabled(item, item.enabled);
    this.setState({ activeGroup: this.state.activeGroup });
  }

  private _isCheckboxChecked = (label: string) => {
    const item = this._getItem(label);
    if (item && item.enabled)
      return true;
    return false;
  }

  private _getItem = (label: string): ListItem => {
    let items: ListItem[];
    switch (this.state.activeGroup.id) {
      case "Models":
        items = this._groups[0].items;
        break;
      case "Categories":
        items = this._groups[1].items;
        break;
      default:
        items = this._groups[0].items;
        break;
    }

    let selectedItem = items[0];
    items.forEach((item) => {
      if (label === item.name) {
        selectedItem = item;
        return;
      }
    });

    return selectedItem;
  }

  /** @hidden */
  public render() {
    const listClassName = classnames("fw-modelselector", this.state.expand && "show");
    const activeClassName = classnames(this.state.activeGroup.label && "active");

    if (this.state.treeInfo)
      return (
        <div className="widget-picker">
          <div>
            <ul className="category-model-horizontal-tabs">
              {
                this._groups.map((group: any) =>
                  (
                    <li
                      className={group.label === this.state.activeGroup.label ? activeClassName : ""}
                      onClick={this._onExpand.bind(this, group)}>
                      <a>{group.label}</a>
                    </li>
                  ))
              }
            </ul>
          </div>
          <div className={listClassName}>
            <div className="modelselector-toolbar">
              <FilteringInput
                filteringInProgress={this.state.treeInfo.filtering ? this.state.treeInfo.filtering : false}
                onFilterCancel={this._onFilterCancel}
                onFilterClear={this._onFilterClear}
                onFilterStart={this._onFilterStart}
                resultSelectorProps={{
                  onSelectedChanged: this._onSelectedMatchChanged,
                  resultCount: this.state.treeInfo.matchesCount ? this.state.treeInfo.matchesCount : 0,
                }}
              />
              <div className="modelselector-buttons">
                <span className="icon icon-visibility" title={UiFramework.i18n.translate("UiFramework:pickerButtons.all")} onClick={this._onSetEnableAll.bind(this, true)} />
                <span className="icon icon-visibility-hide" title={UiFramework.i18n.translate("UiFramework:pickerButtons.none")} onClick={this._onSetEnableAll.bind(this, false)} />
                {/* <span className="icon icon-placeholder" title={UiFramework.i18n.translate("UiFramework:pickerButtons.invert")} /> */}
              </div>
            </div>
            <div style={{ height: "100%" }}>
              {
                (this.props.imodel && this.state.treeInfo.dataProvider) ?
                  <CategoryModelTree
                    dataProvider={this.state.treeInfo.dataProvider}
                    filter={this.state.treeInfo.filter}
                    onFilterApplied={this.onFilterApplied}
                    onMatchesCounted={this._onMatchesCounted}
                    activeMatchIndex={this.state.treeInfo.activeMatchIndex}
                    checkboxEnabled={true}
                    onCheckboxClick={this._onCheckboxClick}
                    isChecked={this._isCheckboxChecked}
                  /> :
                  <div />
              }
            </div >
          </div>
        </div >
      );

    // WIP: localize
    return "Loading...";
  }

}

// tslint:disable-next-line:variable-name
const CategoryModelTree = withFilteringSupport(withUnifiedSelection(Tree));

export default ModelSelectorWidget;

ConfigurableUiManager.registerControl("ModelSelectorWidget", ModelSelectorWidgetControl);
