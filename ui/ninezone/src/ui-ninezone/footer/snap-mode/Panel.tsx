/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Panel.scss";

/** Properties of [[SnapModePanel]] component.
 * @beta
 */
export interface SnapModePanelProps extends CommonProps {
  /** Snap rows. I.e. [[Snap]] */
  children?: React.ReactNode;
  /** Dialog title. */
  title?: string;
}

/** Snap mode panel used with [[SnapMode]] component.
 * @note This is a presentational component and should be aligned with [[SnapMode]] component.
 * I.e. use [[FooterPopup]] to handle alignment.
 * @beta
 */
export class SnapModePanel extends React.PureComponent<SnapModePanelProps> {
  public render() {
    const className = classnames(
      "nz-footer-snapMode-panel",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-title">
          {this.props.title}
        </div>
        <div className="nz-snaps">
          {this.props.children}
        </div>
      </div>
    );
  }
}
