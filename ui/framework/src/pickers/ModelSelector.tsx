/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Picker */

import * as React from "react";
import * as classnames from "classnames";
import { ListItem, ListItemType } from "./ListPicker";
import { IModelApp, Viewport, ViewState, SpatialViewState, SpatialModelState, SelectedViewportChangedArgs } from "@bentley/imodeljs-frontend";
import { ModelQueryParams } from "@bentley/imodeljs-common/lib/ModelProps";
import { UiFramework } from "../UiFramework";
import { ConfigurableUiManager } from "../configurableui/ConfigurableUiManager";
import { ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";
import { WidgetControl } from "../configurableui/WidgetControl";
import { CheckListBox, CheckListBoxItem } from "@bentley/ui-core";
import { SearchBox } from "@bentley/ui-core";
import "./ModelSelector.scss";
import { Group } from "@bentley/ui-ninezone/lib/widget/rectangular/tab/Group";
import { Popup, Position } from "@bentley/ui-core";

export interface Group {
  id: string;
  label: string;
  items: ListItem[];
  initialized: boolean;
  updateState: () => void;
  setEnabled: (item: ListItem, enabled: boolean) => void;
}

export interface ModelSelectorWidgetState {
  expand: boolean;
  activeGroup: Group;
  showOptions: boolean;
}

export class ModelSelectorDemoWidget extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    const thing = options.iModel;
    this.reactElement = <ModelSelectorWidget widgetControl={this} imodel={thing} />;
  }
}

export default class ModelSelectorWidget extends React.Component<any, ModelSelectorWidgetState> {
  private _removeSelectedViewportChanged?: () => void;
  private _groups: Group[] = [];

  constructor(props: any) {
    super(props);

    this._initGroups();
    this.state = { expand: false, activeGroup: this._groups[0], showOptions: false };
    this.updateState();
  }

  public componentDidMount() {
    this._removeSelectedViewportChanged = IModelApp.viewManager.onSelectedViewportChanged.addListener(this._handleSelectedViewportChanged);
  }

  public componentWillUnmount() {
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

  // Update viewed models on selected viewport changed
  private _handleSelectedViewportChanged = (args: SelectedViewportChangedArgs) => {
    if (args.current) {
      alert("Clearing");
      this._initGroups();
      this.updateState();
    }
  }

  private _handleSearchValueChanged = (value: string): void => {
    alert("search " + value);
  }

  // expand the selected group
  private _onExpand = (group: Group) => {
    this.setState({ activeGroup: group, expand: true });
  }

  // collapse
  private _onCollapse = () => {
    this.setState({ expand: false });
  }

  private _onShowOptions = (show: boolean) => {
    this.setState({ showOptions: show });
  }

  // enable or disable a single item
  private _onCheckboxClick = (item: ListItem) => {
    item.enabled = !item.enabled;
    this.state.activeGroup.setEnabled(item, item.enabled);
    // force an update to set the new state in CheckListBoxItem
    // Note: or should we call activeGroup.updateState()?
    // this.forceUpdate();
    this.setState({ activeGroup: this.state.activeGroup });
  }

  // enable or disable all items
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

  public async updateModelsState() {
    const vp = IModelApp.viewManager.getFirstOpenView();
    if (vp)
      this._updateModelsWithViewport(vp);
  }

  public async updateCategoriesState() {
    const vp = IModelApp.viewManager.selectedView;
    if (vp)
      this._updateCategoriesWithViewport(vp);
  }

  public async updateState() {
    this._groups.forEach((group: Group) => {
      if (!group.initialized) {
        group.updateState();
        group.initialized = true;
      }
    });
  }

  // Enable/disable the models and update the state
  /*
      // Invert model selection
    const invert = () => {
      IModelApp.viewManager.forEachViewport((vp: Viewport) => {
        if (!(vp.view instanceof SpatialViewState))
          return;

        const view: SpatialViewState = vp.view.clone();
        for (const item of self.state.items) {
          const enabled = !view.modelSelector.has(item.key);
          if (enabled)
            view.modelSelector.addModels(item.key);
          else
            view.modelSelector.dropModels(item.key);

        }

        vp.changeView(view);
      });

      // Update the category items in the list picker
      self.updateState();
    };
  */

  //  <SearchBox  placeholder="search..." onValueChanged={this._handleSearchValueChanged} />

  public render() {
    const groupsClassName = classnames("widget-groups", this.state.expand && "hide");
    const listClassName = classnames("fw-modelselector", this.state.expand && "show");
    return (
      <div className="widget-picker">
        <div className={groupsClassName}>
          {this._groups.map((group: Group) => (
            <div key={group.id} className="widget-picker-group" onClick={this._onExpand.bind(this, group)}>
              {group.label}
              <span className="group-count">{group.items.length}</span>
              <span className="icon icon-chevron-right" />
            </div>
          ))}
        </div>
        <div className={listClassName}>
          <div className="fw-modelselector-header" >
            <div className="fw-modelselector-back" onClick={this._onCollapse}>
              <span className="icon icon-chevron-left" />
              <div className="ms-title">{this.state.activeGroup.label}</div>
            </div>
            <div className="options" >
              <span className="icon icon-more-vertical-2" onClick={this._onShowOptions.bind(this, !this.state.showOptions)}></span>
              <Popup isShown={this.state.showOptions} position={Position.BottomRight} onClose={this._onShowOptions.bind(this, false)}>
                <ul>
                  <li><span className="icon icon-visibility" />Manage...</li>
                </ul>
              </Popup>
            </div>
          </div>
          <div className="modelselector-toolbar">
            <span className="icon icon-placeholder" title={UiFramework.i18n.translate("UiFramework:pickerButtons.all")} onClick={this._onSetEnableAll.bind(this, true)} />
            <span className="icon icon-placeholder" title={UiFramework.i18n.translate("UiFramework:pickerButtons.none")} onClick={this._onSetEnableAll.bind(this, false)} />
            <span className="icon icon-placeholder" title={UiFramework.i18n.translate("UiFramework:pickerButtons.invert")} />
            <SearchBox placeholder="search..." onValueChanged={this._handleSearchValueChanged} />
          </div>
          <CheckListBox className="fw-modelselector-listbox">
            {this.state.activeGroup.items.map((item: ListItem) => (
              <CheckListBoxItem key={item.key} label={item.name} checked={item.enabled} onClick={this._onCheckboxClick.bind(this, item)} />
            ))}
          </CheckListBox>
        </div>
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("ModelSelectorWidget", ModelSelectorDemoWidget);
