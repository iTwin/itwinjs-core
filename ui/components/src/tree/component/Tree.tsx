/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

// third-party imports
import * as React from "react";
import HighlightingEngine, { HighlightableTreeProps, HighlightableTreeNodeProps } from "../HighlightingEngine";
// bentley imports
import { using } from "@bentley/bentleyjs-core";
import { Tree as TreeBase, TreeNode as TreeNodeBase, shallowDiffers } from "@bentley/ui-core";
// tree-related imports
import {
  BeInspireTree, BeInspireTreeNode, BeInspireTreeNodes, BeInspireTreeNodeConfig,
  BeInspireTreeEvent, MapPayloadToInspireNodeCallback, toNodes,
} from "./BeInspireTree";
import {
  TreeDataProvider, TreeNodeItem,
  DelayLoadedTreeNodeItem, ImmediatelyLoadedTreeNodeItem,
  isTreeDataProviderInterface,
} from "../TreeDataProvider";
// selection-related imports
import { SelectionMode } from "../../common/selection/SelectionModes";
import {
  SelectionHandler, SingleSelectionHandler, MultiSelectionHandler,
  OnItemsSelectedCallback, OnItemsDeselectedCallback,
} from "../../common/selection/SelectionHandler";
// cell editing imports
import { EditorContainer, PropertyUpdatedArgs } from "../../editors/EditorContainer";
// misc
import UiComponents from "../../UiComponents";
// css
import "./Tree.scss";
import { CellEditorPropertyRecord } from "./CellEditorPropertyRecord";

/** Type for nodesSelected callback */
export type NodesSelectedCallback = OnItemsSelectedCallback<TreeNodeItem>;
/** Type for nodesDeselected callback */
export type NodesDeselectedCallback = OnItemsDeselectedCallback<TreeNodeItem>;
/** Type for node renderer */
export type NodeRenderer = (item: BeInspireTreeNode<TreeNodeItem>, props: TreeNodeProps) => React.ReactNode;

/** Props for the [[Tree]] component  */
export interface TreeProps {
  dataProvider: TreeDataProvider;

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

  nodeHighlightingProps?: HighlightableTreeProps;

  onCellEditing?: (cellEditorState: TreeCellEditorState) => void;
  onCellUpdated?: (args: TreeCellUpdatedArgs) => Promise<boolean>;
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

/**
 * A Tree React component that uses the core of BeInspireTree, but renders it
 * with Tree and TreeNode from ui-core.
 */
export class Tree extends React.Component<TreeProps, TreeState> {

  private _mounted: boolean = false;
  private _tree!: BeInspireTree<TreeNodeItem>;
  private _treeComponent: React.RefObject<TreeBase> = React.createRef();
  private _selectionHandler: SelectionHandler<BeInspireTreeNode<TreeNodeItem>>;
  private _nodesSelectionHandlers?: Array<SingleSelectionHandler<BeInspireTreeNode<TreeNodeItem>>>;
  private _pressedItemSelected: boolean = false;

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
    });
    this._tree.on(BeInspireTreeEvent.NodeExpanded, this._onNodeExpanded);
    this._tree.on(BeInspireTreeEvent.NodeCollapsed, this._onNodeCollapsed);
    this._tree.on(BeInspireTreeEvent.ModelLoaded, this._onModelLoaded);
    this._tree.on(BeInspireTreeEvent.ChildrenLoaded, this._onChildrenLoaded);
    this._tree.ready.then(this._onModelReady);
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
      || this.state.model.nodes().some((n) => n.isDirty());
  }

  public componentDidUpdate(prevProps: TreeProps) {
    /* istanbul ignore next */
    if (this.props.onRender)
      this.props.onRender();

    this._selectionHandler.selectionMode = this.props.selectionMode!;

    if (this._treeComponent.current && this.props.nodeHighlightingProps && shallowDiffers(this.props.nodeHighlightingProps, prevProps.nodeHighlightingProps))
      HighlightingEngine.scrollToActiveNode(this._treeComponent.current);

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
      this._tree.ready.then(this._onModelReady);
    }
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

  private _onTreeNodeChanged = (items?: TreeNodeItem[]) => {
    using((this._tree.pauseRendering() as any), async () => {
      // istanbul ignore else
      if (items) {
        for (const item of items) {
          if (item) {
            // specific node needs to be reloaded
            const node = this._tree.node(item.id);
            // istanbul ignore else
            if (node) {
              const wasExpanded = node.expanded();
              node.assign(Tree.inspireNodeFromTreeNodeItem(item, Tree.inspireNodeFromTreeNodeItem.bind(this), node));
              if (wasExpanded)
                await node.loadChildren();
            }
          } else {
            // all root nodes need to be reloaded
            const expandedNodeIds = this._tree.expanded().map((n) => n.id!);
            await this._tree.reload();
            await Promise.all(this._tree.nodes(expandedNodeIds).map((n) => n.loadChildren()));
          }
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
      select: () => {
        if (!node.selected())
          node.select();
      },
      deselect: () => {
        if (node.selected())
          node.deselect();
      },
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
      const cellEditorState: TreeCellEditorState = { active: true, node: undefined };
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

  // tslint:disable-next-line:naming-convention
  private static renderLabelComponent = (node: BeInspireTreeNode<TreeNodeItem>, highlightProps?: HighlightableTreeNodeProps, cellEditorProps?: TreeNodeCellEditorProps) => {
    if (cellEditorProps) {
      if (cellEditorProps.cellEditorState.active && node === cellEditorProps.cellEditorState.node) {
        const record = new CellEditorPropertyRecord(node.text);
        return <EditorContainer propertyRecord={record} title={record.description} onCommit={cellEditorProps.onCellEditCommit} onCommitCancel={cellEditorProps.onCellEditCancel} />;
      }
    }

    if (highlightProps) {
      return HighlightingEngine.renderNodeLabel(node.text, highlightProps);
    }
    return node.text;
  }

  // tslint:disable-next-line:naming-convention
  private renderNode = (node: BeInspireTreeNode<TreeNodeItem>, props: TreeNodeProps): React.ReactNode => {
    return (
      <TreeNode key={node.id} {...props} />
    );
  }

  public render() {
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

    const renderNode = this.props.renderNode ? this.props.renderNode : this.renderNode;
    return (
      <TreeBase ref={this._treeComponent} onMouseDown={this._onMouseDown}>
        {nodes.map((n) => {
          const onNodeSelectionChanged = this._selectionHandler.createSelectionFunction(this._multiSelectionHandler, this._createItemSelectionHandler(n));
          const props: TreeNodeProps = {
            node: n,
            highlightProps: this.state.highlightingEngine ? this.state.highlightingEngine.createRenderProps(n) : undefined,
            renderLabel: Tree.renderLabelComponent,
            onClick: (e: React.MouseEvent) => {
              onNodeSelectionChanged(e.shiftKey, e.ctrlKey);
              this._checkCellEditorStatus(n);
            },
            onMouseDown: () => this._selectionHandler.createDragAction(this._multiSelectionHandler, [this.nodesSelectionHandlers], n),
            onMouseMove: (e: React.MouseEvent) => { if (e.buttons === 1) this._selectionHandler.updateDragAction(n); },
            cellEditorProps: { cellEditorState: this.state.cellEditorState, onCellEditCommit: this._onCellEditCommit, onCellEditCancel: this._deactivateCellEditor },
          };
          return renderNode(n, props);
        })}
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

export interface TreeNodeCellEditorProps {
  cellEditorState: TreeCellEditorState;
  onCellEditCommit: (args: PropertyUpdatedArgs) => void;
  onCellEditCancel: () => void;
}

/**
 * Props for the [[TreeNode]] component
 */
export interface TreeNodeProps {
  node: BeInspireTreeNode<TreeNodeItem>;
  highlightProps?: HighlightableTreeNodeProps;
  cellEditorProps?: TreeNodeCellEditorProps;
  renderLabel: (node: BeInspireTreeNode<TreeNodeItem>, highlightProps?: HighlightableTreeNodeProps, cellEditorProps?: TreeNodeCellEditorProps) => React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
}

/**
 * Default component for rendering a node for the [[Tree]]
 */
export class TreeNode extends React.Component<TreeNodeProps> {
  public shouldComponentUpdate(nextProps: TreeNodeProps) {
    return nextProps.node.isDirty() || shallowDiffers(this.props.highlightProps, nextProps.highlightProps);
  }
  public render() {
    // note: props get mutated here
    this.props.node.setDirty(false);
    return (
      <TreeNodeBase
        data-testid={Tree.TestId.Node}
        isExpanded={this.props.node.expanded()}
        isSelected={this.props.node.selected()}
        isLoading={this.props.node.loading()}
        isLeaf={!this.props.node.hasOrWillHaveChildren()}
        label={this.props.renderLabel(this.props.node, this.props.highlightProps, this.props.cellEditorProps)}
        icon={this.props.node.itree && this.props.node.itree.icon ? <span className={this.props.node.itree.icon} /> : undefined}
        level={this.props.node.getParents().length}
        onClick={this.props.onClick}
        onMouseMove={this.props.onMouseMove}
        onMouseDown={this.props.onMouseDown}
        onClickExpansionToggle={() => this.props.node.toggleCollapse()}
      />
    );
  }
}
