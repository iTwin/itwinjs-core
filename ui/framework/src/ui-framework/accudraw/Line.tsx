/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module AccuDraw */

import * as React from "react";
import * as classnames from "classnames";
import { CommonProps, PointProps } from "@bentley/ui-core";
import "./Line.scss";

/** @alpha */
export interface LineProps extends CommonProps {
  start: PointProps;
  end: PointProps;
}

interface LineInfo {
  topLeft: PointProps;
  width: number;
  slopeInDegrees: number;
}

/** @alpha */
export class Line extends React.Component<LineProps> {

  private createLine(start: PointProps, end: PointProps): LineInfo {
    const xDiff = start.x - end.x;
    const yDiff = start.y - end.y;
    const distance = Math.sqrt((xDiff * xDiff) + (yDiff * yDiff));

    const xMid = (start.x + end.x) / 2;
    const yMid = (start.y + end.y) / 2;

    const slopeInRadian = Math.atan2(start.y - end.y, start.x - end.x);
    const slopeInDegrees = (slopeInRadian * 180) / Math.PI;

    const left = xMid - (distance / 2);
    const top = yMid;

    const lineInfo: LineInfo = {
      topLeft: { x: left, y: top },
      width: distance,
      slopeInDegrees,
    };

    return lineInfo;
  }

  public render() {
    const lineInfo = this.createLine(this.props.start, this.props.end);
    const classNames = classnames(
      "uifw-line",
      this.props.className,
    );
    const style: React.CSSProperties = {
      ...this.props.style,
      width: lineInfo.width,
      top: lineInfo.topLeft.y,
      left: lineInfo.topLeft.x + 2,
      transform: `rotate(${lineInfo.slopeInDegrees}deg)`,
    };

    return (
      <div className={classNames} style={style} />
    );
  }
}
