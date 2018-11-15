/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import Highlighter from "react-highlight-words";
import * as React from "react";
import { BeInspireTreeNode } from "./component/BeInspireTree";
import "./HighlightingEngine.scss";

/** @hidden */
export interface ActiveResultNode {
  id: string;
  index: number;
}

/** @hidden */
export interface HighlightableTreeProps {
  searchText: string;
  activeResultNode?: ActiveResultNode;
}

/** @hidden */
export interface HighlightableTreeNodeProps {
  searchText: string;
  activeResultIndex?: number;
}

/** @hidden */
export default class HighlightingEngine {
  private _searchText: string;
  private _activeResultNode?: ActiveResultNode;
  public static readonly ACTIVE_CLASS_NAME = "ui-components-activehighlight";

  constructor(props: HighlightableTreeProps) {
    this._searchText = props.searchText;
    this._activeResultNode = props.activeResultNode;
  }

  public isNodeActive(node: BeInspireTreeNode<any>) {
    return this._activeResultNode && node.id === this._activeResultNode.id;
  }

  public getActiveNodeIndex(node: BeInspireTreeNode<any>) {
    return this.isNodeActive(node) ? this._activeResultNode!.index : undefined;
  }

  public createRenderProps(node: BeInspireTreeNode<any>): HighlightableTreeNodeProps {
    return {
      searchText: this._searchText,
      activeResultIndex: this.getActiveNodeIndex(node),
    };
  }

  public static renderNodeLabel(text: string, props: HighlightableTreeNodeProps): React.ReactNode {
    return (
      <Highlighter
        searchWords={[props.searchText]}
        activeIndex={props.activeResultIndex as any} // .d.ts file seems to be wrong, doesn't work if it's a string
        activeClassName={HighlightingEngine.ACTIVE_CLASS_NAME}
        autoEscape={true}
        textToHighlight={text}
      />
    );
  }
}
