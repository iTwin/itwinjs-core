/*---------------------------------------------------------------------------------------------
 | $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Breadcrumb */

import * as React from "react";
import * as ReactDOM from "react-dom";
import classnames from "classnames";

import "./Breadcrumb.scss";
import { SplitButton } from "@bentley/ui-core";
import { TreeDataProvider, TreeNodeItem } from "../tree";
import { TableDataProvider, Table, TableDropTargetProps, RowItem, ColumnDescription } from "../table";
import { ContextMenu, ContextMenuItem } from "@bentley/ui-core";
import { BreadcrumbTreeUtils, DataRowItem } from "./BreadcrumbTreeUtils";
import { DropTargetArguments, DragSourceArguments, DragSourceProps, DropTargetProps } from "../dragdrop";
import { BreadcrumbPath, BreadcrumbUpdateEventArgs } from "./BreadcrumbPath";
import { DragDropBreadcrumbButton } from "./DragDropBreadcrumbButton";

enum BreadcrumbMode {
  Dropdown,
  Input,
}

/** Property interface for Breadcrumb */
export interface BreadcrumbProps {
  /** Manager to coordinate state between Breadcrumb element and BreadrcumbDetails element. */
  path: BreadcrumbPath;
  /** Data provider for tree content  */
  dataProvider: any;
  /**
   * Character used to separate discrete tree nodes in Breadcrumb text mode.
   * Default Value: ">"
   */
  delimiter?: string;
  /**
   * Width in pixels, if number, and in specified css units, if string.
   * Default value: "15em"
   */
  width?: number | string;

  dragProps?: DragSourceProps;
  dropProps?: DropTargetProps;
}

/** @hidden */
export interface BreadcrumbState {
  width: number | string;
  current?: TreeNodeItem;
  inputActive: boolean;
}

/**
 * Breadcrumb navigation component, with two discrete modes: text mode, and dropdown mode.
 * Text mode includes autocomplete suggestions.
 * Both dropdown and text mode support arrow and tab navigation.
 */
export class Breadcrumb extends React.Component<BreadcrumbProps, BreadcrumbState> {
  private _inputElement: HTMLInputElement | null = null;
  private _buttonElement: HTMLElement | null = null;

  public static defaultProps: Partial<BreadcrumbProps> = {
    delimiter: "\\",
    width: "",
  };

  /** @hidden */
  public readonly state: Readonly<BreadcrumbState> = {
    width: this.props.width!,
    inputActive: false,
  };

  public componentDidMount() {
    this.props.path.setDataProvider(this.props.dataProvider);
    this.props.path.BreadcrumbUpdateEvent.addListener(this._handleUpdate);
  }

  private _handleUpdate = (args: BreadcrumbUpdateEventArgs) => {
    this.setState({ current: args.currentNode });
  }

  public render(): React.ReactNode {
    const dragProps: DragSourceProps = {};
    if (this.props.dragProps) {
      const { onDragSourceBegin, onDragSourceEnd, objectType } = this.props.dragProps;
      dragProps.onDragSourceBegin = (args: DragSourceArguments) => {
        // boilerplate default
        return onDragSourceBegin ? onDragSourceBegin(args) : args;
      };
      dragProps.onDragSourceEnd = onDragSourceEnd;
      dragProps.objectType = objectType;
    }
    const dropProps: DropTargetProps = {};
    if (this.props.dropProps) {
      const { onDropTargetOver, onDropTargetDrop, canDropTargetDrop, objectTypes } = this.props.dropProps;
      dropProps.onDropTargetDrop = (args: DropTargetArguments): DropTargetArguments => {
        // boilerplate default
        return onDropTargetDrop ? onDropTargetDrop(args) : args;
      };
      dropProps.onDropTargetOver = onDropTargetOver;
      dropProps.canDropTargetDrop = (args: DropTargetArguments) => {
        return canDropTargetDrop ? canDropTargetDrop(args) : true;
      };
      dropProps.objectTypes = objectTypes;
    }
    return (
      <div
        className={classnames("breadcrumb", { "breadcrumb-active": this.state.inputActive })}>
        <div className={"breadcrumb-head"}>
          <BreadcrumbDropdown
            dataProvider={this.props.dataProvider}
            dragProps={dragProps}
            dropProps={dropProps}
            path={this.props.path}
            button={(el) => { this._buttonElement = el; }}
            current={this.state.current}
            onModeSwitch={this._handleModeSwitch}
            delimiter={this.props.delimiter}
            width={this.props.width!}
          />
          <BreadcrumbInput
            dataProvider={this.props.dataProvider}
            path={this.props.path}
            input={(el) => { this._inputElement = el; }}
            buttonElement={this._buttonElement}
            current={this.state.current}
            onModeSwitch={this._handleModeSwitch}
            delimiter={this.props.delimiter}
            width={this.props.width!} />
        </div>
      </div>
    );
  }

  private _handleModeSwitch = (type: BreadcrumbMode) => {
    switch (type) {
      case BreadcrumbMode.Dropdown:
        this.setState({ inputActive: false });
        break;
      case BreadcrumbMode.Input:
        this.setState({ inputActive: true }, () => {
          BreadcrumbTreeUtils.pathTo(this.props.dataProvider, this.state.current).then((pathList) => {
            if (this._inputElement) {
              this._inputElement.value = BreadcrumbTreeUtils.nodeListToString(pathList, this.props.delimiter!);
              this._inputElement.focus();
            }
          });
        });
        break;
    }
  }
}

export default Breadcrumb;

interface BreadcrumbInputProps {
  dataProvider: TreeDataProvider;
  path: BreadcrumbPath;
  buttonElement: HTMLElement | null;
  current?: TreeNodeItem;
  input: (el: HTMLInputElement | null) => void;
  onModeSwitch: (mode: BreadcrumbMode) => void;
  width: number | string;
  delimiter?: string;
}

interface BreadcrumbInputState {
  autocompleting: boolean;
  autocompletePath: ReadonlyArray<Readonly<TreeNodeItem>>;
  autocompleteItems: ReadonlyArray<Readonly<TreeNodeItem>>;
}

class BreadcrumbInput extends React.Component<BreadcrumbInputProps, BreadcrumbInputState> {
  private _inputElement: HTMLInputElement | null = null;
  private _autocomplete: ContextMenu | null = null;

  public readonly state: Readonly<BreadcrumbInputState> = {
    autocompleting: false,
    autocompletePath: [],
    autocompleteItems: [],
  };

  public render(): JSX.Element {
    let pathStr = BreadcrumbTreeUtils.nodeListToString(this.state.autocompletePath, this.props.delimiter!);
    if (pathStr.length > 0)
      pathStr += this.props.delimiter;

    let width = 0;
    if (this._inputElement) {
      const rect = this._inputElement.getBoundingClientRect();
      width = rect.width;
    }

    return (
      <>
        <input
          className={"breadcrumb-input"}
          type="text"
          ref={(e) => {
            this._inputElement = e;
            if (this.props.input) this.props.input(e);
          }}
          style={{ width: this.props.width }}
          onKeyDown={this._handleKeyDown}
          onKeyUp={this._handleKeyUp}
          onChange={this._handleChange} onPaste={this._handleChange} onCut={this._handleChange} onFocus={this._handleChange} onClick={this._handleChange}
          spellCheck={false}></input>
        <div className={"breadcrumb-close icon icon-close"} onClick={this._handleClear} />
        <ContextMenu
          ref={(el) => { this._autocomplete = el; }}
          opened={this.state.autocompleting}
          edgeLimit={false}
          style={{ width }}
          selected={0}
          floating={false}
          autoflip={false}
          onEsc={() => {
            if (this._inputElement) this._inputElement.focus();
          }}
        >
          {this.state.autocompleteItems.map((node, index) => {
            const p = pathStr + node.label;
            let l = 0;
            if (this._inputElement) {
              l = this._inputElement.value.length;
            }
            return (
              <ContextMenuItem
                key={index}
                onSelect={(event) => {
                  if (this._inputElement) {
                    const s = pathStr + node.label + this.props.delimiter;
                    this._inputElement.value = s;
                    this._inputElement.focus();
                    this._inputElement.setSelectionRange(s.length, s.length);

                    const autocompleteStr = this._inputElement.value.substring(0, this._inputElement.selectionEnd!);
                    BreadcrumbTreeUtils.findMatches(this.props.dataProvider, autocompleteStr, this.props.delimiter!, true)
                      .then((data) => {
                        this.setState({
                          autocompletePath: data.list,
                          autocompleteItems: data.items,
                          autocompleting: false,
                        });
                      });
                    event.stopPropagation();
                  }
                }}>
                <span className={"breadcrumb-selected"}>{p.substr(0, l)}</span>{p.substr(l)}
              </ContextMenuItem>
            );
          })}
        </ContextMenu>
      </>
    );
  }
  public componentDidMount() {
    window.addEventListener("click", this._handleClick);
    this.props.path.BreadcrumbUpdateEvent.addListener(this._handleUpdate);
  }

  private _handleUpdate = () => {
    this.setState({ autocompleting: false });
    this.props.onModeSwitch(BreadcrumbMode.Dropdown);
  }

  public componentWillUnmount() {
    window.removeEventListener("click", this._handleClick);
  }
  private _handleClear = (event: any) => {
    if (this._inputElement) {
      this._inputElement.value = "";
      this._handleChange();
      this._inputElement.focus();
      event.stopPropagation();
    }
  }
  private _handleClick = (event: any): void => {
    if (this._autocomplete) {
      const autocompleteElement = ReactDOM.findDOMNode(this._autocomplete);
      if (autocompleteElement && this.props.buttonElement) {
        const isAutocorrect = autocompleteElement.contains(event.target);
        if (event.target !== this.props.buttonElement && event.target !== this._inputElement && !isAutocorrect) {
          this.setState({ autocompleting: false });
          this.props.onModeSwitch(BreadcrumbMode.Dropdown);
        }
        if (this._inputElement && event.target === this._inputElement) {
          this.setState({ autocompleting: false });
          this._inputElement.focus();
        }
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
  private _handleKeyUp = (event: any) => {
    switch (event.keyCode) {
      case 27: /*<Esc>*/
        this.setState({ autocompleting: false });
        break;
      case 38: /*<Up>*/
      case 40: /*<Down>*/
        event.preventDefault();
        if (this._autocomplete && this.state.autocompleteItems.length > 0) {
          this._autocomplete.focus();
          this.setState({ autocompleting: true });
        } else if (this._inputElement) {
          this._inputElement.focus();
        }
        break;
      case 13: /*<Return>*/
        if (this._inputElement) {
          BreadcrumbTreeUtils.findChild(this.props.dataProvider, this._inputElement.value, this.props.delimiter!)
            .then((item) => {
              if (item !== undefined) {
                this.setState({ autocompleting: false });
                this.props.path.setCurrentNode(item);
                this.props.onModeSwitch(BreadcrumbMode.Dropdown);
              } else {
                alert("Not found. Please check your spelling and try again.");
              }
            });
        }
        break;
    }
  }

  private _handleChange = (): void => {
    if (this._inputElement) {
      const autocompleteStr = this._inputElement.value.substring(0, this._inputElement.selectionEnd!);
      BreadcrumbTreeUtils.findMatches(this.props.dataProvider, autocompleteStr, this.props.delimiter!, true)
        .then((data) => {
          this.setState({
            autocompletePath: data.list,
            autocompleteItems: data.items,
            autocompleting: data.items.length > 0,
          });
        });
    }
  }
}

interface BreadcrumbDropdownProps {
  current: TreeNodeItem | undefined;
  dataProvider: TreeDataProvider;
  path: BreadcrumbPath;
  button: (el: HTMLElement | null) => void;
  onModeSwitch: (mode: BreadcrumbMode) => void;
  delimiter?: string;
  width: number | string;

  dragProps: DragSourceProps;
  dropProps: DropTargetProps;
}

interface BreadcrumbDropdownState {
  nodes: ReadonlyArray<Readonly<TreeNodeItem> | undefined>;
  nodeChildren: Array<ReadonlyArray<Readonly<TreeNodeItem>>>;
}

class BreadcrumbDropdown extends React.Component<BreadcrumbDropdownProps, BreadcrumbDropdownState> {
  private _buttonElement: HTMLElement | null = null;
  private _treeRevision: number = 0;

  public readonly state: Readonly<BreadcrumbDropdownState> = {
    nodes: [],
    nodeChildren: [],
  };

  constructor(props: BreadcrumbDropdownProps) {
    super(props);
  }

  public componentDidMount() {
    this._updateTree(this.props.dataProvider, this.props.current);
    this.props.path.BreadcrumbUpdateEvent.addListener(this._pathUpdate);
    this.props.dataProvider.onTreeNodeChanged &&
      this.props.dataProvider.onTreeNodeChanged.addListener(this._treeUpdate);
  }

  private _pathUpdate = (args: BreadcrumbUpdateEventArgs) => {
    if (args.dataProvider)
      this._updateTree(args.dataProvider, args.currentNode);
  }

  private _treeUpdate = () => {
    this._updateTree(this.props.dataProvider, this.props.current);
  }

  public componentDidUpdate(prevProps: BreadcrumbDropdownProps) {
    if (!this.props.path.BreadcrumbUpdateEvent.has(this._pathUpdate)) {
      this.props.path.BreadcrumbUpdateEvent.addListener(this._pathUpdate);
      if (prevProps.path) {
        prevProps.path.BreadcrumbUpdateEvent.removeListener(this._pathUpdate);
      }
    }
  }

  public render(): JSX.Element {
    return (
      <div
        className={"breadcrumb-split-buttons"}
        ref={(e) => {
          this._buttonElement = e;
          if (this.props.button) this.props.button(e);
        }}
        style={{ width: this.props.width! }}
        onClick={this._focusInput}>
        <div className={classnames("breadcrumb-up-dir", "icon", "icon-sort-up", {
          root: this.props.current === undefined,
        })
        } onClick={this._handleUpClick} />
        {this.state.nodes.map((node, i) => {
          const label = node && "label" in node ? node.label : " ";
          let button = <div><span className={classnames("icon", (node && node.iconPath) || (!node && "icon-browse") || "")} /> {label}</div>;
          const { dragProps: drag, dropProps: drop } = this.props;
          if ((drag && (drag.onDragSourceBegin || drag.onDragSourceEnd)) ||
            (drop && (drop.onDropTargetOver || drop.onDropTargetDrop))) {
            const dragProps: DragSourceProps = {};
            if (drag) {
              const { onDragSourceBegin, onDragSourceEnd, objectType } = drag;
              dragProps.onDragSourceBegin = (args: DragSourceArguments) => {
                if (node && node.extendedData) {
                  args.dataObject = node.extendedData;
                  if ("parentId" in args.dataObject && args.dataObject.parentId === undefined) {
                    args.dataObject.parentId = this.props.dataProvider;
                  }
                  if (i > 0) {
                    const parent = this.state.nodes[i - 1];
                    args.parentObject = parent || this.props.dataProvider;
                  }
                }
                return onDragSourceBegin ? onDragSourceBegin(args) : args;
              };
              dragProps.onDragSourceEnd = (args: DragSourceArguments) => {
                if (onDragSourceEnd) {
                  if (i > 0) {
                    const parent = this.state.nodes[i - 1];
                    args.parentObject = parent || this.props.dataProvider;
                  }
                  onDragSourceEnd(args);
                }
              };
              dragProps.objectType = () => {
                if (objectType) {
                  if (typeof objectType === "function") {
                    if (node && node.extendedData) {
                      return objectType(node.extendedData);
                    }
                  } else
                    return objectType;
                }
                return "";
              };
            }
            const dropProps: DropTargetProps = {};
            if (drop) {
              const { onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes } = drop;
              dropProps.onDropTargetDrop = (args: DropTargetArguments): DropTargetArguments => {
                args.dropLocation = node || this.props.dataProvider;
                return onDropTargetDrop ? onDropTargetDrop(args) : args;
              };
              dropProps.onDropTargetOver = (args: DropTargetArguments) => {
                if (onDropTargetOver) {
                  args.dropLocation = node || this.props.dataProvider;
                  onDropTargetOver(args);
                }
              };
              dropProps.canDropTargetDrop = (args: DropTargetArguments) => {
                args.dropLocation = node || this.props.dataProvider;
                return canDropTargetDrop ? canDropTargetDrop(args) : true;
              };
              dropProps.objectTypes = objectTypes;
            }
            button = (
              <DragDropBreadcrumbButton dragProps={dragProps} dropProps={dropProps}>
                <span className={classnames("icon", (node && node.iconPath) || (!node && "icon-browse") || "")} /> {label}
              </DragDropBreadcrumbButton>
            );
          }
          if (this.state.nodeChildren[i].length > 0) {
            return (
              <SplitButton
                className={"breadcrumb-split-button"}
                key={i}
                onClick={(event) => {
                  event.stopPropagation();
                  this.props.path.setCurrentNode(node);
                }}
                label={button}
              >
                {this.state.nodeChildren[i].map((child, d) => {
                  return (
                    <ContextMenuItem
                      key={d}
                      icon={child.iconPath}
                      onSelect={(_event) => {
                        this.props.path.setCurrentNode(child);
                      }}>
                      {child.label}
                    </ContextMenuItem>
                  );
                })}
              </SplitButton>
            );
          } else {
            return (
              <span className={"breadcrumb-end-node"} key={i}>
                {button}
              </span>
            );
          }
        })}
      </div>
    );
  }

  private _handleUpClick = () => {
    if (this.props.current !== undefined) {
      BreadcrumbTreeUtils.pathTo(this.props.dataProvider, this.props.current).then((p) => {
        if (p.length > 1)
          this.props.path.setCurrentNode(p[p.length - 2]);
        else if (p.length === 1)
          this.props.path.setCurrentNode(undefined);
      });
    }
  }

  private _updateTree = async (dataProvider: TreeDataProvider, currentNode?: TreeNodeItem) => {
    const tree = dataProvider || this.props.dataProvider;
    const nodeChildren: Array<ReadonlyArray<Readonly<TreeNodeItem>>> = [];
    const rev = ++this._treeRevision;
    const nodes: ReadonlyArray<Readonly<TreeNodeItem> | undefined> = [undefined, ...await BreadcrumbTreeUtils.pathTo(tree, currentNode)];
    for (const i in nodes) {
      if (nodes.hasOwnProperty(i)) {
        if (nodes[i] === undefined) {
          nodeChildren[i] = await tree.getRootNodes({ size: 9999, start: 0 });
        } else {
          nodeChildren[i] = await tree.getChildNodes(nodes[i] as TreeNodeItem, { size: 9999, start: 0 });
        }
        nodeChildren[i] = nodeChildren[i].filter((child) => child === undefined || child.hasChildren);
      }
    }
    // check to see if tree has been updated in the meantime. ie. this update took too long.
    if (rev === this._treeRevision)
      this.setState({ nodes, nodeChildren });
  }

  private _focusInput = (event: any) => {
    if (event.target === this._buttonElement) {
      this.props.onModeSwitch(BreadcrumbMode.Input);
    }
  }
}

/** Property interface for BreadcrumbDetails */
export interface BreadcrumbDetailsProps {
  /** Path data object shared by Breadcrumb component */
  path: BreadcrumbPath;
  columns?: ColumnDescription[];

  dragProps?: DragSourceProps;
  dropProps?: DropTargetProps;
}

/** @hidden */
export interface BreadcrumbDetailsState {
  table?: TableDataProvider;
  childNodes?: ReadonlyArray<Readonly<TreeNodeItem>>;
}

export class BreadcrumbDetails extends React.Component<BreadcrumbDetailsProps, BreadcrumbDetailsState> {
  public static defaultProps: Partial<BreadcrumbDetailsProps> = {
    columns: [
      { key: "icon", label: "", icon: true },
      { key: "label", label: "Name" },
      { key: "description", label: "Description" },
    ],
  };

  public readonly state: BreadcrumbDetailsState = {};

  constructor(props: BreadcrumbDetailsProps) {
    super(props);
  }

  public componentDidMount() {
    const dataProvider = this.props.path.getDataProvider();
    const node = this.props.path.getCurrentNode();
    if (dataProvider) {
      this._updateTree(dataProvider, node);
      dataProvider.onTreeNodeChanged &&
        dataProvider.onTreeNodeChanged.addListener(this._treeChange);
      this.props.path.BreadcrumbUpdateEvent.addListener(this._pathChange);
    }
  }

  public componentDidUpdate(prevProps: BreadcrumbDetailsProps) {
    if (!this.props.path.BreadcrumbUpdateEvent.has(this._pathChange)) {
      this.props.path.BreadcrumbUpdateEvent.addListener(this._pathChange);
      if (prevProps.path) {
        prevProps.path.BreadcrumbUpdateEvent.removeListener(this._pathChange);
      }
    }
  }
  private _treeChange = () => {
    const dataProvider = this.props.path.getDataProvider();
    const node = this.props.path.getCurrentNode();
    if (dataProvider) {
      if (node) {
        dataProvider.getChildNodes(node, { size: 9999, start: 0 }).then((nodes) => {
          if (nodes.length === 0) {
            BreadcrumbTreeUtils.pathTo(dataProvider, node).then((p) => {
              if (p.length > 1)
                this.props.path.setCurrentNode(p[p.length - 2]);
              else if (p.length === 1)
                this.props.path.setCurrentNode(undefined);
              this._updateTree(dataProvider, node);
            });
          } else this._updateTree(dataProvider, node);
        });
      } else this._updateTree(dataProvider, undefined);
    }
  }
  private _pathChange = (args: BreadcrumbUpdateEventArgs) => {
    if (args.dataProvider) {
      this._updateTree(args.dataProvider, args.currentNode);
    }
  }
  private _updateTree = async (treeDataProvider: TreeDataProvider, node: TreeNodeItem | undefined) => {
    let childNodes: ReadonlyArray<Readonly<TreeNodeItem>> = [];
    if (node === undefined)
      childNodes = await treeDataProvider.getRootNodes({ size: 9999, start: 0 });
    else {
      childNodes = await treeDataProvider.getChildNodes(node, { size: 9999, start: 0 });
      if (childNodes.length === 0) {
        const p = await BreadcrumbTreeUtils.pathTo(treeDataProvider, node);
        if (p.length > 1)
          this.props.path.setCurrentNode(p[p.length - 2]);
        else if (p.length === 1)
          this.props.path.setCurrentNode(undefined);
      }
    }
    const table = BreadcrumbTreeUtils.aliasNodeListToTableDataProvider(childNodes, this.props.columns!);
    this.setState({ table, childNodes });
  }
  public render(): React.ReactElement<any> {
    const dataProvider = this.props.path.getDataProvider();
    const node = this.props.path.getCurrentNode();
    const { childNodes } = this.state;
    const dragProps: DragSourceProps = {};
    if (this.props.dragProps) {
      const { onDragSourceBegin, onDragSourceEnd, objectType } = this.props.dragProps;
      dragProps.onDragSourceBegin = (args: DragSourceArguments) => {
        if (args.dataObject) {
          args.dataObject.parentId = node ? node.id : dataProvider;
        }
        args.parentObject = node || dataProvider;
        return onDragSourceBegin ? onDragSourceBegin(args) : args;
      };
      dragProps.onDragSourceEnd = (args: DragSourceArguments) => {
        if (onDragSourceEnd) {
          args.parentObject = node || dataProvider;
          onDragSourceEnd(args);
        }
      };
      dragProps.objectType = (data: any) => {
        if (objectType) {
          if (typeof objectType === "function") {
            if (data && typeof data === "object") {
              data.parentId = node ? node.id : dataProvider;
            }
            return objectType(data);
          } else
            return objectType;
        }
        return "";
      };
    }
    const dropProps: TableDropTargetProps = { canDropOn: true };
    if (this.props.dropProps) {
      const { onDropTargetOver, onDropTargetDrop, canDropTargetDrop, objectTypes } = this.props.dropProps;
      dropProps.onDropTargetOver = (args: DropTargetArguments) => {
        if (onDropTargetOver) {
          args.dropLocation = node || dataProvider;
          if (childNodes && args.dropRect && args.row) {
            const relativeY = (args.clientOffset.y - args.dropRect.top) / args.dropRect.height;
            if (relativeY >= 1 / 3 && relativeY < 2 / 3) {
              const rowNum = args.row;
              args.row = undefined;
              args.dropLocation = childNodes[rowNum];
            }
          }
          onDropTargetOver(args);
        }
      };
      dropProps.onDropTargetDrop = (args: DropTargetArguments) => {
        args.dropLocation = node || dataProvider;
        if (childNodes && args.dropRect && args.row) {
          const relativeY = (args.clientOffset.y - args.dropRect.top) / args.dropRect.height;
          if (relativeY >= 1 / 3 && relativeY < 2 / 3) {
            const rowNum = args.row;
            args.row = undefined;
            args.dropLocation = childNodes[rowNum];
          }
        }
        if ("parentId" in args.dataObject && args.dataObject.parentId === undefined) {
          args.dataObject.parentId = dataProvider;
        }
        return onDropTargetDrop ? onDropTargetDrop(args) : args;
      };
      dropProps.canDropTargetDrop = (args: DropTargetArguments) => {
        args.dropLocation = node || dataProvider;
        if ("parentId" in args.dataObject && args.dataObject.parentId === undefined) {
          args.dataObject.parentId = this.props.path.getDataProvider();
        }
        return canDropTargetDrop ? canDropTargetDrop(args) : true;
      };
      dropProps.objectTypes = objectTypes;
    }
    return (
      <div className="breadcrumb-details">
        {
          this.state.table &&
          <Table
            dataProvider={this.state.table}
            dragProps={dragProps}
            dropProps={dropProps}
            onRowsSelected={async (rowIterator: AsyncIterableIterator<RowItem>, replace: boolean) => {
              const iteratorResult = await rowIterator.next();
              if (!iteratorResult.done) {
                const row = iteratorResult.value as DataRowItem;
                if ("_node" in row && row._node && row._node.hasChildren) {
                  this.props.path.setCurrentNode(row._node);
                  if (dataProvider)
                    this._updateTree(dataProvider, row._node);
                }
              }
              return replace;
            }}
          />
        }
      </div>
    );
  }
}
