/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as classnames from "classnames";
import * as React from "react";
import { LEVEL_OFFSET } from "./Node";
import "./Placeholder.scss";

/** Properties for the [[TreeNodePlaceholder]] React component
 * @public
 */
export interface TreeNodePlaceholderProps {
  level: number;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  ["data-testid"]?: string;
}

/**
 * Presentation React component for a placeholder to be displayed instead of a node while it's being loaded
 * @public
 */
export class TreeNodePlaceholder extends React.PureComponent<TreeNodePlaceholderProps> {
  public render() {
    const className = classnames("core-tree-placeholder", this.props.className);
    const offset = this.props.level * LEVEL_OFFSET;
    const min = (this.props.minWidth || 50);
    const max = (this.props.maxWidth || 200);
    const width = Math.floor(min + Math.random() * (max - min));
    const style = { ...this.props.style, paddingLeft: `${offset}px` };
    return (
      <div
        className={className}
        style={style}
        data-testid={this.props["data-testid"]}
      >
        <div className="contents" style={{ width: `${width}px` }} />
      </div>
    );
  }
}
