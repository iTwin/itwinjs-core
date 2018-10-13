/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import classnames from "classnames";
import * as React from "react";

import "./Tree.scss";

/** Props for the Tree presentational React component */
export interface TreeProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** Presentation React component for a Tree */
export default class Tree extends React.Component<TreeProps> {
  private _treeElement: React.RefObject<HTMLDivElement> = React.createRef();

  /**
   * @param elementBoundingBox Node DOM Element bounding box relative to viewport
   */
  public scrollToElement(elementBoundingBox: ClientRect | DOMRect) {
    if (!this._treeElement.current)
      return;

    const treeBox = this._treeElement.current.getBoundingClientRect();
    const relativeX = elementBoundingBox.left - treeBox.left + this._treeElement.current.scrollLeft;
    const relativeY = elementBoundingBox.top - treeBox.top + this._treeElement.current.scrollTop;
    this._treeElement.current.scrollTo(
      Math.max(0, relativeX - treeBox.width + elementBoundingBox.width + 30),
      relativeY);

  }

  public render() {
    const className = classnames(
      "nz-tree-tree",
      this.props.className);

    return (
      <div ref={this._treeElement}
        className={className}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }
}
