/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyRecord } from "@itwin/appui-abstract";
import { DelayLoadedTreeNodeItem, ITreeDataProvider, PageOptions, TreeNodeItem } from "../../components-react";
import { ResolvablePromise } from "../test-helpers/misc";

/** @internal */
export interface TestTreeHierarchyNode {
  id: string;
  autoExpand?: boolean;
  delayedLoad?: boolean;
  children?: TestTreeHierarchyNode[];
}

/** @internal */
export class TestTreeDataProvider implements ITreeDataProvider {
  private _delayedLoads: { [nodeId: string]: ResolvablePromise<DelayLoadedTreeNodeItem> } = {};

  constructor(private _hierarchy: TestTreeHierarchyNode[]) { }

  public resolveDelayedLoad = async (nodeId: string) => {
    const node = this._findNode(nodeId);

    if (!node.delayedLoad)
      throw new Error(`Attempted to resolve a non-deferred load for node ${nodeId}`);

    if (!this._delayedLoads[nodeId]) // eslint-disable-line @typescript-eslint/no-misused-promises
      throw new Error(`Deferred load for node '${nodeId}' has not been initiated`);

    await this._delayedLoads[nodeId].resolve(this._makeTreeNodeItem(node));
  };

  public getNodesCount = async (parent?: TreeNodeItem): Promise<number> => this._getChildren(parent).length;

  public getNodes = async (parent?: TreeNodeItem, page?: PageOptions): Promise<TreeNodeItem[]> => {
    if (page === undefined)
      throw new Error("TestTreeDataProvider requires pagination being used");

    const children = this._getChildren(parent).slice(page.start, page.start! + page.size!);
    const nodesToDelayLoad = children.filter((node) => node.delayedLoad);
    await Promise.all(nodesToDelayLoad.map((node) => {
      if (!this._delayedLoads[node.id]) // eslint-disable-line @typescript-eslint/no-misused-promises
        this._delayedLoads[node.id] = new ResolvablePromise<DelayLoadedTreeNodeItem>();

      return this._delayedLoads[node.id];
    }));

    return children.map((node) => this._makeTreeNodeItem(node));
  };

  private _makeTreeNodeItem = (node: TestTreeHierarchyNode): DelayLoadedTreeNodeItem => {
    return { id: node.id, label: PropertyRecord.fromString(node.id, "label"), autoExpand: node.autoExpand, hasChildren: node.children && node.children.length > 0 };
  };

  private _findNode = (nodeId: string): TestTreeHierarchyNode => {
    const findNodeRecursively = (children: TestTreeHierarchyNode[]): TestTreeHierarchyNode | undefined => {
      for (const child of children) {
        if (child.id === nodeId)
          return child;

        if (child.children) {
          const result = findNodeRecursively(child.children);
          if (result)
            return result;
        }
      }

      return undefined;
    };

    const node = findNodeRecursively(this._hierarchy);
    if (!node)
      throw new Error(`Unknown tree nodeId: '${nodeId}'`);

    return node;
  };

  private _getChildren = (parent?: TreeNodeItem): TestTreeHierarchyNode[] => {
    if (!parent)
      return this._hierarchy;

    return this._findNode(parent.id).children || [];
  };
}
