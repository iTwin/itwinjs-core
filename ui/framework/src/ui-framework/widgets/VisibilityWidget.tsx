/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";

import { IModelApp, SelectedViewportChangedArgs, IModelConnection, Viewport } from "@bentley/imodeljs-frontend";
import { IconSpecUtilities } from "@bentley/ui-abstract";
import { Position, ScrollPositionMaintainer } from "@bentley/ui-core";
import { SelectionMode, ContextMenu, ContextMenuItem } from "@bentley/ui-components";
import { connectIModelConnection } from "../redux/connectIModel";

import { CategoryTree } from "../imodel-components/category-tree/CategoriesTree";
import { SpatialContainmentTree } from "../imodel-components/spatial-tree/SpatialContainmentTree";
import { UiFramework } from "../UiFramework";
import { WidgetControl } from "../widgets/WidgetControl";
import { ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";

import "./VisibilityWidget.scss";

import widgetIconSvg from "@bentley/icons-generic/icons/hierarchy-tree.svg";
import { ModelsTree } from "../imodel-components/visibility-tree/ModelsTree";

/**
 * Types of hierarchies displayed in the `VisibilityComponent`
 * @public
 */
export enum VisibilityComponentHierarchy {
  Models = "models",
  Categories = "categories",
  SpatialContainment = "spatial-containment",
}

/**
 * Props for `VisibilityComponent`
 * @alpha
 */
export interface VisibilityComponentProps {
  /** iModel whose data should be displayed in the component */
  iModelConnection: IModelConnection;
  /** Viewport to use for controlling display */
  activeViewport?: Viewport;
  /** `React.Ref` to the root HTML element  */
  activeTreeRef?: React.Ref<HTMLDivElement>;
  /** Start pre-loading specified hierarchies as soon as user picks one for display. */
  enableHierarchiesPreloading?: VisibilityComponentHierarchy[];
  /** Use controlled tree as underlying tree implementation
   * @alpha Temporary property
   */
  useControlledTree?: boolean;
}

interface VisibilityTreeState {
  activeTree: VisibilityComponentHierarchy;
  showOptions: boolean;
  showSearchBox: boolean;
  viewport?: Viewport;
  selectAll: boolean;
  clearAll: boolean;
}

/** VisibilityComponent React component.
 * @alpha
 */
// istanbul ignore next
export class VisibilityComponent extends React.Component<VisibilityComponentProps, VisibilityTreeState> {
  private _optionsElement: HTMLElement | null = null;

  constructor(props: any) {
    super(props);
    this.state = {
      activeTree: VisibilityComponentHierarchy.Models, showOptions: false, showSearchBox: false,
      viewport: this.props.activeViewport, selectAll: false, clearAll: false,
    };
  }
  public async componentDidMount() {
    IModelApp.viewManager.onSelectedViewportChanged.addListener(this._onViewportChangedHandler);
  }

  /** Remove listeners */
  public componentWillUnmount() {
    IModelApp.viewManager.onSelectedViewportChanged.removeListener(this._onViewportChangedHandler);
  }

  private _onViewportChangedHandler = async (args: SelectedViewportChangedArgs) => {
    if (args.current) {
      this.setState({ viewport: args.current });
    }
  }

  private _onShowOptions = () => {
    this.setState((state) => ({
      showOptions: !state.showOptions,
    }));
  }

  private _onCloseOptions = () => {
    this.setState({ showOptions: false });
  }

  private _onShowTree = (event: any) => {
    const activeTree = event.target.value;
    this.setState({ activeTree });
  }

  private _onSetEnableAll = () => {
    this._onCloseOptions();
    this.setState(
      { selectAll: true },
      () => { this.setState({ selectAll: false }); });
  }

  private _onClearAll = () => {
    this._onCloseOptions();
    this.setState(
      { clearAll: true },
      () => { this.setState({ clearAll: false }); });
  }

  private _onToggleSearchBox = () => {
    this.setState((prevState) => ({ showSearchBox: !prevState.showSearchBox }));
  }

  private shouldEnablePreloading(hierarchy: VisibilityComponentHierarchy) {
    return this.props.enableHierarchiesPreloading
      && - 1 !== this.props.enableHierarchiesPreloading.indexOf(hierarchy);
  }

  private _renderTree() {
    const { iModelConnection, useControlledTree } = this.props;
    const { activeTree, showSearchBox, viewport, selectAll, clearAll } = this.state;
    return (<div className="uifw-visibility-tree-wrapper">
      {activeTree === VisibilityComponentHierarchy.Models && <ModelsTree imodel={iModelConnection} activeView={viewport} selectionMode={SelectionMode.None}
        rootElementRef={this.props.activeTreeRef} enablePreloading={this.shouldEnablePreloading(VisibilityComponentHierarchy.Models)} useControlledTree={useControlledTree} />}
      {activeTree === VisibilityComponentHierarchy.Categories && <CategoryTree iModel={iModelConnection} activeView={viewport} showSearchBox={showSearchBox}
        selectAll={selectAll} clearAll={clearAll} enablePreloading={this.shouldEnablePreloading(VisibilityComponentHierarchy.Categories)} useControlledTree={useControlledTree} />}
      {activeTree === VisibilityComponentHierarchy.SpatialContainment && <SpatialContainmentTree iModel={iModelConnection}
        enablePreloading={this.shouldEnablePreloading(VisibilityComponentHierarchy.SpatialContainment)} useControlledTree={useControlledTree} />}
    </div>);
  }

  public render() {
    const { iModelConnection } = this.props;
    if (!iModelConnection)
      return (<span>{UiFramework.translate("visibilityWidget.noImodelConnection")}</span>);

    const { activeTree } = this.state;
    const showCategories = true;
    const showContainment = true;
    const searchStyle: React.CSSProperties = {
      opacity: (activeTree === VisibilityComponentHierarchy.Categories) ? 1 : 0,
      visibility: (activeTree === VisibilityComponentHierarchy.Categories) ? "visible" : "hidden",
    };
    return (<div className="uifw-visibility-tree">
      <div className="uifw-visibility-tree-header">
        <select className="uifw-visibility-tree-select" onChange={this._onShowTree.bind(this)}>
          <option value={VisibilityComponentHierarchy.Models}>{UiFramework.translate("visibilityWidget.modeltree")}</option>
          {showCategories && <option value={VisibilityComponentHierarchy.Categories}>{UiFramework.translate("visibilityWidget.categories")}</option>}
          {showContainment && <option value={VisibilityComponentHierarchy.SpatialContainment}>{UiFramework.translate("visibilityWidget.containment")}</option>}
        </select>
        <span className="icon icon-search" style={searchStyle} onClick={this._onToggleSearchBox} />
        <span className="uifw-visibility-tree-options icon icon-more-vertical-2" style={searchStyle} title={UiFramework.translate("visibilityWidget.options")} ref={(element) => { this._optionsElement = element; }} onClick={this._onShowOptions.bind(this)}></span>
        <ContextMenu parent={this._optionsElement} isOpened={this.state.showOptions} onClickOutside={this._onCloseOptions.bind(this)} position={Position.BottomRight}>
          <ContextMenuItem key={0} icon="icon-visibility" onClick={this._onSetEnableAll} name={UiFramework.translate("pickerButtons.showAll")} />
          <ContextMenuItem key={1} icon="icon-visibility-hide-2" onClick={this._onClearAll} name={UiFramework.translate("pickerButtons.hideAll")} />
        </ContextMenu>
      </div>
      {this._renderTree()}
    </div>);
  }
}

/** VisibilityComponent that is connected to the IModelConnection property in the Redux store. The application must set up the Redux store and include the FrameworkReducer.
 * @beta
 */
export const IModelConnectedVisibilityComponent = connectIModelConnection(null, null)(VisibilityComponent); // tslint:disable-line:variable-name

/** VisibilityWidget React component.
 * @alpha
 */
// istanbul ignore next
export class VisibilityWidget extends WidgetControl {
  private _activeTreeRef = React.createRef<HTMLDivElement>();
  private _maintainScrollPosition?: ScrollPositionMaintainer;

  public static get iconSpec() {
    return IconSpecUtilities.createSvgIconSpec(widgetIconSvg);
  }

  public static get label() {
    return UiFramework.translate("visibilityWidget.visibilityTree");
  }

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    if (options && options.iModelConnection)
      this.reactElement = <VisibilityComponent iModelConnection={options.iModelConnection} activeViewport={IModelApp.viewManager.selectedView} activeTreeRef={this._activeTreeRef} enableHierarchiesPreloading={options.enableHierarchiesPreloading} useControlledTree={options.useControlledTree} />;
    else  // use the connection from redux
      this.reactElement = <IModelConnectedVisibilityComponent activeViewport={IModelApp.viewManager.selectedView} activeTreeRef={this._activeTreeRef} enableHierarchiesPreloading={options.enableHierarchiesPreloading} useControlledTree={options.useControlledTree} />;
  }

  public saveTransientState(): void {
    if (this._activeTreeRef.current)
      this._maintainScrollPosition = new ScrollPositionMaintainer(this._activeTreeRef.current);
  }

  public restoreTransientState(): boolean {
    if (this._maintainScrollPosition) {
      this._maintainScrollPosition.dispose();
      this._maintainScrollPosition = undefined;
    }
    return true;
  }
}
