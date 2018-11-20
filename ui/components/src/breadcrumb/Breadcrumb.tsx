/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Breadcrumb */

import * as React from "react";
import classnames from "classnames";

import "./Breadcrumb.scss";
import * as _ from "lodash";
import { using } from "@bentley/bentleyjs-core";
import { SplitButton, withOnOutsideClick } from "@bentley/ui-core";
import { TreeDataProvider, TreeNodeItem, DelayLoadedTreeNodeItem, ImmediatelyLoadedTreeNodeItem, isTreeDataProviderInterface } from "../tree";
import { ContextMenu, ContextMenuItem } from "@bentley/ui-core";
import { BreadcrumbPath, BreadcrumbUpdateEventArgs } from "./BreadcrumbPath";
import { BeInspireTree, BeInspireTreeNode, BeInspireTreeNodeConfig, MapPayloadToInspireNodeCallback, BeInspireTreeEvent, BeInspireTreeNodes, toNodes } from "../tree/component/BeInspireTree";
import UiComponents from "../UiComponents";

/** @hidden */
export type BreadcrumbNodeRenderer = (props: BreadcrumbNodeProps, node?: TreeNodeItem, parent?: TreeNodeItem, index?: number) => React.ReactNode;

/** Property interface for [[Breadcrumb]] component */
export interface BreadcrumbProps {
  /** Manager to coordinate state between Breadcrumb element and BreadrcumbDetails element. */
  path?: BreadcrumbPath;
  /** Data provider for tree content  */
  dataProvider: TreeDataProvider;
  /** Character used to separate discrete tree nodes in Breadcrumb text mode. Default: "\\" */
  delimiter?: string;
  /** Width in pixels, if number, and in specified css units, if string. Default: "15em" */
  width?: number | string;
  /** Whether to show up-dir directory pop button on the left. Default: true */
  showUpDir?: boolean;
  /** Which BreadcrumbMode to initially start with. Default: BreadcrumbMode.Dropdown */
  initialBreadcrumbMode?: BreadcrumbMode;
  /** Whether to show white background and border. Default: true */
  background?: boolean;
  /** Static breadcrumb element. Default: false */
  staticOnly?: boolean;
  /** Disable plain-text input for the breadcrumb navigation. Default: false */
  dropdownOnly?: boolean;
  /** Whether to disallow navigation to leaf nodes (nodes with no children). Default: true */
  parentsOnly?: boolean;
  /** Callback triggered when child node is loaded with an asynchronous dataProvider. */
  onChildrenLoaded?: (parent: TreeNodeItem, children: TreeNodeItem[]) => void;
  /** Callback triggered when root nodes are loaded with an asynchronous dataProvider. */
  onRootNodesLoaded?: (nodes: TreeNodeItem[]) => void;
  /** @hidden */
  renderNode?: BreadcrumbNodeRenderer;
  /** @hidden */
  onRender?: () => void;
}

/** @hidden */
export enum BreadcrumbMode {
  Dropdown = "dropdown",
  Input = "input",
}

/** @hidden */
export interface BreadcrumbState {
  width: number | string;
  current?: BeInspireTreeNode<TreeNodeItem>;
  currentMode: BreadcrumbMode;
  modelReady: boolean;
}

/**
 * Breadcrumb navigation component, with two discrete modes: text mode, and dropdown mode.
 * Text mode includes autocomplete suggestions.
 * Both dropdown and text mode support arrow and tab navigation.
 */
export class Breadcrumb extends React.Component<BreadcrumbProps, BreadcrumbState> {
  private _mounted: boolean = false;
  private _tree!: BeInspireTree<TreeNodeItem>;

  /** @hidden */
  public static defaultProps: Partial<BreadcrumbProps> = {
    delimiter: "\\",
    background: true,
    initialBreadcrumbMode: BreadcrumbMode.Dropdown,
    showUpDir: true,
    parentsOnly: true,
    width: "",
  };

  /** @hidden */
  public readonly state: Readonly<BreadcrumbState>;

  constructor(props: BreadcrumbProps) {
    super(props);

    this.state = {
      modelReady: isTreeDataProviderInterface(props.dataProvider) ? false : true,
      width: props.width!,
      currentMode: props.initialBreadcrumbMode!,
    };
    this._recreateTree();
  }

  /** @hidden */
  public componentDidMount() {
    this._mounted = true;
    /* istanbul ignore next */
    if (this.props.onRender)
      this.props.onRender();
    if (this.props.path) {
      this.props.path.setDataProvider(this.props.dataProvider);
      this.props.path.BreadcrumbUpdateEvent.addListener(this._handleUpdate);
    }
    if (isTreeDataProviderInterface(this.props.dataProvider) && this.props.dataProvider.onTreeNodeChanged) {
      // subscribe for data provider `onTreeNodeChanged` events
      this.props.dataProvider.onTreeNodeChanged.addListener(this._onTreeNodeChanged);
    }
  }

  /** @hidden */
  public componentWillUnmount() {
    this._tree.removeAllListeners();
    if (this.props.path)
      this.props.path.BreadcrumbUpdateEvent.removeListener(this._handleUpdate);
    if (isTreeDataProviderInterface(this.props.dataProvider) && this.props.dataProvider.onTreeNodeChanged) {
      // unsubscribe from data provider `onTreeNodeChanged` events
      this.props.dataProvider.onTreeNodeChanged.removeListener(this._onTreeNodeChanged);
    }
    this._mounted = false;
  }

  private _handleUpdate = (args: BreadcrumbUpdateEventArgs) => {
    if (args.currentNode && this._mounted) {
      const node = this._tree.node(args.currentNode.id);
      this.setState({ current: node });
    } else {
      this.setState({ current: undefined });
    }
  }

  private _recreateTree() {
    this._tree = new BeInspireTree<TreeNodeItem>({
      dataProvider: this.props.dataProvider,
      renderer: this._onModelChanged,
      mapPayloadToInspireNodeConfig: Breadcrumb.inspireNodeFromTreeNodeItem,
    });
    this._tree.on(BeInspireTreeEvent.ModelLoaded, this._onModelLoaded);
    this._tree.on(BeInspireTreeEvent.ChildrenLoaded, this._onChildrenLoaded);
    this._tree.ready.then(this._onModelReady); // tslint:disable-line:no-floating-promises
  }

  /** @hidden */
  public shouldComponentUpdate(nextProps: BreadcrumbProps, nextState: BreadcrumbState): boolean {
    if (this.state.modelReady !== nextState.modelReady) {
      // always render when state.modelReady changes
      return true;
    }

    if (!nextState.modelReady) {
      // if we got here and model is not ready - don't render
      return false;
    }

    // otherwise, render when any of the following props / state change
    return this.props.renderNode !== nextProps.renderNode
      || this.props.dataProvider !== nextProps.dataProvider
      || this.state.current !== nextState.current
      || this.state.currentMode !== nextState.currentMode;
  }

  /** @hidden */
  public componentDidUpdate(prevProps: BreadcrumbProps) {
    /* istanbul ignore next */
    if (this.props.onRender)
      this.props.onRender();
    if (this.props.dataProvider !== prevProps.dataProvider) {
      if (isTreeDataProviderInterface(prevProps.dataProvider) && prevProps.dataProvider.onTreeNodeChanged) {
        // unsubscribe from previous data provider `onTreeNodeChanged` events
        prevProps.dataProvider.onTreeNodeChanged.removeListener(this._onTreeNodeChanged);
      }
      if (isTreeDataProviderInterface(this.props.dataProvider) && this.props.dataProvider.onTreeNodeChanged) {
        // subscribe for new data provider `onTreeNodeChanged` events
        this.props.dataProvider.onTreeNodeChanged.addListener(this._onTreeNodeChanged);
      }
      this.setState({ modelReady: false }, () => {
        this._recreateTree();
      });
    }
  }

  private _onModelLoaded = (rootNodes: BeInspireTreeNodes<TreeNodeItem>) => {
    if (this.props.onRootNodesLoaded)
      this.props.onRootNodesLoaded(rootNodes.map((n) => n.payload));
    const current = this.state.current ? this._tree.node(this.state.current.payload.id) : undefined;
    if (current !== this.state.current)
      this.setState({ current });
  }

  private _onChildrenLoaded = (parentNode: BeInspireTreeNode<TreeNodeItem>) => {
    const children = parentNode.getChildren();
    if (this.props.onChildrenLoaded)
      this.props.onChildrenLoaded(parentNode.payload, toNodes<TreeNodeItem>(children).map((c) => c.payload));
    const current = this.state.current ? this._tree.node(this.state.current.payload.id) : undefined;
    if (current !== this.state.current)
      this.setState({ current });
  }

  private _onModelChanged = (_visibleNodes: Array<BeInspireTreeNode<TreeNodeItem>>) => {
  }

  private _onModelReady = () => {
    if (this._mounted)
      this.setState({ modelReady: true });
  }

  private _onTreeNodeChanged = (items?: TreeNodeItem[]) => {
    using((this._tree as any).pauseRendering(), async () => { // tslint:disable-line:no-floating-promises
      if (items) {
        for (const item of items) {
          if (item) {
            // specific node needs to be reloaded
            const node = this._tree.node(item.id);
            if (node) {
              node.assign(Breadcrumb.inspireNodeFromTreeNodeItem(item, Breadcrumb.inspireNodeFromTreeNodeItem.bind(this)));
              await node.loadChildren();
            }
          } else {
            // all root nodes need to be reloaded
            await this._tree.reload();
            await Promise.all(this._tree.nodes().map(async (n) => n.loadChildren()));
          }
        }
      }
    });
  }

  private static inspireNodeFromTreeNodeItem(item: TreeNodeItem, remapper: MapPayloadToInspireNodeCallback<TreeNodeItem>): BeInspireTreeNodeConfig {
    const node: BeInspireTreeNodeConfig = {
      id: item.id,
      text: item.label,
      itree: {
        state: { collapsed: false },
      },
    };
    if (item.icon)
      node.itree!.icon = item.icon;
    if ((item as DelayLoadedTreeNodeItem).hasChildren)
      node.children = true;
    else if ((item as ImmediatelyLoadedTreeNodeItem).children)
      node.children = (item as ImmediatelyLoadedTreeNodeItem).children!.map((p) => remapper(p, remapper));
    return node;
  }

  public render(): React.ReactNode {
    return (
      <React.StrictMode>
        <div
          className={classnames("breadcrumb", { background: this.props.background })}>
          <div className="breadcrumb-head"
            data-testid="breadcrumb-dropdown-input-parent">
            {this.props.dropdownOnly || this.props.staticOnly ?
              <BreadcrumbDropdown
                tree={this._tree}
                node={this.state.current}
                onNodeSelected={this._handleNodeSelected}
                renderNode={this.props.renderNode}
                staticOnly={this.props.staticOnly}
                showUpDir={this.props.showUpDir}
                parentsOnly={this.props.parentsOnly}
                width={this.props.width!} /> :
              <InputSwitch
                tree={this._tree}
                node={this.state.current}
                currentMode={this.state.currentMode}
                onInputStart={this._handleInputStart}
                onInputSubmit={this._handleInputSubmit}
                onInputCancel={this._handleInputCancel}
                onNodeSelected={this._handleNodeSelected}
                width={this.props.width!}
                showUpDir={this.props.showUpDir}
                parentsOnly={this.props.parentsOnly}
                delimiter={this.props.delimiter!}
                onOutsideClick={this._handleOutsideClick}
                renderNode={this.props.renderNode} />
            }
          </div>
        </div>
      </React.StrictMode>
    );
  }

  private _handleOutsideClick = () => {
    this.setState({ currentMode: BreadcrumbMode.Dropdown });
  }

  private _handleInputCancel = () => {
    this.setState({ currentMode: BreadcrumbMode.Dropdown });
  }

  private _handleInputSubmit = (node?: TreeNodeItem) => {
    if (this.props.path)
      this.props.path.setCurrentNode(node);
    else {
      if (!node) {
        this.setState({ current: undefined });
      } else {
        const iNode = this._tree.node(node.id);
        this.setState({ current: iNode });
      }
    }
    this.setState({ currentMode: BreadcrumbMode.Dropdown });
  }

  private _handleNodeSelected = (node?: TreeNodeItem) => {
    if (this.props.path)
      this.props.path.setCurrentNode(node);
  }

  private _handleInputStart = () => {
    this.setState({ currentMode: BreadcrumbMode.Input });
  }
}

/** @hidden */
export interface InputSwitchProps {
  tree: BeInspireTree<TreeNodeItem>;
  node?: BeInspireTreeNode<TreeNodeItem>;
  currentMode: BreadcrumbMode;
  onInputStart?: () => void;
  onInputSubmit?: (node?: TreeNodeItem) => void;
  onInputCancel?: () => void;
  onNodeSelected?: (node?: TreeNodeItem) => void;
  showUpDir?: boolean;
  parentsOnly?: boolean;
  renderNode?: BreadcrumbNodeRenderer;
  width: number | string;
  delimiter: string;
}

/** @hidden */
export class InputSwitchComponent extends React.PureComponent<InputSwitchProps> {
  public render(): React.ReactNode {
    const { currentMode, tree, node, onInputStart, onInputSubmit, onInputCancel, onNodeSelected, renderNode, width, showUpDir, delimiter } = this.props;
    switch (currentMode) {
      case BreadcrumbMode.Dropdown:
        return <BreadcrumbDropdown tree={tree} node={node} onNodeSelected={onNodeSelected} renderNode={renderNode} onInputStart={onInputStart} parentsOnly={this.props.parentsOnly} showUpDir={showUpDir} width={width} />;
      case BreadcrumbMode.Input:
        return <BreadcrumbInput tree={tree} node={node} onSubmit={onInputSubmit} onCancel={onInputCancel} parentsOnly={this.props.parentsOnly} delimiter={delimiter} width={width} />;
      default:
        throw new Error("Invalid Prop: currentMode. Must be of type BreadcrumbMode.");
    }
  }
}
/** @hidden */
const InputSwitch = withOnOutsideClick(InputSwitchComponent); // tslint:disable-line:variable-name

/** @hidden */
export interface BreadcrumbInputProps {
  width: number | string;
  delimiter?: string;

  onCancel?: () => void;
  onSubmit?: (path?: TreeNodeItem) => void;
  parentsOnly?: boolean;

  tree: BeInspireTree<TreeNodeItem>;
  node?: BeInspireTreeNode<TreeNodeItem>;
}

/** @hidden */
export interface BreadcrumbInputState {
  autocompleting: boolean;
  autocompleteList: string[];
}

/** @hidden */
export class BreadcrumbInput extends React.Component<BreadcrumbInputProps, BreadcrumbInputState> {
  private _inputElement: HTMLInputElement | null = null;
  private _autocomplete: ContextMenu | null = null;

  /** @hidden */
  public readonly state: Readonly<BreadcrumbInputState> = {
    autocompleting: false,
    autocompleteList: [],
  };

  public render(): JSX.Element {
    return (
      <div className="breadcrumb-input-root" data-testid="breadcrumb-input-root">
        <input
          className="breadcrumb-input"
          type="text"
          ref={(e) => { this._inputElement = e; }}
          style={{ width: this.props.width }}
          onKeyDown={this._handleKeyDown} onKeyUp={this._handleKeyUp}
          onChange={this._handleChange} onPaste={this._handleChange} onCut={this._handleChange} onFocus={this._handleChange} onClick={this._handleChange}
          spellCheck={false}></input>
        <div className="breadcrumb-close icon icon-close" data-testid="breadcrumb-input-close" onClick={this._handleClose} />
        <ContextMenu
          ref={(el) => { this._autocomplete = el; }}
          style={{ width: "100%" }}
          opened={this.state.autocompleting}
          edgeLimit={false}
          selectedIndex={0} floating={false} autoflip={false}
          onEsc={() => { if (this._inputElement) this._inputElement.focus(); }}
        >
          {this.state.autocompleteList.map((listItem, index) => {
            let l = 0;
            if (this._inputElement) {
              l = this._inputElement.value.length;
            }
            return (
              <ContextMenuItem
                key={index}
                onSelect={(event) => {
                  if (this._inputElement) {
                    this._inputElement.value = listItem;
                    this._inputElement.focus();
                    this._inputElement.setSelectionRange(listItem.length, listItem.length);

                    const autocompleteStr = this._inputElement.value.substring(0, this._inputElement.selectionEnd!);
                    this._getAutocompleteList(autocompleteStr).then((list) => { // tslint:disable-line:no-floating-promises
                      this.setState({
                        autocompleting: false,
                        autocompleteList: list,
                      });
                    });
                    event.stopPropagation();
                  }
                }}>
                <span className="breadcrumb-selected">{listItem.substr(0, l)}</span>{listItem.substr(l)}
              </ContextMenuItem>
            );
          })}
        </ContextMenu>
      </div>
    );
  }

  /** @hidden */
  public componentDidMount() {
    window.addEventListener("click", this._handleClick);
    if (this._inputElement) {
      this._inputElement.value = this.props.node ? this.props.node.getTextualHierarchy().join(this.props.delimiter) : "";
      this._inputElement.focus();
    }
  }

  /** @hidden */
  public componentWillUnmount() {
    window.removeEventListener("click", this._handleClick);
  }

  private _handleClose = () => {
    if (this.props.onCancel)
      this.props.onCancel();
    this.setState({ autocompleting: false });
  }

  private _getAutocompleteList = async (path: string) => {
    const node = await this._findChild(path);
    if (node) {
      const baseString = node.getTextualHierarchy().join(this.props.delimiter!);
      const children = typeof node.getChildren() === "boolean" ? await node.loadChildren() : node.getChildren();
      const parentChildren = this.props.parentsOnly ? children.filter((child) => child.hasOrWillHaveChildren()) : children;
      return parentChildren.map((n) => baseString + this.props.delimiter! + n.toString());
    } else {
      const nodes = this.props.tree.nodes();
      const parentRoots = this.props.parentsOnly ? nodes.filter((child) => child.hasOrWillHaveChildren()) : nodes;
      return parentRoots.map((n) => n.toString() + this.props.delimiter!);
    }
    return [];
  }

  private _findChild = async (p: string): Promise<BeInspireTreeNode<TreeNodeItem> | undefined> => {
    const delimiter = this.props.delimiter!;
    if (p.lastIndexOf(delimiter) === p.length - delimiter.length)
      p = p.substr(0, p.length - delimiter.length);
    if (p.length === 0)
      return undefined;
    const root = this.props.tree.nodes();
    for (const node of root) {
      const found = await this._find(node, p);
      if (found)
        return found;
    }
    return undefined;
  }
  private _find = async (node: BeInspireTreeNode<TreeNodeItem>, p: string): Promise<BeInspireTreeNode<TreeNodeItem> | undefined> => {
    const delimiter = this.props.delimiter!;
    // remove leading delimiter
    if (p.indexOf(delimiter) === 0)
      p = p.substr(delimiter.length);
    const { text } = node;
    if (text === p) {
      return node;
    }
    if (p.indexOf(text) === 0 && node.hasOrWillHaveChildren()) {
      const children = typeof node.getChildren() === "boolean" ? await node.loadChildren() : node.getChildren();
      for (const child of children) {
        const n = await this._find(child as BeInspireTreeNode<TreeNodeItem>, p.substr(text.length));
        if (n)
          return n;
      }
    }
    return undefined;
  }

  private _handleClick = (event: any): void => {
    if (this._autocomplete) {
      if (this._inputElement && event.target === this._inputElement) {
        this.setState({ autocompleting: false });
        this._inputElement.focus();
      }
    }
  }

  private _handleKeyDown = (event: any) => {
    switch (event.keyCode) {
      case 38: /*<Up>*/
      case 40: /*<Down>*/
        event.preventDefault();
    }
  }
  private _handleKeyUp = async (event: any) => {
    switch (event.keyCode) {
      case 27: /*<Esc>*/
        this.setState({ autocompleting: false });
        break;
      case 38: /*<Up>*/
      case 40: /*<Down>*/
        event.preventDefault();
        if (this._autocomplete && this.state.autocompleteList.length > 0) {
          this._autocomplete.focus();
          this.setState({ autocompleting: true });
        } else if (this._inputElement) {
          this._inputElement.focus();
        }
        break;
      case 13: /*<Return>*/
        if (this._inputElement) {
          if (this.props.onSubmit) {
            const path = this._inputElement.value;
            if (path === "" || path === this.props.delimiter!) {
              this.props.onSubmit(undefined);
              this.setState({ autocompleting: false });
            } else {
              const node = await this._findChild(path);
              if (node === undefined)
                alert(UiComponents.i18n.translate("UiComponents:breadcrumb.invalidBreadcrumbPath"));
              else {
                this.props.onSubmit(node.payload);
                this.setState({ autocompleting: false });
              }
            }
          }
        }
        break;
    }
  }

  private _handleChange = (): void => {
    if (this._inputElement) {
      const autocompleteStr = this._inputElement.value.substring(0, this._inputElement.selectionEnd!);
      this._getAutocompleteList(autocompleteStr).then((list) => { // tslint:disable-line:no-floating-promises
        this.setState({
          autocompleting: list.length > 0,
          autocompleteList: list,
        });
      });
    }
  }
}

/** @hidden */
export interface BreadcrumbDropdownProps {
  tree: BeInspireTree<TreeNodeItem>;
  node?: BeInspireTreeNode<TreeNodeItem>;
  onInputStart?: () => void;
  onNodeSelected?: (node: TreeNodeItem | undefined) => void;
  staticOnly?: boolean;
  parentsOnly?: boolean;
  delimiter?: string;
  width: number | string;
  showUpDir?: boolean;
  renderNode?: BreadcrumbNodeRenderer;
}

/** @hidden */
export class BreadcrumbDropdown extends React.Component<BreadcrumbDropdownProps> {

  /** @hidden */
  public componentDidMount() {
    if (this.props.node && this.props.node.hasOrWillHaveChildren() && !(this.props.node as any).hasLoadedChildren())
      this.props.node.loadChildren(); // tslint:disable-line:no-floating-promises
    this.props.tree.on(BeInspireTreeEvent.ChildrenLoaded, this._onChildrenLoaded);
    this.props.tree.on(BeInspireTreeEvent.ModelLoaded, this._onModelLoaded);
  }

  /** @hidden */
  public componentWillUnmount() {
    this.props.tree.removeListener(BeInspireTreeEvent.ChildrenLoaded, this._onChildrenLoaded);
    this.props.tree.removeListener(BeInspireTreeEvent.ModelLoaded, this._onModelLoaded);
  }

  private _onModelLoaded = (_rootNodes: BeInspireTreeNodes<TreeNodeItem>) => {
    this.forceUpdate();
  }

  private _onChildrenLoaded = (_parentNode: BeInspireTreeNode<TreeNodeItem>) => {
    this.forceUpdate();
  }

  /** @hidden */
  public shouldComponentUpdate(nextProps: BreadcrumbDropdownProps) {
    return this.props.tree !== nextProps.tree ||
      this.props.node !== nextProps.node ||
      (nextProps.node && nextProps.node.isDirty()) ||
      this.props.onInputStart !== nextProps.onInputStart ||
      this.props.delimiter !== nextProps.delimiter ||
      this.props.width !== nextProps.delimiter ||
      this.props.renderNode !== nextProps.renderNode;
  }

  public render(): JSX.Element | null {
    const node = this.props.node;
    let nodes: BeInspireTreeNodes<TreeNodeItem> | undefined;
    if (node) {
      nodes = toNodes<TreeNodeItem>(node.getParents());
      nodes.reverse();
      nodes.push(node);
    }
    return (
      <div
        className="breadcrumb-dropdown"
        data-testid="breadcrumb-dropdown-background"
        style={{ width: this.props.width! }}
        onClick={this._focusInput}>
        {!this.props.staticOnly && this.props.showUpDir ? <div className={classnames("breadcrumb-up-dir", "icon", "icon-sort-up", {
          root: this.props.node === undefined,
        })
        } onClick={this._handleUpClick} /> : undefined}
        <div className="breadcrumb-crumb-list"
          data-testid="breadcrumb-crumb-list">
          <BreadcrumbDropdownNode
            key={-1}
            tree={this.props.tree}
            node={undefined}
            onNodeSelected={this.props.onNodeSelected}
            staticOnly={this.props.staticOnly}
            parentsOnly={this.props.parentsOnly}
            last={!nodes || nodes.length === 0}
            renderNode={this.props.renderNode} />
          {nodes && nodes.map((n, i) => {
            return (
              <BreadcrumbDropdownNode
                key={i}
                tree={this.props.tree}
                node={n}
                onNodeSelected={this.props.onNodeSelected}
                staticOnly={this.props.staticOnly}
                parentsOnly={this.props.parentsOnly}
                last={i === nodes!.length - 1}
                renderNode={this.props.renderNode} />
            );
          })}
        </div>
      </div>
    );
  }

  private _handleUpClick = () => {
    if (this.props.onNodeSelected) {
      let parent: TreeNodeItem | undefined;
      if (this.props.node) {
        const p = (this.props.node.getParent()) as BeInspireTreeNode<TreeNodeItem>;
        if (p)
          parent = p.payload;
      }
      this.props.onNodeSelected(parent);
    }
  }

  private _focusInput = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget && this.props.onInputStart) // check if click is direct, or bubbled
      this.props.onInputStart();
  }
}

/** @hidden */
export interface BreadcrumbDropdownNodeProps {
  tree: BeInspireTree<TreeNodeItem>;
  node?: BeInspireTreeNode<TreeNodeItem>;
  onNodeSelected?: (node: TreeNodeItem | undefined) => void;
  staticOnly?: boolean;
  parentsOnly?: boolean;
  last?: boolean;
  renderNode?: BreadcrumbNodeRenderer;
}

/** @hidden */
export class BreadcrumbDropdownNode extends React.Component<BreadcrumbDropdownNodeProps> {
  constructor(props: BreadcrumbDropdownNodeProps) {
    super(props);
  }

  public render(): React.ReactNode {
    const { node } = this.props;
    let nodeChildren: Array<BeInspireTreeNode<TreeNodeItem>> = this.props.tree.nodes();
    if (node)
      nodeChildren = toNodes<TreeNodeItem>(node.getChildren());
    const n = node && node.payload;
    let parent: TreeNodeItem | undefined;
    if (node) {
      const p = node.getParent() as BeInspireTreeNode<TreeNodeItem>;
      if (p)
        parent = p.payload;
    }
    const label = n && n.label ? n.label : " ";
    const icon = n && n.icon ? n.icon : "icon-browse";
    const renderNode = this.props.renderNode ? this.props.renderNode : this.renderNode;
    if (this.props.parentsOnly)
      nodeChildren = nodeChildren.filter((child) => child.hasOrWillHaveChildren());
    if (nodeChildren.length > 0) {
      if (this.props.staticOnly) {
        return <span className="breadcrumb-split-button static">
          {renderNode({ label, icon }, n, parent)}
          {!this.props.last ? <span className="static-arrow-icon icon icon-chevron-right" /> : undefined}
        </span>;
      }
      return (
        <SplitButton
          className="breadcrumb-split-button"
          onClick={(event) => {
            event.stopPropagation();
            if (this.props.onNodeSelected)
              this.props.onNodeSelected(n);
          }}
          label={renderNode({ label, icon }, n, parent)}
        >
          {nodeChildren.map((child, d) => {
            return (
              <ContextMenuItem
                key={d}
                icon={child.payload.icon}
                onSelect={(_event) => {
                  if (this.props.onNodeSelected)
                    this.props.onNodeSelected(child.payload);
                }}>
                {child.payload.label}
              </ContextMenuItem>
            );
          })}
        </SplitButton>
      );
    } else {
      return (
        <span className={classnames("breadcrumb-end-node", { static: this.props.staticOnly })}>
          {renderNode({ label, icon }, n, parent)}
        </span>
      );
    }
  }

  // tslint:disable-next-line:naming-convention
  private renderNode = (props: BreadcrumbNodeProps, _node?: TreeNodeItem, _parent?: TreeNodeItem, _index?: number) => {
    return <BreadcrumbNode label={props.label} icon={props.icon} />;
  }
}

/** Property interface for [[BreadcrumbNode]] */
export interface BreadcrumbNodeProps {
  /** Icon class string */
  icon: string;
  /** Node label */
  label: string;
}

/** Default BreadcrumbNode component */
export class BreadcrumbNode extends React.Component<BreadcrumbNodeProps> {
  public render(): React.ReactNode {
    const { icon, label } = this.props;
    return <span><span className={classnames("icon", icon || "")} /> {label}</span>;
  }
}
