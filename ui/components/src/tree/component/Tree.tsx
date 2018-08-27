/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
import { withDropTarget, DropTargetArguments, DragSourceArguments, DropTargetProps, DragSourceProps } from "../../dragdrop";
import { DragDropTreeNode } from "./DragDropNodeWrapper";
import { Tree as TreeBase, TreeBranch, TreeNode } from "@bentley/ui-core";
import { BeInspireTree, InspireTreeNode, InspireTreeDataProvider, NodePredicate } from "./BeInspireTree";
import Highlighter from "react-highlight-words";
import { SelectionMode } from "../../common/selection/SelectionModes";
import {
  SelectionHandler, SingleSelectionHandler, MultiSelectionHandler,
  OnItemsSelectedCallback, OnItemsDeselectedCallback,
} from "../../common/selection/SelectionHandler";

// tslint:disable-next-line:variable-name
const DropTree = withDropTarget(TreeBase);

/** Signature for the Nodes Selected callback */
export type OnNodesSelectedCallback = OnItemsSelectedCallback<InspireTreeNode>;
/** Signature for the Nodes Deselected callback */
export type OnNodesDeselectedCallback = OnItemsDeselectedCallback<InspireTreeNode>;

/** Tree event callbacks  */
export interface TreeEvents {
  onNodesSelected: OnNodesSelectedCallback;
  onNodesDeselected: OnNodesDeselectedCallback;
  onNodeExpanded: (node: InspireTreeNode) => void;
  onNodeCollapsed: (node: InspireTreeNode) => void;
  onChildrenLoaded: (node: InspireTreeNode) => void;
}

export interface TreeState {
  rootNodes: InspireTreeNode[];
}

/** Props for the Tree React component  */
export interface TreeProps {
  onTreeReloaded?: () => void;
  dataProvider: InspireTreeDataProvider;
  dragProps?: DragSourceProps;
  dropProps?: DropTargetProps;
  renderNode?: (data: InspireTreeNode, children?: React.ReactNode) => React.ReactNode;
  selectedNodes?: string[] | NodePredicate;
  selectionMode?: SelectionMode;
  expandedNodes?: ReadonlyArray<string>;
  highlightString?: string;
  key?: any;
}

/** Props for the Tree React component  */
export type Props = TreeProps & Partial<TreeEvents>;

/**
 * A Tree React component that uses the core of InspireTree, but renders it
 *  with Tree, TreeBranch, and TreeNode from ui-core.
 */
export default class Tree extends React.Component<Props, TreeState> {

  private _tree: BeInspireTree;
  private _nodeRenderFunc: (data: InspireTreeNode, children?: React.ReactNode, index?: number) => React.ReactNode;
  private _isMounted = false;
  private _selectionHandler: SelectionHandler<InspireTreeNode>;
  private _nodesSelectionHandlers?: Array<SingleSelectionHandler<InspireTreeNode>>;

  public readonly state: Readonly<TreeState> = { rootNodes: [] };

  constructor(props: Props, context?: any) {
    super(props, context);

    this._tree = this.createTree();
    this._selectionHandler = new SelectionHandler(props.selectionMode ? props.selectionMode : SelectionMode.Single,
      this.props.onNodesSelected, this.props.onNodesDeselected);
    this._nodeRenderFunc = (props.renderNode) ? props.renderNode : this._defaultRenderNode;
  }

  // tslint:disable-next-line:naming-convention
  private get nodesSelectionHandlers(): Array<SingleSelectionHandler<InspireTreeNode>> {
    if (!this._nodesSelectionHandlers) {
      this._nodesSelectionHandlers = [];
      const nodes = this._tree.visibleNodes();
      for (const node of nodes) {
        this._nodesSelectionHandlers.push(this.createItemSelectionHandler(node));
      }
    }
    return this._nodesSelectionHandlers;
  }

  private createTree(): BeInspireTree {
    const tree = new BeInspireTree(this.props.dataProvider, this._syncNodes);
    tree.on("node.expanded", this._onNodeExpanded);
    tree.on("node.collapsed", this._onNodeCollapsed);
    tree.on("children.loaded", this._onChildrenLoaded);
    return tree;
  }

  public async componentWillReceiveProps(props: Props) {
    if (this.props.selectionMode !== props.selectionMode)
      this._selectionHandler.selectionMode = props.selectionMode ? props.selectionMode : SelectionMode.Single;

    this._nodeRenderFunc = (props.renderNode) ? props.renderNode : this._defaultRenderNode;
    this._selectionHandler.onItemsSelectedCallback = this.props.onNodesSelected;
    this._selectionHandler.onItemsDeselectedCallback = this.props.onNodesDeselected;

    this._tree.pauseRendering();

    const expandedNodeIds = props.expandedNodes ? props.expandedNodes : this._tree.expandedNodeIds;

    if (this.props.dataProvider !== props.dataProvider)
      await this._tree.reload();

    await this._tree.updateExpansion(expandedNodeIds);
    await this._tree.updateTreeSelection(props.selectedNodes);

    this._tree.resumeRendering();

    if (this.props.onTreeReloaded)
      this.props.onTreeReloaded();
  }

  public componentWillMount() {
    this._isMounted = true;
    this.componentWillReceiveProps(this.props);
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  private _onNodeExpanded = (node: InspireTreeNode) => {
    if (this.props.onNodeExpanded)
      this.props.onNodeExpanded(node);

    this._nodesSelectionHandlers = undefined;
    if (undefined !== node.children && "boolean" !== typeof node.children) {
      this._tree.updateNodesSelection(node.children as any, this.props.selectedNodes);
    }
  }

  private _onNodeCollapsed = (node: InspireTreeNode) => {
    if (this.props.onNodeCollapsed)
      this.props.onNodeCollapsed(node);
    this._nodesSelectionHandlers = undefined;
  }

  private _onChildrenLoaded = (parentNode: InspireTreeNode) => {
    if (this.props.onChildrenLoaded)
      this.props.onChildrenLoaded(parentNode);

    if (undefined !== parentNode.children && "boolean" !== typeof parentNode.children) {
      this._tree.updateNodesSelection(parentNode.children as any, this.props.selectedNodes);
    }
    this._nodesSelectionHandlers = undefined;
  }

  // Update the state when changes have been made to our nodes
  private _syncNodes = (rootNodes: InspireTreeNode[]) => {
    if (!this._isMounted)
      return;

    this.setState({ rootNodes });
  }

  private _getLabelComponent = (text: string) => {
    if (this.props.highlightString) {
      return (
        <Highlighter
          searchWords={[this.props.highlightString]}
          autoEscape={true}
          textToHighlight={text}
        />
      );
    }
    return text;
  }

  private _defaultRenderNode = (data: InspireTreeNode, children?: React.ReactNode, index?: number): React.ReactNode => {
    const itemHandler = this.createItemSelectionHandler(data);
    const onSelectionChanged = this._selectionHandler.createSelectionFunction(this._multiSelectionHandler, itemHandler);

    const onMouseDown = (_e: React.MouseEvent) => {
      this._selectionHandler.createDragAction(this._multiSelectionHandler, [this.nodesSelectionHandlers], data);
    };
    const toggleExpansion = () => data.toggleCollapse();

    if (this.props.dragProps || this.props.dropProps) {
      const dragProps: DragSourceProps = {};
      if (this.props.dragProps) {
        const { onDragSourceBegin, onDragSourceEnd, objectType } = this.props.dragProps;
        dragProps.onDragSourceBegin = (args: DragSourceArguments) => {
          args.dataObject = data;
          args.parentObject = parent || this.props.dataProvider;
          return onDragSourceBegin ? onDragSourceBegin(args) : args;
        };
        dragProps.onDragSourceEnd = (args: DragSourceArguments) => {
          if (onDragSourceEnd) {
            args.parentObject = parent || this.props.dataProvider;
            onDragSourceEnd(args);
          }
        };
        dragProps.objectType = () => {
          if (objectType) {
            if (typeof objectType === "function")
              return objectType(data);
            else
              return objectType;
          }
          return "";
        };
      }
      const dropProps: DropTargetProps = {};
      if (this.props.dropProps) {
        const { onDropTargetOver, onDropTargetDrop, canDropTargetDrop, objectTypes } = this.props.dropProps;
        dropProps.onDropTargetOver = (args: DropTargetArguments) => {
          // populate tree information while it's accessable
          args.dropLocation = data;
          if (args.dropRect) {
            const relativeY = (args.clientOffset.y - args.dropRect.top) / args.dropRect.height;
            if (relativeY < 1 / 3 && relativeY > 2 / 3 && index !== undefined) {
              args.dropLocation = parent || this.props.dataProvider;
              args.row = index;
              if (relativeY > 2 / 3) {
                args.row = index + 1;
              }
            }
          }
          if (onDropTargetOver) onDropTargetOver(args);
        };
        dropProps.onDropTargetDrop = (args: DropTargetArguments): DropTargetArguments => {
          // populate tree information while it's accessable
          args.dropLocation = data;
          if (args.dropRect) {
            const relativeY = (args.clientOffset.y - args.dropRect.top) / args.dropRect.height;
            if ((relativeY < 1 / 3 || relativeY > 2 / 3) && index !== undefined) {
              args.dropLocation = parent || this.props.dataProvider;
              args.row = index;
              if (relativeY > 2 / 3) {
                args.row = index + 1;
              }
            }
          }
          if (onDropTargetDrop) return onDropTargetDrop(args);
          return args;
        };
        dropProps.canDropTargetDrop = (args: DropTargetArguments) => {
          // populate tree information while it's accessable
          args.dropLocation = data;
          if (canDropTargetDrop) return canDropTargetDrop(args);
          return true;
        };
        dropProps.objectTypes = objectTypes;
      }
      return (
        <DragDropTreeNode
          dragProps={dragProps}
          dropProps={dropProps}
          shallow={true}
          key={data.id}
          isExpanded={data.expanded()}
          isSelected={data.selected()}
          isLoading={data.loading()}
          isLeaf={!data.hasOrWillHaveChildren()}
          label={this._getLabelComponent(data.text ? data.text : "")}
          icon={<span className={data.icon} />}
          onClick={(e: React.MouseEvent) => { onSelectionChanged(e.shiftKey, e.ctrlKey); }}
          onMouseMove={(e: React.MouseEvent) => { if (e.buttons === 1) this._selectionHandler.updateDragAction(data); }}
          onMouseDown={onMouseDown}
          onClickExpansionToggle={toggleExpansion}
        >
          {children}
        </DragDropTreeNode>
      );
    } else
      return (
        <TreeNode
          key={data.id}
          isExpanded={data.expanded()}
          isSelected={data.selected()}
          isLoading={data.loading()}
          isLeaf={!data.hasOrWillHaveChildren()}
          label={this._getLabelComponent(data.text ? data.text : "")}
          icon={<span className={data.icon} />}
          onClick={(e: React.MouseEvent) => { onSelectionChanged(e.shiftKey, e.ctrlKey); }}
          onMouseMove={(e: React.MouseEvent) => { if (e.buttons === 1) this._selectionHandler.updateDragAction(data); }}
          onMouseDown={onMouseDown}
          onClickExpansionToggle={toggleExpansion}
        >
          {children}
        </TreeNode>
      );
  }

  private createItemSelectionHandler(node: InspireTreeNode): SingleSelectionHandler<InspireTreeNode> {
    return {
      select: () => node.select(),
      deselect: () => node.deselect(),
      isSelected: () => node.selected(),
      item: () => node,
    };
  }

  private _multiSelectionHandler: MultiSelectionHandler<InspireTreeNode> = {
    selectBetween: (node1: InspireTreeNode, node2: InspireTreeNode) => this._tree.selectBetween(node1, node2),
    deselectAll: () => this._tree.deselectAll(),
    updateSelection: (selections: InspireTreeNode[], deselections: InspireTreeNode[]) => {
      selections.forEach((x) => x.select());
      deselections.forEach((x) => x.deselect());
    },
    areEqual: (item1: InspireTreeNode, item2: InspireTreeNode) => item1 === item2,
  };

  private renderBranch(nodes: InspireTreeNode[] | undefined) {
    const items: React.ReactNode[] = [];

    // For every node
    (nodes || []).forEach((node: InspireTreeNode) => {
      // Only render if node is available
      if (node.available()) {
        // Build a branch for all children of this node
        let children: React.ReactNode | undefined;
        if (node.expanded() && node.hasChildren()) {
          children = this.renderBranch(node.children as any);
        }

        // Push this node.
        items.push(this._nodeRenderFunc(node, children));
      }
    });

    return (
      <TreeBranch>{items}</TreeBranch>);
  }

  // Renders the wrapping div and root branch
  public render() {
    if (this.props.dropProps) {
      const { onDropTargetOver, onDropTargetDrop, canDropTargetDrop, objectTypes } = this.props.dropProps;
      const dropProps = {
        onDropTargetOver: (args: DropTargetArguments) => {
          if (onDropTargetOver) {
            args.dropLocation = this.props.dataProvider;
            onDropTargetOver(args);
          }
        },
        onDropTargetDrop: (args: DropTargetArguments): DropTargetArguments => {
          args.dropLocation = this.props.dataProvider;
          return onDropTargetDrop ? onDropTargetDrop(args) : args;
        },
        canDropTargetDrop: (args: DropTargetArguments) => {
          args.dropLocation = this.props.dataProvider;
          return canDropTargetDrop ? canDropTargetDrop(args) : true;
        },
        objectTypes,
      };
      return (
        <DropTree
          dropStyle={{
            height: "100%",
          }}
          dropProps={dropProps}
          shallow={true}
        >
          {this.renderBranch(this.state.rootNodes)}
        </DropTree>
      );
    } else
      return (
        <div onMouseDown={this._onMouseDown}>
          <TreeBase>{this.renderBranch(this.state.rootNodes)}</TreeBase>
        </div>
      );
  }

  private _onMouseDown = () => {
    document.addEventListener("mouseup", this._onMouseUp, { capture: true, once: true });
  }

  private _onMouseUp = () => {
    this._selectionHandler.completeDragAction();
  }

}
