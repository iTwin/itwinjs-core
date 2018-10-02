/*---------------------------------------------------------------------------------------------
 | $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, TreeDataChangeEvent, PageOptions, TreeNodeItem } from "../../src/index";

interface MockTreeNodeItem extends TreeNodeItem {
  children?: MockTreeNodeItem[];
}

const data: MockTreeNodeItem[] = [
  {
    label: "Root 1", id: "66640415289992", description: "First root node", iconPath: "icon-clipboard-cut", hasChildren: true,
    children: [
      { label: "Child 1.1", id: "14056415405179", description: "First child node to first root node.", parentId: "66640415289992", iconPath: "icon-parallel-move", hasChildren: false },
      { label: "Child 1.2", id: "13613905720638", description: "Second child node to first root node.", parentId: "66640415289992", iconPath: "icon-phone", hasChildren: false },
      { label: "Child 1.3", id: "37567272482330", description: "Third child node to first root node.", parentId: "66640415289992", iconPath: "icon-technical-preview-bw", hasChildren: false },
      { label: "Child 1.4", id: "76545451605244", description: "Fourth child node to first root node.", parentId: "66640415289992", iconPath: "icon-records", hasChildren: false },
      { label: "Child 1.5", id: "59874551327032", description: "Fifth child node to first root node.", parentId: "66640415289992", iconPath: "icon-share", hasChildren: false },
    ],
  }, {
    label: "Root 2", id: "66097988616707", description: "Second root node", iconPath: "icon-file-types-xls", hasChildren: true,
    children: [
      { label: "Child 2.1", id: "50938067331247", description: "First child node to second root node.", parentId: "66097988616707", iconPath: "icon-slice", hasChildren: false },
      { label: "Child 2.2", id: "48370230776108", description: "Second child node to second root node.", parentId: "66097988616707", iconPath: "icon-deliverable", hasChildren: false },
      {
        label: "Child 2.3", id: "91325646187787", description: "Third child node to second root node.", parentId: "66097988616707", iconPath: "icon-chat-2", hasChildren: true,
        children: [
          { label: "Child 2.3.1", id: "1199839571660", description: "First child node to third child node of first root node.", parentId: "91325646187787", iconPath: "icon-checkmark", hasChildren: false },
        ],
      },
      { label: "Child 2.4", id: "17293005347680", description: "Fourth child node to second root node.", parentId: "66097988616707", iconPath: "icon-attach", hasChildren: false },
      { label: "Child 2.5", id: "13263543111312", description: "Fifth child node to second root node.", parentId: "66097988616707", iconPath: "icon-basket", hasChildren: false },
    ],
  },
];

function getNodeById(nodes: MockTreeNodeItem | MockTreeNodeItem[], id: string): MockTreeNodeItem | undefined {
  if (!("length" in nodes)) {
    nodes = [nodes];
  }
  for (const node of nodes) {
    if (node.id === id)
      return node;
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const n = getNodeById(child, id);
        if (n) return n;
      }
    }
  }
  return undefined;
}

const treeDataChangeEvent = new TreeDataChangeEvent();

export const mockTreeDataProvider: TreeDataProvider = {
  onTreeNodeChanged: treeDataChangeEvent,
  getRootNodes: async (_pageOptions: PageOptions): Promise<TreeNodeItem[]> => {
    return data.map((node: any) => {
      return node;
    });
    return [];
  },
  getRootNodesCount: async (): Promise<number> => {
    return data.length;
  },
  getChildNodes: async (parent: TreeNodeItem, _pageOptions: PageOptions): Promise<TreeNodeItem[]> => {
    const n = getNodeById(data, parent.id);
    if (n && n.children)
      return n.children.map((c: TreeNodeItem) => {
        return c;
      });
    return [];
  },
  getChildNodesCount: async (parent: TreeNodeItem): Promise<number> => {
    const n = getNodeById(data, parent.id);
    if (n && n.children)
      return n.children.length;
    return 0;
  },
};
