/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { immerable } from "immer";
import { CheckBoxState } from "@bentley/ui-core";
import { SparseTree, SparseArray } from "./internal/SparseTree";
import { DelayLoadedTreeNodeItem, ImmediatelyLoadedTreeNodeItem, TreeNodeItem } from "../TreeDataProvider";

/**
 * Immutable data structure that describes tree node.
 * @alpha
 */
export interface TreeModelNode {
  readonly id: string;
  readonly parentId: string | undefined;
  readonly depth: number;

  readonly isLoading?: boolean;
  readonly numChildren: number | undefined;

  readonly description: string | undefined;
  readonly isExpanded: boolean;
  readonly label: string;
  readonly isSelected: boolean;

  readonly checkbox: CheckBoxInfo;

  readonly item: TreeNodeItem;
}

/**
 * Immutable data structure that describes checkbox info.
 * @alpha
 */
export interface CheckBoxInfo {
  readonly state: CheckBoxState;
  readonly tooltip?: string;

  readonly isDisabled: boolean;
  readonly isVisible: boolean;
}

/**
 * Mutable data structure that describes tree node.
 * @alpha
 */
export interface MutableTreeModelNode extends TreeModelNode {
  isLoading: boolean;

  description: string;
  isExpanded: boolean;
  label: string;
  isSelected: boolean;

  checkbox: MutableCheckBoxInfo;

  item: TreeNodeItem;
}

/**
 * Mutable data structure that describes checkbox info.
 * @alpha
 */
export interface MutableCheckBoxInfo extends CheckBoxInfo {
  state: CheckBoxState;
  tooltip?: string;

  isDisabled: boolean;
  isVisible: boolean;
}

/**
 * Data structure that describes tree node placeholder.
 * @alpha
 */
export interface TreeModelNodePlaceholder {
  readonly childIndex: number;
  readonly depth: number;
  readonly parentId?: string;
}

/**
 * Data structure that describes tree root node.
 * @alpha
 */
export interface TreeModelRootNode {
  readonly depth: -1;
  readonly id: undefined;

  readonly numChildren: number | undefined;
}

/**
 * Data structure that describes input used to create tree node.
 * @alpha
 */
export interface TreeModelNodeInput {
  readonly description?: string;
  readonly isExpanded: boolean;
  readonly id: string;
  readonly item: TreeNodeItem;
  readonly label: string;
  readonly isLoading: boolean;
  readonly numChildren?: number;
  readonly isSelected: boolean;
}

type TreeModelNodeType = TreeModelNode | TreeModelNodePlaceholder | TreeModelRootNode;

/** @alpha */
export function isTreeModelNode(obj: TreeModelNodeType | undefined): obj is TreeModelNode {
  return obj !== undefined && !isTreeModelNodePlaceholder(obj) && !isTreeModelRootNode(obj);
}

/** @alpha */
export function isTreeModelNodePlaceholder(obj: TreeModelNodeType | undefined): obj is TreeModelNodePlaceholder {
  return obj !== undefined && "childIndex" in obj;
}

/** @alpha */
export function isTreeModelRootNode(obj: TreeModelNodeType | undefined): obj is TreeModelRootNode {
  return obj !== undefined && (obj as TreeModelRootNode).id === undefined && !("childIndex" in obj);
}

/** @alpha */
export type TreeNodeItemData = ImmediatelyLoadedTreeNodeItem & DelayLoadedTreeNodeItem;

/**
 * Data structure that describes set of visible tree nodes as a flat list.
 * @alpha
 */
export interface VisibleTreeNodes extends Iterable<TreeModelNode | TreeModelNodePlaceholder> {
  getNumNodes(): number;
  getAtIndex(index: number): TreeModelNode | TreeModelNodePlaceholder | undefined;
  getModel(): TreeModel;
  getNumRootNodes(): number | undefined;
}

/**
 * Data structure that describes tree model.
 * @alpha
 */
export interface TreeModel {
  getRootNode(): TreeModelRootNode;

  getNode(id: string): TreeModelNode | undefined;
  getNode(parentId: string | undefined, childIndex: number): TreeModelNode | TreeModelNodePlaceholder | undefined;
  getNode(nodeId: string | undefined, childIndex?: number): TreeModelNode | TreeModelNodePlaceholder | TreeModelRootNode | undefined;

  getChildren(parentId: string | undefined): SparseArray<string> | undefined;

  iterateTreeModelNodes(parentId?: string): IterableIterator<TreeModelNode>;
}

/**
 * Tree model that represent the tree and holds nodes.
 * @alpha
 */
export class MutableTreeModel implements TreeModel {
  public static [immerable] = true;

  private _tree = new SparseTree<MutableTreeModelNode>();
  private _rootNode: TreeModelRootNode = { depth: -1, id: undefined, numChildren: undefined };

  public getRootNode(): TreeModelRootNode {
    return this._rootNode;
  }

  public getNode(id: string): MutableTreeModelNode | undefined;
  public getNode(parentId: string | undefined, childIndex: number): MutableTreeModelNode | TreeModelNodePlaceholder | TreeModelRootNode | undefined;
  public getNode(nodeId: string | undefined, childIndex?: number): MutableTreeModelNode | TreeModelNodePlaceholder | TreeModelRootNode | undefined {
    if (childIndex === undefined) {
      return this._tree.getNode(nodeId!);
    }

    const children = this._tree.getChildren(nodeId);
    const childId = children !== undefined ? children.get(childIndex) : undefined;
    if (childId !== undefined) {
      return this._tree.getNode(childId);
    }

    const parentNode = nodeId === undefined ? this._rootNode : this._tree.getNode(nodeId);
    if (parentNode !== undefined) {
      return {
        childIndex,
        depth: parentNode.depth + 1,
        parentId: nodeId,
      };
    }

    return undefined;
  }

  public getChildren(parentId: string | undefined): SparseArray<string> | undefined {
    return this._tree.getChildren(parentId);
  }

  public setChildren(
    parentId: string | undefined,
    nodeInputs: TreeModelNodeInput[],
    offset: number,
  ) {
    const parentNode = parentId === undefined ? this._rootNode : this._tree.getNode(parentId);
    if (parentNode === undefined)
      return;

    const children: MutableTreeModelNode[] = [];
    for (const input of nodeInputs) {
      const child = MutableTreeModel.createTreeModelNode(parentNode, input);
      children.push(child);
    }

    this._tree.setChildren(parentNode && parentNode.id, children, offset);
  }

  public setNumChildren(parentId: string | undefined, numChildren: number) {
    const parentNode = parentId === undefined ? this._rootNode : this._tree.getNode(parentId);
    if (parentNode !== undefined) {
      (parentNode.numChildren as number) = numChildren;
    }

    this._tree.setNumChildren(parentId, numChildren);
  }

  public clearChildren(parentId: string | undefined) {
    const parentNode = parentId === undefined ? this._rootNode : this._tree.getNode(parentId);
    if (parentNode !== undefined) {
      (parentNode.numChildren as number | undefined) = undefined;
    }
    this._tree.setNumChildren(parentId, 0);
  }

  public computeVisibleNodes(): VisibleTreeNodes {
    const result = MutableTreeModel.getVisibleDescendants(this._tree, this._rootNode);
    return {
      getNumNodes: () => result.length,
      getAtIndex: (index: number): TreeModelNode | TreeModelNodePlaceholder | undefined => {
        if (typeof (index) === "number") {
          return result[index];
        }

        return this._tree.getNode(index);
      },
      getModel: () => this,
      getNumRootNodes: () => this._rootNode.numChildren,
      [Symbol.iterator]: () => result[Symbol.iterator](),
    };
  }

  public * iterateTreeModelNodes(parentId?: string): IterableIterator<MutableTreeModelNode> {
    const _this = this;
    function* iterateDescendants(subParentId: string | undefined): IterableIterator<MutableTreeModelNode> {
      const children = _this.getChildren(subParentId);
      if (children === undefined) {
        return;
      }

      for (const [nodeId] of children.iterateValues()) {
        const node = _this.getNode(nodeId);
        if (node !== undefined) {
          yield node;
          yield* iterateDescendants(nodeId);
        }
      }
    }

    yield* iterateDescendants(parentId);
  }

  private static createTreeModelNode(parentNode: TreeModelNode | TreeModelRootNode, input: TreeModelNodeInput): MutableTreeModelNode {
    return {
      id: input.id,
      parentId: parentNode.id,
      depth: parentNode.depth + 1,

      isLoading: input.isLoading,
      numChildren: input.numChildren,

      description: input.description || "",
      isExpanded: input.isExpanded,
      label: input.label,
      isSelected: input.isSelected,

      checkbox: {
        state: input.item.checkBoxState || CheckBoxState.Off,
        isDisabled: !!input.item.isCheckboxDisabled,
        isVisible: !!input.item.isCheckboxVisible,
      },

      item: input.item,
    };
  }

  // Traverses the tree and collects visible descendants.
  private static getVisibleDescendants(
    tree: SparseTree<TreeModelNode>,
    rootNode: TreeModelNode | TreeModelRootNode,
    result: Array<TreeModelNode | TreeModelNodePlaceholder> = [],
  ): Array<TreeModelNode | TreeModelNodePlaceholder> {
    const children = tree.getChildren(rootNode.id);
    if (!children) {
      return result;
    }

    let index = 0;
    for (const childId of children) {
      if (childId === undefined) {
        result.push({ parentId: rootNode.id, depth: rootNode.depth + 1, childIndex: index });
      } else {
        const childNode = tree.getNode(childId);
        if (childNode === undefined) {
          // node was disposed
          result.push({ parentId: rootNode.id, depth: rootNode.depth + 1, childIndex: index });
        } else {
          result.push(childNode);
          if (childNode.isExpanded && childNode.numChildren !== undefined) {
            MutableTreeModel.getVisibleDescendants(tree, childNode, result);
          }
        }
      }

      ++index;
    }

    return result;
  }
}
