/*---------------------------------------------------------------------------------------------
 | $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Breadcrumb */

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as classnames from "classnames";

import "./Breadcrumb.scss";
import { SplitButton } from "@bentley/ui-core";
import { ContextMenu, ContextMenuItem } from "@bentley/ui-core";
import { BreadcrumbItem, BreadcrumbRoot, BreadcrumbNode } from "./BreadcrumbTreeData";
import { BreadcrumbPath, BreadcrumbUpdateEventArgs } from "./BreadcrumbPath";

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
}

/** @hidden */
export interface BreadcrumbState {
  width: number | string;
  currentTree: BreadcrumbItem;
  inputActive: boolean;
  autocompleting: boolean;
  autocompleteList: BreadcrumbNode[];
}

/**
 * Breadcrumb navigation component, with two discrete modes: text mode, and dropdown mode.
 * Text mode includes autocomplete suggestions.
 * Both dropdown and text mode support arrow and tab navigation.
 */
export class Breadcrumb extends React.Component<BreadcrumbProps, BreadcrumbState> {
  private _inputElement: HTMLInputElement | null = null;
  private _buttonElement: HTMLElement | null = null;
  private root: BreadcrumbRoot;

  public static defaultProps: Partial<BreadcrumbProps> = {
    delimiter: "\\",
    width: "",
  };

  /** @hidden */
  public readonly state: Readonly<BreadcrumbState> = {
    width: this.props.width!,
    currentTree: this.root,
    inputActive: false,
    autocompleting: false,
    autocompleteList: [],
  };

  constructor(props: BreadcrumbProps) {
    super(props);
    this.root = new BreadcrumbRoot(this.props.dataProvider, "", this.props.delimiter);
  }

  public componentDidMount() {
    this.props.path.setBreadcrumbData(this.root, this.root);
    this.props.path.BreadcrumbUpdateEvent.addListener(this.handleUpdate);
  }

  private handleUpdate = (args: BreadcrumbUpdateEventArgs) => {
    if (args.root)
      this.root = args.root;
    if (args.currentNode)
      this.setState({ currentTree: args.currentNode });
  }

  public render(): React.ReactNode {
    return (
      <div
        className={classnames("breadcrumb", { "breadcrumb-active": this.state.inputActive })}>
        <div className={"breadcrumb-head"}>
          <BreadcrumbDropdown
            root={this.root}
            button={(el) => { this._buttonElement = el; }}
            current={this.state.currentTree}
            onModeSwitch={this.handleModeSwitch}
            onTreeChange={this.handleTreeChange}
            width={this.props.width!} />
          <BreadcrumbInput
            root={this.root}
            input={(el) => { this._inputElement = el; }}
            buttonElement={this._buttonElement}
            current={this.state.currentTree}
            onModeSwitch={this.handleModeSwitch}
            onTreeChange={this.handleTreeChange}
            width={this.props.width!} />
        </div>
      </div>
    );
  }

  private handleTreeChange = (tree: BreadcrumbItem) => {
    this.setState({ currentTree: tree });
    this.props.path.setBreadcrumbData(this.root, tree);
  }

  private handleModeSwitch = (type: BreadcrumbMode, newTree?: BreadcrumbItem) => {
    switch (type) {
      case BreadcrumbMode.Dropdown:
        if (newTree) {
          this.setState({ currentTree: newTree }, () => {
            this.setState({ inputActive: false });
          });
        } else {
          this.setState({ inputActive: false });
        }
        break;
      case BreadcrumbMode.Input:
        this.setState({ inputActive: true }, () => {
          this.root.pathTo(this.state.currentTree).then((pathList) => {
            if (this._inputElement) {
              this._inputElement.value = this.root.nodeListToString(pathList);
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
  root: BreadcrumbRoot;
  buttonElement: HTMLElement | null;
  current: BreadcrumbItem;
  input: (el: HTMLInputElement | null) => void;
  onModeSwitch: (mode: BreadcrumbMode, tree?: BreadcrumbItem) => void;
  onTreeChange: (tree: BreadcrumbItem) => void;
  width: number | string;
}

interface BreadcrumbInputState {
  autocompleting: boolean;
  autocompletePath: BreadcrumbItem[];
  autocompleteItems: BreadcrumbNode[];
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
    let path = this.props.root.nodeListToString(this.state.autocompletePath);
    if (path.length > 0)
      path += this.props.root.delimiter;

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
          onKeyDown={this.handleKeyDown}
          onKeyUp={this.handleKeyUp}
          onChange={this.handleChange} onPaste={this.handleChange} onCut={this.handleChange} onFocus={this.handleChange} onClick={this.handleChange}
          spellCheck={false}></input>
        <div className={"breadcrumb-close icon icon-close"} onClick={this.handleClear} />
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
            const p = path + node.label;
            let l = 0;
            if (this._inputElement) {
              l = this._inputElement.value.length;
            }
            return (
              <ContextMenuItem
                key={index}
                onSelect={(event) => {
                  if (this._inputElement) {
                    const s = path + node.label + this.props.root.delimiter;
                    this._inputElement.value = s;
                    this._inputElement.focus();
                    this._inputElement.setSelectionRange(s.length, s.length);

                    this.updateList().then((autocompleteData) => {
                      this.setState({
                        autocompleting: false,
                        autocompleteItems: autocompleteData.items,
                        autocompletePath: autocompleteData.list,
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
    window.addEventListener("click", this.handleClick);
  }

  public componentWillUnmount() {
    window.removeEventListener("click", this.handleClick);
  }
  private handleClear = (event: any) => {
    if (this._inputElement) {
      this._inputElement.value = "";
      this.handleChange();
      this._inputElement.focus();
      event.stopPropagation();
    }
  }
  private handleClick = (event: any): void => {
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

  private handleKeyDown = (event: any) => {
    switch (event.keyCode) {
      case 38: /*<Up>*/
      case 40: /*<Down>*/
        event.preventDefault();
    }
  }
  private handleKeyUp = (event: any) => {
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
          this.props.root.findChild(this._inputElement.value).then((item) => {
            if (item !== undefined) {
              const i = item as BreadcrumbItem;
              this.setState({ autocompleting: false });
              this.props.onTreeChange(i);
              this.props.onModeSwitch(BreadcrumbMode.Dropdown, i);
            } else {
              alert("Not found. Please check your spelling and try again.");
            }
          });
        }
        break;
    }
  }

  private handleChange = (): void => {
    if (this._inputElement) {
      this.updateList().then((autocompleteData) => {
        this.setState({
          autocompletePath: autocompleteData.list,
          autocompleteItems: autocompleteData.items,
          autocompleting: autocompleteData.items.length > 0,
        });
      });
    }
  }

  private updateList = async (): Promise<{ items: BreadcrumbNode[], list: BreadcrumbItem[] }> => {
    if (this._inputElement) {
      const autocompleteStr = this._inputElement.value.substring(0, this._inputElement.selectionEnd!);
      return await this.props.root.findMatches(autocompleteStr, true);
    }
    return { items: [], list: [] };
  }

}

interface BreadcrumbDropdownProps {
  current: BreadcrumbItem;
  root: BreadcrumbRoot;
  button: (el: HTMLElement | null) => void;
  onModeSwitch: (mode: BreadcrumbMode, tree?: BreadcrumbItem) => void;
  onTreeChange: (tree: BreadcrumbItem) => void;
  width: number | string;
}

interface BreadcrumbDropdownState {
  nodes: BreadcrumbItem[];
  nodeChildren: BreadcrumbNode[][];
}

class BreadcrumbDropdown extends React.Component<BreadcrumbDropdownProps, BreadcrumbDropdownState> {
  private _buttonElement: HTMLElement | null = null;
  private _treeRevision: number  = 0;

  public readonly state: Readonly<BreadcrumbDropdownState> = {
    nodes: [],
    nodeChildren: [],
  };

  public componentDidMount() {
    this.updateTree();
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
        onClick={this.focusInput}>
        <div className={classnames("breadcrumb-up-dir", "icon", "icon-sort-up", {
          root: this.props.current && this.props.current.equals(this.props.root) })
        } onClick={this.handleUpClick} />
        {this.state.nodes.map((node, i) => {
          const label = "label" in node ? node.label : " ";
          if (this.state.nodeChildren[i] && this.state.nodeChildren[i].length > 0) {
            return (
              <SplitButton
                className={"breadcrumb-split-button"}
                icon={node.icon}
                key={i}
                onClick={(event) => {
                  event.stopPropagation();
                  this.updateTree().then(() => {
                    this.props.onTreeChange(node);
                  });
                }}
                label={label}>
                {this.state.nodeChildren[i].map((child, d) => {
                  return (
                    <ContextMenuItem
                      key={d}
                      icon={child.icon}
                      onSelect={(_event) => {
                        this.updateTree().then(() => {
                          this.props.onTreeChange(child);
                        });
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
                <span className={classnames("icon", node.icon)} /> {label}
              </span>
            );
          }
        })}
      </div>
    );
  }

  private handleUpClick = () => {
    if (!this.props.current.equals(this.props.root) && "parent" in this.props.current)
      this.props.onTreeChange(this.props.current.parent);
  }

  public componentDidUpdate(prevProps: BreadcrumbDropdownProps) {
    if (prevProps.current !== this.props.current || prevProps.root !== this.props.root) {
      this.updateTree();
    }
  }
  private updateTree = async () => {
    const nodeChildren: BreadcrumbNode[][] = [];
    const rev = ++this._treeRevision;
    const nodes: BreadcrumbItem[] = await this.props.root.pathTo(this.props.current);
    for (const i in nodes) {
      if (nodes.hasOwnProperty(i)) {
        if (nodes[i] === this.props.root) {
          nodeChildren[i] = await this.props.root.loadRoot();
        } else {
          nodeChildren[i] = await this.props.root.loadChildren(nodes[i] as BreadcrumbNode);
        }
        nodeChildren[i] = nodeChildren[i].filter((child) => child.hasChildren);
      }
    }
    // check to see if tree has been updated in the meantime. ie. this update took too long.
    if (rev === this._treeRevision)
      this.setState({ nodes, nodeChildren });
  }

  private focusInput = (event: any) => {
    if (event.target === this._buttonElement) {
      this.props.onModeSwitch(BreadcrumbMode.Input);
    }
  }
}

/** Property interface for BreadcrumbDetails */
export interface BreadcrumbDetailsProps {
  /** Path data object shared by Breadcrumb component */
  path: BreadcrumbPath;
}

/** @hidden */
export interface BreadcrumbDetailsState {
  root?: BreadcrumbRoot;
  node?: BreadcrumbItem;
  childNodes: BreadcrumbNode[];
  selected: number;
}

/** Breadcrumb Details view */
export class BreadcrumbDetails extends React.Component<BreadcrumbDetailsProps, BreadcrumbDetailsState> {

  /** @hidden */
  public readonly state: Readonly<BreadcrumbDetailsState> = {
    childNodes: [],
    selected: -1,
  };

  public componentDidMount() {
    const root = this.props.path.getRoot();
    const node = this.props.path.getCurrentNode();
    if (root && node)
      this.updateTree(root, node);
    this.props.path.BreadcrumbUpdateEvent.addListener(this.handleUpdate);
  }

  private handleUpdate = (args: BreadcrumbUpdateEventArgs) => {
    this.updateTree(args.root, args.currentNode);
  }

  private handleBlur = () => {
    this.setState({ selected: -1 });
  }

  private handleKeyUp = (event: any) => {
    let { selected } = this.state;
    switch (event.keyCode) {
      case 27: /*<Esc>*/
        selected = -1;
        break;
      case 38: /*<Up>*/
      case 40: /*<Down>*/
        if (selected === -1)
          selected = 0;
        else {
          if (event.keyCode === 38) {
            if (selected === 0)
              selected = this.state.childNodes.length - 1;
            else
              selected--;
          } else {
            if (selected === this.state.childNodes.length - 1)
              selected = 0;
            else
              selected++;
          }
        }
        break;
      case 13: /*<Return>*/
      case 39: /*<Right>*/
        if (this.state.selected >= 0 && this.state.selected < this.state.childNodes.length) {
          const child = this.state.childNodes[this.state.selected];
          if (child && child.hasChildren) {
            selected = 0;
            this.props.path.setBreadcrumbData(undefined, child);
          }
        }
        break;
      case 8: /*<Backspace>*/
      case 37: /*<Left>*/
        if (this.state.node && this.state.root && "parent" in this.state.node && this.state.node.parent) {
          selected = 0;
          this.props.path.setBreadcrumbData(undefined, this.state.node.parent);
        }
        break;
    }
    this.setState({ selected });
  }

  public render(): JSX.Element {
    return (
      <div className={"breadcrumb-details"} tabIndex={-1} onKeyUp={this.handleKeyUp} onBlur={this.handleBlur}>
        {this.state.childNodes.map((child, i) => {
          return (
            <BreadcrumbDetailRow
              key={i}
              className={classnames({ selected: this.state.selected === i })}
              icon={child.hasChildren ? "icon-folder" : (child.icon || "")}
              onClick={() => {
                this.setState({ selected: i });
              }}
              onDoubleClick={(event) => {
                event.preventDefault();
                if (child.hasChildren)
                  this.props.path.setBreadcrumbData(undefined, child);
              }}>{child.label}</BreadcrumbDetailRow>
          );
        })}
      </div>
    );
  }
  private updateTree = async (root: BreadcrumbRoot, node: BreadcrumbItem) => {
    let childNodes: BreadcrumbNode[] = [];
    if (node.equals(root))
      childNodes = await root.loadRoot();
    else
      childNodes = await root.loadChildren(node as BreadcrumbNode);

    this.setState({ node, root, childNodes });
  }
}

interface BreadcrumbDetailRowProps {
  icon: string;
  className?: string;
  onClick?: (event: any) => any;
  onDoubleClick?: (event: any) => any;
}

class BreadcrumbDetailRow extends React.Component<BreadcrumbDetailRowProps> {
  public render(): JSX.Element {
    return (
      <div className={classnames("breadcrumb-detail-row", this.props.className)} onClick={this.props.onClick} onDoubleClick={this.props.onDoubleClick}>
        <div className={classnames("breadcrumb-detail-icon", "icon", this.props.icon)} />
        <div className={"breadcrumb-detail-content"}>{this.props.children}</div>
      </div>
    );
  }
}
