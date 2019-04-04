/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../utilities/Props";
import "./Zone.scss";
import { RectangleProps } from "../utilities/Rectangle";
import { CssProperties } from "../utilities/Css";

/** Properties of [[Zone]] component. */
export interface ZoneProps extends CommonProps {
  /** Actual bounds of this [[Zone]]. */
  bounds: RectangleProps;
  /** Zone content. Available widgets: [[Stacked]], [[Tools]] */
  children?: React.ReactNode;
}

/**
 * A zone that may contain widgets.
 * @note For zone 2 use [[ToolSettingsZone]] component.
 * @note For zone 8 use [[StatusZone]] component.
 */
export class Zone extends React.PureComponent<ZoneProps> {
  public render() {
    const className = classnames(
      "nz-zones-zone",
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
