/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
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
import { WidgetControl } from "../widgets/WidgetControl";
import { Tree, FilteringInput, TreeNodeItem, PageOptions, DelayLoadedTreeNodeItem, TreeDataChangesListener, SelectionMode } from "@bentley/ui-components";
import "./ModelSelector.scss";
import { PresentationTreeDataProvider, treeWithFilteringSupport, IPresentationTreeDataProvider } from "@bentley/presentation-components";
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
  iModelConnection: IModelConnection;
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
    selectedNodes?: string[];
  };
}

/**
 * Implementation of a PresentationTreeDataProvider that manages checkbox display,
 * bolding, and highlighting selections.
 */
class ModelSelectorDataProvider implements IPresentationTreeDataProvider {
  private _baseProvider: PresentationTreeDataProvider;

  /** @hidden */
  constructor(imodel: IModelConnection, rulesetId: string) {
    this._baseProvider = new PresentationTreeDataProvider(imodel, rulesetId);
  }

  /** Id of the ruleset used by this data provider */
  public get rulesetId(): string { return this._baseProvider.rulesetId; }

  /** [[IModelConnection]] used by this data provider */
  public get imodel(): IModelConnection { return this._baseProvider.imodel; }

  /** Listener for tree node changes */
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
   * @returns Filtered NodePaths
   */
  public getFilteredNodePaths = async (filter: string): Promise<NodePathElement[]> => {
    return this._baseProvider.getFilteredNodePaths(filter);
  }

  /**
   * Provides count for number of nodes under parent node
   * @param parentNode Node to count children for
   * @returns number of children under parentNode
   */
  public getNodesCount = _.memoize(async (parentNode?: TreeNodeItem): Promise<number> => {
    return this._baseProvider.getNodesCount(parentNode);
  });

  /**
   * Modifies and returns nodes to be displayed.
   * @param parentNode The parent node for all nodes to be returned
   * @param pageOptions Paging options
   * @returns TreeNodeItems to be displayed
   */
  public getNodes = _.memoize(async (parentNode?: TreeNodeItem, pageOptions?: PageOptions): Promise<DelayLoadedTreeNodeItem[]> => {
    const nodes = await this._baseProvider.getNodes(parentNode, pageOptions);
    nodes.forEach((n: DelayLoadedTreeNodeItem) => {
      n.isCheckboxVisible = true;

      if (n.checkBoxState && n.checkBoxState === CheckBoxState.On)
        n.labelBold = true;
      else
        n.labelBold = false;
    });
    return nodes;
  });
}

/** Model Selector [[WidgetControl]] */
export class ModelSelectorWidgetControl extends WidgetControl {
  /** Creates a ModelSelectorDemoWidget */
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <ModelSelectorWidget iModelConnection={options.iModelConnection} />;
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

  /** Iinitialize listeners and category/model rulesets */
  public componentDidMount() {
    this._isMounted = true;
    this._initModelState();
    this._initCategoryState();

    this._removeSelectedViewportChanged = IModelApp.viewManager.onSelectedViewportChanged.addListener(this._handleSelectedViewportChanged);
  }

  private _initModelState = () => {
    Presentation.presentation.rulesets().add(require("../../../rulesets/Models")) // tslint:disable-line:no-floating-promises
      .then((ruleset: RegisteredRuleset) => {
        if (!this._isMounted)
          return;
        this._modelRuleset = ruleset;
        this.setState({
          treeInfo: {
            ruleset,
            dataProvider: new ModelSelectorDataProvider(this.props.iModelConnection, ruleset.id),
            filter: "",
            filtering: false,
            prevProps: this.props,
            activeMatchIndex: 0,
            matchesCount: 0,
            selectedNodes: [],
          },
          expand: true,
        });
        // tslint:disable:no-floating-promises
        this._onSetEnableAll(true);
      });
  }

  private _initCategoryState = () => {
    Presentation.presentation.rulesets().add(require("../../../rulesets/Categories")) // tslint:disable-line:no-floating-promises
      .then((ruleset: RegisteredRuleset) => {
        if (!this._isMounted)
          return;
        this._categoryRuleset = ruleset;
        // tslint:disable:no-floating-promises
        this._onSetEnableAll(true);
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

  /** Initializes category/model groups and contents */
  private _initGroups() {
    this._groups = [];
    this._groups.push(this._getDefaultModelGroup());
    this._groups.push(this._getDefaultCategoryGroup());
  }

  /**
   * Creates initial model group
   * @returns Initialized model group
   */
  private _getDefaultModelGroup = () => {
    return {
      id: "Models",
      label: UiFramework.i18n.translate("UiFramework:categoriesModels.models"),
      items: [],
      initialized: false,
      updateState: this.updateModelsState.bind(this),
      setEnabled: this._onModelChecked,
    };
  }

  /**
   * Creates initial category group
   * @returns Initialized category group
   */
  private _getDefaultCategoryGroup = () => {
    return {
      id: "Categories",
      label: UiFramework.i18n.translate("UiFramework:categoriesModels.categories"),
      items: [],
      initialized: false,
      updateState: this.updateCategoriesState.bind(this),
      setEnabled: this._onCategoryChecked,
    };
  }

  /**
   * Update viewed models on selected viewport changed
   * @param args Arguments for selected viewport changed
   */
  private _handleSelectedViewportChanged = (args: SelectedViewportChangedArgs) => {
    if (args.current) {
      this._initGroups();
      this.updateState(); // tslint:disable-line:no-floating-promises
    }
  }

  /**
   * Expand the selected group
   * @param group ModelGroup to expand.
   */
  private _onExpand = async (group: ModelGroup) => {
    const activeRuleset = this._getActiveRuleset(group);
    if (!activeRuleset)
      return;

    await this._setActiveRuleset(activeRuleset);
    this._setInitialExpandedState(group);
  }

  /**
   * Determines active ruleset based on provided group.
   * @param group Newly set active group.
   * @returns Ruleset associated with newly set active group.
   */
  private _getActiveRuleset = (group: ModelGroup): RegisteredRuleset | undefined => {
    if (group.label === UiFramework.i18n.translate("UiFramework:categoriesModels.models"))
      return this._modelRuleset;
    else if (group.label === UiFramework.i18n.translate("UiFramework:categoriesModels.categories"))
      return this._categoryRuleset;
    else
      return this._modelRuleset;
  }

  /**
   * Sets provided ruleset as new ruleset for tree.
   * @param activeRuleset Ruleset to provide to tree.
   */
  private _setActiveRuleset = async (activeRuleset: RegisteredRuleset) => {
    this.setState({
      treeInfo: {
        ...this.state.treeInfo!,
        ruleset: activeRuleset,
        dataProvider: new ModelSelectorDataProvider(this.props.iModelConnection, activeRuleset.id),
      },
    });
  }

  /**
   * Sets initial state as tab expands
   * @param group ModelGroup to initialize state on
   */
  private _setInitialExpandedState = async (group: ModelGroup) => {
    if (this.state.treeInfo) {
      const selectedNodes = await this._selectEnabledItems(group.items);

      this.setState({
        treeInfo: {
          ...this.state.treeInfo,
          selectedNodes,
        },
        activeGroup: group,
        expand: true,
      });
    }
  }

  /**
   * Sets checkbox and selection states of node based on
   * enable state of associated items.
   * @param items Items to set selection for if enabled
   * @returns Nodes that have been selected
   */
  private _selectEnabledItems = async (items: ListItem[]) => {
    const selectedNodes = Array<string>();
    const promises = Array<Promise<DelayLoadedTreeNodeItem | undefined>>();
    for (const item of items) {
      if (item)
        promises.push(this._getNodeFromItem(item));
    }

    await Promise.all(promises).then((nodes) => {
      nodes.forEach((node) => {
        if (node) {
          selectedNodes.push(node.id);
          this._selectLabel(node);
        }
      });
    });

    return selectedNodes;
  }

  /**
   * Enable or disable all items and nodes
   * @param enable Specifies if items and nodes should be enabled or disabled
   */
  private _onSetEnableAll = (enable: boolean) => {
    this._setEnableAllItems(enable);
    this._setEnableAllNodes(enable);
  }

  /**
   * Enable or disable all items
   * @param enable Specifies if items should be enabled or disabled
   */
  private _setEnableAllItems = (enable: boolean) => {
    for (const item of this.state.activeGroup.items) {
      item.enabled = enable;
      this.state.activeGroup.setEnabled(item, enable);
    }
    this.state.activeGroup.updateState();
  }

  /**
   * Enable or disable all nodes
   * @param enable Specifies if nodes should be enabled or disabled
   */
  private _setEnableAllNodes = async (enable: boolean) => {
    let selectedNodes: string[] = [];
    if (enable) {
      selectedNodes = await this._selectAllNodes();
    } else {
      this._deselectAllNodes();
    }

    this.setState({
      treeInfo: {
        ...this.state.treeInfo!,
        selectedNodes,
      },
    });
  }

  /**
   * Asynchronously removes selection styling (checkbox, bold) from
   * every node and sets visibility of all items to hidden.
   */
  private _deselectAllNodes = async () => {
    const parents: TreeNodeItem[] = await this.state.treeInfo!.dataProvider.getNodes();
    const promises: Array<Promise<DelayLoadedTreeNodeItem[]>> = [];

    parents.forEach((parent) => {
      parent.checkBoxState = CheckBoxState.Off;
      parent.labelBold = false;
      promises.push(this.state.treeInfo!.dataProvider.getNodes(parent));
    });
    this.state.treeInfo!.dataProvider.onTreeNodeChanged.raiseEvent(parents);

    Promise.all(promises).then((childNodeCollection: DelayLoadedTreeNodeItem[][]) => {
      childNodeCollection.forEach((childNodes) => {
        childNodes.forEach((child) => {
          child.checkBoxState = CheckBoxState.Off;
          child.labelBold = false;
        });
        this.state.treeInfo!.dataProvider.onTreeNodeChanged.raiseEvent(childNodes);
      });
    });

    this._setEnableAllItems(false);
  }

  /**
   * Asynchronously adds selection styling (checkbox, bold) to
   * every node and sets visibility of all items to display.
   * @returns IDs of all nodes, including children
   */
  private _selectAllNodes = async (): Promise<string[]> => {
    const parents: TreeNodeItem[] = await this.state.treeInfo!.dataProvider.getNodes();
    const nodeIds: string[] = [];
    const promises: Array<Promise<DelayLoadedTreeNodeItem[]>> = [];

    parents.forEach((parent) => {
      parent.checkBoxState = CheckBoxState.On;
      parent.labelBold = true;
      nodeIds.push(parent.id);
      promises.push(this.state.treeInfo!.dataProvider.getNodes(parent));
    });
    this.state.treeInfo!.dataProvider.onTreeNodeChanged.raiseEvent(parents);

    await Promise.all(promises).then((childNodeCollection: DelayLoadedTreeNodeItem[][]) => {
      childNodeCollection.forEach((childNodes) => {
        childNodes.forEach((child) => {
          child.checkBoxState = CheckBoxState.On;
          child.labelBold = true;
          nodeIds.push(child.id);
        });
        this.state.treeInfo!.dataProvider.onTreeNodeChanged.raiseEvent(childNodes);
      });
    });

    return nodeIds;
  }

  /** Invert display on all items and state of all nodes */
  private _onInvertAll = () => {
    this._invertEnableOnAllItems();
    this._invertEnableOnAllNodes();
  }

  /** Invert display on all items */
  private _invertEnableOnAllItems = () => {
    for (const item of this.state.activeGroup.items) {
      this.state.activeGroup.setEnabled(item, !item.enabled);
      item.enabled = !item.enabled;
    }
    this.state.activeGroup.updateState();
  }

  /** Invert state of all nodes */
  private _invertEnableOnAllNodes = async () => {
    const selectedNodes = await this._invertAllNodes();

    this.setState({
      treeInfo: {
        ...this.state.treeInfo!,
        selectedNodes,
      },
    });
  }

  /**
   * Asynchronously inverts selection styling (checkbox, bold) on
   * every node and sets an inverted visibility for all items.
   * @returns IDs of all nodes selected after inversion.
   */
  private _invertAllNodes = async (): Promise<string[]> => {
    const parents: TreeNodeItem[] = await this.state.treeInfo!.dataProvider.getNodes();
    const nodeIds: string[] = [];
    const promises: Array<Promise<DelayLoadedTreeNodeItem[]>> = [];

    parents.forEach((parent) => {
      if (parent.checkBoxState === CheckBoxState.On) {
        parent.checkBoxState = CheckBoxState.Off;
        parent.labelBold = false;
      } else {
        parent.checkBoxState = CheckBoxState.On;
        parent.labelBold = true;
        nodeIds.push(parent.id);
      }
      promises.push(this.state.treeInfo!.dataProvider.getNodes(parent));
    });
    this.state.treeInfo!.dataProvider.onTreeNodeChanged.raiseEvent(parents);

    await Promise.all(promises).then((childNodeCollection: DelayLoadedTreeNodeItem[][]) => {
      childNodeCollection.forEach((childNodes) => {
        childNodes.forEach((child) => {
          if (child.checkBoxState === CheckBoxState.On) {
            child.checkBoxState = CheckBoxState.Off;
            child.labelBold = false;
          } else {
            child.checkBoxState = CheckBoxState.On;
            child.labelBold = true;
            nodeIds.push(child.id);
          }
        });
        this.state.treeInfo!.dataProvider.onTreeNodeChanged.raiseEvent(childNodes);
      });
    });

    return nodeIds;
  }

  private async _updateModelsWithViewport(vp: Viewport) {
    // Query models and add them to state
    if (!(vp.view instanceof SpatialViewState))
      return;

    const spatialView = vp.view as SpatialViewState;
    const modelQueryParams: ModelQueryParams = { from: SpatialModelState.getClassFullName(), wantPrivate: false };
    let curModelProps: ModelProps[] = new Array<ModelProps>();

    if (this.props.iModelConnection)
      curModelProps = await this.props.iModelConnection.models.queryProps(modelQueryParams);

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

    if (this.props.iModelConnection)
      rows = await this.props.iModelConnection.executeQuery(ecsql);

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

  /** Modify viewport to display checked models */
  private _onModelChecked = (item: ListItem, checked: boolean) => {
    if (!IModelApp.viewManager)
      return;

    item.enabled = checked;
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

  /** Modify viewport to display checked categories */
  private _onCategoryChecked = (item: ListItem, checked: boolean) => {
    if (!IModelApp.viewManager || !IModelApp.viewManager.selectedView)
      return;

    item.enabled = checked;

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

  /** Set item state for selected node */
  private _onNodesSelected = (items: TreeNodeItem[]) => {
    items.forEach((item: TreeNodeItem) => {
      item.checkBoxState = CheckBoxState.On;
      item.labelBold = true;
      this._setItemState(item, true);
    });
    return true;
  }

  private _onNodeExpanded = async (item: TreeNodeItem) => {
    const enable = item.checkBoxState === CheckBoxState.On ? true : false;
    await this._setEnableChildren(item, enable);
    const nodes = await this.state.treeInfo!.dataProvider.getNodes(item);
    this.state.treeInfo!.dataProvider.onTreeNodeChanged.raiseEvent(nodes);
  }

  private _onCheckboxClick = (node: TreeNodeItem) => {
    node.checkBoxState === CheckBoxState.On ? this._onNodesDeselected([node]) : this._onNodesSelected([node]);
  }

  /** Set item state for deselected node */
  private _onNodesDeselected = (items: TreeNodeItem[]) => {
    items.forEach((item: TreeNodeItem) => {
      item.checkBoxState = CheckBoxState.Off;
      item.labelBold = false;
      this._setItemState(item, false);
    });
    return true;
  }

  /**
   * Set item and node state after input change
   * @param treeItem Item to set state on
   * @param enable Flag to enable or disable item, determined by checkBoxState if not specified
   */
  private _setItemState = (treeItem: TreeNodeItem, enable: boolean) => {
    enable ? this._setItemStateOn(treeItem) : this._setItemStateOff(treeItem);
    this.setState({ activeGroup: this.state.activeGroup });
  }

  /**
   * Set display flag on for item and then set node state to on.
   * @param treeItem  Node item that is being enabled
   */
  private _setItemStateOn = (treeItem: TreeNodeItem) => {
    this._setEnableItem(treeItem, true);
    this._setEnableNode(treeItem, true);
    this._setEnableChildren(treeItem, true);
    this.state.treeInfo!.dataProvider.onTreeNodeChanged.raiseEvent([treeItem]);
  }

  /**
   * Set display flag off for item and then set node state to off.
   * @param treeItem  Node item that is being disabled.
   */
  private _setItemStateOff = async (treeItem: TreeNodeItem) => {
    this._setEnableItem(treeItem, false);
    this._setEnableNode(treeItem, false);
    this._setEnableChildren(treeItem, false);
    this.state.treeInfo!.dataProvider.onTreeNodeChanged.raiseEvent([treeItem]);
  }

  /**
   * Set display flag on an item based on toggled node.
   * @param treeItem  Node related to toggled display item.
   */
  private _setEnableItem = (treeItem: TreeNodeItem, enable: boolean) => {
    const item = this._getItem(treeItem.label);
    this.state.activeGroup.setEnabled(item, enable);
  }

  /**
   * Sets display flag and node state for a given item.
   * @param treeItem  Node to set state for.
   * @param enable  Specifies if item should be enabled or disabled.
   */
  private _setEnableNode = (treeItem: TreeNodeItem, enable: boolean) => {
    const selectedNodes = enable ? this._selectLabel(treeItem) : this._deselectLabel(treeItem);
    this.setState({
      treeInfo: {
        ...this.state.treeInfo!,
        selectedNodes,
      },
    });
  }

  /**
   * Sets display flag and node state for a given item's children.
   * @param treeItem  Node whose children to set state and display for.
   * @param enable  Specified if children should be enabled or disabled.
   */
  private _setEnableChildren = async (treeItem: TreeNodeItem, enable: boolean) => {
    const childNodes = await this.state.treeInfo!.dataProvider.getNodes(treeItem);
    let selectedNodes: string[] = this.state.treeInfo!.selectedNodes ? [...this.state.treeInfo!.selectedNodes!] : [];
    for (const child of childNodes) {
      selectedNodes = enable ? this._selectLabel(child, selectedNodes) : this._deselectLabel(child, selectedNodes);
    }

    this.setState({
      treeInfo: {
        ...this.state.treeInfo!,
        selectedNodes,
      },
    });
  }

  /**
   * Adds a node to a list of selected items and returns to caller for state setting.
   * @param treeNode  Node to add as a selected node
   * @param selectedNodes (optional) managed set of selected nodes - defaults to set
   *                      provided by treeInfo if none provided
   * @returns List of ID's for selected nodes
   */
  private _selectLabel = (treeItem: TreeNodeItem, selectedNodes?: string[]): string[] => {
    if (this.state.treeInfo && this.state.treeInfo.selectedNodes) {
      if (!selectedNodes || selectedNodes.length === 0)
        selectedNodes = [...this.state.treeInfo.selectedNodes];

      const index = selectedNodes.indexOf(treeItem.id);
      if (index === -1) {
        treeItem.checkBoxState = CheckBoxState.On;
        treeItem.labelBold = true;

        const nodes = selectedNodes;
        nodes.push(treeItem.id);
        return nodes;
      }
      return selectedNodes;
    }
    return [];
  }

  /**
   * Removes a node from a list of selected items and returns to caller for state setting.
   * @param treeNode  Node to remove from selected nodes
   * @param selectedNodes (optional) managed set of selected nodes - defaults to set
   *                      provided by treeInfo if none provided
   * @returns List of ID's for selected nodes
   */
  private _deselectLabel = (treeItem: TreeNodeItem, selectedNodes?: string[]): string[] => {
    if (this.state.treeInfo && this.state.treeInfo.selectedNodes) {
      if (!selectedNodes || selectedNodes.length === 0)
        selectedNodes = [...this.state.treeInfo.selectedNodes];

      const index = selectedNodes.indexOf(treeItem.id);
      if (index > -1) {
        treeItem.checkBoxState = CheckBoxState.Off;
        treeItem.labelBold = false;

        const nodes = selectedNodes;
        nodes.splice(index, 1);
        return nodes;
      }
      return selectedNodes;
    }
    return [];
  }

  /**
   * Find an item specified by a node based on shared label.
   * @param label  Label of item to be retreived
   * @returns Specified item from list. Defaults to first item if none found.
   */
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

    const checkedItem = items.find((item: ListItem): boolean => {
      return label === item.name;
    });

    return checkedItem ? checkedItem : items[0];
  }

  /**
   * Find a node specified by an item
   * @param item Item to find node with
   * @returns Matching node.
   */
  private _getNodeFromItem = async (item: ListItem) => {
    if (this.state.treeInfo) {
      const nodes = await this.state.treeInfo.dataProvider.getNodes();
      for (const node of nodes) {
        if (node.label === item.name)
          return node;
      }
    }

    return;
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
                      key={group.id}
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
                <span className="icon icon-visibility-invert" title={UiFramework.i18n.translate("UiFramework:pickerButtons.invert")} onClick={this._onInvertAll.bind(this)} />
              </div>
            </div>
            <div style={{ height: "100%" }}>
              {
                (this.props.iModelConnection) ?
                  <CategoryModelTree
                    dataProvider={this.state.treeInfo.dataProvider}
                    filter={this.state.treeInfo.filter}
                    onFilterApplied={this.onFilterApplied}
                    onMatchesCounted={this._onMatchesCounted}
                    activeMatchIndex={this.state.treeInfo.activeMatchIndex}
                    selectedNodes={this.state.treeInfo.selectedNodes}
                    selectionMode={SelectionMode.Multiple}
                    onNodesSelected={this._onNodesSelected}
                    onNodesDeselected={this._onNodesDeselected}
                    onNodeExpanded={this._onNodeExpanded}
                    onCheckboxClick={this._onCheckboxClick}
                  /> :
                  <div />
              }
            </div >
          </div>
        </div >
      );
    return UiFramework.i18n.translate("UiFramework:categoriesModels.loadingMessage");
  }
}

// tslint:disable-next-line:variable-name
const CategoryModelTree = treeWithFilteringSupport(Tree);

export default ModelSelectorWidget;

ConfigurableUiManager.registerControl("ModelSelectorWidget", ModelSelectorWidgetControl);
