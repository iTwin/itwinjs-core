/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Snap.scss";

/** Properties of [[Snap]] component.
 * @beta
 */
export interface SnapProps extends CommonProps {
  /** Label of snap row. */
  children?: string;
  /** Snap row icon. I.e. [[SnapModeIcon]] */
  icon?: React.ReactNode;
  /** Describes if the snap row is active. */
  isActive?: boolean;
  /** Function called when the Snap component is clicked. */
  onClick?: () => void;
}

/** Snap row used in [[SnapModePanel]] component.
 * @beta
 */
export class Snap extends React.PureComponent<SnapProps> {
  public render() {
    const dialogClassName = classnames(
      "nz-footer-snapMode-snap",
      this.props.isActive && "nz-active",
      this.props.className);

    return (
      <div
        onClick={this.props.onClick}
        className={dialogClassName}
        style={this.props.style}
      >
        {this.props.icon === undefined ? undefined :
          <div>
            {this.props.icon}
          </div>
        }
        <div>
          {this.props.children}
        </div>
      </div>
    );
  }
}
