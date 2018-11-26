/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import InspireTree, * as Inspire from "inspire-tree";
import { IDisposable, using } from "@bentley/bentleyjs-core";

/**
 * Enum containing all events that may be emitted by [[BeInspireTree]]
 */
export enum BeInspireTreeEvent {
  ChangesApplied = "changes.applied",
  ChildrenLoaded = "children.loaded",
  DataLoaded = "data.loaded",
  DataLoadError = "data.loaderror",
  ModelLoaded = "model.loaded",
  NodeAdded = "node.added",
  NodeBlurred = "node.blurred",
  NodeChecked = "node.checked",
  NodeCollapsed = "node.collapsed",
  NodeDeselected = "node.deselected",
  NodeEdited = "node.edited",
  NodeExpanded = "node.expanded",
  NodeFocused = "node.focused",
  NodeHidden = "node.hidden",
  NodeMoved = "node.moved",
  NodePaginated = "node.paginated",
  NodeRemoved = "node.removed",
  NodeSelected = "node.selected",
  NodeShown = "node.shown",
  NodeUnchecked = "node.unchecked",
}

/** Be alias for Inspire.NodeConfig */
export type BeInspireTreeNodeConfig = Inspire.NodeConfig;

/**
 * Type definition for all BeInspireTree nodes
 */
export interface BeInspireTreeNode<TPayload> extends Inspire.TreeNode, BeInspireTreeNodeConfig {
  payload: TPayload;
  beInspireTree: BeInspireTree<TPayload>;
  isDirty(): boolean;
  setDirty(value: boolean): void;
}
/**
 * Definition of a list of [[BeInspireTreeNode]] with some additional filtering methods
 */
export interface BeInspireTreeNodes<TPayload> extends Array<BeInspireTreeNode<TPayload>> {
  node(id: string): BeInspireTreeNode<TPayload> | undefined;
  nodes(ids?: string[]): BeInspireTreeNodes<TPayload>;
  deepest(): BeInspireTreeNodes<TPayload>;
  flatten(): BeInspireTreeNodes<TPayload>;
  expanded(): BeInspireTreeNodes<TPayload>;
  collapsed(): BeInspireTreeNodes<TPayload>;
  selected(): BeInspireTreeNodes<TPayload>;
  visible(): BeInspireTreeNodes<TPayload>;
}

/** Array of tree node data elements */
export type BeInspireTreeDataProviderRaw<TPayload> = TPayload[];
/** A Promise for DataProviderRaw */
export type BeInspireTreeDataProviderPromise<TPayload> = Promise<BeInspireTreeDataProviderRaw<TPayload>>;
/** Signature for BeInspireTree data provider */
export type BeInspireTreeDataProviderMethod<TPayload> = (parent?: TPayload) => BeInspireTreeDataProviderPromise<TPayload>;
/** Signature for BeInspireTree data provider */
export interface BeInspireTreeDataProviderInterface<TPayload> {
  getNodesCount(parent?: TPayload): Promise<number>;
  getNodes(parent?: TPayload): BeInspireTreeDataProviderPromise<TPayload>;
}
/** Type definition for all BeInspireTree data providers */
export type BeInspireTreeDataProvider<TPayload> = BeInspireTreeDataProviderRaw<TPayload>
  | BeInspireTreeDataProviderPromise<TPayload>
  | BeInspireTreeDataProviderMethod<TPayload>
  | BeInspireTreeDataProviderInterface<TPayload>;

/** Type definition for a BeInspireTree renderer */
export type BeInspireTreeRenderer<TPayload> = (rootNodes: Array<BeInspireTreeNode<TPayload>>) => void;

/**
 * A context which keeps [[BeInspireTree]] events muted until
 * it gets disposed.
 */
export class EventsMuteContext implements IDisposable {

  private _triggeredEventsCount: number = 0;

  public constructor(
    private _events: BeInspireTreeEvent[],
    private _mute: (events: BeInspireTreeEvent[]) => void,
    private _unmute: (events: BeInspireTreeEvent[]) => boolean,
    private _emit?: (events: BeInspireTreeEvent[]) => void,
    private _listen?: (events: BeInspireTreeEvent[], listener: (...values: any[]) => void) => (() => void),
    allowedEventTriggersBeforeMute: number = 0) {
    this.init(allowedEventTriggersBeforeMute);
  }

  private init(allowedEventTriggersBeforeMute: number) {
    if (0 === allowedEventTriggersBeforeMute || !this._listen) {
      this._mute(this._events);
      return;
    }
    let stopListening: (() => void) | undefined;
    const callback = () => {
      if (++this._triggeredEventsCount >= allowedEventTriggersBeforeMute) {
        this._mute(this._events);
        stopListening!();
      }
    };
    stopListening = this._listen(this._events, callback);
  }

  public dispose() {
    const didUnmute = this._unmute(this._events);
    if (didUnmute && this._emit)
      this._emit(this._events);
  }
}

/** @hidden */
export type MapPayloadToInspireNodeCallback<TPayload> = (payload: TPayload, remapper: MapPayloadToInspireNodeCallback<TPayload>) => BeInspireTreeNodeConfig;

/**
 * Configuration properties for [[BeInspireTree]]
 */
export interface Props<TNodePayload> {
  dataProvider: BeInspireTreeDataProvider<TNodePayload>;
  pageSize?: number;
  renderer: BeInspireTreeRenderer<TNodePayload>;
  mapPayloadToInspireNodeConfig: MapPayloadToInspireNodeCallback<TNodePayload>;
}

/**
 * Bentley wrapper for 'inspire-tree'
 */
export class BeInspireTree<TNodePayload> {

  private _tree: InspireTree;
  private _eventMutes: Map<BeInspireTreeEvent, number>;
  private _readyPromise!: Promise<void>;

  constructor(props: Props<TNodePayload>) {
    this._eventMutes = new Map();

    this._tree = new InspireTree({
      data: wrapDataProvider<TNodePayload>(this, props.dataProvider, props.mapPayloadToInspireNodeConfig),
      pagination: {
        limit: props.pageSize,
      },
      deferredLoading: true,
      selection: {
        multiple: true,
        autoDeselect: false,
      },
    } as Inspire.Config);

    this._tree.on([BeInspireTreeEvent.ChangesApplied], () => {
      props.renderer(this.visible());
    });
    this.onModelInvalidated();
  }

  private onModelInvalidated() {
    this._readyPromise = new Promise<Inspire.TreeNodes>((resolve) => {
      this._tree.once([BeInspireTreeEvent.ModelLoaded], () => {
        const nodes = this._tree.nodes();
        nodes.forEach((n) => toNode(n).setDirty(true));
        resolve(nodes);
      });
    }).then(async (rootNodes: Inspire.TreeNodes) => {
      await using(this.pauseRendering(), async () => {
        await ensureNodesAutoExpanded(rootNodes);
      });
    });
  }

  public get ready(): Promise<void> { return this._readyPromise; }

  /**
   * Stop emitting the specified events until the returned
   * [[EventsMuteContext]] object is disposed
   */
  public mute(events: BeInspireTreeEvent[]): EventsMuteContext {
    return new EventsMuteContext(events, this.doMute, this.doUnmute);
  }

  // tslint:disable-next-line:naming-convention
  private doMute = (events: BeInspireTreeEvent[]) => {
    events.forEach((ev) => {
      if (!this._eventMutes.has(ev))
        this._eventMutes.set(ev, 1);
      else
        this._eventMutes.set(ev, this._eventMutes.get(ev)! + 1);
    });
    if (typeof this._tree.muted() !== "boolean")
      this._tree.mute(events.concat(this._tree.muted() as any));
    else
      this._tree.mute(events);
  }

  // tslint:disable-next-line:naming-convention
  private doUnmute = (events: BeInspireTreeEvent[]) => {
    const eventsToUnmute = events.filter((ev) => {
      let mutesCount = this._eventMutes.get(ev);
      if (mutesCount === undefined || mutesCount === 0)
        return false;
      this._eventMutes.set(ev, --mutesCount);
      return (mutesCount === 0);
    });
    this._tree.unmute(eventsToUnmute);
    return (eventsToUnmute.length > 0);
  }

  // tslint:disable-next-line:naming-convention
  private doEmit = (events: BeInspireTreeEvent[]) => {
    this._tree.emit(events);
  }

  /**
   * Stop calling the renderer method until the returned
   * object is disposed. When that happens, the [[BeInspireTreeEvent.ChangesApplied]]
   * event is emitted if any changes in the hierarchy happened during the pause
   */
  public pauseRendering(allowedRendersBeforePause: number = 0): EventsMuteContext {
    const doEmit = (events: BeInspireTreeEvent[]) => {
      if (this._tree.nodes().some((n) => toNode(n).isDirty())) {
        this.doEmit(events);
      }
    };
    const doListen = (events: BeInspireTreeEvent[], listener: (...values: any[]) => void) => {
      this.on(events, listener);
      return () => this._tree.removeListener(events, listener);
    };
    return new EventsMuteContext([BeInspireTreeEvent.ChangesApplied], this.doMute, this.doUnmute,
      doEmit, doListen, allowedRendersBeforePause);
  }

  /**
   * Request a new render of current model.
   *
   * @hidden
   */
  public applyChanges() {
    this.doEmit([BeInspireTreeEvent.ChangesApplied]);
  }

  /** Add a listener for specific event */
  public on(event: BeInspireTreeEvent | BeInspireTreeEvent[], listener: (...values: any[]) => void): this {
    this._tree.on(event, listener);
    return this;
  }

  /** Remove listener for specific event */
  public removeListener(event: BeInspireTreeEvent | BeInspireTreeEvent[], listener: (...values: any[]) => void): this {
    this._tree.removeListener(event, listener);
    return this;
  }

  /** Remove all listeners for specific event(s) */
  public removeAllListeners(event?: BeInspireTreeEvent | BeInspireTreeEvent[]) {
    this._tree.removeAllListeners(event);
  }

  /** Get root node with the specified id */
  public node(id: string): BeInspireTreeNode<TNodePayload> | undefined {
    return toNode(this._tree.node(id));
  }

  /** Get root nodes with the specified ids */
  public nodes(ids?: string[]) {
    return toNodes<TNodePayload>(this._tree.nodes(ids));
  }

  /** Get flat list of all available nodes */
  public flatten() {
    return toNodes<TNodePayload>(this._tree.flatten(() => true));
  }

  /** Get a flat list of available leaf nodes */
  public deepest() {
    return toNodes<TNodePayload>(this._tree.deepest());
  }

  /** Get a flat list of expanded nodes */
  public expanded() {
    return toNodes<TNodePayload>(this._tree.expanded());
  }

  /** Get a flat list of collapsed nodes */
  public collapsed() {
    return toNodes<TNodePayload>(this._tree.collapsed());
  }

  /** Get a flat list of selected nodes */
  public selected() {
    return toNodes<TNodePayload>(this._tree.selected());
  }

  /** Get a flat list of visible nodes */
  public visible() {
    return toNodes<TNodePayload>(this._tree.visible());
  }

  /** Reload the tree */
  public async reload() {
    await using(this.pauseRendering(), async () => {
      const rootNodes = await this._tree.reload();
      rootNodes.forEach((n) => toNode(n).setDirty(true));
    });
  }

  /**
   * Deselects all nodes
   */
  public deselectAll(muteEvents = true) {
    using(this.mute((muteEvents) ? [BeInspireTreeEvent.NodeDeselected] : []), () => {
      this._tree.deselectDeep();
    });
  }

  /**
   * Selects all nodes between two nodes (inclusive)
   *
   * Note: order of supplied nodes is not important
   */
  public selectBetween(node1: BeInspireTreeNode<TNodePayload>, node2: BeInspireTreeNode<TNodePayload>, muteEvents = true): Array<BeInspireTreeNode<TNodePayload>> {
    return using(this.mute((muteEvents) ? [BeInspireTreeEvent.NodeSelected] : []), () => {
      let start, end: BeInspireTreeNode<TNodePayload>;
      if (node1.indexPath() <= node2.indexPath()) {
        start = node1;
        end = node2;
      } else {
        start = node2;
        end = node1;
      }

      const selected = new Array<BeInspireTreeNode<TNodePayload>>();

      let curr = start;
      while (curr) {
        selected.push(toNode(curr));
        curr.select();

        if (curr.id === end.id)
          break;

        curr = toNode(curr.nextVisibleNode());
      }

      return selected;
    });
  }

  private createSelectedNodePredicate(nodesToSelect?: string[] | ((payload: TNodePayload) => boolean)): Inspire.NodeIteratee | undefined {
    if (!nodesToSelect)
      return undefined;

    let predicate: Inspire.NodeIteratee;
    if (typeof nodesToSelect === "function") {
      predicate = (n: Inspire.TreeNode) => nodesToSelect(toNode<TNodePayload>(n).payload);
    } else {
      predicate = (n: Inspire.TreeNode) => (-1 !== nodesToSelect.indexOf(toNode(n).id!));
    }
    return predicate;
  }

  private updateSelection(selectHandler: (predicate: Inspire.NodeIteratee) => void, nodesToSelect: string[] | ((payload: TNodePayload) => boolean) | undefined, muteEvents: boolean) {
    const predicate = this.createSelectedNodePredicate(nodesToSelect);
    if (!predicate)
      return;

    using(this.mute((muteEvents) ? [BeInspireTreeEvent.NodeSelected, BeInspireTreeEvent.NodeDeselected] : []), () => {
      this._tree.disableDeselection();
      selectHandler(predicate);
      this._tree.enableDeselection();
    });
  }

  /**
   * Deselects everything and selects only nodes that meet the `nodesToSelect` criteria
   */
  public updateTreeSelection(nodesToSelect?: string[] | ((payload: TNodePayload) => boolean), muteEvents = true) {
    const selectFunc = (predicate: Inspire.NodeIteratee) => {
      this._tree.deselectDeep();
      this._tree.flatten(predicate).select();
    };
    return this.updateSelection(selectFunc, nodesToSelect, muteEvents);
  }

  /**
   * Updates selection state of provided `nodes` based on `nodesToSelect` criteria
   */
  public updateNodesSelection(nodes: BeInspireTreeNodes<TNodePayload> | Inspire.TreeNodes, nodesToSelect?: string[] | ((payload: TNodePayload) => boolean), muteEvents = true) {
    const selectFunc = (predicate: Inspire.NodeIteratee) => {
      let filtered: Inspire.TreeNode[];
      if ((nodes as Inspire.TreeNodes).filterBy)
        filtered = (nodes as Inspire.TreeNodes).filterBy(predicate).map((n) => n);
      else
        filtered = (nodes as BeInspireTreeNodes<TNodePayload>).filter(predicate);
      filtered.forEach((node) => node.select());
    };
    return this.updateSelection(selectFunc, nodesToSelect, muteEvents);
  }
}

async function loadChildrenRecursive(n: Inspire.TreeNode, filterNodeIds: string[]): Promise<Inspire.TreeNodes> {
  const children = await n.loadChildren();
  await ensureChildrenLoaded(children, filterNodeIds);
  return children;
}

const needsChildrenLoaded = (n: Inspire.TreeNode) => n.hasOrWillHaveChildren() && !(n as any).hasLoadedChildren();

async function ensureChildrenLoaded(branch: Inspire.TreeNodes | Inspire.TreeNode[], filterNodeIds: string[]): Promise<Inspire.TreeNode[]> {
  const childNodes = branch.filter((n) => filterNodeIds.includes(toNode(n).id!));
  const allChildren = (await Promise.all(childNodes.map(async (n) => {
    if (needsChildrenLoaded(n))
      return loadChildrenRecursive(toNode(n), filterNodeIds);
    return n.getChildren();
  }))).reduce((children: Inspire.TreeNode[], curr: Inspire.TreeNodes) => {
    children.push(...curr);
    return children;
  }, []);
  await ensureNodesAutoExpanded(allChildren);
  return allChildren;
}

async function ensureNodesAutoExpanded(branch: Inspire.TreeNodes | Inspire.TreeNode[]): Promise<void> {
  const idsToExpand = branch.filter((n) => n.expanded()).map((n) => toNode(n).id!);
  if (idsToExpand.length > 0)
    await ensureChildrenLoaded(branch, idsToExpand);
}

function isTreeNodes(test: Inspire.TreeNode | Inspire.TreeNodes): test is Inspire.TreeNodes {
  return InspireTree.isTreeNodes(test);
}

/** @hidden */
export const toNode = <TPayload>(inspireNode: Inspire.TreeNode): BeInspireTreeNode<TPayload> => {
  const anyNode = inspireNode as any;
  if (!inspireNode) {
    // some inspire tree methods return `undefined` even when they say they don't - handle
    // the case by returning undefined as well
    return anyNode;
  }

  // override the loadChildren method to handle multiple calls with memoization
  if (!anyNode._loadChildrenOverriden) {
    const loadChildrenBase = inspireNode.loadChildren;
    inspireNode.loadChildren = async (): Promise<Inspire.TreeNodes> => {
      const loadedNode: Inspire.TreeNode & { _loadingPromise?: Promise<Inspire.TreeNodes> } = inspireNode;
      if (!loadedNode._loadingPromise) {
        const baseResult = loadChildrenBase.call(inspireNode);
        loadedNode._loadingPromise = baseResult.then((children: Inspire.TreeNodes) => { delete loadedNode._loadingPromise; return children; });
      }
      return loadedNode._loadingPromise!;
    };
    anyNode._loadChildrenOverriden = true;
  }

  // override the expand method to handle auto-expansion of loaded children
  if (!anyNode._expandOverriden) {
    const expandBase = inspireNode.expand;
    inspireNode.expand = async (): Promise<Inspire.TreeNode> => {
      const tree = anyNode.beInspireTree as BeInspireTree<TPayload>;
      // note: we want to allow a single render to show node as loading
      // before pausing rendering
      const allowedRendersBeforePause = needsChildrenLoaded(inspireNode) ? 1 : 0;
      return using(tree.pauseRendering(allowedRendersBeforePause), async () => {
        // note: the base `expand` method returns the expanded node if it's immediately loaded
        // and returns its children if the expanded node is delay-loaded...
        const expandResult = await expandBase.call(inspireNode);
        const children = isTreeNodes(expandResult) ? expandResult : expandResult.getChildren();
        // note: children loaded by the default `expand` implementation
        await ensureNodesAutoExpanded(children);
        return expandResult;
      });
    };
    anyNode._expandOverriden = true;
  }

  // inject a couple of methods to handle dirtiness
  anyNode.isDirty = () => anyNode.itree.dirty;
  anyNode.setDirty = (value: boolean) => {
    if (value)
      anyNode.markDirty();
    else
      anyNode.itree.dirty = value;
  };

  return anyNode;
};

/** @hidden */
export const toNodes = <TPayload>(inspireNodes: Inspire.TreeNodes): BeInspireTreeNodes<TPayload> => {
  return Object.assign(inspireNodes.map((n) => toNode<TPayload>(n)), {
    node: (id: string) => toNode<TPayload>(inspireNodes.node(id)),
    nodes: (ids?: string[]) => toNodes<TPayload>(inspireNodes.nodes(ids)),
    deepest: () => toNodes<TPayload>(inspireNodes.deepest()),
    flatten: () => toNodes<TPayload>(inspireNodes.flatten(() => true)),
    expanded: () => toNodes<TPayload>(inspireNodes.expanded()),
    collapsed: () => toNodes<TPayload>(inspireNodes.collapsed()),
    selected: () => toNodes<TPayload>(inspireNodes.selected()),
    visible: () => toNodes<TPayload>(inspireNodes.visible()),
  });
};

const isDataProviderInterface = (obj: unknown): obj is BeInspireTreeDataProviderInterface<any> => {
  return (typeof obj === "object")
    && ((obj as any).getNodesCount && (typeof (obj as any).getNodesCount) === "function")
    && ((obj as any).getNodes && (typeof (obj as any).getNodes) === "function");
};

const wrapDataProvider = <TPayload>(tree: BeInspireTree<TPayload>, provider: BeInspireTreeDataProvider<TPayload>, mapPayloadToInspireNodeConfig: MapPayloadToInspireNodeCallback<TPayload>) => {
  const mapPayloadToInspireNode = (payload: TPayload): Inspire.NodeConfig & { payload: TPayload } => {
    const result: BeInspireTreeNodeConfig & { payload: TPayload, beInspireTree: BeInspireTree<TPayload> } = {
      ...mapPayloadToInspireNodeConfig(payload, mapPayloadToInspireNode),
      beInspireTree: tree,
      payload,
    };
    return result;
  };
  const mapPayloadToInspireNodes = (payload: TPayload[]) => payload.map(mapPayloadToInspireNode);
  const nodeToPayload = (node?: BeInspireTreeNode<TPayload>) => (node ? node.payload : undefined);

  if (Array.isArray(provider))
    return mapPayloadToInspireNodes(provider);

  if (typeof provider === "object") {
    if (isDataProviderInterface(provider))
      return async (parent?: BeInspireTreeNode<TPayload>) => provider.getNodes(nodeToPayload(parent)).then(mapPayloadToInspireNodes);
    return provider.then(mapPayloadToInspireNodes);
  }

  return async (parent?: BeInspireTreeNode<TPayload>) => provider(nodeToPayload(parent)).then(mapPayloadToInspireNodes);
};
