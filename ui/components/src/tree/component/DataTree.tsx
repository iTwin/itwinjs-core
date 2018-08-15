/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
import Tree from "./Tree";
import { InspireTreeNode, InspireTreeNodeData } from "./BeInspireTree";
import { TreeDataProvider, TreeNodeItem } from "../TreeDataProvider";
import { DropTargetArguments, DragSourceArguments } from "../../dragdrop";
import * as _ from "lodash";

/** Signature for the Selected Node predicate */
export type SelectedNodePredicate = (node: TreeNodeItem) => boolean;

/**
 * Props for DataTree React component
 */
export interface DataTreeProps {
  dataProvider: TreeDataProvider;

  expandedNodes?: string[];
  objectType?: string | ((data: any) => string);
  objectTypes?: string[];

  selectedNodes?: string[] | SelectedNodePredicate;
  onNodesSelected?: (nodes: TreeNodeItem[], replace: boolean) => void;
  onNodesDeselected?: (nodes: TreeNodeItem[]) => void;

  onDropTargetDrop?: (data: DropTargetArguments) => DropTargetArguments;
  onDropTargetOver?: (data: DropTargetArguments) => void;
  canDropTargetDrop?: (data: DropTargetArguments) => boolean;
  onDragSourceBegin?: (data: DragSourceArguments) => DragSourceArguments;
  onDragSourceEnd?: (data: DragSourceArguments) => void;
}

interface InspireTreeNavNodeData extends InspireTreeNodeData {
  _treeNode: TreeNodeItem;
}

export interface InspireTreeNavNode extends InspireTreeNode {
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

  public shouldComponentUpdate(nextProps: DataTreeProps): boolean {
    if (_.isEqual(this.props.expandedNodes, nextProps.expandedNodes)
      && this.props.dataProvider === nextProps.dataProvider
      && _.isEqual(this.props.selectedNodes, nextProps.selectedNodes)
      && this.props.onNodesDeselected === nextProps.onNodesDeselected
      && this.props.onNodesSelected === nextProps.onNodesSelected)
      return false;
    return true;
  }

  public componentDidMount() {
    this.props.dataProvider.onTreeNodeChanged &&
      this.props.dataProvider.onTreeNodeChanged.addListener(this.onTreeNodeChanged);
  }
  public componentWillUnmount() {
    this.props.dataProvider.onTreeNodeChanged &&
      this.props.dataProvider.onTreeNodeChanged.removeListener(this.onTreeNodeChanged);
  }
  private onTreeNodeChanged = () => {
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

    return (
      <Tree
        dataProvider={(node) => (node) ? getChildNodes(node as InspireTreeNavNode) : getRootNodes()}
        selectedNodes={isNodeSelected} onNodesSelected={onNodesSelected} onNodesDeselected={onNodesDeselected}
        onDropTargetOver={(args: DropTargetArguments) => {
          if (args.dropLocation && typeof args.dropLocation === "object" && this.props.onDropTargetOver) {
            const treeNode = args.dropLocation as InspireTreeNavNode;
            if ("_treeNode" in treeNode) { // dropLocation has _treeNode prop
              args.dropLocation = treeNode._treeNode;
            } else { // else, must be root node; set it to TreeDataProvider
              args.dropLocation = this.props.dataProvider;
            }
            this.props.onDropTargetOver(args);
          }
        }}
        onDropTargetDrop={(args: DropTargetArguments): DropTargetArguments => {
          if (args.dropLocation) {
            const treeNode = args.dropLocation as InspireTreeNavNode;
            if ("_treeNode" in treeNode) {
              args.dropLocation = treeNode._treeNode;
            } else {
              args.dropLocation = this.props.dataProvider;
            }
          }
          if (this.props.onDropTargetDrop) return this.props.onDropTargetDrop(args);
          return args;
        }}
        canDropTargetDrop={(args: DropTargetArguments) => {
          if (args.dropLocation && typeof args.dropLocation === "object") {
            const treeNode = args.dropLocation as InspireTreeNavNode;
            if ("_treeNode" in treeNode) {
              args.dropLocation = treeNode._treeNode;
            } else {
              args.dropLocation = this.props.dataProvider;
            }
          }
          if (this.props.canDropTargetDrop) return this.props.canDropTargetDrop(args);
          return true;
        }}
        onDragSourceBegin={(args: DragSourceArguments) => {
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
                if ("_treeNode" in parentNode) {
                  args.parentObject = parentNode._treeNode;
                } else {
                  args.parentObject = this.props.dataProvider;
                }

              }
            }
            if (this.props.onDragSourceBegin) return this.props.onDragSourceBegin(args);
          }
          return args;
        }}
        onDragSourceEnd={(args: DragSourceArguments) => {
          // if there is a parentObject, narrow it to a TreeNodeItem
          if (args.parentObject && typeof args.parentObject === "object") {
            const parentNode = args.parentObject as InspireTreeNavNode;
            if ("_treeNode" in parentNode) {
              args.parentObject = parentNode._treeNode;
            } else {
              args.parentObject = this.props.dataProvider;
            }
          }
          if (this.props.onDragSourceEnd) this.props.onDragSourceEnd(args);
        }}
        objectType={(data: any) => {
          if (this.props.objectType) {
            if (typeof this.props.objectType === "function") {
              if (data) {
                const treeNode = data as InspireTreeNavNode;
                if ("_treeNode" in treeNode) {
                  const d = treeNode._treeNode.extendedData;
                  return this.props.objectType(d);
                }
              }
            } else {
              return this.props.objectType;
            }
          }
          return "";
        }}
        objectTypes={this.props.objectTypes}
        expandedNodes={this.props.expandedNodes}
      />
    );
  }
}
