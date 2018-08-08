/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Breadcrumb */

import { TreeNodeItem } from "../tree";

/** Union of both root and node objects */
export type BreadcrumbItem = BreadcrumbRoot | BreadcrumbNode;

/** Root node; may have multiple children loaded from getRootNodes, in cases where dataProvider loads multiple root nodes */
export class BreadcrumbRoot {
  public dataProvider: any;
  public icon: string | undefined;
  public delimiter: string;
  public hasChildren: boolean = false;

  /**
   * @param dataProvider TreeDataProvider object or ECTreeDataProvider
   * @param icon optional override of root icon. Default: "icon-browse"
   * @param delimiter character used to delimit path levels. Default: "\\"
   */
  constructor(dataProvider: any, icon: string = "icon-browse", delimiter: string = "\\") {
    this.dataProvider = dataProvider;
    this.icon = icon;
    this.delimiter = delimiter;
    this.loadRoot().then((nodes) => {
      if (nodes.length > 0)
        this.hasChildren = true;
      else
        this.hasChildren = false;
    });
  }

  /** load root nodes from dataProvider */
  public loadRoot = async () => {
    if (!this.dataProvider)
      return [];
    if (!this.dataProvider.getRootNodes)
      return [];
    const treeNodes = await this.dataProvider.getRootNodes({ size: 9999, start: 0 });
    return treeNodes.map((n: TreeNodeItem) => this.treeNodeToBreadcrumbNode(n, this));
  }

  /** load children of node from dataProvider */
  public loadChildren = async (node: BreadcrumbNode) => {
    if (!this.dataProvider)
      return [];
    if (!this.dataProvider.getChildNodes)
      return [];
    const treeNodes = await this.dataProvider.getChildNodes(node._treeNode, { size: 9999, start: 0 });
    return treeNodes.map((n: TreeNodeItem) => this.treeNodeToBreadcrumbNode(n, node));
  }

  private treeNodeToBreadcrumbNode(node: TreeNodeItem, parent: BreadcrumbItem): BreadcrumbNode {
    return new BreadcrumbNode(node, node.label, node.hasChildren, parent, node.iconPath);
  }

  /**
   * Traverses tree to find path to target
   * @param target BreadcrumbItem to find the path to
   * @returns Promise object representing List of BreadcrumbItems between root and target.
   */
  public async pathTo(target: BreadcrumbItem): Promise<BreadcrumbItem[]> {
    const path = await this.path(target, this);
    if (path)
      return path;
    else
      return [this];
  }

  private path = async (target: BreadcrumbItem, tree: BreadcrumbItem): Promise<BreadcrumbItem[] | undefined> => {
    if (tree.equals(target)) {
      return [tree];
    }
    if (!tree.equals(this) && !tree.hasChildren)
      return undefined;

    let children: BreadcrumbNode[];
    if (tree.equals(this))
      children = await this.loadRoot();
    else
      children = await this.loadChildren(tree as BreadcrumbNode);

    for (const child of children) {
      const path = await this.path(target, child);
      if (path) {
        return [tree, ...path];
      }
    }
    return undefined;
  }

  /**
   * escape strings for Regexp
   * Adapted from https://stackoverflow.com/a/6969486
   * @param str raw input
   * @returns escaped output
   */
  private escapeRegExp = (str: string) => str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");

  /**
   * finds node given a path
   * @param path Path to node
   * @returns Promise object with BreadcrumbItem object of node if found, undefined if not found.
   */
  public findChild = async (path: string): Promise<BreadcrumbItem | undefined> => {
    // remove padding whitespace
    const delimiter = this.escapeRegExp((this.delimiter!));
    // remove trailing delimiter with optional whitespace padding
    path = path.replace(new RegExp("\\s*" + delimiter + "\\s*$"), "");
    if (path.length === 0)
      return this;
    const root = await this.loadRoot();
    for (const tree of root) {
      const node = await this.find(tree, path, delimiter);
      if (node)
        return node;
    }
    return undefined;
  }

  private find = async (node: BreadcrumbNode, path: string, delimiter: string): Promise<BreadcrumbNode | undefined> => {
    // remove leading delimiter with optional whitespace padding
    path = path.replace(new RegExp("^\\s*" + delimiter + "\\s*"), "");

    // remove leading whitespace
    const label = node.label.replace(/^\s+/, "");
    if (label === path) {
      return node;
    }
    if (path.indexOf(label) === 0 && node.hasChildren) {
      const children = await this.loadChildren(node);
      for (const child of children) {
        const n = await this.find(child, path.substr(label.length), this.delimiter);
        if (n)
          return n;
      }
    }
    return undefined;
  }

  /**
   * finds all matches in given path. much like the windows 'dir' or linux 'ls' commands.
   * also finds list of Breadcrumb Items
   * @param path Path to search in.
   * @param hasChildren filters items in given path to be only parent nodes. ie. only objects with hasChildren = true
   * @returns Promise object representing tuple containing both BreadcrumbNode items in given path, and list of BreadcrumbItems to the path
   */
  public findMatches = async (path: string, hasChildren: boolean = false): Promise<{ items: BreadcrumbNode[], list: BreadcrumbItem[] }> => {
    let items: BreadcrumbNode[] = [];
    let list: BreadcrumbItem[] = [];
    if (path.length === 0) {
      items = await this.loadRoot();
      list = [this];
    } else {
      const delimiter = this.escapeRegExp((this.delimiter!));
      const mat = path.match(new RegExp("\\s*(.*)\\s*" + delimiter + "\\s*(.*?)$"));

      let node: BreadcrumbItem | undefined = this;
      if (mat) {
        const n = await this.findChild(mat[1]);
        if (!n)
          node = undefined;
        else {
          node = n;
          list = await this.pathTo(n);
        }
      }
      if (node && node.hasChildren) {
        let children: BreadcrumbNode[];
        if (node.equals(this))
          children = await this.loadRoot();
        else
          children = await this.loadChildren(node as BreadcrumbNode);
        let name = path;
        if (mat) {
          name = mat[2];
        }
        if (name.length === 0) {
          items = children;
        } else {
          for (const tree of children) {
            if (tree.label.substr(0, name.length) === name) {
              items.push(tree);
            }
          }
        }
      }
    }
    if (hasChildren)
      return { items: items.filter((child) => child.hasChildren), list };
    else
      return { items, list };
  }

  /**
   * recieves list of BreadcrumbItems and assembles their labels into a path string
   * @param pathList list of BreadcrumbItems to stringify
   * @returns path string
   */
  public nodeListToString = (pathList: BreadcrumbItem[]): string => {
    const path: string[] = [];
    if (pathList.length === 0)
      return "";
    for (const item of pathList) {
      if (item && "label" in item)
        path.push(item.label);
    }
    return path.join(this.delimiter!);
  }

  public equals = (that: BreadcrumbItem): boolean => {
    return that instanceof BreadcrumbRoot && !("_treeNode" in that) && this.delimiter === that.delimiter;
  }
}

/** child node of BreadcrumbRoot */
export class BreadcrumbNode {
  public _treeNode: TreeNodeItem;
  public parent: BreadcrumbItem;
  public icon: string | undefined;
  public label: string;
  public hasChildren: boolean;

  constructor(treeNode: TreeNodeItem, label: string, hasChildren: boolean, parent: BreadcrumbItem, icon?: string) {
    this._treeNode = treeNode;
    this.label = label;
    this.hasChildren = hasChildren;
    this.parent = parent;
    this.icon = icon;
  }

  public equals = (that: BreadcrumbItem) => {
    return that instanceof BreadcrumbNode && this._treeNode.id === that._treeNode.id && this.label === that.label && this.icon === that.icon;
  }
}
