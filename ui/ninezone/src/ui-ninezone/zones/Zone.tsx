/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { CssProperties } from "../utilities/Css";
import { RectangleProps } from "../utilities/Rectangle";
import { CommonProps } from "@bentley/ui-core";
import "./Zone.scss";

/** Properties of [[Zone]] component.
 * @beta
 */
export interface ZoneProps extends CommonProps {
  /** Zone bounds. */
  bounds: RectangleProps;
  /** Zone content. I.e. [[Stacked]], [[Footer]], [[ToolSettings]], [[ToolSettingsTab]], [[GhostOutline]] */
  children?: React.ReactNode;
  /** Describes if the zone is in footer mode. */
  isInFooterMode?: boolean;
  /** Describes if the zone component is hidden. */
  isHidden?: boolean;
}

/** Zone component of 9-Zone UI app.
 * @beta
 */
export class Zone extends React.PureComponent<ZoneProps> {
  public render() {
    const className = classnames(
      "nz-zones-zone",
      this.props.isInFooterMode && "nz-footer-mode",
      this.props.isHidden && "nz-hidden",
      this.props.className);

    const style: React.CSSProperties = {
      ...CssProperties.fromBounds(this.props.bounds),
      ...this.props.style,
    };

    return (
      <div
        className={className}
        style={style}
      >
        {this.props.children}
      </div>
    );
  }
}
