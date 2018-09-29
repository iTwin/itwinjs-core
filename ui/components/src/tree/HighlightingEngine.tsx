/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import Highlighter from "react-highlight-words";
import * as React from "react";
import { InspireTreeNode } from "./component/BeInspireTree";
import "./HighlightingEngine.scss";

/** @hidden */
export interface ActiveResultNode {
  id: string;
  index: number;
}

/** @hidden */
export interface IScrollableElement {
  scrollToElement: (elementBoundingBox: ClientRect | DOMRect) => void;
}

/** @hidden */
export interface HighlightableTreeProps {
  searchText: string;
  activeResultNode?: ActiveResultNode;
}

/** @hidden */
export default class HighlightingEngine {
  private _searchText: string;
  private _activeResultNode?: ActiveResultNode;
  private _activeResultReactDom: React.RefObject<HTMLSpanElement> = React.createRef();

  constructor(props: HighlightableTreeProps) {
    this._searchText = props.searchText;
    this._activeResultNode = props.activeResultNode;
  }

  public isNodeActive(node: InspireTreeNode) {
    return this._activeResultNode && node.id === this._activeResultNode.id;
  }

  public getActiveNodeIndex(node: InspireTreeNode) {
    return this.isNodeActive(node) ? this._activeResultNode!.index : undefined;
  }

  public scrollToActiveNode(scrollableContainer: IScrollableElement) {
    if (this._activeResultReactDom.current) {
      // Workaround for edge scrollTo issue https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/15534521/
      if (!Element.prototype.scrollTo) {
        this._activeResultReactDom.current.scrollIntoView();
        return;
      }
      const highlightedElement = this._activeResultReactDom.current.getElementsByClassName("ui-components-activehighlight")[0];

      if (highlightedElement)
        scrollableContainer.scrollToElement(highlightedElement.getBoundingClientRect());
    }
  }

  public getNodeLabelComponent(node: InspireTreeNode) {
    if (node.text && this._searchText) {
      const activeIndex = this.getActiveNodeIndex(node);

      return (
        <span ref={activeIndex !== undefined ? this._activeResultReactDom : undefined}>
          <Highlighter
            searchWords={[this._searchText]}
            activeIndex={activeIndex as any} // .d.ts file seems to be wrong, doesn't work if it's a string
            activeClassName="ui-components-activehighlight"
            autoEscape={true}
            textToHighlight={node.text}
          />
        </span>
      );
    }
    return node.text;
  }
}
