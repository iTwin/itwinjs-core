/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Picker */

import * as React from "react";
import classnames from "classnames";
import { SpatialViewState } from "@bentley/imodeljs-frontend";
import { isInstanceNodeKey, NodeKey } from "@bentley/presentation-common";
import { treeWithFilteringSupport } from "@bentley/presentation-components";
import { Tree, TreeNodeItem, FilteringInput, SelectionMode, DelayLoadedTreeNodeItem } from "@bentley/ui-components";
import { CheckBoxInfo, CheckBoxState, isPromiseLike, NodeCheckboxRenderProps, ImageCheckBox } from "@bentley/ui-core";
import { ContextMenuPortal, ContextMenuItem, Position } from "../../contextmenu/PortalContextMenu";
import { UiFramework } from "../../UiFramework";
import { ListItem, ListItemType } from "../ListPicker";
import { CategoryModelTreeProps, CategoryModelTreeState, TreeNodeArrayPromise, Groups } from "./ModelSelectorDefinitions";

/**
 * Tree which displays and manages models or categories contained in an iModel.
 * @alpha
 */
export class CategoryModelTree extends React.Component<CategoryModelTreeProps, CategoryModelTreeState> {
  private _optionsElement: HTMLElement | null = null;
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
      isOptionsOpened: false,
      filterInfo: {},
      showSearchBox: false,
      selectedNodes: [],
    };
  }

  /** @internal */
  public componentDidMount() {
    this._isMounted = true;
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
    if (this._isMounted)
      this.setState({ selectedNodes });
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
    if (this._isMounted)
      this.setState({ selectedNodes });
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
    const item = this._getItem(this.state.activeGroup.dataProvider.getNodeKey(node));
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
    this._onCloseContextMenu();
    const items = await this.state.activeGroup.dataProvider.getNodes();
    this._setItemStates(items, enable); // tslint:disable-line:no-floating-promises
    this.setState({ checkboxInfo: this.createCheckBoxInfoCallback() });
  }

  /** Invert display on all items and state of all nodes */
  private _onInvertAll = async () => {
    this._onCloseContextMenu();
    this._invertEnableOnAllItems();
    this._invertEnableOnAllNodes(); // tslint:disable-line:no-floating-promises
    this.setState({ checkboxInfo: this.createCheckBoxInfoCallback() });
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
    this.state.activeGroup.updateState();
  }

  /** Invert state of all nodes */
  private _invertEnableOnAllNodes = async () => {
    const selectedNodes = await this._invertAllNodes();
    this.setState({ selectedNodes });
  }

  /**
   * Asynchronously inverts selection styling (checkbox, bold) on
   * every node and sets an inverted visibility for all items.
   * @returns IDs of all nodes selected after inversion.
   */
  private _invertAllNodes = async (): Promise<string[]> => {
    const parents: TreeNodeItem[] = await this.state.activeGroup.dataProvider.getNodes();
    const nodeIds: string[] = [];
    const promises: TreeNodeArrayPromise[] = [];

    parents.forEach((parent) => {
      if (parent.checkBoxState === CheckBoxState.Off)
        nodeIds.push(parent.id);
      promises.push(this.state.activeGroup.dataProvider.getNodes(parent));
    });

    await Promise.all(promises).then((childNodeCollection: DelayLoadedTreeNodeItem[][]) => {
      childNodeCollection.forEach((childNodes) => {
        childNodes.forEach((child) => {
          if (child.checkBoxState === CheckBoxState.Off)
            nodeIds.push(child.id);
        });
      });
    });

    return nodeIds;
  }

  /** @internal */
  public render() {
    const listClassName = classnames("uifw-modelselector", "show");
    return (
      <div className={listClassName}>
        {this._getToolbar()}
        {this._getTree()}
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

  private _getTree = () => {
    return (
      <div className="modelselector-content">
        <CategoryModelFilterTree
          // rowHeight={this._getRowHeight}
          dataProvider={this.state.activeGroup.dataProvider}
          filter={this.state.filterInfo ? this.state.filterInfo!.filter : ""}
          onFilterApplied={this.onFilterApplied}
          onMatchesCounted={this._onMatchesCounted}
          activeMatchIndex={this.state.filterInfo ? this.state.filterInfo.activeMatchIndex : 0}
          selectedNodes={this.state.selectedNodes}
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
      </div>
    );
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
    const nodeId = isInstanceNodeKey(key) && key.instanceKey.id;
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

  private _manageSelection = async (items: TreeNodeItem[], enable: boolean) => {
    await this._setItemStates(items, enable);
    this.setState({ checkboxInfo: this.createCheckBoxInfoCallback() });
  }

  /**
   * Set item and node state after input change
   * @param treeItem Item to set state on
   * @param enable Flag to enable or disable item, determined by checkBoxState if not specified
   */
  private _setItemStates = async (treeItems: TreeNodeItem[], enable: boolean) => {
    this._setEnableItems(treeItems, enable);
    this._setEnableNodes(treeItems, enable);

    if (this.state.activeGroup.id === Groups.Categories)
      treeItems.forEach((treeItem: TreeNodeItem) => {
        this._setEnableChildren(treeItem, enable); // tslint:disable-line:no-floating-promises
      });
  }

  /**
   * Set display flag on an item based on toggled node.
   * @param treeItem  Node related to toggled display item.
   */
  private _setEnableItems = (treeItems: TreeNodeItem[], enable: boolean) => {
    treeItems.forEach((treeItem: TreeNodeItem) => {
      const item = this._getItem(this.state.activeGroup.dataProvider.getNodeKey(treeItem));
      item.enabled = enable;
      this.state.activeGroup.setEnabled([item], enable);
      this.state.activeGroup.updateState();
    });
    this.setState({ checkboxInfo: this.createCheckBoxInfoCallback() });
  }

  /**
   * Find an item specified by a node based on shared key.
   * @param label  Label of item to be retrieved
   * @returns Specified item from list. Defaults to first item if none found.
   */
  private _getItem = (key: NodeKey): ListItem => {
    const items = this.state.activeGroup.items;
    for (const item of items) {
      if (isInstanceNodeKey(key) && key.instanceKey.id === item.key) {
        return item;
      }
    }
    return items[0];
  }

  /**
   * Sets display flag and node state for a given item.
   * @param treeItem  Node to set state for.
   * @param enable  Specifies if item should be enabled or disabled.
   */
  private _setEnableNodes = (treeItems: TreeNodeItem[], enable: boolean) => {
    const selectedNodes = this._manageSelectedNodes(treeItems, enable);
    this.setState({ selectedNodes });
  }

  private _manageSelectedNodes = (treeItems: TreeNodeItem[], enable: boolean, selectedNodes: string[] = []) => {
    if (selectedNodes.length === 0)
      selectedNodes = [...this.state.selectedNodes];

    treeItems.forEach((treeItem: TreeNodeItem) => {
      const index = selectedNodes.indexOf(treeItem.id);
      if (enable && index === -1) {
        selectedNodes.push(treeItem.id);
      } else if (!enable && index > -1) {
        selectedNodes.splice(index, 1);
      }
    });
    return selectedNodes;
  }

  private _setEnableChildren = async (treeItem: TreeNodeItem, enable: boolean) => {
    const childNodes = await this.state.activeGroup.dataProvider.getNodes(treeItem);
    this._setEnableItems(childNodes, enable);

    let selectedNodes: string[] = this.state.selectedNodes ? [...this.state.selectedNodes!] : [];
    for (const child of childNodes) {
      selectedNodes = this._manageSelectedNodes([child], enable, selectedNodes);
    }
    this.setState({ selectedNodes });
  }
}

/**
 * Tree component with support for filtering
 * @alpha
 */
const CategoryModelFilterTree = treeWithFilteringSupport(Tree); // tslint:disable-line:variable-name
