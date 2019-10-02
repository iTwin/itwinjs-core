/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module AccuDraw */

import * as React from "react";
import * as classnames from "classnames";
import { CommonProps, Point, PointProps } from "@bentley/ui-core";
import "./CircularHandle.scss";

/** @alpha */
export interface CircularHandleProps extends CommonProps {
  /** Center point */
  point: PointProps;
  /** Size in pixels */
  size: number;
}

/** @alpha */
export class CircularHandle extends React.PureComponent<CircularHandleProps> {
  public render() {
    const size = this.props.size + "px";
    const point = Point.create(this.props.point);
    const offset = Math.floor(this.props.size / 2);
    const newPoint = point.offset({ x: -offset, y: -offset });

    const className = classnames(
      "uifw-circular-handle",
      this.props.className,
    );
    const style: React.CSSProperties = {
      ...this.props.style,
      width: size,
      height: size,
      top: newPoint.y,
      left: newPoint.x,
    };

    return (
      <div className={className} style={style} />
    );
  }
}
