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
import "./Outline.scss";

/** Properties of [[OutlineProps]] component.
 * @beta
 */
export interface OutlineProps extends CommonProps {
  /** Outline bounds. */
  bounds: RectangleProps;
}

/** Zone outline displayed when merging/unmerging zones.
 * @beta
 */
export class Outline extends React.PureComponent<OutlineProps> {
  public render() {
    const className = classnames(
      "nz-zones-outline",
      this.props.className);

    const style: React.CSSProperties = {
      ...CssProperties.fromBounds(this.props.bounds),
      ...this.props.style,
    };

    return (
      <div
        className={className}
        style={style}
      />
    );
  }
}
