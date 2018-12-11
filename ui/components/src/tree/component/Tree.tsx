/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

// third-party imports
import * as React from "react";
import { AutoSizer, Size, List as VirtualizedList, ListRowProps as VirtualizedListRowProps } from "react-virtualized";
// bentley imports
import { using } from "@bentley/bentleyjs-core";
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

  selectedNodes?: string[] | ((node: TreeNodeItem) => boolean);
  selectionMode?: SelectionMode;
  onNodesSelected?: NodesSelectedCallback;
  onNodesDeselected?: NodesDeselectedCallback;

  onNodeExpanded?: (node: TreeNodeItem) => void;
  onNodeCollapsed?: (node: TreeNodeItem) => void;

  onChildrenLoaded?: (parent: TreeNodeItem, children: TreeNodeItem[]) => void;
  onRootNodesLoaded?: (nodes: TreeNodeItem[]) => void;

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

  onCheckboxClick?: (node: BeInspireTreeNode<TreeNodeItem>) => void;
  checkboxesEnabled?: true;
  isChecked?: (label: string) => boolean;

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

  private _mounted = false;
  private _tree!: BeInspireTree<TreeNodeItem>;
  private _treeRef = React.createRef<TreeBase>();
  private _scrollableContainerRef = React.createRef<VirtualizedList>();
  private _selectionHandler: SelectionHandler<BeInspireTreeNode<TreeNodeItem>>;
  private _nodesSelectionHandlers?: Array<SingleSelectionHandler<BeInspireTreeNode<TreeNodeItem>>>;
  private _pressedItemSelected = false;
  /** Used to find out when all of the nodes finish rendering */
  private _nodesToRenderCount = 0;
  private _renderedNodesCount = 0;
  /** Used to delay the automatic scrolling when stepping through higlighted text */
  private _shouldScrollToActiveNode = false;

  public static readonly defaultProps: Partial<TreeProps> = {
    selectionMode: SelectionMode.Single,
  };

  constructor(props: TreeProps, context?: any) {
    super(props, context);

    this.recreateTree();

    this._selectionHandler = new SelectionHandler(props.selectionMode!, this._onNodesSelected, this._onNodesDeselected);
    this._selectionHandler.onItemsSelectedCallback = this._onNodesSelected;
    this._selectionHandler.onItemsDeselectedCallback = this._onNodesDeselected;

    this.state = {
      prev: {
        dataProvider: props.dataProvider,
        selectedNodes: props.selectedNodes,
        modelReady: false,
      },
      model: this._tree,
      modelReady: false,
      cellEditorState: { active: false },
    };
  }

  private recreateTree() {
    this._tree = new BeInspireTree<TreeNodeItem>({
      dataProvider: this.props.dataProvider,
      renderer: this._onModelChanged,
      mapPayloadToInspireNodeConfig: Tree.inspireNodeFromTreeNodeItem,
      pageSize: this.props.pageSize,
      disposeChildrenOnCollapse: this.props.disposeChildrenOnCollapse,
    });
    this._tree.on(BeInspireTreeEvent.NodeExpanded, this._onNodeExpanded);
    this._tree.on(BeInspireTreeEvent.NodeCollapsed, this._onNodeCollapsed);
    this._tree.on(BeInspireTreeEvent.ModelLoaded, this._onModelLoaded);
    this._tree.on(BeInspireTreeEvent.ChildrenLoaded, this._onChildrenLoaded);
    this._tree.ready.then(this._onModelReady); // tslint:disable-line:no-floating-promises
  }

  public static getDerivedStateFromProps(props: TreeProps, state: TreeState): TreeState | null {
    const providerChanged = (props.dataProvider !== state.prev.dataProvider);
    const selectedNodesChanged = (props.selectedNodes !== state.prev.selectedNodes);
    const modelReadyChanged = (state.modelReady !== state.prev.modelReady);
    if (providerChanged || selectedNodesChanged || (modelReadyChanged && state.modelReady)) {
      using((state.model.mute([BeInspireTreeEvent.ChangesApplied]) as any), () => {
        // note: calling this may actually mutate `model`
        // and`rootNodes` in state, but that should be fine
        state.model.updateTreeSelection(props.selectedNodes);
      });
    }

    // create base state that just updates `prev` values
    const base: TreeState = {
      ...state,
      prev: {
        ...state.prev,
        dataProvider: props.dataProvider,
        modelReady: state.modelReady,
        selectedNodes: props.selectedNodes,
        nodeHighlightingProps: props.nodeHighlightingProps,
      },
    };

    // update highlighting engine if props have changed
    if (props.nodeHighlightingProps !== state.prev.nodeHighlightingProps) {
      base.highlightingEngine = props.nodeHighlightingProps ? new HighlightingEngine(props.nodeHighlightingProps) : undefined;
    }

    // in case provider changed, have to reset `modelReady`
    if (providerChanged) {
      return {
        ...base,
        modelReady: false,
      };
    }

    return base;
  }

  public componentDidMount() {
    this._mounted = true;
    if (isTreeDataProviderInterface(this.props.dataProvider) && this.props.dataProvider.onTreeNodeChanged) {
      // subscribe for data provider `onTreeNodeChanged` events
      this.props.dataProvider.onTreeNodeChanged.addListener(this._onTreeNodeChanged);
    }

    /* istanbul ignore next */
    if (this.props.onRender)
      this.props.onRender();
  }

  public componentWillUnmount() {
    this._tree.removeAllListeners();
    if (isTreeDataProviderInterface(this.props.dataProvider) && this.props.dataProvider.onTreeNodeChanged) {
      // unsubscribe from data provider `onTreeNodeChanged` events
      this.props.dataProvider.onTreeNodeChanged.removeListener(this._onTreeNodeChanged);
    }
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

  public componentDidUpdate(prevProps: TreeProps) {
    /* istanbul ignore next */
    if (this.props.onRender)
      this.props.onRender();

    this._selectionHandler.selectionMode = this.props.selectionMode!;

    if (this.props.nodeHighlightingProps && shallowDiffers(this.props.nodeHighlightingProps, prevProps.nodeHighlightingProps)) {
      this._shouldScrollToActiveNode = true;
    }

    if (this.props.dataProvider !== prevProps.dataProvider) {
      if (isTreeDataProviderInterface(prevProps.dataProvider) && prevProps.dataProvider.onTreeNodeChanged) {
        // unsubscribe from previous data provider `onTreeNodeChanged` events
        prevProps.dataProvider.onTreeNodeChanged.removeListener(this._onTreeNodeChanged);
      }
      if (isTreeDataProviderInterface(this.props.dataProvider) && this.props.dataProvider.onTreeNodeChanged) {
        // subscribe for new data provider `onTreeNodeChanged` events
        this.props.dataProvider.onTreeNodeChanged.addListener(this._onTreeNodeChanged);
      }
      this.recreateTree();
      this.setState({ model: this._tree });
      this._tree.ready.then(this._onModelReady); // tslint:disable-line:no-floating-promises
    }
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

  private _onNodesSelected = (nodes: Array<BeInspireTreeNode<TreeNodeItem>>, replace: boolean) => {
    if (this.props.onNodesSelected)
      this.props.onNodesSelected(nodes.map((n) => n.payload), replace);
  }

  private _onNodesDeselected = (nodes: Array<BeInspireTreeNode<TreeNodeItem>>) => {
    if (this.props.onNodesDeselected)
      this.props.onNodesDeselected(nodes.map((n) => n.payload));
  }

  private _onNodeExpanded = (node: BeInspireTreeNode<TreeNodeItem>) => {
    if (this.props.onNodeExpanded)
      this.props.onNodeExpanded(node.payload);

    // note: we get here when parent node is expanded. if data provider loads
    // children immediately, then node has children here. if data provider
    // delay loads children, then `node.getChildren()` returns empty array
    this._tree.updateNodesSelection(node.getChildren(), this.props.selectedNodes);

    this._nodesSelectionHandlers = undefined;
  }

  private _onNodeCollapsed = (node: BeInspireTreeNode<TreeNodeItem>) => {
    if (this.props.onNodeCollapsed)
      this.props.onNodeCollapsed(node.payload);

    this._nodesSelectionHandlers = undefined;
  }

  private _onModelLoaded = (rootNodes: BeInspireTreeNodes<TreeNodeItem>) => {
    if (this.props.onRootNodesLoaded)
      this.props.onRootNodesLoaded(rootNodes.map((n) => n.payload));

    this._nodesSelectionHandlers = undefined;
  }

  private _onChildrenLoaded = (parentNode: BeInspireTreeNode<TreeNodeItem>) => {
    const children = parentNode.getChildren();

    if (this.props.onChildrenLoaded)
      this.props.onChildrenLoaded(parentNode.payload, toNodes<TreeNodeItem>(children).map((c) => c.payload));

    // note: we get here when parent node is expanded and data provider
    // finishes delay-loading its child nodes
    this._tree.updateNodesSelection(children, this.props.selectedNodes);

    this._nodesSelectionHandlers = undefined;
  }

  private _onModelChanged = (_visibleNodes: Array<BeInspireTreeNode<TreeNodeItem>>) => {
    // just set the model to initiate update
    this.setState({ model: this._tree });
  }

  private _onModelReady = () => {
    // istanbul ignore else
    if (this._mounted)
      this.setState({ modelReady: true });
  }

  private _onTreeNodeChanged = (items: Array<TreeNodeItem | undefined>) => {
    using((this._tree.pauseRendering() as any), async () => { // tslint:disable-line:no-floating-promises
      for (const item of items) {
        if (item) {
          // specific node needs to be reloaded
          const node = this._tree.node(item.id);
          if (node) {
            const wasExpanded = node.expanded();
            node.assign(Tree.inspireNodeFromTreeNodeItem(item, Tree.inspireNodeFromTreeNodeItem.bind(this), node));
            if (wasExpanded)
              await node.loadChildren();
          }
        } else {
          // all root nodes need to be reloaded
          await this._tree.reload();
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
      const nodes = this._tree.visible();
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
    selectBetween: (node1: BeInspireTreeNode<TreeNodeItem>, node2: BeInspireTreeNode<TreeNodeItem>) => this._tree.selectBetween(node1, node2),
    deselectAll: () => {
      this._tree.deselectAll();
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
    const nodeItem: TreeNodeItem = node.payload;
    if (isSelected && this._pressedItemSelected && nodeItem.isEditable)
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
  private renderLabelComponent = async ({ node, highlightProps, cellEditorProps, valueRendererManager }: RenderNodeLabelProps): Promise<React.ReactNode> => {
    const labelForeColor = node.payload.labelForeColor ? node.payload.labelForeColor.toString(16) : undefined;
    const labelBackColor = node.payload.labelBackColor ? node.payload.labelBackColor.toString(16) : undefined;
    const labelBold = node.payload.labelBold ? "bold" : undefined;
    const labelItalic = node.payload.labelItalic ? "italic" : undefined;

    const labelStyle: React.CSSProperties = {
      color: labelForeColor,
      backgroundColor: labelBackColor,
      fontWeight: labelBold,
      fontStyle: labelItalic,
    };

    if (cellEditorProps) {
      if (cellEditorProps.cellEditorState.active && node === cellEditorProps.cellEditorState.node) {
        const record = new CellEditorPropertyRecord(node.text);
        return (
          <span style={labelStyle}>
            <EditorContainer propertyRecord={record} title={record.description}
              onCommit={cellEditorProps.onCellEditCommit} onCancel={cellEditorProps.onCellEditCancel} ignoreEditorBlur={cellEditorProps.ignoreEditorBlur} />
          </span>
        );
      }
    }

    let element: React.ReactNode = node.text;

    if (highlightProps)
      element = HighlightingEngine.renderNodeLabel(node.text, highlightProps);

    const context: PropertyValueRendererContext = { containerType: PropertyContainerType.Tree, decoratedTextElement: element };
    const nodeRecord = this.nodeToPropertyRecord(node);

    if (!valueRendererManager)
      valueRendererManager = PropertyValueRendererManager.defaultManager;

    return (
      <span style={labelStyle}>
        {await valueRendererManager.render(nodeRecord, context)}
      </span>
    );
  }

  private _onCheckboxClick = (node: BeInspireTreeNode<TreeNodeItem>) => {
    if (this.props.onCheckboxClick)
      this.props.onCheckboxClick(node);
  }

  // tslint:disable-next-line:naming-convention
  private renderNode = (node: BeInspireTreeNode<TreeNodeItem>, props: TreeNodeProps): React.ReactNode => {
    return (
      <TreeNode
        key={node.id}
        checkboxState={node.payload.checkBoxState}
        isCheckboxEnabled={node.payload.isCheckBoxEnabled}
        {...props}
      />
    );
  }

  private resetNodeRendersCounting() {
    this._nodesToRenderCount = 0;
    this._renderedNodesCount = 0;
  }

  private _onNodeFullyRendered = () => {
    this._renderedNodesCount++;
    if (this._renderedNodesCount < this._nodesToRenderCount)
      return;

    if (this.props.onNodesRender)
      this.props.onNodesRender();

    if (this._shouldScrollToActiveNode) {
      this.scrollToActiveNode();
      this._shouldScrollToActiveNode = false;
    }

    this.resetNodeRendersCounting();
  }

  private _createTreeNodeProps = (node: BeInspireTreeNode<TreeNodeItem>, props: TreeProps, state: TreeState): TreeNodeProps => {
    const onNodeSelectionChanged = this._selectionHandler.createSelectionFunction(this._multiSelectionHandler, this._createItemSelectionHandler(node));

    return {
      node,
      highlightProps: state.highlightingEngine ? state.highlightingEngine.createRenderProps(node) : undefined,
      isCheckboxEnabled: props.checkboxesEnabled,
      onCheckboxClick: this._onCheckboxClick,
      checkboxState: node.payload.checkBoxState,
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

    this.resetNodeRendersCounting();
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
            <PlaceholderNode node={node} />
          </div>
        );
      }

      this._nodesToRenderCount++;

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
    return this.props.node.id !== nextProps.node.id;
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
