/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

// third-party imports
import _ from "lodash";
import * as React from "react";
import { AutoSizer, Size, List as VirtualizedList, ListRowProps as VirtualizedListRowProps } from "react-virtualized";
// bentley imports
import { using, Guid } from "@bentley/bentleyjs-core";
import { Tree as TreeBase, TreeNodePlaceholder, shallowDiffers, CheckBoxState } from "@bentley/ui-core";
// tree-related imports
import {
  BeInspireTree, BeInspireTreeNode, BeInspireTreeNodes, BeInspireTreeNodeConfig,
  BeInspireTreeEvent, MapPayloadToInspireNodeCallback, toNode, toNodes,
} from "./BeInspireTree";
import {
  TreeDataProvider, TreeNodeItem,
  DelayLoadedTreeNodeItem, ImmediatelyLoadedTreeNodeItem,
  isTreeDataProviderInterface,
} from "../TreeDataProvider";
import { TreeNodeProps, TreeNode, TreeNodeCellEditorProps } from "./Node";
import { PropertyValueRendererManager, PropertyValueRendererContext, PropertyContainerType } from "../../properties/ValueRendererManager";
// selection-related imports
import { SelectionMode } from "../../common/selection/SelectionModes";
import {
  SelectionHandler, SingleSelectionHandler, MultiSelectionHandler,
  OnItemsSelectedCallback, OnItemsDeselectedCallback,
} from "../../common/selection/SelectionHandler";
// cell editing imports
import { EditorContainer, PropertyUpdatedArgs } from "../../editors/EditorContainer";
import { PropertyRecord } from "../../properties/Record";
import { PropertyValueFormat, PrimitiveValue } from "../../properties/Value";
import { PropertyDescription } from "../../properties/Description";
// node highlighting
import HighlightingEngine, { HighlightableTreeProps, HighlightableTreeNodeProps } from "../HighlightingEngine";
// misc
import UiComponents from "../../UiComponents";
// css
import "./Tree.scss";

/** Type for nodesSelected callback */
export type NodesSelectedCallback = OnItemsSelectedCallback<TreeNodeItem>;
/** Type for nodesDeselected callback */
export type NodesDeselectedCallback = OnItemsDeselectedCallback<TreeNodeItem>;
/** Type for node renderer */
export type NodeRenderer = (item: BeInspireTreeNode<TreeNodeItem>, props: TreeNodeProps) => React.ReactNode;

/** Properties for the [[Tree]] component  */
export interface TreeProps {
  /** Nodes provider */
  dataProvider: TreeDataProvider;

  /**
   * Size of a single page that's requested from `dataProvider` (only
   * applies when the provider is `ITreeDataProvider`). Defaults to
   * disabled pagination.
   */
  pageSize?: number;

  /**
   * Should child nodes be disposed when parent node is collapsed. Saves some
   * memory in exchange of performance. Disabled by default.
   */
  disposeChildrenOnCollapse?: boolean;

  /**
   * Describes nodes that should be selected. May be defined as:
   * - an array of node ids
   * - a callback that takes a node and returns a boolean
   */
  selectedNodes?: string[] | ((node: TreeNodeItem) => boolean);
  /**
   * Mode of nodes' selection in the tree
   */
  selectionMode?: SelectionMode;
  /**
   * Callback that's called when nodes are selected. In case of
   * delayed loading (`pageSize != 0`), called only after all selected
   * nodes are fully loaded
   */
  onNodesSelected?: NodesSelectedCallback;
  /**
   * Callback that's called when nodes are deselected. In case of
   * delayed loading (`pageSize != 0`), called only after all deselected
   * nodes are fully loaded
   */
  onNodesDeselected?: NodesDeselectedCallback;
  /**
   * Called to report progress of selection load. Arguments:
   * - `loaded` - number of items loaded
   * - `total` - total number of items that need to be loaded
   * - `cancel` - callback method to cancel the load
   *
   * Note: the callback is only called when selection change involves some
   * not-loaded nodes.
   */
  onSelectionLoadProgress?: (loaded: number, total: number, cancel: () => void) => void;
  /**
   * Called when selection load is canceled. Common cases when that happens:
   * - `cancel` method called from `onSelectionLoadProgress` callback
   * - selection change during nodes' load
   *
   * Note: the callback is only called when selection change involves some
   * not-loaded nodes.
   */
  onSelectionLoadCanceled?: () => void;
  /**
   * Called when selection load is finished
   *
   * Note: the callback is only called when selection change involves some
   * not-loaded nodes.
   */
  onSelectionLoadFinished?: () => void;

  /**
   * Callback that's called when node is expanded
   */
  onNodeExpanded?: (node: TreeNodeItem) => void;
  /**
   * Callback that's called when node is collapsed
   */
  onNodeCollapsed?: (node: TreeNodeItem) => void;

  /**
   * Callback that's called when root nodes are loaded. If pagination
   * is enabled, it's called once per every loaded page.
   */
  onRootNodesLoaded?: (nodes: TreeNodeItem[]) => void;
  /**
   * Callback that's called when child nodes are loaded. If pagination
   * is enabled, it's called once per every loaded page.
   */
  onChildrenLoaded?: (parent: TreeNodeItem, children: TreeNodeItem[]) => void;

  renderNode?: NodeRenderer;
  /** @hidden */
  onRender?: () => void;
  /** @hidden */
  onNodesRender?: () => void;

  nodeHighlightingProps?: HighlightableTreeProps;

  onCellEditing?: (cellEditorState: TreeCellEditorState) => void;
  onCellUpdated?: (args: TreeCellUpdatedArgs) => Promise<boolean>;
  /** @hidden */
  ignoreEditorBlur?: boolean;

  onCheckboxClick?: (node: TreeNodeItem) => void;

  /** Custom property value renderer manager */
  propertyValueRendererManager?: PropertyValueRendererManager;
}

/** State for the [[Tree]] component  */
export interface TreeState {
  prev: {
    dataProvider: TreeDataProvider;
    modelReady: boolean;
    selectedNodes?: string[] | ((node: TreeNodeItem) => boolean);
    nodeHighlightingProps?: HighlightableTreeProps;
  };
  model: BeInspireTree<TreeNodeItem>;
  modelReady: boolean;
  cellEditorState: TreeCellEditorState;

  pendingSelectionChange?: {
    range: [string, string];
    counts: {
      leftToLoad: number;
      totalToLoad: number;
      totalInSelection: number;
    };
    continue: () => void;
  };

  /** @hidden */
  highlightingEngine?: HighlightingEngine;
}

/** Tree Cell Editor state */
export interface TreeCellEditorState {
  active: boolean;
  node?: BeInspireTreeNode<TreeNodeItem>;
}

/** Arguments for the Tree Cell Updated event callback */
export interface TreeCellUpdatedArgs {
  /** The cell being updated. */
  node: BeInspireTreeNode<TreeNodeItem>;
  /** The new value for the cell. */
  newValue: any;
}

/** Params to the TreeNodeProps.renderLabel method */
export interface RenderNodeLabelProps {
  node: BeInspireTreeNode<TreeNodeItem>;
  highlightProps?: HighlightableTreeNodeProps;
  cellEditorProps?: TreeNodeCellEditorProps;
  valueRendererManager?: PropertyValueRendererManager;
}

/**
 * A Tree React component that uses the core of BeInspireTree, but renders it
 * with Tree and TreeNode from ui-core.
 */
export class Tree extends React.Component<TreeProps, TreeState> {

  private _mounted: boolean = false;
  private _treeRef: React.RefObject<TreeBase> = React.createRef();
  private _scrollableContainerRef: React.RefObject<VirtualizedList> = React.createRef();
  private _selectionHandler: SelectionHandler<BeInspireTreeNode<TreeNodeItem>>;
  private _nodesSelectionHandlers?: Array<SingleSelectionHandler<BeInspireTreeNode<TreeNodeItem>>>;
  private _pressedItemSelected = false;
  /** Used to find out when all of the nodes finish rendering */
  private _nodesRenderInfo?: { total: number, rendered: number, renderId: string };
  /** Used to delay the automatic scrolling when stepping through highlighted text */
  private _shouldScrollToActiveNode = false;

  public static readonly defaultProps: Partial<TreeProps> = {
    selectionMode: SelectionMode.Single,
  };

  constructor(props: TreeProps, context?: any) {
    super(props, context);

    this._selectionHandler = new SelectionHandler(props.selectionMode!, this._onNodesSelected, this._onNodesDeselected);
    this._selectionHandler.onItemsSelectedCallback = this._onNodesSelected;
    this._selectionHandler.onItemsDeselectedCallback = this._onNodesDeselected;

    this.state = {
      prev: {
        dataProvider: props.dataProvider,
        selectedNodes: props.selectedNodes,
        modelReady: false,
      },
      model: Tree.createModel(props),
      modelReady: false,
      cellEditorState: { active: false },
    };
  }

  private static createModel(props: TreeProps) {
    return new BeInspireTree<TreeNodeItem>({
      dataProvider: props.dataProvider,
      mapPayloadToInspireNodeConfig: Tree.inspireNodeFromTreeNodeItem,
      pageSize: props.pageSize,
      disposeChildrenOnCollapse: props.disposeChildrenOnCollapse,
    });
  }

  public static getDerivedStateFromProps(props: TreeProps, state: TreeState): TreeState | null {
    const providerChanged = (props.dataProvider !== state.prev.dataProvider);
    const selectedNodesChanged = (props.selectedNodes !== state.prev.selectedNodes);
    const modelReadyChanged = (state.modelReady !== state.prev.modelReady);

    // create derived state that just updates `prev` values
    const derivedState: TreeState = {
      ...state,
      prev: {
        ...state.prev,
        dataProvider: props.dataProvider,
        modelReady: state.modelReady,
        selectedNodes: props.selectedNodes,
        nodeHighlightingProps: props.nodeHighlightingProps,
      },
    };

    // update highlighting engine if related props changed
    if (props.nodeHighlightingProps !== state.prev.nodeHighlightingProps) {
      derivedState.highlightingEngine = props.nodeHighlightingProps ? new HighlightingEngine(props.nodeHighlightingProps) : undefined;
    }

    // in case provider changed, have to re-create `model` and reset `modelReady`
    if (providerChanged) {
      derivedState.model = Tree.createModel(props);
      derivedState.modelReady = false;
    }

    // update tree selection if either selected nodes changed or model became ready
    if (!providerChanged && (selectedNodesChanged || (modelReadyChanged && state.modelReady))) {
      using((state.model.mute([BeInspireTreeEvent.ChangesApplied])), () => {
        // note: calling this may actually mutate `model`
        // in state, but that should be fine
        state.model.updateTreeSelection(props.selectedNodes);
      });
    }

    return derivedState;
  }

  public componentDidMount() {
    this._mounted = true;
    this.assignModelListeners(this.state.model);
    this.assignDataProviderListeners(this.props.dataProvider);

    /* istanbul ignore next */
    if (this.props.onRender)
      this.props.onRender();
  }

  public componentWillUnmount() {
    this.dropModelListeners(this.state.model);
    this.dropDataProviderListeners(this.props.dataProvider);
    this._mounted = false;
  }

  public shouldComponentUpdate(nextProps: TreeProps, nextState: TreeState): boolean {
    if (this.state.modelReady !== nextState.modelReady) {
      // always render when state.modelReady changes
      return true;
    }

    if (!nextState.modelReady) {
      // if we got here and model is not ready - don't render
      return false;
    }

    // otherwise, render when any of the following props / state change
    return this.props.selectedNodes !== nextProps.selectedNodes
      || this.props.renderNode !== nextProps.renderNode
      || this.props.dataProvider !== nextProps.dataProvider
      || this.props.nodeHighlightingProps !== nextProps.nodeHighlightingProps
      || this.state.cellEditorState !== nextState.cellEditorState
      || this.state.model.visible().some((n) => n.isDirty());
  }

  public componentDidUpdate(prevProps: TreeProps, prevState: TreeState) {
    this._selectionHandler.selectionMode = this.props.selectionMode!;

    if (this.props.selectedNodes !== prevProps.selectedNodes && this.state.pendingSelectionChange) {
      this._cancelPendingSelectionChange();
    }

    if (this.props.nodeHighlightingProps && shallowDiffers(this.props.nodeHighlightingProps, prevProps.nodeHighlightingProps)) {
      if (this._nodesRenderInfo)
        this._shouldScrollToActiveNode = true;
      else
        this.scrollToActiveNode();
    }

    if (this.state.model !== prevState.model) {
      this.dropModelListeners(prevState.model);
      this.assignModelListeners(this.state.model);
    }

    if (this.props.dataProvider !== prevProps.dataProvider) {
      this.dropDataProviderListeners(prevProps.dataProvider);
      this.assignDataProviderListeners(this.props.dataProvider);
    }

    /* istanbul ignore next */
    if (this.props.onRender)
      this.props.onRender();
  }

  private assignModelListeners(model: BeInspireTree<TreeNodeItem>) {
    model.on(BeInspireTreeEvent.ChangesApplied, this._onModelChanged);
    model.on(BeInspireTreeEvent.NodeExpanded, this._onNodeExpanded);
    model.on(BeInspireTreeEvent.NodeCollapsed, this._onNodeCollapsed);
    model.on(BeInspireTreeEvent.ModelLoaded, this._onModelLoaded);
    model.on(BeInspireTreeEvent.ChildrenLoaded, this._onChildrenLoaded);
    model.ready.then(this._onModelReady); // tslint:disable-line:no-floating-promises
  }

  private dropModelListeners(model: BeInspireTree<TreeNodeItem>) {
    model.removeAllListeners();
  }

  private assignDataProviderListeners(provider: TreeDataProvider) {
    if (isTreeDataProviderInterface(provider) && provider.onTreeNodeChanged) {
      provider.onTreeNodeChanged.addListener(this._onTreeNodeChanged);
    }
  }

  private dropDataProviderListeners(provider: TreeDataProvider) {
    if (isTreeDataProviderInterface(provider) && provider.onTreeNodeChanged) {
      provider.onTreeNodeChanged.removeListener(this._onTreeNodeChanged);
    }
  }

  private _onModelChanged = () => {
    // just re-set the model to initiate update
    this.setState((prev) => ({ model: prev.model }));
  }

  private _onModelReady = () => {
    // istanbul ignore else
    if (this._mounted)
      this.setState({ modelReady: true });
  }

  private scrollToActiveNode() {
    if (!this._scrollableContainerRef.current || !this._treeRef.current
      || !this.props.nodeHighlightingProps || !this.props.nodeHighlightingProps.activeMatch) {
      return;
    }

    // scroll to active node
    const activeNodeId = this.props.nodeHighlightingProps.activeMatch.nodeId;
    const index = this.state.model.visible().findIndex((n) => n.id === activeNodeId);
    this._scrollableContainerRef.current.scrollToRow(index);

    // now make sure the active match is also visible
    const scrollTo = [...this._treeRef.current.getElementsByClassName(HighlightingEngine.ACTIVE_CLASS_NAME)];
    if (scrollTo.length > 0)
      this._treeRef.current.scrollToElement(scrollTo[0]);
  }

  private static computeNodesLoadCounts(
    curr: { leftToLoad: number, totalInSelection: number },
    prev?: { leftToLoad: number, totalToLoad: number, totalInSelection: number },
  ) {
    if (!prev) {
      return {
        ...curr,
        totalToLoad: curr.leftToLoad,
      };
    }
    const totalIncrease = curr.totalInSelection - prev.totalInSelection;
    return {
      leftToLoad: curr.leftToLoad,
      totalToLoad: prev.totalToLoad + totalIncrease,
      totalInSelection: curr.totalInSelection,
    };
  }

  private _onNodesSelected = (nodes: Array<BeInspireTreeNode<TreeNodeItem>>, replace: boolean) => {
    if (!this.props.onNodesSelected)
      return;

    const rangeKey: [string, string] = (nodes.length > 1) ? [nodes[0].id!, nodes[nodes.length - 1].id!] : ["", ""];
    const nodesLoaded: Array<BeInspireTreeNode<TreeNodeItem>> = [];
    const nodesNotLoaded: Array<BeInspireTreeNode<TreeNodeItem>> = [];
    nodes.forEach((n) => {
      if (n.payload)
        nodesLoaded.push(n);
      else
        nodesNotLoaded.push(n);
    });

    if (this.state.pendingSelectionChange) {
      if (!_.isEqual(this.state.pendingSelectionChange.range, rangeKey)) {
        // there is a pending selection change but ranges don't match - it means
        // the selection has changed while loading and we should cancel pending
        // selection change
        this._cancelPendingSelectionChange();
      } else if (nodesNotLoaded.length === 0) {
        // there is a pending selection change with matching ranges and there
        // are no more nodes to load - it means we're done loading
        const loadTotal = this.state.pendingSelectionChange.counts.totalToLoad;
        this.setState({ pendingSelectionChange: undefined }, () => {
          this.reportPendingSelectionChangeProgress(loadTotal, loadTotal);
          if (this.props.onSelectionLoadFinished)
            this.props.onSelectionLoadFinished();
        });
      }
    }

    if (nodesNotLoaded.length > 0) {
      // found nodes that need to be loaded
      this.setState((prev) => ({
        pendingSelectionChange: {
          range: rangeKey,
          counts: Tree.computeNodesLoadCounts(
            { leftToLoad: nodesNotLoaded.length, totalInSelection: nodes.length },
            prev.pendingSelectionChange ? prev.pendingSelectionChange.counts : undefined,
          ),
          continue: () => this._onNodesSelected(this.state.model.selectBetween(nodes[0], nodes[nodes.length - 1]), true),
        },
      }), () => {
        // request a page of nodes to be loaded
        // note: this might result in multiple page loads because the nodes
        // may be on different levels and the pages are not aligned
        nodesNotLoaded.slice(0, this.props.pageSize!).forEach((n) => {
          // tslint:disable-next-line: no-floating-promises
          this.state.model.requestNodeLoad(toNode(n.getParent()), n.placeholderIndex!);
        });
        // report status
        const totalToLoad = this.state.pendingSelectionChange!.counts.totalToLoad;
        const loaded = totalToLoad - nodesNotLoaded.length;
        this.reportPendingSelectionChangeProgress(loaded, totalToLoad);
      });
    }

    // report currently loaded selection
    this.props.onNodesSelected(nodesLoaded.map((n) => n.payload!), replace);
  }

  private _onNodesDeselected = (nodes: Array<BeInspireTreeNode<TreeNodeItem>>) => {
    if (!this.props.onNodesDeselected)
      return;

    this.props.onNodesDeselected(nodes.map((n) => n.payload!));
  }

  private _onNodeExpanded = (node: BeInspireTreeNode<TreeNodeItem>) => {
    if (this.props.onNodeExpanded)
      this.props.onNodeExpanded(node.payload!);

    // note: we get here when parent node is expanded. if data provider loads
    // children immediately, then node has children here. if data provider
    // delay loads children, then `node.getChildren()` returns empty array and
    // the `_onChildrenLoaded` callback is called where we do the same thing as here
    this.state.model.updateNodesSelection(node.getChildren(), this.props.selectedNodes);

    this._nodesSelectionHandlers = undefined;
  }

  private _onNodeCollapsed = (node: BeInspireTreeNode<TreeNodeItem>) => {
    if (this.props.onNodeCollapsed)
      this.props.onNodeCollapsed(node.payload!);

    this._nodesSelectionHandlers = undefined;
  }

  private _cancelPendingSelectionChange = () => {
    this.setState({ pendingSelectionChange: undefined });
    if (this.props.onSelectionLoadCanceled)
      this.props.onSelectionLoadCanceled();
  }

  private reportPendingSelectionChangeProgress(loaded: number, total: number) {
    if (this.props.onSelectionLoadProgress)
      this.props.onSelectionLoadProgress(loaded, total, this._cancelPendingSelectionChange);
  }

  private onNodesLoaded(nodes: BeInspireTreeNodes<TreeNodeItem>) {
    // clear node selection handlers' cache
    this._nodesSelectionHandlers = undefined;

    // update the selection state of already loaded nodes
    this.state.model.updateNodesSelection(nodes, this.props.selectedNodes);
    if (this.state.pendingSelectionChange) {
      // continue loading selection
      this.state.pendingSelectionChange.continue();
    }
  }

  private _onModelLoaded = (rootNodes: BeInspireTreeNodes<TreeNodeItem>) => {
    // note: if pagination is enabled, this callback is called for every
    // root nodes' page
    if (this.props.onRootNodesLoaded) {
      // we call the `onRootNodesLoaded` callback only with the nodes that have payload
      const nodesWithPayload = rootNodes.filter((n) => undefined !== n.payload);
      this.props.onRootNodesLoaded(nodesWithPayload.map((n) => n.payload!));
    }
    this.onNodesLoaded(rootNodes);
  }

  private _onChildrenLoaded = (parentNode: BeInspireTreeNode<TreeNodeItem>) => {
    // note: we get here when parent node is expanded and data provider
    // finishes delay-loading its child nodes. If pagination is enabled, this callback
    // is called for every page of children
    const children = parentNode.getChildren();

    if (this.props.onChildrenLoaded) {
      // we call the `onChildrenLoaded` callback only with the nodes that have payload
      const nodesWithPayload = toNodes<TreeNodeItem>(children).filter((n) => undefined !== n.payload);
      this.props.onChildrenLoaded(parentNode.payload!, nodesWithPayload.map((n) => n.payload!));
    }

    this.onNodesLoaded(toNodes(children));
  }

  private _onTreeNodeChanged = (items: Array<TreeNodeItem | undefined>) => {
    using((this.state.model.pauseRendering() as any), async () => { // tslint:disable-line:no-floating-promises
      for (const item of items) {
        if (item) {
          // specific node needs to be reloaded
          const node = this.state.model.node(item.id);
          if (node) {
            const wasExpanded = node.expanded();
            node.assign(Tree.inspireNodeFromTreeNodeItem(item, Tree.inspireNodeFromTreeNodeItem.bind(this), node));
            if (wasExpanded)
              await node.loadChildren();
          }
        } else {
          // all root nodes need to be reloaded
          await this.state.model.reload();
        }
      }
    });
  }

  private _onMouseDown = () => {
    document.addEventListener("mouseup", this._onMouseUp, { capture: true, once: true });
  }

  private _onMouseUp = () => {
    this._selectionHandler.completeDragAction();
  }

  // tslint:disable-next-line:naming-convention
  private get nodesSelectionHandlers(): Array<SingleSelectionHandler<BeInspireTreeNode<TreeNodeItem>>> {
    if (!this._nodesSelectionHandlers) {
      this._nodesSelectionHandlers = [];
      const nodes = this.state.model.visible();
      for (const node of nodes) {
        this._nodesSelectionHandlers.push(this._createItemSelectionHandler(node));
      }
    }
    return this._nodesSelectionHandlers;
  }

  /** map TreeNodeItem into an InspireNode */
  public static inspireNodeFromTreeNodeItem(item: TreeNodeItem, remapper: MapPayloadToInspireNodeCallback<TreeNodeItem>, base?: BeInspireTreeNodeConfig): BeInspireTreeNodeConfig {
    base = base || { text: "" };
    const node: BeInspireTreeNodeConfig = {
      ...base,
      id: item.id,
      text: item.label,
      itree: {
        ...base.itree,
        state: {
          ...(base.itree ? base.itree.state : undefined),
        },
      },
    };
    if (item.checkBoxState === CheckBoxState.On)
      node.itree!.state!.checked = true;
    if (item.icon)
      node.itree!.icon = item.icon;
    if (item.autoExpand)
      node.itree!.state!.collapsed = false;
    if ((item as DelayLoadedTreeNodeItem).hasChildren)
      node.children = true;
    else if ((item as ImmediatelyLoadedTreeNodeItem).children)
      node.children = (item as ImmediatelyLoadedTreeNodeItem).children!.map((p) => remapper(p, remapper));
    return node;
  }

  private _createItemSelectionHandler = (node: BeInspireTreeNode<TreeNodeItem>): SingleSelectionHandler<BeInspireTreeNode<TreeNodeItem>> => {
    return {
      preselect: () => {
        this._pressedItemSelected = node.selected();
      },
      select: () => node.select(),
      deselect: () => node.deselect(),
      isSelected: () => node.selected(),
      item: () => node,
    };
  }

  private _multiSelectionHandler: MultiSelectionHandler<BeInspireTreeNode<TreeNodeItem>> = {
    selectBetween: (node1: BeInspireTreeNode<TreeNodeItem>, node2: BeInspireTreeNode<TreeNodeItem>) => this.state.model.selectBetween(node1, node2),
    deselectAll: () => {
      this.state.model.deselectAll();
      if (!this._pressedItemSelected) {
        this._deactivateCellEditor();
        this.forceUpdate();
      }
    },
    updateSelection: (selections: Array<BeInspireTreeNode<TreeNodeItem>>, deselections: Array<BeInspireTreeNode<TreeNodeItem>>) => {
      selections.forEach((x) => x.select());
      deselections.forEach((x) => x.deselect());
    },
    areEqual: (item1: BeInspireTreeNode<TreeNodeItem>, item2: BeInspireTreeNode<TreeNodeItem>) => item1 === item2,
  };

  private _checkCellEditorStatus = (node: BeInspireTreeNode<TreeNodeItem>): void => {
    let activate = false;

    const isSelected = node.selected();
    const nodeItem = node.payload;
    if (nodeItem && isSelected && this._pressedItemSelected && nodeItem.isEditable)
      activate = true;

    if (activate)
      this._activateCellEditor(node);
    else
      this._deactivateCellEditor();
  }

  private _activateCellEditor = (node: BeInspireTreeNode<TreeNodeItem>): void => {
    const cellEditorState: TreeCellEditorState = { active: true, node };
    if (cellEditorState !== this.state.cellEditorState) {
      this.setState(
        { cellEditorState },
        () => {
          if (this.props.onCellEditing)
            this.props.onCellEditing(cellEditorState);
        },
      );
    }
  }

  private _deactivateCellEditor = (): void => {
    if (this.state.cellEditorState.active) {
      if (this.state.cellEditorState.node)
        this.state.cellEditorState.node.setDirty(true);
      const cellEditorState: TreeCellEditorState = { active: false, node: undefined };
      this.setState({ cellEditorState });
    }
  }

  private _onCellEditCommit = async (args: PropertyUpdatedArgs) => {
    if (this.props.onCellUpdated && this.state.cellEditorState.node) {
      const cellUpdatedArgs: TreeCellUpdatedArgs = {
        node: this.state.cellEditorState.node,
        newValue: args.newValue,
      };
      const allowed = await this.props.onCellUpdated(cellUpdatedArgs);
      if (allowed)
        this.state.cellEditorState.node.setDirty(true);
    }
    this._deactivateCellEditor();
  }

  private nodeToPropertyRecord(node: BeInspireTreeNode<TreeNodeItem>) {
    const value: PrimitiveValue = {
      displayValue: node.text,
      value: node.text,
      valueFormat: PropertyValueFormat.Primitive,
    };
    const property: PropertyDescription = {
      displayLabel: UiComponents.i18n.translate("UiComponents:general.label"),
      typename: node.payload && node.payload.typename ? node.payload.typename : "string",
      name: "node_label",
    };

    return new PropertyRecord(value, property);
  }

  // tslint:disable-next-line:naming-convention
  private renderLabelComponent = ({ node, highlightProps, cellEditorProps, valueRendererManager }: RenderNodeLabelProps): React.ReactNode | Promise<React.ReactNode> => {
    const labelStyle: React.CSSProperties = {
      color: node.payload!.labelForeColor ? node.payload!.labelForeColor!.toString(16) : undefined,
      backgroundColor: node.payload!.labelBackColor ? node.payload!.labelBackColor!.toString(16) : undefined,
      fontWeight: node.payload!.labelBold ? "bold" : undefined,
      fontStyle: node.payload!.labelItalic ? "italic" : undefined,
    };

    // handle cell editing
    if (cellEditorProps) {
      if (cellEditorProps.cellEditorState.active && node === cellEditorProps.cellEditorState.node) {
        // if cell editing is enabled, return editor instead of the label
        const record = new CellEditorPropertyRecord(node.text);
        return (
          <span style={labelStyle}>
            <EditorContainer propertyRecord={record} title={record.description}
              onCommit={cellEditorProps.onCellEditCommit} onCancel={cellEditorProps.onCellEditCancel} ignoreEditorBlur={cellEditorProps.ignoreEditorBlur} />
          </span>
        );
      }
    }

    // handle filtered matches' highlighting
    let labelElement: React.ReactNode = node.text;
    if (highlightProps)
      labelElement = HighlightingEngine.renderNodeLabel(node.text, highlightProps);

    // handle custom cell rendering
    const context: PropertyValueRendererContext = {
      containerType: PropertyContainerType.Tree,
      decoratedTextElement: labelElement,
      style: labelStyle,
    };
    const nodeRecord = this.nodeToPropertyRecord(node);
    if (!valueRendererManager)
      valueRendererManager = PropertyValueRendererManager.defaultManager;
    return valueRendererManager.render(nodeRecord, context);
  }

  private _onCheckboxClick = (node: BeInspireTreeNode<TreeNodeItem>) => {
    if (this.props.onCheckboxClick)
      this.props.onCheckboxClick(node.payload!);
  }

  // tslint:disable-next-line:naming-convention
  private renderNode = (node: BeInspireTreeNode<TreeNodeItem>, props: TreeNodeProps): React.ReactNode => {
    return (<TreeNode key={node.id} {...props} />);
  }

  private _onNodeFullyRendered = (renderId?: string) => {
    if (!this._nodesRenderInfo || this._nodesRenderInfo.renderId !== renderId)
      return;

    if (++this._nodesRenderInfo.rendered < this._nodesRenderInfo.total)
      return;

    if (this.props.onNodesRender)
      this.props.onNodesRender();

    if (this._shouldScrollToActiveNode) {
      this.scrollToActiveNode();
      this._shouldScrollToActiveNode = false;
    }

    this._nodesRenderInfo = undefined;
  }

  private _createTreeNodeProps = (node: BeInspireTreeNode<TreeNodeItem>, props: TreeProps, state: TreeState): TreeNodeProps => {
    const onNodeSelectionChanged = this._selectionHandler.createSelectionFunction(this._multiSelectionHandler, this._createItemSelectionHandler(node));

    return {
      node,
      highlightProps: state.highlightingEngine ? state.highlightingEngine.createRenderProps(node) : undefined,
      isCheckboxVisible: node.payload!.isCheckboxVisible,
      isCheckboxDisabled: node.payload!.isCheckboxDisabled,
      checkboxState: node.payload!.checkBoxState,
      onCheckboxClick: this._onCheckboxClick,
      renderLabel: this.renderLabelComponent,
      onClick: (e: React.MouseEvent) => {
        onNodeSelectionChanged(e.shiftKey, e.ctrlKey);
        this._checkCellEditorStatus(node);
      },
      onMouseDown: () => this._selectionHandler.createDragAction(this._multiSelectionHandler, [this.nodesSelectionHandlers], node),
      onMouseMove: (e: React.MouseEvent) => { if (e.buttons === 1) this._selectionHandler.updateDragAction(node); },
      cellEditorProps: {
        cellEditorState: state.cellEditorState,
        onCellEditCommit: this._onCellEditCommit,
        onCellEditCancel: this._deactivateCellEditor,
        ignoreEditorBlur: props.ignoreEditorBlur,
      },
      valueRendererManager: props.propertyValueRendererManager,
      onFinalRenderComplete: this._onNodeFullyRendered,
      renderId: this._nodesRenderInfo!.renderId,
    };
  }

  public render() {
    if (!this.state.modelReady) {
      return (
        <p className="ui-components-tree-loading">
          {UiComponents.i18n.translate("UiComponents:general.loading")}
        </p>
      );
    }

    const nodes = this.state.model.visible();
    if (nodes.length === 0) {
      return (
        <p className="ui-components-tree-errormessage">
          {this.props.nodeHighlightingProps ?
            UiComponents.i18n.translate("UiComponents:tree.noResultsForFilter", { searchText: this.props.nodeHighlightingProps.searchText }) :
            UiComponents.i18n.translate("UiComponents:general.noData")}
        </p>
      );
    }

    const getNodesRenderInfo = () => {
      if (!this._nodesRenderInfo)
        this._nodesRenderInfo = { total: 0, rendered: 0, renderId: Guid.createValue() };
      return this._nodesRenderInfo;
    };
    this._nodesRenderInfo = undefined;

    const baseRenderNode = this.props.renderNode ? this.props.renderNode : this.renderNode;
    const renderNode = ({ index, key, style, isScrolling }: VirtualizedListRowProps) => {
      const node = nodes[index];
      if (!node.payload) {
        if (!isScrolling) {
          // tslint:disable-next-line:no-floating-promises
          this.state.model.requestNodeLoad(toNode(node.getParent()), node.placeholderIndex!);
        }
        return (
          <div key={key} className="node-wrapper" style={style}>
            <PlaceholderNode key={node.id} node={node} />
          </div>
        );
      }

      getNodesRenderInfo().total++;

      const props = this._createTreeNodeProps(node, this.props, this.state);
      return (
        <div key={key} className="node-wrapper" style={style}>
          {baseRenderNode(node, props)}
        </div>
      );
    };

    return (
      <TreeBase ref={this._treeRef} onMouseDown={this._onMouseDown} className="ui-components-tree">
        <AutoSizer>
          {({ width, height }: Size) => (
            <VirtualizedList
              ref={this._scrollableContainerRef}
              width={width} height={height}
              rowCount={nodes.length}
              overscanRowCount={10}
              rowHeight={24}
              rowRenderer={renderNode}
              autoContainerWidth={false}
            />
          )}
        </AutoSizer>
      </TreeBase>
    );
  }
}

/** @hidden */
// istanbul ignore next
export namespace Tree {
  export const enum TestId {
    Node = "tree-node",
    NodeContents = "tree-node-contents",
    NodeExpansionToggle = "tree-node-expansion-toggle",
  }
}

/**
 * Default component for rendering a node for the [[Tree]]
 */
class PlaceholderNode extends React.Component<{ node: BeInspireTreeNode<TreeNodeItem> }> {
  public shouldComponentUpdate(nextProps: TreeNodeProps) {
    return nextProps.node.isDirty() || this.props.node.id !== nextProps.node.id;
  }
  public render() {
    // note: props get mutated here
    this.props.node.setDirty(false);
    const level = this.props.node.getParents().length;
    return <TreeNodePlaceholder level={level} />;
  }
}

/** PropertyRecord for cell editing */
class CellEditorPropertyRecord extends PropertyRecord {
  constructor(value: any, typename: string = "string", editor?: string) {
    const name = "cell-editor";
    const v: PrimitiveValue = {
      valueFormat: PropertyValueFormat.Primitive,
      value,
      displayValue: value.toString(),
    };
    const p: PropertyDescription = {
      name,
      displayLabel: "Cell Editor",
      typename,
    };
    if (editor)
      p.editor = { name: editor, params: [] };
    super(v, p);

    this.description = "";
    this.isReadonly = false;
  }
}
