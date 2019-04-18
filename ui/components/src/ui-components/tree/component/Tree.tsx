/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

// third-party imports
import _ from "lodash";
import * as React from "react";
import classnames from "classnames";
import { AutoSizer, Size, List as VirtualizedList, ListRowProps as VirtualizedListRowProps } from "react-virtualized";

// bentley imports
import { using, Guid } from "@bentley/bentleyjs-core";
import {
  Tree as TreeBase, TreeNodePlaceholder, shallowDiffers,
  CheckBoxState, CheckBoxInfo, NodeCheckboxRenderer,
  Spinner, SpinnerSize, CommonProps,
} from "@bentley/ui-core";

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
import { TreeNodeProps, TreeNode } from "./Node";
import { PropertyValueRendererManager } from "../../properties/ValueRendererManager";
// selection-related imports
import { SelectionMode } from "../../common/selection/SelectionModes";
import {
  SelectionHandler, SingleSelectionHandler, MultiSelectionHandler,
  OnItemsSelectedCallback, OnItemsDeselectedCallback,
} from "../../common/selection/SelectionHandler";
// node highlighting
import { HighlightingEngine, HighlightableTreeProps } from "../HighlightingEngine";
// misc
import { UiComponents } from "../../UiComponents";
import { CellEditingEngine, EditableTreeProps } from "../CellEditingEngine";
import { ITreeImageLoader, TreeImageLoader } from "../ImageLoader";

// css
import "./Tree.scss";

/** Type for nodesSelected callback
 * @internal
 */
export type NodesSelectedCallback = OnItemsSelectedCallback<TreeNodeItem>;
/** Type for nodesDeselected callback
 * @internal
 */
export type NodesDeselectedCallback = OnItemsDeselectedCallback<TreeNodeItem>;
/** Type for node renderer
 * @internal
 */
export type NodeRenderer = (item: BeInspireTreeNode<TreeNodeItem>, props: TreeNodeProps) => React.ReactNode;

/** Properties for the [[Tree]] component
 * @public
 */
export interface TreeProps extends CommonProps {
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
   * @internal
   */
  onNodesSelected?: NodesSelectedCallback;
  /**
   * Callback that's called when nodes are deselected. In case of
   * delayed loading (`pageSize != 0`), called only after all deselected
   * nodes are fully loaded
   * @internal
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

  /** Contains render overrides for different pieces of the tree component */
  renderOverrides?: {
    /** Callback to render a node @internal */
    renderNode?: NodeRenderer;
    /** Callback to render a node checkbox. When a custom node renderer is used, it's responsible for calling this callback. */
    renderCheckbox?: NodeCheckboxRenderer;
  };

  /** @internal */
  onRender?: () => void;
  /** @internal */
  onNodesRender?: () => void;

  /** Properties for node highlighting logic. If not provided, node highlighting is disabled. @internal */
  nodeHighlightingProps?: HighlightableTreeProps;

  /** Properties for cell editing logic. If not provided, cell editing is disabled. @beta */
  cellEditing?: EditableTreeProps;

  /**
   * Describes nodes that should be checked. May be defined as:
   * - an array of node ids
   * - a callback that takes a node and returns a boolean
   *
   * **Note:** when set, this property overrides checkbox-related TreeNodeItem attributes
   */
  checkboxInfo?: (node: TreeNodeItem) => CheckBoxInfo | Promise<CheckBoxInfo>;
  /**
   * A callback that gets fired when checkbox state changes
   */
  onCheckboxClick?: (node: TreeNodeItem, newState: CheckBoxState) => void;

  /** Custom property value renderer manager */
  propertyValueRendererManager?: PropertyValueRendererManager;

  /** Turns on node description rendering when enabled */
  showDescriptions?: boolean;

  /** Turns on icon rendering when enabled */
  showIcons?: boolean;

  /** Custom image loader. Default ImageLoader loads icons already bundled in the library */
  imageLoader?: ITreeImageLoader;

  /** A constant value for row height, or a function that calculates row height based on rendered node */
  rowHeight?: ((node?: TreeNodeItem, index?: number) => number) | number;
}

/** State for the Tree component
 * @internal
 */
interface TreeState {
  prev: {
    dataProvider: TreeDataProvider;
    modelReady: boolean;
    selectedNodes?: string[] | ((node: TreeNodeItem) => boolean);
    checkboxInfo?: (node: TreeNodeItem) => CheckBoxInfo | Promise<CheckBoxInfo>;
    nodeHighlightingProps?: HighlightableTreeProps;
    cellEditing?: EditableTreeProps;
  };

  model: BeInspireTree<TreeNodeItem>;
  modelReady: boolean;

  currentlyEditedNode?: BeInspireTreeNode<TreeNodeItem>;

  pendingSelectionChange?: {
    range: [string, string];
    counts: {
      leftToLoad: number;
      totalToLoad: number;
      totalInSelection: number;
    };
    continue: () => void;
  };

  /** @internal */
  highlightingEngine?: HighlightingEngine;

  /** @internal */
  cellEditingEngine?: CellEditingEngine;
}

/**
 * A Tree React component that uses the core of BeInspireTree
 * but renders with TreeBase and TreeNodeBase from ui-core.
 * @public
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
  private _defaultImageLoader = new TreeImageLoader();

  public static readonly defaultProps: Partial<TreeProps> = {
    selectionMode: SelectionMode.Single,
  };

  /** @internal */
  constructor(props: TreeProps) {
    super(props);

    this._selectionHandler = new SelectionHandler(props.selectionMode!, this._onNodesSelected, this._onNodesDeselected);
    this._selectionHandler.onItemsSelectedCallback = this._onNodesSelected;
    this._selectionHandler.onItemsDeselectedCallback = this._onNodesDeselected;

    this.state = {
      prev: {
        dataProvider: props.dataProvider,
        selectedNodes: props.selectedNodes,
        checkboxInfo: props.checkboxInfo,
        modelReady: false,
      },
      model: Tree.createModel(props),
      modelReady: false,
    };
  }

  private _setCellEditorState = (state?: BeInspireTreeNode<TreeNodeItem>) => this.setState({ currentlyEditedNode: state });
  private _getCellEditorState = () => this.state.currentlyEditedNode;

  private static createModel(props: TreeProps) {
    return new BeInspireTree<TreeNodeItem>({
      dataProvider: props.dataProvider,
      mapPayloadToInspireNodeConfig: Tree.inspireNodeFromTreeNodeItem,
      pageSize: props.pageSize,
      disposeChildrenOnCollapse: props.disposeChildrenOnCollapse,
    });
  }

  /** @internal */
  public static getDerivedStateFromProps(props: TreeProps, state: TreeState): TreeState | null {
    const providerChanged = (props.dataProvider !== state.prev.dataProvider);
    const selectedNodesChanged = (props.selectedNodes !== state.prev.selectedNodes);
    const checkboxInfoChanged = (props.checkboxInfo !== state.prev.checkboxInfo);
    const modelReadyChanged = (state.modelReady !== state.prev.modelReady);

    // create derived state that just updates `prev` values
    const derivedState: TreeState = {
      ...state,
      prev: {
        ...state.prev,
        dataProvider: props.dataProvider,
        modelReady: state.modelReady,
        selectedNodes: props.selectedNodes,
        checkboxInfo: props.checkboxInfo,
        nodeHighlightingProps: props.nodeHighlightingProps,
        cellEditing: props.cellEditing,
      },
    };

    // update highlighting engine if related props changed
    if (props.nodeHighlightingProps !== state.prev.nodeHighlightingProps) {
      derivedState.highlightingEngine = props.nodeHighlightingProps ? new HighlightingEngine(props.nodeHighlightingProps) : undefined;
    }

    // update cell editing engine if related props changed
    if (shallowDiffers(props.cellEditing, state.prev.cellEditing)) {
      derivedState.cellEditingEngine = props.cellEditing ? new CellEditingEngine(props.cellEditing) : undefined;
    }

    // in case provider changed, have to re-create `model` and reset `modelReady`
    if (providerChanged) {
      derivedState.model = Tree.createModel(props);
      derivedState.modelReady = false;
    } else {
      const modelBecameReady = (modelReadyChanged && state.modelReady);
      if (modelBecameReady || selectedNodesChanged) {
        // note: not using `pauseRendering()` here to avoid firing `ChangesApplied`
        // when the EventsMuteContext is disposed - the component is going to be
        // rendered anyway if we got here
        using((state.model.mute([BeInspireTreeEvent.ChangesApplied])), (_r) => {
          // note: calling this may mutate `model` in state
          state.model.updateTreeSelection(props.selectedNodes);
        });
      }
      if ((modelBecameReady || checkboxInfoChanged) && props.checkboxInfo) {
        // note: using `pauseRendering()` here - need it to fire `ChangesApplied`
        // event after checkboxes are asynchronously updated
        // tslint:disable-next-line: no-floating-promises
        using((state.model.pauseRendering()), async (_r) => {
          // note: calling this may actually mutate `model` in state
          await state.model.updateTreeCheckboxes(props.checkboxInfo!);
        });
      }
    }

    return derivedState;
  }

  /** @internal */
  public componentDidMount() {
    this._mounted = true;
    this.assignModelListeners(this.state.model);
    this.assignDataProviderListeners(this.props.dataProvider);

    if (this.state.cellEditingEngine && !this.state.cellEditingEngine.hasSubscriptions)
      this.state.cellEditingEngine.subscribe(this._getCellEditorState, this._setCellEditorState);

    /* istanbul ignore next */
    if (this.props.onRender)
      this.props.onRender();
  }

  /** @internal */
  public componentWillUnmount() {
    this.dropModelListeners(this.state.model);
    this.dropDataProviderListeners(this.props.dataProvider);
    if (this.state.cellEditingEngine)
      this.state.cellEditingEngine.unsubscribe();
    this._mounted = false;
  }

  public shouldComponentUpdate(nextProps: TreeProps, nextState: TreeState): boolean {
    if (this.state.modelReady !== nextState.modelReady || this.state.model !== nextState.model) {
      // always render when modelReady or model changes
      return true;
    }

    if (!nextState.modelReady) {
      // if we got here and model is not ready - don't render
      return false;
    }

    // otherwise, render when any of the following props / state change
    return this.props.selectedNodes !== nextProps.selectedNodes
      || this.props.checkboxInfo !== nextProps.checkboxInfo
      || shallowDiffers(this.props.renderOverrides, nextProps.renderOverrides)
      || this.props.dataProvider !== nextProps.dataProvider
      || this.props.nodeHighlightingProps !== nextProps.nodeHighlightingProps
      || this.state.currentlyEditedNode !== nextState.currentlyEditedNode
      || this.state.model.visible().some((n) => n.isDirty());
  }

  /** @internal */
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

    if (this.state.cellEditingEngine && !this.state.cellEditingEngine.hasSubscriptions) {
      this.state.cellEditingEngine.subscribe(this._getCellEditorState, this._setCellEditorState);
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
    // tslint:disable-next-line:no-floating-promises
    model.ready.then(() => {
      if (model === this.state.model)
        this._onModelReady();
    });
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
    this.state.model.updateNodesSelection(toNodes(node.getChildren()), this.props.selectedNodes);
    if (this.props.checkboxInfo) {
      // tslint:disable-next-line: no-floating-promises
      this.state.model.updateNodesCheckboxes(toNodes(node.getChildren()), this.props.checkboxInfo);
    }

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

    if (this.props.checkboxInfo) {
      // tslint:disable-next-line: no-floating-promises
      this.state.model.updateNodesCheckboxes(nodes, this.props.checkboxInfo);
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
            node.assign(Tree.inspireNodeFromTreeNodeItem(item, Tree.inspireNodeFromTreeNodeItem, node));
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

  private _getNodeHeight = (node?: TreeNodeItem) => {
    if (this.props.showDescriptions && node && node.description)
      return 44;

    return 24;
  }

  /** map TreeNodeItem into an InspireNode
   * @internal
   */
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

    if (item.isCheckboxVisible)
      node.itree!.state!.checkboxVisible = true;
    else
      delete node.itree!.state!.checkboxVisible;

    if (item.isCheckboxDisabled)
      node.itree!.state!.checkboxDisabled = true;
    else
      delete node.itree!.state!.checkboxDisabled;

    if (item.checkBoxState === CheckBoxState.Partial) {
      node.itree!.state!.indeterminate = true;
      delete node.itree!.state!.checked;
    } else if (item.checkBoxState === CheckBoxState.On) {
      node.itree!.state!.checked = true;
      delete node.itree!.state!.indeterminate;
    } else {
      delete node.itree!.state!.checked;
      delete node.itree!.state!.indeterminate;
    }

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
        if (this.state.cellEditingEngine)
          this.state.cellEditingEngine.deactivateEditor();
        this.forceUpdate();
      }
    },
    updateSelection: (selections: Array<BeInspireTreeNode<TreeNodeItem>>, deselections: Array<BeInspireTreeNode<TreeNodeItem>>) => {
      selections.forEach((x) => x.select());
      deselections.forEach((x) => x.deselect());
    },
    areEqual: (item1: BeInspireTreeNode<TreeNodeItem>, item2: BeInspireTreeNode<TreeNodeItem>) => item1 === item2,
  };

  private _onCheckboxClick = (node: BeInspireTreeNode<TreeNodeItem>, newState: CheckBoxState) => {
    if (this.props.onCheckboxClick)
      this.props.onCheckboxClick(node.payload!, newState);
  }

  // tslint:disable-next-line:naming-convention
  private defaultRenderNode = (node: BeInspireTreeNode<TreeNodeItem>, props: TreeNodeProps): React.ReactNode => {
    return (
      <TreeNode
        key={node.id}
        {...props}
      />
    );
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

  private createTreeNodeProps(node: BeInspireTreeNode<TreeNodeItem>): TreeNodeProps {
    const onNodeSelectionChanged = this._selectionHandler.createSelectionFunction(this._multiSelectionHandler, this._createItemSelectionHandler(node));

    return {
      node,
      checkboxProps: node.itree!.state!.checkboxVisible ? {
        isDisabled: node.itree!.state!.checkboxDisabled,
        state: node.itree!.state!.checked ? CheckBoxState.On : CheckBoxState.Off,
        onClick: this._onCheckboxClick,
        tooltip: node.itree!.checkboxTooltip,
      } : undefined,
      cellEditing: this.state.cellEditingEngine,
      showDescription: this.props.showDescriptions,
      renderOverrides: {
        renderCheckbox: this.props.renderOverrides ? this.props.renderOverrides.renderCheckbox : undefined,
      },
      renderId: this._nodesRenderInfo ? this._nodesRenderInfo.renderId : undefined,
      onFinalRenderComplete: this._onNodeFullyRendered,
      highlightProps: this.state.highlightingEngine
        ? this.state.highlightingEngine.createRenderProps(node)
        : undefined,
      valueRendererManager: this.props.propertyValueRendererManager
        ? this.props.propertyValueRendererManager
        : PropertyValueRendererManager.defaultManager,
      imageLoader: this.props.showIcons ? (this.props.imageLoader ? this.props.imageLoader : this._defaultImageLoader) : undefined,
      onClick: (e: React.MouseEvent) => {
        onNodeSelectionChanged(e.shiftKey, e.ctrlKey);
        if (this.state.cellEditingEngine)
          this.state.cellEditingEngine.checkStatus(node, this._pressedItemSelected);
      },
      onMouseDown: () => this._selectionHandler.createDragAction(this._multiSelectionHandler, [this.nodesSelectionHandlers], node),
      onMouseMove: (e: React.MouseEvent) => { if (e.buttons === 1) this._selectionHandler.updateDragAction(node); },

    };
  }

  /** Get loaded node by its ID */
  public getLoadedNode(id: string): TreeNodeItem | undefined {
    const node = this.state.model.node(id);
    return node ? node.payload : undefined;
  }

  /** @internal */
  public render() {
    if (!this.state.modelReady) {
      return (
        <div className="components-tree-loader">
          <Spinner size={SpinnerSize.Large} />
        </div>
      );
    }

    const nodes = this.state.model.visible();
    if (nodes.length === 0) {
      return (
        <p className="components-tree-errormessage">
          {this.props.nodeHighlightingProps ?
            UiComponents.i18n.translate("UiComponents:tree.noResultsForFilter", { searchText: this.props.nodeHighlightingProps.searchText }) :
            UiComponents.i18n.translate("UiComponents:general.noData")}
        </p>
      );
    }

    // This is a hack (since it doesn't have a proper public method) to force Virtualized List to clear cell cache.
    // There is recomputeRowHeights, but it forces an update
    if (this._scrollableContainerRef.current && this._scrollableContainerRef.current.Grid)
      (this._scrollableContainerRef.current.Grid as any).state.instanceProps.rowSizeAndPositionManager.resetCell(0);

    const getNodesRenderInfo = () => {
      if (!this._nodesRenderInfo)
        this._nodesRenderInfo = { total: 0, rendered: 0, renderId: Guid.createValue() };
      return this._nodesRenderInfo;
    };
    this._nodesRenderInfo = undefined;

    const baseRenderNode = this.props.renderOverrides && this.props.renderOverrides.renderNode ? this.props.renderOverrides.renderNode : this.defaultRenderNode;
    const renderNode = ({ index, style, isScrolling }: VirtualizedListRowProps) => {
      const node = nodes[index];
      const key = node.id ? node.id : node.text;
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

      const props = this.createTreeNodeProps(node);
      return (
        <div key={key} className="node-wrapper" style={style}>
          {baseRenderNode(node, props)}
        </div>
      );
    };

    const getRowHeight = ({ index }: { index: number }) => {
      if (this.props.rowHeight && typeof (this.props.rowHeight) === "number")
        return this.props.rowHeight;

      const getHeight = this.props.rowHeight && typeof (this.props.rowHeight) === "function" ? this.props.rowHeight : this._getNodeHeight;

      return getHeight(nodes[index].payload, index);
    };

    return (
      <TreeBase ref={this._treeRef} onMouseDown={this._onMouseDown}
        className={classnames("components-tree", this.props.className)} style={this.props.style}
      >
        <AutoSizer>
          {({ width, height }: Size) => (
            <VirtualizedList
              ref={this._scrollableContainerRef}
              width={width} height={height}
              rowCount={nodes.length}
              overscanRowCount={10}
              rowHeight={getRowHeight}
              rowRenderer={renderNode}
              autoContainerWidth={false}
            />
          )}
        </AutoSizer>
      </TreeBase>
    );
  }
}

/**
 * @internal
 * @note Renamed 'Tree' namespace to 'TreeTest' because extract-api does not allow two different release tags for 'Tree.
 */
// istanbul ignore next
export namespace TreeTest {

  /** @internal */
  export const enum TestId {
    Node = "tree-node",
    NodeContents = "tree-node-contents",
    NodeExpansionToggle = "tree-node-expansion-toggle",
    NodeCheckbox = "tree-node-checkbox",
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
