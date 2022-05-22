/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeEvent } from "@itwin/core-bentley";
import { PropertyRecord } from "@itwin/appui-abstract";
import { DelayLoadedTreeNodeItem, MutableTreeDataProvider, PageOptions, TreeDataChangesListener, TreeNodeItem } from "@itwin/components-react";

export enum TreeDragTypes {
  Parent = "parent",
  Child = "child",
}

export let dataProviderRaw: DelayLoadedTreeNodeItem[] = [ // eslint-disable-line prefer-const
  {
    label: PropertyRecord.fromString("Root 1"), id: "66640415289992", description: "First root node", icon: "icon-placeholder", hasChildren: true,
    extendedData: {
      type: TreeDragTypes.Parent,
      children: [
        { label: PropertyRecord.fromString("Child 1.1"), id: "14056415405179", extendedData: { type: TreeDragTypes.Child }, description: "First child node to first root node.", parentId: "66640415289992", icon: "icon-placeholder" },
        { label: PropertyRecord.fromString("Child 1.2"), id: "13613905720638", extendedData: { type: TreeDragTypes.Child }, description: "Second child node to first root node.", parentId: "66640415289992", icon: "icon-placeholder" },
        { label: PropertyRecord.fromString("Child 1.3"), id: "37567272482330", extendedData: { type: TreeDragTypes.Child }, description: "Third child node to first root node.", parentId: "66640415289992", icon: "icon-placeholder" },
        { label: PropertyRecord.fromString("Child 1.4"), id: "76545451605244", extendedData: { type: TreeDragTypes.Child }, description: "Fourth child node to first root node.", parentId: "66640415289992", icon: "icon-placeholder" },
        { label: PropertyRecord.fromString("Child 1.5"), id: "59874551327032", extendedData: { type: TreeDragTypes.Child }, description: "Fifth child node to first root node.", parentId: "66640415289992", icon: "icon-placeholder" },
      ] as DelayLoadedTreeNodeItem[],
    },
  }, {
    label: PropertyRecord.fromString("Root 2"), id: "66097988616707", description: "Second root node", icon: "icon-placeholder", hasChildren: true,
    extendedData: {
      type: TreeDragTypes.Parent,
      children: [
        { label: PropertyRecord.fromString("Child 2.1"), id: "50938067331247", extendedData: { type: TreeDragTypes.Child }, description: "First child node to second root node.", parentId: "66097988616707", icon: "icon-placeholder" },
        { label: PropertyRecord.fromString("Child 2.2"), id: "48370230776108", extendedData: { type: TreeDragTypes.Child }, description: "Second child node to second root node.", parentId: "66097988616707", icon: "icon-placeholder" },
        {
          label: PropertyRecord.fromString("Child 2.3"), id: "91325646187787", description: "Third child node to second root node.", parentId: "66097988616707", icon: "icon-placeholder", hasChildren: true,
          extendedData: {
            type: TreeDragTypes.Child,
            children: [
              { label: PropertyRecord.fromString("Child 2.3.1"), id: "1199839571660", extendedData: { type: TreeDragTypes.Child }, description: "First child node to third child node of first root node.", parentId: "91325646187787", icon: "icon-placeholder" },
            ] as DelayLoadedTreeNodeItem[],
          },
        } as DelayLoadedTreeNodeItem,
        { label: PropertyRecord.fromString("Child 2.4"), id: "17293005347680", extendedData: { type: TreeDragTypes.Child }, description: "Fourth child node to second root node.", parentId: "66097988616707", icon: "icon-placeholder" },
        { label: PropertyRecord.fromString("Child 2.5"), id: "13263543111312", extendedData: { type: TreeDragTypes.Child }, description: "Fifth child node to second root node.", parentId: "66097988616707", icon: "icon-placeholder" },
      ] as DelayLoadedTreeNodeItem[],
    },
  },
];

// eslint-disable-next-line deprecation/deprecation
export class DemoMutableTreeDataProvider implements MutableTreeDataProvider {
  public onTreeNodeChanged = new BeEvent<TreeDataChangesListener>();
  private _data: DelayLoadedTreeNodeItem[];
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
      let parentsParent: DelayLoadedTreeNodeItem | undefined;
      if (newIndex !== -1) {
        toNodes.splice(newIndex, 0, node);
      } else {
        toNodes.push(node);
      }
      const arr = [];
      if (newParent) {
        const np = newParent as DelayLoadedTreeNodeItem;
        if (!np.hasChildren) {
          np.hasChildren = true;
          if (np.parentId) {
            const p = this._getNodeById(this._data, np.parentId);
            parentsParent = p;
            arr.push(parentsParent);
          }
        }
      }
      if (newParent === parent)
        arr.push(parent);
      else {
        if (!this.isDescendent(newParent, parent) && (!parentsParent || !this.isDescendent(parentsParent)))
          arr.push(parent);
        if (!this.isDescendent(parent, newParent) && !parentsParent)
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

export const demoMutableTreeDataProvider = new DemoMutableTreeDataProvider(dataProviderRaw);
