/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import InspireTree, * as Inspire from "inspire-tree";
import { isArrayLike } from "lodash";
import { CallableInstance } from "callable-instance2/import";
import { IDisposable, using } from "@bentley/bentleyjs-core";
import { PageOptions } from "../../common/PageOptions";

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

/** Data structure for [[BeInspireTreeNodeConfig]] with our injected props */
export interface BeInspireTreeNodePayloadConfig<TPayload> extends Inspire.NodeConfig {
  /** Node's data. May be `undefined` if this is placeholder node. */
  payload?: TPayload;
  /** Index of the node at the parent level. Only set if this is a placeholder node. */
  placeholderIndex?: number;
  /** Reference to the tree */
  beInspireTree: BeInspireTree<TPayload>;
}

/** Type definition for all BeInspireTree nodes */
export interface BeInspireTreeNode<TPayload> extends Inspire.TreeNode, BeInspireTreeNodePayloadConfig<TPayload> {
  isDirty(): boolean;
  setDirty(value: boolean): void;
  /** @hidden */
  resetBeInspireOverrides(): void;
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
  getNodes(parent?: TPayload, page?: PageOptions): BeInspireTreeDataProviderPromise<TPayload>;
}
/** Type definition for all BeInspireTree data providers */
export type BeInspireTreeDataProvider<TPayload> = BeInspireTreeDataProviderRaw<TPayload>
  | BeInspireTreeDataProviderPromise<TPayload>
  | BeInspireTreeDataProviderMethod<TPayload>
  | BeInspireTreeDataProviderInterface<TPayload>;

/** Type definition for a BeInspireTree renderer */
export type BeInspireTreeRenderer<TPayload> = (rootNodes: Array<BeInspireTreeNode<TPayload>>) => void;

type BeInspireTreeDataFunc<TPayload> = (parent: BeInspireTreeNode<TPayload> | undefined,
  resolve: (nodes: Array<BeInspireTreeNodePayloadConfig<TPayload>>, totalCount: number) => any,
  reject: (err: Error) => any,
  pagination?: Inspire.Pagination,
) => void;
type BeInspireTreeData<TPayload> = Array<BeInspireTreeNodePayloadConfig<TPayload>>
  | Promise<Array<BeInspireTreeNodePayloadConfig<TPayload>>>
  | BeInspireTreeDataFunc<TPayload>;

/**
 * A context which keeps [[BeInspireTree]] events muted until
 * it gets disposed.
 */
export class EventsMuteContext implements IDisposable {

  private _triggeredEventsCount: number = 0;
  private _didMute = false;
  private _stopListening: (() => void) | undefined;

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
      this._didMute = true;
      return;
    }
    const callback = () => {
      if (++this._triggeredEventsCount >= allowedEventTriggersBeforeMute) {
        this._mute(this._events);
        this._didMute = true;
        if (this._stopListening) {
          this._stopListening();
          this._stopListening = undefined;
        }
      }
    };
    this._stopListening = this._listen(this._events, callback);
  }

  public dispose() {
    if (this._stopListening) {
      this._stopListening();
      this._stopListening = undefined;
    }

    if (!this._didMute)
      return;

    const didUnmute = this._unmute(this._events);
    if (didUnmute && this._emit)
      this._emit(this._events);
  }
}

/** @hidden */
export type MapPayloadToInspireNodeCallback<TPayload> = (payload: TPayload, remapper: MapPayloadToInspireNodeCallback<TPayload>) => BeInspireTreeNodeConfig;

interface DeferredLoadingHandler<TPayload> {
  requestNodeLoad(parent: BeInspireTreeNode<TPayload> | undefined, index: number): Promise<void>;
  disposeNodeCaches(parent: BeInspireTreeNode<TPayload>): void;
}

/**
 * Configuration properties for [[BeInspireTree]]
 */
export interface Props<TNodePayload> {
  dataProvider: BeInspireTreeDataProvider<TNodePayload>;
  mapPayloadToInspireNodeConfig: MapPayloadToInspireNodeCallback<TNodePayload>;
  pageSize?: number;
  disposeChildrenOnCollapse?: boolean;
}

/**
 * Bentley wrapper for 'inspire-tree'
 */
export class BeInspireTree<TNodePayload> {

  private _tree: InspireTree;
  private _eventMutes: Map<BeInspireTreeEvent, number>;
  private _readyPromise!: Promise<void>;
  private _deferredLoadingHandler?: DeferredLoadingHandler<TNodePayload>;
  private _visibleCached?: BeInspireTreeNodes<TNodePayload>;
  private _suspendedRendering?: EventsMuteContext;
  public props: Props<TNodePayload>;

  constructor(props: Props<TNodePayload>) {
    this.props = props;
    this._eventMutes = new Map();

    const wrappedProvider = wrapDataProvider<TNodePayload>(this, props.dataProvider, props.mapPayloadToInspireNodeConfig);
    if (wrappedProvider instanceof WrappedInterfaceProvider)
      this._deferredLoadingHandler = wrappedProvider as WrappedInterfaceProvider<TNodePayload>;
    const config: Inspire.Config = {
      data: wrappedProvider as any, // note: invalid declaration for this callback
      selection: {
        multiple: true,
        autoDeselect: false,
      },
    };
    this._tree = new InspireTree(config);

    // make sure model is dirty when it's loaded
    this.on(BeInspireTreeEvent.ModelLoaded, (model: BeInspireTreeNodes<TNodePayload>) => {
      model.forEach((n) => n.markDirty());
    });

    // dispose `visible` cache when data is loaded or nodes are expanded or collapsed
    this.on([BeInspireTreeEvent.DataLoaded, BeInspireTreeEvent.NodeCollapsed, BeInspireTreeEvent.NodeExpanded], () => {
      this._visibleCached = undefined;
    });

    // we want to allow consumers of `BeInspireTree` to listen for `ModelLoaded`
    // and `ChildrenLoaded` events and do any kind of manipulation with them **before**
    // `ChangesApplied` event is emitted, so we have to suspend rendering when data is loaded
    // and resume it in `*Loaded` listener.
    this.on(BeInspireTreeEvent.DataLoaded, () => {
      this._suspendedRendering = this.pauseRendering();
    });
    this.on([BeInspireTreeEvent.ModelLoaded, BeInspireTreeEvent.ChildrenLoaded], () => {
      if (this._suspendedRendering) {
        this._suspendedRendering.dispose();
        this._suspendedRendering = undefined;
      }
    });

    // override the `load` function to handle auto-expanding nodes
    // note: tree starts loading as soon as it gets created, so the first load
    // is not using this override - in that case auto-expansion is handled
    // in `onModelInvalidated` function
    const baseTreeLoad = this._tree.load;
    this._tree.load = async (loader): Promise<Inspire.TreeNodes> => {
      const result = await baseTreeLoad.call(this._tree, loader);
      await using(this.pauseRendering(), async () => {
        await ensureNodesAutoExpanded(result);
      });
      return result;
    };

    // assign `disposeChildrenOnCollapse` handler if needed
    if (props.disposeChildrenOnCollapse) {
      if (!isDeferredDataProvider(props.dataProvider))
        throw new Error("Property `disposeChildrenOnCollapse` is only available on deferred data providers");
      this.on(BeInspireTreeEvent.NodeCollapsed, (node: BeInspireTreeNode<TNodePayload>) => {
        if (this._deferredLoadingHandler)
          this._deferredLoadingHandler.disposeNodeCaches(node);
        node.children = true;
      });
    }

    // invalidate our `ready` promise
    this.onModelInvalidated();
  }

  private onModelInvalidated() {
    this._readyPromise = new Promise<void>((resolve) => {
      this._tree.once([BeInspireTreeEvent.ModelLoaded], resolve);
    }).then(async () => {
      // note: the following is only needed for the initial load of the tree
      // when our `load` override isn't assigned yet
      await using(this.pauseRendering(), async () => {
        await ensureNodesAutoExpanded(this._tree.nodes());
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
      if (this.visible().some((n) => n.isDirty())) {
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
    const events = Array.isArray(event) ? event : [event];
    events.forEach((e) => {
      const shouldInsertBeforeLast = ((e === BeInspireTreeEvent.DataLoaded && this._tree.listeners(e).length >= 2)
        || (e === BeInspireTreeEvent.ModelLoaded && this._tree.listeners(e).length >= 2)
        || (e === BeInspireTreeEvent.ChildrenLoaded && this._tree.listeners(e).length >= 1));
      if (shouldInsertBeforeLast)
        this._tree.listeners(e).splice(this._tree.listeners(e).length - 1, 0, listener);
      else
        this._tree.on(e, listener);
    });
    return this;
  }

  /** Remove listener for specific event */
  public removeListener(event: BeInspireTreeEvent | BeInspireTreeEvent[], listener: (...values: any[]) => void): this {
    const events = Array.isArray(event) ? event : [event];
    events.forEach((e) => this._tree.removeListener(e, listener));
    return this;
  }

  /** Remove all listeners for specific event(s) */
  public removeAllListeners(event?: BeInspireTreeEvent | BeInspireTreeEvent[]) {
    if (!event) {
      this._tree.removeAllListeners(undefined);
      return;
    }
    const events = Array.isArray(event) ? event : [event];
    events.forEach((e) => this._tree.removeAllListeners(e));
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
    if (!this._visibleCached)
      this._visibleCached = toNodes<TNodePayload>(this._tree.visible());
    return this._visibleCached;
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

      let startIndex = -1;
      let endIndex = -1;
      for (let i = 0; i < this.visible().length; ++i) {
        const vn = this.visible()[i];
        if (vn.id === start.id)
          startIndex = i;
        if (vn.id === end.id)
          endIndex = i;
        if (startIndex !== -1 && endIndex !== -1)
          break;
      }

      const selected = this.visible().slice(startIndex, endIndex + 1);
      selected.forEach((n) => n.select());
      return selected;
    });
  }

  private createSelectedNodePredicate(nodesToSelect?: string[] | ((payload: TNodePayload) => boolean)): Inspire.NodeIteratee | undefined {
    if (!nodesToSelect)
      return undefined;

    let predicate: Inspire.NodeIteratee;
    if (typeof nodesToSelect === "function") {
      predicate = (n: Inspire.TreeNode) => (toNode<TNodePayload>(n).payload && nodesToSelect(toNode<TNodePayload>(n).payload!));
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

  /** @hidden */
  public createPlaceholderNode(index: number, parent?: BeInspireTreeNode<TNodePayload>): BeInspireTreeNode<TNodePayload> {
    const node = toNode<TNodePayload>(this._tree.createNode({
      id: `${parent ? parent.id : ""}-not_loaded[${index}]`,
      text: "",
      payload: undefined as any,
      beInspireTree: this,
    }));
    node.placeholderIndex = index;
    return node;
  }

  /**
   * Request a node at the specified index to be loaded for the given parent. Only
   * makes sense on a paginated tree, throws otherwise.
   */
  public async requestNodeLoad(parent: BeInspireTreeNode<TNodePayload> | undefined, index: number): Promise<void> {
    if (!this._deferredLoadingHandler)
      throw new Error("requestNodeLoad should only be called when pagination is enabled");
    return this._deferredLoadingHandler.requestNodeLoad(parent, index);
  }

  /** @hidden */
  public async loadNodes(): Promise<void> {
    await this._tree.load((this._tree as any).config.data);
  }
}

async function loadChildrenRecursive(n: Inspire.TreeNode, filterNodeIds: string[]): Promise<Inspire.TreeNodes> {
  const children = await n.loadChildren();
  await ensureChildrenLoaded(children, filterNodeIds);
  return children;
}

const needsChildrenLoaded = (n: Inspire.TreeNode) => n.hasOrWillHaveChildren() && !(n as any).hasLoadedChildren();

async function ensureChildrenLoaded(branch: Inspire.TreeNodes | Inspire.TreeNode[], filterNodeIds: string[]): Promise<void> {
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
}

async function ensureNodesAutoExpanded(branch: Inspire.TreeNodes | Inspire.TreeNode[]): Promise<void> {
  const idsToExpand = branch.filter((n) => n.expanded()).map((n) => toNode(n).id!);
  if (idsToExpand.length > 0)
    await ensureChildrenLoaded(branch, idsToExpand);
}

/** @hidden */
export const toNode = <TPayload>(inspireNode: Inspire.TreeNode): BeInspireTreeNode<TPayload> => {
  const anyNode = inspireNode as any;
  if (!inspireNode) {
    // some inspire tree methods return `undefined` even when they say they don't - handle
    // the case by returning undefined as well
    return anyNode;
  }

  if (!anyNode._loadChildrenOverriden) {
    const loadChildrenBase = inspireNode.loadChildren;
    inspireNode.loadChildren = async (): Promise<Inspire.TreeNodes> => {
      const children = await loadChildrenBase.call(inspireNode);
      // note: inspire-tree calls BeInspireTreeEvent.ChildrenLoaded as part of
      // the above call, so listeners get called before we get a chance to auto-expand...
      await ensureNodesAutoExpanded(children);
      return children;
    };
    anyNode._loadChildrenOverriden = loadChildrenBase;
  }

  // inject a method to reset overrides
  anyNode.resetBeInspireOverrides = () => {
    anyNode.loadChildren = anyNode._loadChildrenOverriden;
    delete anyNode._loadChildrenOverriden;
  };

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

const isDeferredDataProvider = (provider: BeInspireTreeDataProvider<any>): boolean => {
  return (typeof provider === "function") || isDataProviderInterface(provider);
};

const nodeToPayload = <TPayload>(node?: BeInspireTreeNodePayloadConfig<TPayload>) => (node ? node.payload : undefined);

class PayloadToNodeRemapper<TPayload> {
  constructor(
    private _tree: BeInspireTree<TPayload>,
    private _mapPayloadToInspireNodeConfig: MapPayloadToInspireNodeCallback<TPayload>) {
  }
  public remapOne = (payload: TPayload): BeInspireTreeNodePayloadConfig<TPayload> => ({
    ...this._mapPayloadToInspireNodeConfig(payload, this.remapOne),
    beInspireTree: this._tree,
    payload,
  })
  public remapMany = (payload: TPayload[]): Array<BeInspireTreeNodePayloadConfig<TPayload>> => {
    return payload.map(this.remapOne);
  }
}

function onNodesDelayLoaded<TPayload>(parent: BeInspireTreeNode<TPayload> | undefined, nodes: Array<BeInspireTreeNodePayloadConfig<TPayload>>) {
  if (parent) {
    // inspire-tree emits `data.loaded` event only when root nodes are loaded, but
    // we also need it to be emitted when children are loaded - we depend on it being called
    // after the children are loaded but before the `children.loaded` event is emitted.
    parent.tree().emit(BeInspireTreeEvent.DataLoaded, nodes);
  }
}

const wrapDataProvider = <TPayload>(tree: BeInspireTree<TPayload>, provider: BeInspireTreeDataProvider<TPayload>, mapPayloadToInspireNodeConfig: MapPayloadToInspireNodeCallback<TPayload>): BeInspireTreeData<TPayload> => {
  const remapper = new PayloadToNodeRemapper(tree, mapPayloadToInspireNodeConfig);

  if (Array.isArray(provider)) {
    // array data provider
    return remapper.remapMany(provider);
  }

  if (typeof provider === "function") {
    // method data provider
    return ((parent: BeInspireTreeNode<TPayload> | undefined, resolve: (nodes: Array<BeInspireTreeNodePayloadConfig<TPayload>>, totalCount: number) => any, _reject: (err: Error) => any) => {
      const payload = nodeToPayload(parent);
      // tslint:disable-next-line: no-floating-promises
      provider(payload).then(remapper.remapMany).then((nodes) => {
        onNodesDelayLoaded(parent, nodes);
        resolve(nodes, nodes.length);
      });
    });
  }

  if (isDataProviderInterface(provider)) {
    // interface data provider
    return new WrappedInterfaceProvider({
      tree,
      provider,
      nodesRemapper: remapper,
    });
  }

  // promise data provider
  return provider.then(remapper.remapMany);
};

interface NodesLoadResult<TPayload> {
  totalNodesCount: number;
  nodes: TPayload[];
}

interface WrappedInterfaceProviderProps<TPayload> {
  tree: BeInspireTree<TPayload>;
  provider: BeInspireTreeDataProviderInterface<TPayload>;
  nodesRemapper: PayloadToNodeRemapper<TPayload>;
}
class WrappedInterfaceProvider<TPayload> extends CallableInstance implements DeferredLoadingHandler<TPayload> {
  private _tree: BeInspireTree<TPayload>;
  private _provider: BeInspireTreeDataProviderInterface<TPayload>;
  private _paginationHelper?: PaginationHelper<NodesLoadResult<TPayload>>;
  private _nodesRemapper: PayloadToNodeRemapper<TPayload>;
  private _stashedPages = new Map<string | undefined, { total: number, pages: Array<{ start: number, nodes: TPayload[] }> }>();
  private _initialRequests = new Set<string | undefined>();

  public constructor(props: WrappedInterfaceProviderProps<TPayload>) {
    super("inspireLoad");
    this.inspireLoad;

    this._tree = props.tree;
    this._provider = props.provider;
    this._nodesRemapper = props.nodesRemapper;
    if (undefined !== this._tree.props.pageSize && 0 !== this._tree.props.pageSize)
      this._paginationHelper = new PaginationHelper(this._tree.props.pageSize, this._pagedLoad, this._onPageLoaded);
  }

  public requestNodeLoad = async (parent: BeInspireTreeNode<TPayload> | undefined, index: number): Promise<void> => {
    if (!this._paginationHelper)
      throw new Error("requestNodeLoad should only be called when pagination is enabled");
    await this._paginationHelper.request(parent ? parent.id : undefined, index);
  }

  public disposeNodeCaches(node: BeInspireTreeNode<TPayload>) {
    node.getChildren().forEach((c) => this.disposeNodeCaches(toNode(c)));
    this._stashedPages.delete(node.id);
    if (this._paginationHelper)
      this._paginationHelper.disposeCaches(node.id);
  }

  /** Called by PaginationHelper to load a page */
  private _pagedLoad = async (parentId: string | undefined, pageStart: number): Promise<NodesLoadResult<TPayload>> => {
    const parentNode = parentId ? this._tree.node(parentId) : undefined;
    const parentPayload = parentNode ? parentNode.payload : undefined;

    const handleCollapsedParent = () => {
      if (this._tree.props.disposeChildrenOnCollapse && parentNode && parentNode.collapsed())
        throw new Error("Parent node collapsed while children were being loaded");
    };

    let totalNodesCount: number | undefined;
    if (parentNode && isArrayLike(parentNode.children)) {
      totalNodesCount = parentNode.getChildren().length;
    } else if (!parentNode) {
      let rootNodesCount = 0;
      try { rootNodesCount = this._tree.nodes().length; } catch (e) { }
      if (rootNodesCount > 0)
        totalNodesCount = rootNodesCount;
    }
    if (undefined === totalNodesCount) {
      totalNodesCount = await this._provider.getNodesCount(parentPayload);
      handleCollapsedParent();
    }

    const page: PageOptions = {
      start: pageStart,
      size: this._paginationHelper!.pageSize,
    };
    const nodes = await this._provider.getNodes(parentPayload, page);
    handleCollapsedParent();
    return {
      totalNodesCount,
      nodes,
    };
  }

  /** Called by PaginationHelper when a page is finished loading */
  private _onPageLoaded = async (parentId: string | undefined, pageStart: number, result: NodesLoadResult<TPayload>) => {
    // stash the result
    const stash = {
      total: result.totalNodesCount,
      pages: [{ start: pageStart, nodes: result.nodes }],
    };
    this._stashedPages.set(parentId, stash);

    if (!this._initialRequests.delete(parentId)) {
      // because the load is going to happen almost synchronously (just
      // merge current nodes with stash), there's no point to show the
      // `loading` state and then re-render with `completed` state + nodes.
      // instead, just pause rendering until we have the nodes
      await using(this._tree.pauseRendering(), async () => {
        // request children for `parent` to reload - the load handler
        // will merge the current children with stash (see `inspireLoad`)
        if (parentId)
          await this._tree.node(parentId)!.loadChildren();
        else
          await this._tree.loadNodes();
      });
    }
  }

  private createPagedNodesResult(parent: BeInspireTreeNode<TPayload> | undefined): Array<BeInspireTreeNodePayloadConfig<TPayload>> {
    const parentId = parent ? parent.id : undefined;
    const currNodes = parent ? toNodes(parent.getChildren()) : this._tree.nodes();
    const stash = this._stashedPages.get(parentId);
    if (!stash) {
      // nothing in stash - return current nodes
      return currNodes as any;
    }
    this._stashedPages.delete(parentId);

    // merge current nodes with stash content, fill missing
    // pieces with placeholders
    const resolvedNodes = new Array(stash.total);
    stash.pages.forEach((page) => {
      page.nodes.forEach((n, index) => {
        resolvedNodes[page.start + index] = this._nodesRemapper.remapOne(n);
      });
    });
    for (let i = 0; i < stash.total; ++i) {
      if (resolvedNodes[i])
        continue;
      if (currNodes[i]) {
        currNodes[i].resetBeInspireOverrides();
        resolvedNodes[i] = currNodes[i];
      } else {
        resolvedNodes[i] = this._tree.createPlaceholderNode(i, parent);
      }
    }
    return resolvedNodes;
  }

  /** Called by inspire-tree */
  private async inspireLoad(parent: BeInspireTreeNode<TPayload> | undefined, resolve: (nodes: Array<BeInspireTreeNodePayloadConfig<TPayload>>, totalCount: number) => any) {
    if (!this._paginationHelper) {
      // pagination is disabled - just load all nodes for the parent
      const payload = parent ? parent.payload : undefined;
      // tslint:disable-next-line:no-floating-promises
      this._provider.getNodes(payload).then((payloads) => {
        const nodes = this._nodesRemapper.remapMany(payloads);
        onNodesDelayLoaded(parent, nodes);
        resolve(nodes, nodes.length);
      });
      return;
    }

    // paginated behavior
    const parentId = parent ? parent.id : undefined;
    if (!this._paginationHelper.hasOrWillHaveLoadedPages(parentId)) {
      // parent has no children yet - initiate a request and wait
      this._initialRequests.add(parentId);
      await this.requestNodeLoad(parent, 0);
    }
    const pagedNodes = this.createPagedNodesResult(parent);
    if (parent && isArrayLike(parent.children)) {
      // reset so concat doesn't duplicate nodes
      parent.children = true;
    }
    onNodesDelayLoaded(parent, pagedNodes);
    resolve(pagedNodes, pagedNodes.length);
  }
}
interface WrappedInterfaceProvider<TPayload> {
  // tslint:disable-next-line:callable-types
  (parent: BeInspireTreeNode<TPayload> | undefined, resolve: (nodes: Array<BeInspireTreeNodePayloadConfig<TPayload>>, totalCount: number) => any): void;
}

type PagedLoadHandler<TLoadResult> = (parentId: string | undefined, pageStart: number) => Promise<TLoadResult>;
type PageLoadedCallback<TLoadResult> = (parentId: string | undefined, pageStart: number, result: TLoadResult) => Promise<void>;
class PaginationHelper<TPageLoadResult> {
  public readonly pageSize: number;
  private _loadedPages: Map<string | undefined, Set<number>>;
  private _requestedPages: Map<string | undefined, Map<number, Promise<void>>>;
  private _loadHandler: PagedLoadHandler<TPageLoadResult>;
  private _onPageLoaded: PageLoadedCallback<TPageLoadResult>;

  constructor(pageSize: number, loadHandler: PagedLoadHandler<TPageLoadResult>, onPageLoaded: PageLoadedCallback<TPageLoadResult>) {
    this.pageSize = pageSize;
    this._loadHandler = loadHandler;
    this._onPageLoaded = onPageLoaded;
    this._loadedPages = new Map();
    this._requestedPages = new Map();
  }

  private getPageStartIndex(nodeIndex: number) {
    return nodeIndex - nodeIndex % this.pageSize;
  }

  private async createRequest(parentId: string | undefined, pageStart: number): Promise<void> {
    return this._loadHandler(parentId, pageStart).then(async (result) => {
      await this.onRequestHandled(parentId, pageStart, result);
    }).catch(() => {
      this.onRequestRejected(parentId, pageStart);
    });
  }

  public hasOrWillHaveLoadedPages(parentId: string | undefined): boolean {
    return this._loadedPages.has(parentId) || this._requestedPages.has(parentId);
  }

  public disposeCaches(parentId: string | undefined) {
    this._loadedPages.delete(parentId);
    this._requestedPages.delete(parentId);
  }

  public async request(parentId: string | undefined, index: number): Promise<void> {
    const pageStart = this.getPageStartIndex(index);
    const loadedPages = this._loadedPages.get(parentId);
    if (loadedPages !== undefined && loadedPages.has(pageStart)) {
      // already loaded
      return;
    }
    let requestedPages = this._requestedPages.get(parentId);
    if (requestedPages === undefined) {
      requestedPages = new Map();
      this._requestedPages.set(parentId, requestedPages);
    }
    let request = requestedPages.get(pageStart);
    if (!request) {
      request = this.createRequest(parentId, pageStart);
      requestedPages.set(pageStart, request);
    }
    await request;
  }

  private async onRequestHandled(parentId: string | undefined, pageStart: number, result: TPageLoadResult) {
    // add the request to loaded list
    let loadedPages = this._loadedPages.get(parentId);
    if (!loadedPages) {
      loadedPages = new Set();
      this._loadedPages.set(parentId, loadedPages);
    }
    loadedPages.add(pageStart);

    // remove request from active requests list
    const requestedPages = this._requestedPages.get(parentId);
    if (requestedPages && requestedPages.delete(pageStart)) {
      // callback
      await this._onPageLoaded(parentId, pageStart, result);
    }
  }

  private onRequestRejected(parentId: string | undefined, pageStart: number) {
    // remove request from active requests list
    const requestedPages = this._requestedPages.get(parentId);
    if (requestedPages)
      requestedPages.delete(pageStart);
  }
}
