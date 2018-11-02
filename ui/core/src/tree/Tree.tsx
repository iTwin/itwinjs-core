/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import classnames from "classnames";
import * as React from "react";

import "./Tree.scss";

/** Properties for the [[Tree]] presentational React component */
export interface TreeProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
  onMouseMove?: React.MouseEventHandler<HTMLDivElement>;
  onMouseUp?: React.MouseEventHandler<HTMLDivElement>;
}

/** Presentation React component for a Tree */
export default class Tree extends React.PureComponent<TreeProps> {
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

  public getElementsByClassName(className: string): Element[] {
    return this._treeElement.current ? [...this._treeElement.current.getElementsByClassName(className)] : [];
  }

  public render() {
    const className = classnames(
      "nz-tree-tree",
      this.props.className);

    return (
      <div ref={this._treeElement}
        className={className}
        style={this.props.style}
        onMouseDown={this.props.onMouseDown}
        onMouseMove={this.props.onMouseMove}
        onMouseUp={this.props.onMouseUp}
      >
        {this.props.children}
      </div>
    );
  }
}
