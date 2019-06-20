/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ResolvablePromise } from "../test-helpers/misc";
import { ITreeDataProvider, DelayLoadedTreeNodeItem, TreeNodeItem, PageOptions, BeInspireTree, Tree } from "../../ui-components";

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

  public resolveDelayedLoad = (nodeId: string) => {
    const node = this._findNode(nodeId);

    if (!node.delayedLoad)
      throw new Error(`Attempted to resolve a non-deferred load for node ${nodeId}`);

    if (!this._delayedLoads[nodeId])
      throw new Error(`Deferred load for node '${nodeId}' has not been initiated`);

    this._delayedLoads[nodeId].resolve(this._makeTreeNodeItem(node));
  }

  public getNodesCount = async (parent?: TreeNodeItem): Promise<number> => this._getChildren(parent).length;

  public getNodes = async (parent?: TreeNodeItem, page?: PageOptions): Promise<TreeNodeItem[]> => {
    if (page === undefined)
      throw new Error("TestTreeDataProvider requires pagination being used");

    const children = this._getChildren(parent).slice(page.start!, page.start! + page.size!);
    const nodesToDelayLoad = children.filter((node) => node.delayedLoad);
    await Promise.all(nodesToDelayLoad.map((node) => {
      if (!this._delayedLoads[node.id])
        this._delayedLoads[node.id] = new ResolvablePromise<DelayLoadedTreeNodeItem>();

      return this._delayedLoads[node.id];
    }));

    return children.map((node) => this._makeTreeNodeItem(node));
  }

  private _makeTreeNodeItem = (node: TestTreeHierarchyNode): DelayLoadedTreeNodeItem => {
    return { id: node.id, label: node.id, autoExpand: node.autoExpand, hasChildren: node.children && node.children.length > 0 };
  }

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
  }

  private _getChildren = (parent?: TreeNodeItem): TestTreeHierarchyNode[] => {
    if (!parent)
      return this._hierarchy;

    return this._findNode(parent.id).children || [];
  }
}

/** @internal */
export async function initializeTree(hierarchy: Node[], pageSize = 1): Promise<BeInspireTree<TreeNodeItem>> {
  const tree = new BeInspireTree<TreeNodeItem>({
    dataProvider: new TestTreeDataProvider(createTestTreeHierarchy(hierarchy)),
    mapPayloadToInspireNodeConfig: Tree.inspireNodeFromTreeNodeItem,
    pageSize,
  });
  await tree.ready;

  return tree;
}

/** @internal */
export interface Node {
  id: number;
  children?: Node[];
}

function createTestTreeHierarchy(hierarchy: Node[]): TestTreeHierarchyNode[] {
  const testTreeHierarchy: TestTreeHierarchyNode[] = [];
  for (const node of hierarchy) {
    if (!node.children) {
      testTreeHierarchy.push({ id: node.id.toString() });
    } else {
      testTreeHierarchy.push({ id: node.id.toString(), autoExpand: true, children: createTestTreeHierarchy(node.children) });
    }
  }

  return testTreeHierarchy;
}
