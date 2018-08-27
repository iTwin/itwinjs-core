/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
import Tree from "./Tree";
import { InspireTreeNode, InspireTreeNodeData } from "./BeInspireTree";
import { TreeDataProvider, TreeNodeItem } from "../TreeDataProvider";
import { SelectionMode } from "../../common/selection/SelectionModes";
import { DropTargetArguments, DragSourceArguments, DragSourceProps, DropTargetProps } from "../../dragdrop";

/** Signature for the Selected Node predicate */
export type SelectedNodePredicate = (node: TreeNodeItem) => boolean;

/**
 * Props for DataTree React component
 */
export interface DataTreeProps {
  dataProvider: TreeDataProvider;

  expandedNodes?: string[];
  selectionMode?: SelectionMode;
  objectType?: string | ((data: any) => string);
  objectTypes?: string[];
  selectedNodes?: string[] | SelectedNodePredicate;
  onNodesSelected?: (nodes: TreeNodeItem[], replace: boolean) => void;
  onNodesDeselected?: (nodes: TreeNodeItem[]) => void;
  dragProps?: DragSourceProps;
  dropProps?: DropTargetProps;
}

interface InspireTreeNavNodeData extends InspireTreeNodeData {
  _treeNode: TreeNodeItem;
}

interface InspireTreeNavNode extends InspireTreeNode {
  _treeNode: TreeNodeItem;
}

/**
 * DataTree React component
 */
export default class DataTree extends React.Component<DataTreeProps> {
  constructor(props: DataTreeProps, context?: any) {
    super(props, context);
  }

  private treeNodeToInspireNode(node: TreeNodeItem): InspireTreeNavNodeData {
    return {
      text: node.label,
      icon: node.iconPath || undefined,
      children: node.hasChildren || false,
      id: node.id,
      _treeNode: node,
    };
  }

  public componentDidMount() {
    this.props.dataProvider.onTreeNodeChanged &&
      this.props.dataProvider.onTreeNodeChanged.addListener(this._onTreeNodeChanged);
  }
  public componentWillUnmount() {
    this.props.dataProvider.onTreeNodeChanged &&
      this.props.dataProvider.onTreeNodeChanged.removeListener(this._onTreeNodeChanged);
  }
  private _onTreeNodeChanged = () => {
    this.forceUpdate();
  }

  public render() {
    const getChildNodes = async (parent: InspireTreeNavNode) => {
      const treeNodes = await this.props.dataProvider.getChildNodes(parent._treeNode, { size: 9999, start: 0 });
      return treeNodes.map(this.treeNodeToInspireNode);
    };

    const getRootNodes = async () => {
      const treeNodes = await this.props.dataProvider.getRootNodes({ size: 9999, start: 0 });
      return treeNodes.map(this.treeNodeToInspireNode);
    };

    const isNodeSelected = (node: InspireTreeNode): boolean => {
      if (!this.props.selectedNodes)
        return false;
      if (Array.isArray(this.props.selectedNodes))
        return -1 !== this.props.selectedNodes.indexOf(node.id!);
      return this.props.selectedNodes((node as InspireTreeNavNode)._treeNode);
    };

    const onNodesSelected = (nodes: InspireTreeNode[], replace: boolean) => {
      if (this.props.onNodesSelected)
        this.props.onNodesSelected(nodes.map((node) => (node as InspireTreeNavNode)._treeNode), replace);
    };

    const onNodesDeselected = (nodes: InspireTreeNode[]) => {
      if (this.props.onNodesDeselected)
        this.props.onNodesDeselected(nodes.map((node) => (node as InspireTreeNavNode)._treeNode));
    };

    // By default, dragProps will be empty
    const dragProps: DragSourceProps = {};
    if (this.props.dragProps) {
      const { onDragSourceBegin, onDragSourceEnd, objectType } = this.props.dragProps;
      dragProps.onDragSourceBegin = (args: DragSourceArguments) => {
        if (args.dataObject && typeof args.dataObject === "object") {
          const treeNode = args.dataObject as InspireTreeNavNode;
          if ("_treeNode" in treeNode && treeNode._treeNode && treeNode._treeNode.extendedData) {
            args.dataObject = treeNode._treeNode.extendedData;
            if ("parentId" in args.dataObject && args.dataObject.parentId === undefined) {
              args.dataObject.parentId = this.props.dataProvider;
            }
            // if there is a parentObject, narrow it to a TreeNodeItem
            if (args.parentObject && typeof args.parentObject === "object") {
              const parentNode = args.parentObject as InspireTreeNavNode;
              if ("_treeNode" in parentNode)
                args.parentObject = parentNode._treeNode;
              else
                args.parentObject = this.props.dataProvider;
            }
          }
        }
        return onDragSourceBegin ? onDragSourceBegin(args) : args;
      };
      dragProps.onDragSourceEnd = (args: DragSourceArguments) => {
        // if there is a parentObject, narrow it to a TreeNodeItem
        if (args.parentObject && typeof args.parentObject === "object" && onDragSourceEnd) {
          const parentNode = args.parentObject as InspireTreeNavNode;
          if ("_treeNode" in parentNode)
            args.parentObject = parentNode._treeNode;
          else
            args.parentObject = this.props.dataProvider;
          onDragSourceEnd(args);
        }
      };
      dragProps.objectType = (data: any) => {
        if (objectType) {
          if (typeof objectType === "function") {
            if (data) {
              const treeNode = data as InspireTreeNavNode;
              if ("_treeNode" in treeNode) {
                const d = treeNode._treeNode.extendedData;
                return objectType(d);
              }
            }
          } else {
            return objectType;
          }
        }
        return "";
      };
    }
    const dropProps: DropTargetProps = {};
    if (this.props.dropProps) {
      const { onDropTargetOver, onDropTargetDrop, canDropTargetDrop, objectTypes } = this.props.dropProps;
      dropProps.onDropTargetOver = (args: DropTargetArguments) => {
        if (args.dropLocation && typeof args.dropLocation === "object" && onDropTargetOver) {
          const treeNode = args.dropLocation as InspireTreeNavNode;
          if ("_treeNode" in treeNode) { // dropLocation has _treeNode prop
            args.dropLocation = treeNode._treeNode;
          } else { // else, must be root node; set it to TreeDataProvider
            args.dropLocation = this.props.dataProvider;
          }
          onDropTargetOver(args);
        }
      };
      dropProps.onDropTargetDrop = (args: DropTargetArguments): DropTargetArguments => {
        if (args.dropLocation) {
          const treeNode = args.dropLocation as InspireTreeNavNode;
          if ("_treeNode" in treeNode) {
            args.dropLocation = treeNode._treeNode;
          } else {
            args.dropLocation = this.props.dataProvider;
          }
        }
        return onDropTargetDrop ? onDropTargetDrop(args) : args;
      };
      dropProps.canDropTargetDrop = (args: DropTargetArguments) => {
        if (args.dropLocation && typeof args.dropLocation === "object") {
          const treeNode = args.dropLocation as InspireTreeNavNode;
          if ("_treeNode" in treeNode) {
            args.dropLocation = treeNode._treeNode;
          } else {
            args.dropLocation = this.props.dataProvider;
          }
        }
        return canDropTargetDrop ? canDropTargetDrop(args) : true;
      };
      dropProps.objectTypes = objectTypes;
    }
    return (
      <Tree
        dataProvider={(node) => (node) ? getChildNodes(node as InspireTreeNavNode) : getRootNodes()}
        selectedNodes={isNodeSelected} onNodesSelected={onNodesSelected} onNodesDeselected={onNodesDeselected}
        dragProps={dragProps}
        dropProps={dropProps}
        expandedNodes={this.props.expandedNodes}
        selectionMode={this.props.selectionMode}
      />
    );
  }
}
