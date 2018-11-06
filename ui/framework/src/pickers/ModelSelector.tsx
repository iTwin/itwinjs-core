/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Picker */

import * as React from "react";
import classnames from "classnames";
import { ListItem, ListItemType } from "./ListPicker";
import { IModelApp, Viewport, ViewState, SpatialViewState, SpatialModelState, SelectedViewportChangedArgs } from "@bentley/imodeljs-frontend";
import { ModelQueryParams } from "@bentley/imodeljs-common/lib/ModelProps";
import { UiFramework } from "../UiFramework";
import { ConfigurableUiManager } from "../configurableui/ConfigurableUiManager";
import { ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";
import { WidgetControl } from "../configurableui/WidgetControl";
import {
  // CheckListBox,
  // CheckListBoxItem,
  SearchBox,
} from "@bentley/ui-core";
// import Group from "@bentley/ui-ninezone/lib/widget/rectangular/tab/Group";
import { Tree } from "@bentley/ui-components";
import "./ModelSelector.scss";
import { PresentationTreeDataProvider, withUnifiedSelection } from "@bentley/presentation-components/lib/tree";
import { Presentation } from "@bentley/presentation-frontend";
import { RegisteredRuleset } from "@bentley/presentation-common";

/** Model Group used by [[ModelSelectorWidget]] */
export interface ModelGroup {
  id: string;
  label: string;
  items: ListItem[];
  initialized: boolean;
  updateState: () => void;
  setEnabled: (item: ListItem, enabled: boolean) => void;
}

/** State for the [[ModelSelectorWidget]] component */
export interface ModelSelectorWidgetState {
  expand: boolean;
  activeGroup: ModelGroup;
  showOptions: boolean;
  treeInfo?: {
    ruleset: RegisteredRuleset;
    dataProvider: PresentationTreeDataProvider;
  };
}

/** Model Selector [[WidgetControl]] */
export class ModelSelectorWidgetControl extends WidgetControl {
  /** Creates a ModelSelectorDemoWidget */
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    const thing = options.iModel;
    this.reactElement = <ModelSelectorWidget widgetControl={this} imodel={thing} />;
  }
}

/** Model Selector Widget React component */
export class ModelSelectorWidget extends React.Component<any, ModelSelectorWidgetState> {
  private _removeSelectedViewportChanged?: () => void;
  private _groups: ModelGroup[] = [];
  private _isMounted = false;

  /** Creates a ModelSelectorWidget */
  constructor(props: any) {
    super(props);

    this._initGroups();
    this.state = { expand: false, activeGroup: this._groups[0], showOptions: false };
    this.updateState();
  }

  /** Adds listeners */
  public componentDidMount() {
    this._isMounted = true;

    this._removeSelectedViewportChanged = IModelApp.viewManager.onSelectedViewportChanged.addListener(this._handleSelectedViewportChanged);

    Presentation.presentation.rulesets().add(require("../../rulesets/ModelsCategories"))
      .then((ruleset: RegisteredRuleset) => {
        if (!this._isMounted)
          return;
        this.setState({ treeInfo: { ruleset, dataProvider: new PresentationTreeDataProvider(this.props.imodel, ruleset.id) } });
      });
  }

  /** Removes listeners */
  public componentWillUnmount() {
    this._isMounted = false;

    if (this.state.treeInfo)
      Presentation.presentation.rulesets().remove(this.state.treeInfo.ruleset);

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
      this.updateState();
    }
  }

  private _handleSearchValueChanged = (value: string): void => {
    alert("search " + value); alert("search " + value);
  }

  /** expand the selected group */
  private _onExpand = (group: ModelGroup) => {
    this.setState({ activeGroup: group, expand: true });
  }

  // /** enable or disable a single item */
  // private _onCheckboxClick = (item: ListItem) => {
  //   item.enabled = !item.enabled;
  //   this.state.activeGroup.setEnabled(item, item.enabled);
  //   this.setState({ activeGroup: this.state.activeGroup });
  // }

  /** enable or disable all items */
  private _onSetEnableAll = (enable: boolean) => {
    for (const item of this.state.activeGroup.items) {
      this.state.activeGroup.setEnabled(item, enable);
    }

    this.state.activeGroup.updateState();
  }

  private async _updateModelsWithViewport(vp: Viewport) {
    // Query models and add them to state
    if (!(vp.view instanceof SpatialViewState))
      return;

    const spatialView = vp.view as SpatialViewState;
    const modelQueryParams: ModelQueryParams = { from: SpatialModelState.getClassFullName(), wantPrivate: false };
    const curModelProps = await this.props.imodel.models.queryProps(modelQueryParams);

    const models: ListItem[] = [];
    for (const modelProps of curModelProps) {
      const model: ListItem = {
        key: modelProps.id.toString(),
        name: modelProps.name,
        enabled: spatialView.modelSelector.has(modelProps.id),
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
    const rows = await this.props.imodel.executeQuery(ecsql);

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
    if (!IModelApp.viewManager.selectedView)
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
    this._updateCategoriesWithViewport(IModelApp.viewManager.selectedView);
  }

  /** Add models to current viewport */
  public async updateModelsState() {
    const vp = IModelApp.viewManager.getFirstOpenView();
    if (vp)
      this._updateModelsWithViewport(vp);
  }

  /** Add categories to current viewport */
  public async updateCategoriesState() {
    const vp = IModelApp.viewManager.selectedView;
    if (vp)
      this._updateCategoriesWithViewport(vp);
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

  private _getChildren = (): DemoMutableNode[] => {
    const children = new Array<DemoMutableNode>();
    this.state.activeGroup.items.map((item: ListItem) => {
      const whatever = { label: item.name, id: item.key, type: item.type.toString(), description: "", parentId: this.state.activeGroup.id, iconPath: "icon-parallel-move" };
      children.push(whatever);
    });
    return children;
  }

  /** @hidden */
  public render() {
    /*const listClassName = classnames("fw-modelselector", this.state.expand && "show");
    const activeClassName = classnames(this.state.activeGroup.label && "active");

    if (!this.state.expand)
      this._onExpand(this.state.activeGroup);

    // Clear data ahead of time
    data = [];
    data.push({
      label: this.state.activeGroup.label, id: this.state.activeGroup.id, type: "root", description: "", iconPath: "icon-clipboard-cut",
      children: this._getChildren(),
    });*/

    if (this.state.treeInfo)
      return <CategoryModelTree dataProvider={this.state.treeInfo.dataProvider} />;

    // WIP: localize
    return "Loading...";
  }
}

// tslint:disable-next-line:variable-name
const CategoryModelTree = withUnifiedSelection(Tree);

// let data = new Array<DemoMutableNode>();

interface DemoMutableNode {
  label: string;
  id: string;
  type: string;
  description: string;
  parentId?: string;
  iconPath?: string;
  children?: DemoMutableNode[];
}

export default ModelSelectorWidget;

ConfigurableUiManager.registerControl("ModelSelectorWidget", ModelSelectorWidgetControl);
