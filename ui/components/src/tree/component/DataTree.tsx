/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
import Tree from "./Tree";
import { InspireTreeNode, InspireTreeNodeData } from "./BeInspireTree";
import { TreeDataProvider, TreeNodeItem } from "../TreeDataProvider";
import * as _ from "lodash";

/** Signature for the Selected Node predicate */
export type SelectedNodePredicate = (node: TreeNodeItem) => boolean;

/**
 * Props for DataTree React component
 */
export interface DataTreeProps {
  dataProvider: TreeDataProvider;

  expandedNodes?: string[];

  selectedNodes?: string[] | SelectedNodePredicate;
  onNodesSelected?: (nodes: TreeNodeItem[], replace: boolean) => void;
  onNodesDeselected?: (nodes: TreeNodeItem[]) => void;
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

  public shouldComponentUpdate(nextProps: DataTreeProps): boolean {
    if (_.isEqual(this.props.expandedNodes, nextProps.expandedNodes)
      && this.props.dataProvider === nextProps.dataProvider
      && _.isEqual(this.props.selectedNodes, nextProps.selectedNodes)
      && this.props.onNodesDeselected === nextProps.onNodesDeselected
      && this.props.onNodesSelected === nextProps.onNodesSelected)
      return false;
    return true;
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
        expandedNodes={this.props.expandedNodes}
      />
    );
  }
}
