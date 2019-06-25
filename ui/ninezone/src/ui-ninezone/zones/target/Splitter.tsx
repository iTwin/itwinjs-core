/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { MergeTargetProps } from "./Merge";
import { WidgetTarget } from "./Target";
import "./Splitter.scss";

/** Properties of [[SplitterTarget]] component.
 * @beta
 */
export interface SplitterTargetProps extends MergeTargetProps {
  /** Describes if the splitter target is used in a vertical splitter. */
  readonly isVertical?: boolean;
  /** Splitter pane count. */
  readonly paneCount: number;
}

/** Visual target component used to add widgets to a splitter.
 * @beta
 */
export class SplitterTarget extends React.PureComponent<SplitterTargetProps> {
  public render() {
    const { className, style, ...props } = this.props;
    const targetClassName = classnames("nz-zones-target-splitter",
      className);
    const size = 100 / (this.props.paneCount + 1);
    const offset = 100 - size;
    return (
      <WidgetTarget
        className={targetClassName}
        style={{
          ...this.props.isVertical ? {
            top: `${offset}%`,
            height: `${size}%`,
          } : {
              left: `${offset}%`,
              width: `${size}%`,
            },
          ...style,
        }}
        {...props}
      />
    );
  }
}
