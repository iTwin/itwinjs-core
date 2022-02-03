/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeEvent } from "@itwin/core-bentley";
import { PropertyRecord } from "@itwin/appui-abstract";
import type {
  DelayLoadedTreeNodeItem, ImmediatelyLoadedTreeNodeItem, ITreeDataProvider, PageOptions, TreeDataChangesListener, TreeNodeItem,
} from "../../components-react";

/** @internal */
export enum TreeDragTypes {
  Root = "root",
  Child = "child",
}

/** @internal */
export interface DemoDragDropObject {
  id: string;
  label: string;
  icon: string;
  type: string;
  description: string;
  children?: DelayLoadedTreeNodeItem[];
  parentId: string;
}

export let dataProviderRaw: DelayLoadedTreeNodeItem[] = [ // eslint-disable-line prefer-const
  {
    label: PropertyRecord.fromString("Interface Node 1"), id: "1", description: "First root node", icon: "icon-clipboard-cut", hasChildren: true,
    extendedData: {
      type: TreeDragTypes.Root,
      children: [
        { label: PropertyRecord.fromString("Interface Node 1.1"), id: "1.1", extendedData: { type: TreeDragTypes.Child }, description: "First child node to first root node.", parentId: "1", icon: "icon-parallel-move" },
        { label: PropertyRecord.fromString("Interface Node 1.2"), id: "1.2", extendedData: { type: TreeDragTypes.Child }, description: "Fifth child node to first root node.", parentId: "1", icon: "icon-share" },
      ],
    },
  }, {
    label: PropertyRecord.fromString("Interface Node 2"), id: "2", description: "Second root node", icon: "icon-file-types-xls", hasChildren: true,
    extendedData: {
      type: TreeDragTypes.Root,
      children: [
        { label: PropertyRecord.fromString("Interface Node 2.1"), id: "2.1", extendedData: { type: TreeDragTypes.Child }, description: "First child node to second root node.", parentId: "2", icon: "icon-slice" },
        {
          label: PropertyRecord.fromString("Interface Node 2.2"), id: "2.2", description: "Third child node to second root node.", parentId: "2", icon: "icon-chat-2", hasChildren: true,
          extendedData: {
            type: TreeDragTypes.Child,
            children: [
              { label: PropertyRecord.fromString("Interface Node 2.2.1"), id: "2.2.1", extendedData: { type: TreeDragTypes.Child }, description: "First child node to second child node of second root node.", parentId: "2.2", icon: "icon-checkmark" },
            ],
          },
        } as DelayLoadedTreeNodeItem,
        { label: PropertyRecord.fromString("Interface Node 2.5"), id: "2.5", extendedData: { type: TreeDragTypes.Child }, description: "Fifth child node to second root node.", parentId: "2", icon: "icon-basket" },
      ],
    },
  },
];

/** @internal */
export class DemoITreeDataProvider implements ITreeDataProvider {
  public onTreeNodeChanged = new BeEvent<TreeDataChangesListener>();
  protected _data: DelayLoadedTreeNodeItem[];
  constructor(data: DelayLoadedTreeNodeItem[]) {
    this._data = data;
  }
  public getNodes = async (parent?: TreeNodeItem, pageOptions?: PageOptions): Promise<TreeNodeItem[]> => {
    let start = 0;
    let end: number | undefined;
    if (pageOptions !== undefined) {
      if (pageOptions.start !== undefined)
        start = pageOptions.start;
      if (pageOptions.size !== undefined)
        end = start + pageOptions.size;
    }
    if (parent) {
      if (parent && parent.extendedData && parent.extendedData.children)
        return parent.extendedData.children.slice(start, end);
      return [];
    }
    return this._data.slice(start, end);
  };

  public getNodesCount = async (parent?: TreeNodeItem): Promise<number> => {
    if (parent) {
      if (parent && parent.extendedData && parent.extendedData.children)
        return parent.extendedData.children.length;
      return 0;
    }
    return this._data.length;
  };
}

/** @internal */
export class DemoMutableITreeDataProvider extends DemoITreeDataProvider {
  public insertNode = (parent: TreeNodeItem | undefined, child: TreeNodeItem, index: number = -1): void => {
    let nodes = this._data;
    if (parent) {
      if (!parent.extendedData) parent.extendedData = {};
      if (!parent.extendedData.children) parent.extendedData.children = [];
      nodes = parent.extendedData.children;
    }
    if (index !== -1)
      nodes.splice(index, 0, child);
    else
      nodes.push(child);
    if (parent) {
      const p = parent as DelayLoadedTreeNodeItem;
      p.hasChildren = true;
    }
    this.onTreeNodeChanged.raiseEvent([parent]);
  };

  public removeNode = (parent: TreeNodeItem | undefined, child: TreeNodeItem): void => {
    let nodes = this._data;
    if (parent) {
      if (!parent.extendedData || !parent.extendedData.children) return;
      nodes = parent.extendedData.children;
    }
    const idx = nodes.findIndex((e) => e.id === child.id);
    if (idx !== -1) {
      nodes.splice(idx, 1);
      if (parent && nodes.length === 0) {
        const p = parent as DelayLoadedTreeNodeItem;
        p.hasChildren = false;
      }
      this.onTreeNodeChanged.raiseEvent([parent]);
    }
  };

  public moveNode = (parent: TreeNodeItem | undefined, newParent: TreeNodeItem | undefined, child: TreeNodeItem, newIndex: number = -1): void => {
    let nodes = this._data;
    if (parent) {
      if (!parent.extendedData || !parent.extendedData.children) return;
      nodes = parent.extendedData.children;
    }
    let toNodes = this._data;
    if (newParent) {
      if (!newParent.extendedData) newParent.extendedData = {};
      if (!newParent.extendedData.children) newParent.extendedData.children = [];
      toNodes = newParent.extendedData.children;
    }
    const index = nodes.findIndex((e) => e.id === child.id);
    if (parent === newParent && index === newIndex)
      return;
    if (index !== -1) {
      const node = nodes.splice(index, 1)[0];
      if (parent && nodes.length === 0) {
        const p = parent as DelayLoadedTreeNodeItem;
        p.hasChildren = false;
      }
      if (newIndex !== -1) {
        toNodes.splice(newIndex, 0, node);
        if (newParent) {
          const np = newParent as DelayLoadedTreeNodeItem;
          np.hasChildren = true;
        }
      } else
        toNodes.push(node);
      const arr = [];
      if (newParent === parent)
        arr.push(parent);
      else {
        if (!this.isDescendent(newParent, parent))
          arr.push(parent);
        if (!this.isDescendent(parent, newParent))
          arr.push(newParent);
      }
      this.onTreeNodeChanged.raiseEvent(arr);
    }
  };

  private _getNodeById(nodes: DelayLoadedTreeNodeItem[] | DelayLoadedTreeNodeItem, id: string): DelayLoadedTreeNodeItem | undefined {
    if (!("length" in nodes)) {
      nodes = [nodes];
    }
    for (const node of nodes) {
      if (node.id === id)
        return node;
      if (node.extendedData && node.extendedData.children && node.extendedData.children.length > 0) {
        for (const child of node.extendedData.children) {
          const n = this._getNodeById(child, id);
          if (n) return n;
        }
      }
    }
    return undefined;
  }

  public isDescendent = (parent?: TreeNodeItem, nodeItem?: TreeNodeItem): boolean => {
    let c: DelayLoadedTreeNodeItem | undefined;
    if ((parent && !nodeItem) || (!parent && !nodeItem))
      return false;
    else if (!parent && nodeItem)
      c = this._getNodeById(this._data, nodeItem.id);
    else if (parent && nodeItem) {
      if (parent.id === nodeItem.id)
        return true;
      if (parent && parent.extendedData && parent.extendedData.children) {
        c = this._getNodeById(parent.extendedData.children, nodeItem.id);
      }
    }
    if (c) return true;
    return false;
  };
  public getNodeIndex = (parent: TreeNodeItem | undefined, node: TreeNodeItem): number => {
    let nodes = this._data;
    if (parent) {
      if (!parent.extendedData || !parent.extendedData.children) return -1;
      nodes = parent.extendedData.children;
    }
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === node.id) {
        return i;
      }
    }
    return -1;
  };
}

export const mockInterfaceTreeDataProvider = new DemoITreeDataProvider(dataProviderRaw);
export const mockMutableInterfaceTreeDataProvider = new DemoMutableITreeDataProvider(dataProviderRaw);

export const mockRawTreeDataProvider: ImmediatelyLoadedTreeNodeItem[] = [
  { label: PropertyRecord.fromString("Raw Node 1"), id: "1", description: "node 1 child" },
  {
    label: PropertyRecord.fromString("Raw Node 2"), id: "2", description: "node 2 child",
    children: [
      {
        label: PropertyRecord.fromString("Raw Node 2.1"), id: "2.1", parentId: "2", description: "node 2.1 child",
        children: [
          { label: PropertyRecord.fromString("Raw Node 2.1.1"), id: "2.1.1", parentId: "2.1", description: "node 2.1.1 child" },
        ] as ImmediatelyLoadedTreeNodeItem[],
      },
      { label: PropertyRecord.fromString("Raw Node 2.2"), id: "2.2", parentId: "2", description: "node 2.2 child" },
    ] as ImmediatelyLoadedTreeNodeItem[],
  },
  { label: PropertyRecord.fromString("Raw Node 3"), id: "3", description: "node 3 child" },
  { label: PropertyRecord.fromString("Raw Node 4"), id: "4", description: "node 4 child" },
];

export const mockRawTreeDataProvider2: ImmediatelyLoadedTreeNodeItem[] = [
  { label: PropertyRecord.fromString("Raw 2 Node 1"), id: "1", description: "node 1 child" },
  {
    label: PropertyRecord.fromString("Raw 2 Node 2"), id: "2", description: "node 2 child",
    children: [
      {
        label: PropertyRecord.fromString("Raw 2 Node 2.1"), id: "2.1", parentId: "2", description: "node 2.1 child",
        children: [
          { label: PropertyRecord.fromString("Raw 2 Node 2.1.1"), id: "2.1.1", description: "node 2.1.1 child" },
        ] as ImmediatelyLoadedTreeNodeItem[],
      },
    ] as ImmediatelyLoadedTreeNodeItem[],
  },
  { label: PropertyRecord.fromString("Raw 2 Node 3"), id: "3", description: "node 3 child" },
  { label: PropertyRecord.fromString("Raw 2 Node 4"), id: "4", description: "node 4 child" },
];
