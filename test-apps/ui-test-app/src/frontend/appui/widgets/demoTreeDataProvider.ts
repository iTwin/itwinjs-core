/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { TreeNodeItem, TreeDataProvider, MutableTreeDataProvider, TreeDataChangeEvent } from "@bentley/ui-components";
import { DropTargetArguments, DragSourceArguments, DropStatus, DropEffects } from "@bentley/ui-components";

const data: DemoMutableNode[] = [
  {
    label: "Root 1", id: "66640415289992", type: "root", description: "First root node", iconPath: "icon-clipboard-cut",
    children: [
      { label: "Child 1.1", id: "14056415405179", type: "child", description: "First child node to first root node.", parentId: "66640415289992", iconPath: "icon-parallel-move" },
      { label: "Child 1.2", id: "13613905720638", type: "child", description: "Second child node to first root node.", parentId: "66640415289992", iconPath: "icon-phone" },
      { label: "Child 1.3", id: "37567272482330", type: "child", description: "Third child node to first root node.", parentId: "66640415289992", iconPath: "icon-technical-preview-bw" },
      { label: "Child 1.4", id: "76545451605244", type: "child", description: "Fourth child node to first root node.", parentId: "66640415289992", iconPath: "icon-records" },
      { label: "Child 1.5", id: "59874551327032", type: "child", description: "Fifth child node to first root node.", parentId: "66640415289992", iconPath: "icon-share" },
    ],
  }, {
    label: "Root 2", id: "66097988616707", type: "root", description: "Second root node", iconPath: "icon-file-types-xls",
    children: [
      { label: "Child 2.1", id: "50938067331247", type: "child", description: "First child node to second root node.", parentId: "66097988616707", iconPath: "icon-slice" },
      { label: "Child 2.2", id: "48370230776108", type: "child", description: "Second child node to second root node.", parentId: "66097988616707", iconPath: "icon-deliverable" },
      {
        label: "Child 2.3", id: "91325646187787", type: "child", description: "Third child node to second root node.", parentId: "66097988616707", iconPath: "icon-chat-2",
        children: [
          { label: "Child 2.3.1", id: "1199839571660", type: "child", description: "First child node to third child node of first root node.", parentId: "91325646187787", iconPath: "icon-checkmark" },
        ],
      },
      { label: "Child 2.4", id: "17293005347680", type: "child", description: "Fourth child node to second root node.", parentId: "66097988616707", iconPath: "icon-attach" },
      { label: "Child 2.5", id: "13263543111312", type: "child", description: "Fifth child node to second root node.", parentId: "66097988616707", iconPath: "icon-basket" },
    ],
  },
];

interface DemoMutableNode {
  label: string;
  id: string;
  type: string;
  description: string;
  parentId?: string;
  iconPath?: string;
  children?: DemoMutableNode[];
}

function DemoNodeToTreeNodeItem(node: DemoMutableNode): TreeNodeItem {
  const { label, id, description, type, parentId, children, iconPath } = node;
  const extendedData = { id, label, description, type, children, parentId, iconPath };
  const hasChildren = node.children !== undefined && node.children.length > 0;
  return { label, id, description, extendedData, parentId, hasChildren, iconPath };
}

function TreeNodeItemToDemoNode(node: TreeNodeItem): DemoMutableNode {
  const n = getNodeById(data, node.id);
  if (n) return n;

  const { label, id, description, parentId, hasChildren, extendedData, iconPath } = node;
  const type = ("type" in extendedData && extendedData.type) || "";
  const o = { label, id, type, description, parentId, iconPath };
  if (hasChildren) {
    const children = ("children" in extendedData && extendedData.children) || [];
    return { ...o, children };
  } else return o;
}

function getNodeById(nodes: DemoMutableNode | DemoMutableNode[], id: string): DemoMutableNode | undefined {
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

function getNodeIndexById(nodes: DemoMutableNode | DemoMutableNode[], id: string): number {
  if (!("length" in nodes)) {
    const parent = nodes;
    if (parent.children) {
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < parent.children.length; i++) {
        if (parent.children[i].id === id) {
          return i;
        }
      }
    }
  } else {
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) {
        return i;
      }
    }
  }
  return -1;
}

const treeDataChangeEvent = new TreeDataChangeEvent();

export const demoMutableTreeDataProvider: TreeDataProvider & MutableTreeDataProvider = {
  onTreeNodeChanged: treeDataChangeEvent,
  getRootNodes: async (_pageOptions: any): Promise<TreeNodeItem[]> => {
    return data.map((node: any) => {
      return DemoNodeToTreeNodeItem(node);
    });
    return [];
  },
  getRootNodesCount: async (): Promise<number> => {
    return data.length;
  },
  getChildNodes: async (parent: TreeNodeItem, _pageOptions: any): Promise<TreeNodeItem[]> => {
    const n = getNodeById(data, parent.id);
    if (n && n.children)
      return n.children.map((c: DemoMutableNode) => {
        return DemoNodeToTreeNodeItem(c);
      });
    return [];
  },
  getChildNodesCount: async (parent: TreeNodeItem): Promise<number> => {
    const n = getNodeById(data, parent.id);
    if (n && n.children)
      return n.children.length;
    return 0;
  },
  addRootNode: (rootNode: TreeNodeItem): void => {
    const rn = TreeNodeItemToDemoNode(rootNode);
    rn.parentId = undefined;
    data.push(rn);
    treeDataChangeEvent.raiseEvent();
  },
  insertRootNode: (rootNode: TreeNodeItem, index: number): void => {
    const rn = TreeNodeItemToDemoNode(rootNode);
    rn.parentId = undefined;
    data.splice(index, 0, rn);
    treeDataChangeEvent.raiseEvent();
  },
  removeRootNode: (rootNode: TreeNodeItem): void => {
    const n = getNodeIndexById(data, rootNode.id);
    if (n !== -1) {
      data.splice(n, 1);
      treeDataChangeEvent.raiseEvent();
    }
  },
  moveRootNode: (rootNode: TreeNodeItem, newIndex: number): void => {
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < data.length; i++) {
      const node = data[i];
      if (node.id === rootNode.id) {
        data.splice(newIndex, 0, node);
        if (newIndex < i) i++;
        data.splice(i, 1);
        treeDataChangeEvent.raiseEvent();
        return;
      }
    }
  },
  addChildNode: (parent: TreeNodeItem, child: TreeNodeItem): void => {
    const p = getNodeById(data, parent.id);

    if (p) {
      if (!p.children) p.children = [];
      const cn = TreeNodeItemToDemoNode(child);
      cn.parentId = p.id;
      p.children.push(cn);
      treeDataChangeEvent.raiseEvent();
      return;
    }
  },
  insertChildNode: (parent: TreeNodeItem, child: TreeNodeItem, index: number): void => {
    const p = getNodeById(data, parent.id);
    if (p) {
      if (!p.children) p.children = [];
      const cn = TreeNodeItemToDemoNode(child);
      cn.parentId = p.id;
      p.children.splice(index, 0, cn);
      treeDataChangeEvent.raiseEvent();
      return;
    }
  },
  removeChildNode: (parent: TreeNodeItem, child: TreeNodeItem): void => {
    const p = getNodeById(data, parent.id);
    if (p && p.children) {
      const n = getNodeIndexById(p, child.id);
      if (n !== -1) {
        p.children.splice(n, 1);
        treeDataChangeEvent.raiseEvent();
        return;
      }
    }
  },
  moveChildNode: (parent: TreeNodeItem, child: TreeNodeItem, newIndex: number): void => {
    const p = getNodeById(data, parent.id);
    if (p && p.children) {
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < p.children.length; i++) {
        const n = p.children[i];
        if (n.id === child.id) {
          p.children.splice(newIndex, 0, n);
          if (newIndex < i) i++;
          p.children.splice(i, 1);
          treeDataChangeEvent.raiseEvent();
          return;
        }
      }
    }
  },
  isDescendent: (parent: TreeNodeItem, nodeItem: TreeNodeItem): boolean => {
    if (parent.id === nodeItem.id)
      return true;
    const p = getNodeById(data, parent.id);
    if (p && p.children) {
      const c = getNodeById(p, nodeItem.id);
      if (c) return true;
    }
    return false;
  },
  getRootNodeIndex: (rootNode: TreeNodeItem): number => {
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < data.length; i++) {
      if (data[i].id === rootNode.id) {
        return i;
      }
    }
    return -1;
  },
  getChildNodeIndex: (parent: TreeNodeItem, child: TreeNodeItem): number => {
    const p = getNodeById(data, parent.id);
    if (p && p.children) {
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < p.children.length; i++) {
        if (p.children[i].id === child.id) {
          return i;
        }
      }
    }
    return -1;
  },
};
export const treeDropTargetDropCallback = (args: DropTargetArguments): DropTargetArguments => {
  // Ensure all important properties exist on dataObject
  if (args.dataObject && "id" in args.dataObject && "label" in args.dataObject && "description" in args.dataObject) {
    const { label, description, parentId, ...rest } = args.dataObject;
    let children;
    if ("children" in args.dataObject) children = args.dataObject.children;

    let id = "";
    if (args.dropEffect === DropEffects.Copy) {
      id = Math.round(Math.random() * 1e14) + ""; // Copy means new ID, don't delete old.
    } else if ("id" in args.dataObject && args.dataObject.id !== undefined) {
      id = args.dataObject.id; // Link means keep ID and old node, Move means keep ID and delete old node.
    }
    const dragNode: TreeNodeItem = {
      ...rest,
      id, label, description,
      hasChildren: children !== undefined && "length" in children && children.length > 0,
      extendedData: { ...args.dataObject },
      parentId: typeof parentId === "string" ? undefined : parentId,
    };
    if (args.dropLocation) {
      if ("id" in args.dropLocation) {
        const dropNode = args.dropLocation as TreeNodeItem;
        const exists = demoMutableTreeDataProvider.getChildNodeIndex(dropNode, dragNode) !== -1;
        if (!demoMutableTreeDataProvider.isDescendent(dragNode, dropNode)) {
          if (args.row !== undefined) {
            if (exists && parentId === args.dropLocation.id && args.dropEffect === DropEffects.Move) {
              demoMutableTreeDataProvider.moveChildNode(dropNode, dragNode, args.row);
              args.dropStatus = DropStatus.Drop;
              args.local = true;
            } else if (!exists) {
              demoMutableTreeDataProvider.insertChildNode(dropNode, dragNode, args.row);
              args.dropStatus = DropStatus.Drop;
            }
          } else if (!exists && (parentId !== args.dropLocation.id || args.dropEffect === DropEffects.Copy)) {
            demoMutableTreeDataProvider.addChildNode(dropNode, dragNode);
            args.dropStatus = DropStatus.Drop;
          }
        }
      } else { // "id" field in dropLocation, must be root/dataProvider
        const treeId = args.dropLocation;
        const exists = demoMutableTreeDataProvider.getRootNodeIndex(dragNode) !== -1;
        if (args.row !== undefined) {
          if (exists && parentId === treeId && args.dropEffect === DropEffects.Move) {
            demoMutableTreeDataProvider.moveRootNode(dragNode, args.row);
            args.dropStatus = DropStatus.Drop;
            args.local = true;
          } else if (!exists) {
            demoMutableTreeDataProvider.insertRootNode(dragNode, args.row);
            args.dropStatus = DropStatus.Drop;
          }
        } else if (!exists && (parentId !== treeId || args.dropEffect === DropEffects.Copy)) {
          demoMutableTreeDataProvider.addRootNode(dragNode);
          args.dropStatus = DropStatus.Drop;
        }
      }
    }
  }
  return args;
};
export const treeDragSourceEndCallback = (args: DragSourceArguments) => {
  if (args.dataObject) {
    const { id, label, description } = args.dataObject;
    const dragNode: TreeNodeItem = {
      id, label, description,
      extendedData: { ...args.dataObject },
      hasChildren: false,
    };
    if (args.dropStatus === DropStatus.Drop && args.dropEffect === DropEffects.Move && !args.local) {
      if ("id" in args.parentObject) {
        demoMutableTreeDataProvider.removeChildNode(args.parentObject, dragNode);
      } else { // no parent object, must be root.
        demoMutableTreeDataProvider.removeRootNode(dragNode);
      }
    }
  }
};

export const treeCanDropTargetDropCallback = (args: DropTargetArguments) => {
  // Ensure all important properties exist on dataObject
  if (args.dataObject && "id" in args.dataObject && "label" in args.dataObject && "description" in args.dataObject) {
    const { label, description, parentId } = args.dataObject;
    let id = "";
    if (args.dropEffect === DropEffects.Copy) {
      id = Math.round(Math.random() * 1e14) + ""; // Copy means new ID, don't delete old.
    } else if ("id" in args.dataObject && args.dataObject.id !== undefined) {
      id = args.dataObject.id; // Link means keep ID and old node, Move means keep ID and delete old node.
    }
    const dragNode: TreeNodeItem = {
      id, label, description,
      extendedData: { ...args.dataObject },
      hasChildren: false,
    };
    if (args.dropLocation) {
      if ("id" in args.dropLocation) {
        const dropNode = args.dropLocation as TreeNodeItem;
        const exists = demoMutableTreeDataProvider.getChildNodeIndex(dropNode, dragNode) !== -1;
        if (!demoMutableTreeDataProvider.isDescendent(dragNode, dropNode)) {
          if (args.row !== undefined) {
            if (exists && parentId === args.dropLocation.id && args.dropEffect === DropEffects.Move) {
              return true;
            } else if (!exists) {
              return true;
            }
          } else if (!exists && parentId !== args.dropLocation.id) {
            return true;
          }
        }
      } else { // "id" field in dropLocation, must be root/dataProvider
        const treeId = args.dropLocation;
        const exists = demoMutableTreeDataProvider.getRootNodeIndex(dragNode) !== -1;
        if (args.row !== undefined) {
          if (exists && parentId === treeId && args.dropEffect === DropEffects.Move) {
            return true;
          } else if (!exists) {
            return true;
          }
        } else if (!exists && parentId !== treeId) {
          return true;
        }
      }
    }
  }
  return false;
};
