/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Picker */

import * as React from "react";
import classnames from "classnames";
import { ModelQueryParams, ModelProps } from "@bentley/imodeljs-common";
import { SpatialViewState, SpatialModelState } from "@bentley/imodeljs-frontend";
import { isInstanceNodeKey } from "@bentley/presentation-common";
import { treeWithFilteringSupport } from "@bentley/presentation-components";
import { Tree, TreeNodeItem, FilteringInput, SelectionMode } from "@bentley/ui-components";
import { CheckBoxInfo, CheckBoxState, isPromiseLike, NodeCheckboxRenderProps, ImageCheckBox, LoadingSpinner, SpinnerSize } from "@bentley/ui-core";
import { ContextMenuPortal, ContextMenuItem, Position } from "../../contextmenu/PortalContextMenu";
import { UiFramework } from "../../UiFramework";
import { ListItem, ListItemType } from "../ListPicker";
import { CategoryModelTreeProps, CategoryModelTreeState, Groups } from "./ModelSelectorDefinitions";

/**
 * Tree which displays and manages models or categories contained in an iModel.
 * @alpha
 */
export class CategoryModelTree extends React.Component<CategoryModelTreeProps, CategoryModelTreeState> {
  private _optionsElement: HTMLElement | null = null;
  private _allNodeIds: string[] = [];
  private _isMounted = false;

  constructor(props: CategoryModelTreeProps) {
    super(props);
    this._initState();
    this._initSelectedNodes();
  }

  private _initState = () => {
    this.state = {
      activeGroup: this.props.activeGroup,
      checkboxInfo: this.createCheckBoxInfoCallback(),
      isLoading: false,
      isOptionsOpened: false,
      filterInfo: {},
      showSearchBox: false,
      selectedNodes: [],
    };
  }

  /** @internal */
  public componentDidMount() {
    this._isMounted = true;
    this.props.activeView.onViewedModelsChanged.addListener(this._onViewedModelsChanged);
    this.props.activeView.onViewedCategoriesChanged.addListener(this._onViewedCategoriesChanged);
  }

  /** @internal */
  public componentDidUpdate(prevProps: CategoryModelTreeProps, _prevState: CategoryModelTreeState) {
    if (prevProps.activeView) {
      this.props.activeView.onViewedModelsChanged.removeListener(this._onViewedModelsChanged);
      this.props.activeView.onViewedCategoriesChanged.removeListener(this._onViewedCategoriesChanged);
    }
    if (this.props.activeView) {
      this.props.activeView.onViewedModelsChanged.addListener(this._onViewedModelsChanged);
      this.props.activeView.onViewedCategoriesChanged.addListener(this._onViewedCategoriesChanged);
    }
  }

  /** @internal */
  public componentWillUnmount() {
    this._isMounted = false;
  }

  private _initSelectedNodes = () => {
    const group = this.state.activeGroup.id;
    if (group === Groups.Models)
      this._setModelsFromViewState(); // tslint:disable-line:no-floating-promises
    else if (group === Groups.Categories)
      this._setCategoriesFromViewState(); // tslint:disable-line:no-floating-promises

  }

  private _onViewedModelsChanged = () => {
    this._setModelsFromViewState(); // tslint:disable-line:no-floating-promises
  }
  private _onViewedCategoriesChanged = () => {
    this._setCategoriesFromViewState(); // tslint:disable-line:no-floating-promises
  }

  /** Set model selection state based on ViewState */
  private _setModelsFromViewState = async () => {
    const view = this.props.activeView.view as SpatialViewState;
    const nodes = await this.state.activeGroup.dataProvider.getNodes();
    const selectedNodes: string[] = [];
    this.state.activeGroup.items.forEach((item: ListItem) => {
      if (view.modelSelector.models.has(item.key)) {
        const node = this._getNodeFromItem(item, nodes);
        selectedNodes.push(node.id);
      }
    });
    if (this._isMounted) this.setState({ selectedNodes });
  }

  /** Set category selection state based on ViewState */
  private _setCategoriesFromViewState = async () => {
    const view = this.props.activeView.view as SpatialViewState;
    const nodes = await this.state.activeGroup.dataProvider.getNodes();
    const selectedNodes: string[] = [];
    this.state.activeGroup.items.forEach((item: ListItem) => {
      if (view.categorySelector.categories.has(item.key)) {
        const node = this._getNodeFromItem(item, nodes);
        selectedNodes.push(node.id);
      }
    });
    if (this._isMounted) this.setState({ selectedNodes });
  }

  /**
   * Find a node specified by an item
   * @param item Item to find node with
   * @returns Matching node.
   */
  private _getNodeFromItem = (item: ListItem, nodes: TreeNodeItem[]) => {
    for (const node of nodes) {
      const key = this.state.activeGroup.dataProvider.getNodeKey(node);
      if (isInstanceNodeKey(key) && key.instanceKey.id === item.key) {
        return node;
      }
    }
    return nodes[0];
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
    const key = this.state.activeGroup.dataProvider.getNodeKey(node);
    const nodeId = isInstanceNodeKey(key) ? key.instanceKey.id : "";
    const item = this._getItem(nodeId);
    if (item) {
      const view = this.props.activeView.view as SpatialViewState;
      let state = CheckBoxState.Off;
      const group = this.state.activeGroup.id;
      if (group === Groups.Models && view.modelSelector.models.has(item.key) ||
        group === Groups.Categories && view.categorySelector.categories.has(item.key))
        state = CheckBoxState.On;
      return { isDisabled: false, isVisible: true, state };
    }
    return {};
  }

  // tslint:disable-next-line: naming-convention
  private onCheckboxStateChange = async (node: TreeNodeItem, state: CheckBoxState) => {
    state === CheckBoxState.On ? this._onNodesSelected([node]) : this._onNodesDeselected([node]);
  }

  // tslint:disable-next-line: naming-convention
  private renderNodeCheckbox = (props: NodeCheckboxRenderProps): React.ReactNode => {
    return (
      <ImageCheckBox
        checked={props.checked}
        disabled={props.disabled}
        imageOn="icon-visibility"
        imageOff="icon-visibility-hide-2"
        onClick={props.onChange}
      />
    );
  }

  /**
   * Enable or disable all items and nodes
   * @param enable Specifies if items and nodes should be enabled or disabled
   */
  private _onSetEnableAll = async (enable: boolean) => {
    this.setState({ isLoading: true });
    this._onCloseContextMenu();
    if (this._allNodeIds.length === 0)
      this._allNodeIds = await this._fetchAllNodeIds();
    this._setItemStates(this._allNodeIds, enable); // tslint:disable-line:no-floating-promises

    if (this._isMounted)
      this.setState({ isLoading: false, checkboxInfo: this.createCheckBoxInfoCallback() });
  }

  private _fetchAllNodeIds = async (): Promise<string[]> => {
    if (this.state.activeGroup.id === Groups.Models) {
      const nodeIds = await this._fetchAllModelNodeIds();
      return nodeIds;
    }
    if (this.state.activeGroup.id === Groups.Categories) {
      const nodeIds = await this._fetchAllCategoryNodeIds();
      return nodeIds;
    }
    return [];
  }

  private _fetchAllModelNodeIds = async (): Promise<string[]> => {
    const modelQueryParams: ModelQueryParams = { from: SpatialModelState.getClassFullName(), wantPrivate: false };
    let curModelProps: ModelProps[] = new Array<ModelProps>();

    if (this.props.iModelConnection)
      curModelProps = await this.props.iModelConnection.models.queryProps(modelQueryParams);

    const ids: string[] = [];
    for (const modelProps of curModelProps) {
      ids.push(modelProps.id ? modelProps.id.toString() : "");
    }

    return ids;
  }

  private _fetchAllCategoryNodeIds = async (): Promise<string[]> => {
    const view = this.props.activeView.view as SpatialViewState;
    const selectUsedSpatialCategoryIds = "SELECT DISTINCT Category.Id as id from BisCore.GeometricElement3d WHERE Category.Id IN (SELECT ECInstanceId from BisCore.SpatialCategory)";
    const selectUsedDrawingCategoryIds = "SELECT DISTINCT Category.Id as id from BisCore.GeometricElement2d WHERE Model.Id=? AND Category.Id IN (SELECT ECInstanceId from BisCore.DrawingCategory)";
    const ecsql = view.is3d() ? selectUsedSpatialCategoryIds : selectUsedDrawingCategoryIds;
    const ecsql2 = "SELECT ECInstanceId as id, UserLabel as label, CodeValue as code FROM " + (view.is3d() ? "BisCore.SpatialCategory" : "BisCore.DrawingCategory") + " WHERE ECInstanceId IN (" + ecsql + ")";
    const ids = [];

    if (this.props.iModelConnection) {
      const rowIterator = this.props.iModelConnection.query(ecsql2);
      for await (const row of rowIterator) {
        ids.push(row.id);
      }
    }

    return ids;
  }

  /** Invert display on all items and state of all nodes */
  private _onInvertAll = async () => {
    this.setState({ isLoading: true });
    this._onCloseContextMenu();
    this._invertEnableOnAllItems();
    if (this._isMounted) this.setState({ isLoading: false, checkboxInfo: this.createCheckBoxInfoCallback() });
  }

  /** Invert display on all items */
  private _invertEnableOnAllItems = () => {
    const enabledItems = [];
    const disabledItems = [];
    for (const item of this.state.activeGroup.items) {
      item.enabled = !item.enabled;
      item.enabled ? enabledItems.push(item) : disabledItems.push(item);
    }
    this.state.activeGroup.setEnabled(enabledItems, true);
    this.state.activeGroup.setEnabled(disabledItems, false);
  }

  /** @internal */
  public render() {
    const listClassName = classnames("uifw-modelselector", "show");
    return (
      <div className={listClassName}>
        {this._getToolbar()}
        <div className="modelselector-content">
          {this.state.isLoading ?
            this._getSpinner() :
            this._getTree()
          }
        </div>
      </div>
    );
  }

  private _getToolbar = () => {
    return (
      <div className="modelselector-toolbar">
        {this.state.showSearchBox &&
          <FilteringInput
            filteringInProgress={this.state.filterInfo && this.state.filterInfo.filtering || false}
            onFilterCancel={this._onFilterCancel}
            onFilterClear={this._onFilterClear}
            onFilterStart={this._onFilterStart}
            resultSelectorProps={{
              onSelectedChanged: this._onSelectedMatchChanged,
              resultCount: this.state.filterInfo && this.state.filterInfo.matchesCount || 0,
            }}
          />
        }
        <div className="option-group">
          <span className="icon icon-search" onClick={this._onToggleSearchBox} />
          <span className="options icon icon-more-2" title={UiFramework.i18n.translate("UiFramework:categoriesModels.options")}
            onClick={this._onShowOptions.bind(this)} ref={(element) => { this._optionsElement = element; }}></span>
          <ContextMenuPortal parent={this._optionsElement} isOpened={this.state.isOptionsOpened} onClickOutside={this._onCloseContextMenu.bind(this)} position={Position.BottomRight}>
            <ContextMenuItem key={0} name={UiFramework.i18n.translate("UiFramework:pickerButtons.showAll")} icon="icon-visibility" onClick={this._onSetEnableAll.bind(this, true)} />
            <ContextMenuItem key={1} name={UiFramework.i18n.translate("UiFramework:pickerButtons.hideAll")} icon="icon-visibility-hide-2" onClick={this._onSetEnableAll.bind(this, false)} />
            <ContextMenuItem key={2} name={UiFramework.i18n.translate("UiFramework:pickerButtons.invert")} icon="icon-visibility-invert" onClick={this._onInvertAll.bind(this)} />
          </ContextMenuPortal>
        </div>
      </div>
    );
  }

  private _onToggleSearchBox = () => {
    this.setState({ showSearchBox: !this.state.showSearchBox });
  }

  private _onFilterCancel = () => {
    if (!this.state.filterInfo)
      return;

    this.setState({
      filterInfo: {
        ...this.state.filterInfo,
        filter: "",
        filtering: false,
      },
    });
  }

  private _onFilterClear = () => {
    if (!this.state.filterInfo)
      return;

    this.setState({
      filterInfo: {
        ...this.state.filterInfo,
        filter: "",
        filtering: false,
      },
    });
  }

  private _onFilterStart = (filter: string) => {
    if (!this.state.filterInfo)
      return;

    this.setState({
      filterInfo: {
        ...this.state.filterInfo,
        filter,
        filtering: true,
      },
    });
  }

  private _onSelectedMatchChanged = (index: number) => {
    if (this.state.filterInfo && index !== this.state.filterInfo.matchesCount)
      this.setState({
        filterInfo: {
          ...this.state.filterInfo,
          activeMatchIndex: index,
        },
      });
  }

  // tslint:disable-next-line:naming-convention
  private onFilterApplied = (_filter?: string): void => {
    if (this.state.filterInfo && this.state.filterInfo.filtering)
      this.setState({
        filterInfo: {
          ...this.state.filterInfo,
          filtering: false,
        },
      });
  }

  private _onMatchesCounted = (count: number) => {
    if (this.state.filterInfo && count !== this.state.filterInfo.matchesCount)
      this.setState({
        filterInfo: {
          ...this.state.filterInfo,
          matchesCount: count,
        },
      });
  }

  private _onShowOptions(event: any) {
    event.stopPropagation();
    this.setState({ isOptionsOpened: !this.state.isOptionsOpened });
  }

  private _onCloseContextMenu() {
    this.setState({ isOptionsOpened: false });
  }

  private _getSpinner = () => {
    return (
      <LoadingSpinner size={SpinnerSize.Large} />
    );
  }

  private _getTree = () => {
    return (
      <CategoryModelFilterTree
        dataProvider={this.state.activeGroup.dataProvider}
        filter={this.state.filterInfo ? this.state.filterInfo!.filter : ""}
        onFilterApplied={this.onFilterApplied}
        onMatchesCounted={this._onMatchesCounted}
        activeMatchIndex={this.state.filterInfo ? this.state.filterInfo.activeMatchIndex : 0}
        selectedNodes={this._getSelectedNodes}
        selectionMode={SelectionMode.Multiple}
        onNodesSelected={this._onNodesSelected}
        onNodesDeselected={this._onNodesDeselected}
        onNodeExpanded={this._onNodeExpanded}
        showDescriptions={true}
        checkboxInfo={this.state.checkboxInfo}
        onCheckboxClick={this.onCheckboxStateChange}
        showIcons={true}
        renderOverrides={{ renderCheckbox: this.renderNodeCheckbox }}
        pageSize={5}
      />
    );
  }

  private _getSelectedNodes = (node: TreeNodeItem) => {
    const key = this.state.activeGroup.dataProvider.getNodeKey(node);
    const id = isInstanceNodeKey(key) ? key.instanceKey.id : "";
    if (this.state.activeGroup.id === Groups.Models) {
      return this._isModelDisplayed(id);
    }
    if (this.state.activeGroup.id === Groups.Categories) {
      return this._isCategoryDisplayed(id);
    }
    return false;
  }

  private _isModelDisplayed = (id: string) => {
    const view = this.props.activeView.view as SpatialViewState;
    if (view.modelSelector.models.has(id))
      return true;
    return false;
  }

  private _isCategoryDisplayed = (id: string) => {
    const view = this.props.activeView.view as SpatialViewState;
    if (view.categorySelector.categories.has(id))
      return true;
    return false;
  }

  private _onNodesSelected = (items: TreeNodeItem[]) => {
    this._manageSelection(items, true); // tslint:disable-line:no-floating-promises
  }

  private _onNodesDeselected = (items: TreeNodeItem[]) => {
    this._manageSelection(items, false); // tslint:disable-line:no-floating-promises
  }

  // Nodes only expand if active group is "Categories"
  private _onNodeExpanded = async (node: TreeNodeItem) => {
    const categories: ListItem[] = this.state.activeGroup.items;
    const key = this.state.activeGroup.dataProvider.getNodeKey(node);
    const nodeId = isInstanceNodeKey(key) ? key.instanceKey.id : "";
    const ecsql = "SELECT ECInstanceId as id FROM BisCore.SubCategory WHERE Parent.Id=" + nodeId;
    const rows = [];

    if (this.props.iModelConnection) {
      const rowIterator = this.props.iModelConnection.query(ecsql);
      for await (const row of rowIterator) {
        rows.push(row);
      }
    }

    for (const row of rows) {
      const existingItem = categories.find((category) => {
        return row.id === category.key;
      });

      if (!existingItem) {
        const category: ListItem = {
          key: row.id as string,
          enabled: this.props.activeView.view.categorySelector.has(row.id as string),
          type: ListItemType.Item,
        };
        categories.push(category);
      }
    }

    this.setState({
      activeGroup: {
        ...this.state.activeGroup,
        items: categories,
      },
      checkboxInfo: this.createCheckBoxInfoCallback(),
    });
  }

  private _manageSelection = async (nodes: TreeNodeItem[], enable: boolean) => {
    const nodeIds = this._getNodeIds(nodes);
    await this._setItemStates(nodeIds, enable);

    if (this._isMounted) this.setState({ checkboxInfo: this.createCheckBoxInfoCallback() });
  }

  private _getNodeIds = (nodes: TreeNodeItem[]) => {
    const nodeIds: string[] = [];
    nodes.forEach((node) => {
      const key = this.state.activeGroup.dataProvider.getNodeKey(node);
      const id = isInstanceNodeKey(key) ? key.instanceKey.id : "";
      nodeIds.push(id);
    });
    return nodeIds;
  }

  /**
   * Set item and node state after input change
   * @param treeItem Item to set state on
   * @param enable Flag to enable or disable item, determined by checkBoxState if not specified
   */
  private _setItemStates = async (treeItemIds: string[], enable: boolean) => {
    this._setEnableItems(treeItemIds, enable);

    if (this.state.activeGroup.id === Groups.Categories)
      treeItemIds.forEach((treeItemId: string) => {
        this._setEnableChildren(treeItemId, enable); // tslint:disable-line:no-floating-promises
      });
  }

  /**
   * Set display flag on an item based on toggled node.
   * @param treeItem  Node related to toggled display item.
   */
  private _setEnableItems = (treeNodeIds: string[], enable: boolean) => {
    treeNodeIds.forEach((treeNodeId: string) => {
      const item = this._getItem(treeNodeId);
      item.enabled = enable;
      this.state.activeGroup.setEnabled([item], enable);
    });
    if (this._isMounted) this.setState({ checkboxInfo: this.createCheckBoxInfoCallback() });
  }

  /**
   * Find an item specified by a node based on shared key.
   * @param treeNodeId Tree node ID to match.
   * @returns Specified item from list. Defaults to first item if none found.
   */
  private _getItem = (treeNodeId: string): ListItem => {
    const items = this.state.activeGroup.items;
    for (const item of items) {
      if (treeNodeId === item.key) {
        return item;
      }
    }
    return items[0];
  }

  private _setEnableChildren = async (nodeId: string, enable: boolean) => {
    const childNodeIds = await this._fetchChildNodes(nodeId);
    this._setEnableItems(childNodeIds, enable);
  }

  private _fetchChildNodes = async (nodeId: string): Promise<string[]> => {
    const ecsql = "SELECT ECInstanceId as id FROM BisCore.SubCategory WHERE Parent.Id=" + nodeId;
    const childIds = [];

    if (this.props.iModelConnection) {
      const rowIterator = this.props.iModelConnection.query(ecsql);
      for await (const row of rowIterator) {
        childIds.push(row.id);
      }
    }

    return childIds;
  }
}

/**
 * Tree component with support for filtering
 * @alpha
 */
const CategoryModelFilterTree = treeWithFilteringSupport(Tree); // tslint:disable-line:variable-name
