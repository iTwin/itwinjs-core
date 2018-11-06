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
export interface IScrollableElement {
  scrollToElement: (elementBoundingBox: ClientRect | DOMRect) => void;
  getElementsByClassName: (className: string) => Element[];
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

  public static scrollToActiveNode(scrollableContainer: IScrollableElement) {
    const scrollTo = scrollableContainer.getElementsByClassName("ui-components-activehighlight");
    if (scrollTo.length === 0)
      return;

    if (!Element.prototype.scrollTo) {
      // workaround for Edge scrollTo issue https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/15534521/
      scrollTo[0].scrollIntoView();
    } else {
      scrollableContainer.scrollToElement(scrollTo[0].getBoundingClientRect());
    }
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
        activeClassName="ui-components-activehighlight"
        autoEscape={true}
        textToHighlight={text}
      />
    );
  }
}
