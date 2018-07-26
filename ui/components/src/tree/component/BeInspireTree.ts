/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as InspireTreeTypes from "inspire-tree";

// note: a hack to get around invalid declarations file
// tslint:disable-next-line:variable-name
const InspireTree = InspireTreeTypes as any;

/** Interface for tree node data provided to the BeInspireTree */
export interface InspireTreeNodeData {
  id?: string;
  children?: InspireTreeTypes.TreeNodes | boolean;
  text?: string;
  icon?: string;
}

/** Array of tree node data elements */
export type DataProviderRaw = InspireTreeNodeData[];
/** A Promise for DataProviderRaw */
export type DataProviderPromise = Promise<DataProviderRaw>;
/** Signature for BeInspireTree data provider */
export type DataProviderMethod = (node: InspireTreeNode) => DataProviderPromise;

/** Type definition for all BeInspireTree nodes */
export type InspireTreeNode = InspireTreeTypes.TreeNode & InspireTreeNodeData;
/** Type definition for all BeInspireTree data providers */
export type InspireTreeDataProvider = DataProviderRaw | DataProviderPromise | DataProviderMethod;
/** Type definition for a BeInspireTree renderer */
export type InspireTreeRenderer = (rootNodes: InspireTreeNode[]) => void;

/** Signature for an InspireTreeNode predicate */
export type NodePredicate = (id: InspireTreeNode) => boolean;

/** Bentley wrapper for 'inspire-tree' */
export class BeInspireTree {
  private tree: InspireTreeTypes.InspireTree;
  private modelLoadedPromise: Promise<void>;

  constructor(dataProvider: InspireTreeDataProvider, renderer: InspireTreeRenderer) {
    this.tree = new InspireTree({
      data: dataProvider,
      selection: {
        multiple: true,
        // wip: expose other properties through props
      },
    } as InspireTreeTypes.Config);

    this.modelLoadedPromise = new Promise((resolve) => {
      this.tree.on(["model.loaded"], (nodes: InspireTreeNode[]) => { resolve(); this.prepareRootNodes(nodes); });
      this.tree.on(["changes.applied"], () => renderer(this.tree.nodes() as any));
    });
  }

  /**
   * Wraps InspireTreeNode.loadChildren so we save off the promise it returns.
   * This way, multiple calls to loadChildren for a single node will not result in duplicate nodes.
   */
  private async loadNodeChildren(n: InspireTreeNode): Promise<InspireTreeNode[]> {
    const node: InspireTreeNode & { _loadingPromise?: Promise<InspireTreeNode[]> } = n as any;

    if (node.children !== true) {
      return node.getChildren() as any;
    }

    if (!node._loadingPromise) {
      node._loadingPromise = node.loadChildren().then((data) => { delete node._loadingPromise; return data as any; });
    }

    return await node._loadingPromise;
  }

  /**
   * Wraps InspireTree.mute events are *added* to the list of currently muted events.
   * The default behavior of InspireTree.mute is that events *replaces* the list of currently muted events.
   */
  private mute(events: string[]) {
    if (typeof this.tree.muted() !== "boolean")
      this.tree.mute(events.concat(this.tree.muted() as any));
    else
      this.tree.mute(events);
  }

  /**
   * Wraps InspireTree.unmute (purely for consistency with this.mute).
   */
  private unmute(events: string[]) {
    this.tree.unmute(events);
  }

  private async prepareRootNodes(nodes: InspireTreeNode[]) {
    const shouldMute = !this.tree.isEventMuted("node.selected");
    const eventsToMute = shouldMute ? ["node.selected", "node.deselected", "node.expanded", "node.collapsed"] : [];
    this.mute(eventsToMute);

    const loadingPromises = nodes.map((n) => this.loadNodeChildren(n));
    await Promise.all(loadingPromises);

    this.unmute(eventsToMute);
  }

  private async ensureChildrenLoaded(branch: InspireTreeTypes.InspireTree, nodesToExpand: string[]): Promise<void> {
    const loadingPromises: Array<Promise<void>> = [];

    // We can't ensure that any children are loaded if the model isn't loaded yet...
    await this.modelLoadedPromise;

    const loadChildren = async (node: InspireTreeNode): Promise<void> => {
      const loaded = await this.loadNodeChildren(node) as any;
      await this.ensureChildrenLoaded(loaded, nodesToExpand);
    };

    const nodeNeedsToLoadChildren = (n: any) => (true === n.children);
    for (const node of branch.nodes(nodesToExpand).filterBy(nodeNeedsToLoadChildren)) {
      loadingPromises.push(loadChildren(node));
    }

    await Promise.all(loadingPromises);
  }

  public get expandedNodeIds(): string[] {
    return this.tree.expanded().map((n: InspireTreeNode) => n.id!);
  }

  public async updateExpansion(nodesToExpand: ReadonlyArray<string>, muteEvents = true): Promise<void> {
    const eventsToMute = (muteEvents) ? ["node.expanded", "node.collapsed"] : [];
    this.mute(eventsToMute);

    // Collapse (deeply) only the nodes that should not be expanded
    // If we just collapse everything, we'd see a "flicker" where the tree renders collapsed and then re-renders expanded
    this.tree.flatten((n: InspireTreeNode) => nodesToExpand.indexOf(n.id!) < 0).collapse();

    await this.ensureChildrenLoaded(this.tree, nodesToExpand as string[]);
    this.tree.nodes(nodesToExpand as string[]).expand();

    this.unmute(eventsToMute);
  }

  private static createSelectedNodePredicate(nodesToSelect?: string[] | NodePredicate): NodePredicate | undefined {
    if (!nodesToSelect)
      return undefined;

    let predicate: (node: InspireTreeNode) => boolean;
    if (typeof nodesToSelect === "function") {
      predicate = nodesToSelect;
    } else {
      predicate = (node: InspireTreeNode) => (-1 !== nodesToSelect.indexOf(node.id!));
    }
    return predicate;
  }

  private async updateSelection(selectFunc: (predicate: NodePredicate) => void, nodesToSelect: string[] | NodePredicate | undefined, muteEvents: boolean): Promise<void> {
    const predicate = BeInspireTree.createSelectedNodePredicate(nodesToSelect);
    if (!predicate)
      return;

    const eventsToMute = (muteEvents) ? ["node.selected", "node.deselected"] : [];
    this.mute(eventsToMute);
    this.tree.disableDeselection();
    selectFunc(predicate);
    this.tree.enableDeselection();
    this.unmute(eventsToMute);
  }

  public async updateTreeSelection(nodesToSelect?: string[] | NodePredicate, muteEvents = true): Promise<void> {
    const selectFunc = (predicate: NodePredicate) => {
      this.tree.deselectDeep();
      this.tree.flatten(predicate).select();
    };
    return this.updateSelection(selectFunc, nodesToSelect, muteEvents);
  }

  public async updateNodesSelection(nodes: InspireTreeNode[], nodesToSelect?: string[] | NodePredicate, muteEvents = true): Promise<void> {
    const selectFunc = (predicate: NodePredicate) => {
      nodes.filter((node) => predicate(node)).forEach((node) => node.select());
    };
    return this.updateSelection(selectFunc, nodesToSelect, muteEvents);
  }

  public reload() {
    return this.tree.reload();
  }

  public pauseRendering() {
    this.mute(["changes.applied"]);
  }

  public resumeRendering() {
    this.unmute(["changes.applied"]);
    this.tree.emit("changes.applied");
  }

  public on(event: string, listener: (...values: any[]) => void): this {
    this.tree.on(event, listener);
    return this;
  }

  public removeAllListeners(event?: string | string[]): void {
    this.tree.removeAllListeners(event);
  }

  public nodes(ids?: string[]): InspireTreeNode[] {
    return this.tree.nodes(ids) as any;
  }
}
