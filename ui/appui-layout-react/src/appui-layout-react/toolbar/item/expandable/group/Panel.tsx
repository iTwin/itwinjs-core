/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import "./Panel.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@itwin/core-react";

/** Properties of [[Panel]] component.
 * @deprecated
 * @alpha
 */
export interface PanelProps extends CommonProps {
  /** Panel content. */
  children?: React.ReactNode;
}

/** Basic panel used in [[ExpandableItem]]. Used as base in [[Group]] and [[NestedGroup]] components.
 * @deprecated
 * @alpha
 */
export class Panel extends React.PureComponent<PanelProps> {
  private static _groupPanelClassName = "nz-toolbar-item-expandable-group-panel";

  public override render() {
    const className = classnames(
      Panel._groupPanelClassName,
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }

  /** Determines if an expandable group panel is open.
   * @deprecated
   */
  public static get isPanelOpen(): boolean {
    return (document.getElementsByClassName(Panel._groupPanelClassName).length > 0);
  }
}
