/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tiles */

import * as React from "react";
import * as classnames from "classnames";
import { CommonDivProps } from "../utils/Props";

/** @alpha */
export interface TileProps extends CommonDivProps {
  title: string;
  icon?: React.ReactNode;
  featured?: boolean;
  minimal?: boolean;
  href?: string;
  onClick?: (e: any) => any;
  stepNum?: number;
  stepCount?: number;
}

/** @internal */
export type TileDefaultProps = Pick<TileProps, "stepNum">;

/** @alpha */
export class Tile extends React.Component<TileProps> {

  /** @internal */
  public static readonly defaultProps: TileDefaultProps = {
    stepNum: 0,
  };

  /** @internal */
  public render(): JSX.Element {
    const stepType =
      (this.props.stepCount && this.props.stepCount < 13)
        ? Math.floor(this.props.stepNum! * 12 / (this.props.stepCount - 1))
        : this.props.stepNum! % 16;
    const stepClass = `uicore-step-${stepType}`;

    const classNames = classnames(
      "uicore-tiles-tile",
      stepClass,
      this.props.featured && "uicore-featured",
      this.props.minimal && "uicore-minimal",
    );

    return (
      <div className={classNames} style={this.props.style}>
        <a className="uicore-link" href={this.props.href} onClick={this.props.onClick}>
          <div className="uicore-icon">
            {this.props.icon}
          </div>
          <p className="uicore-title">{this.props.title}</p>
        </a>
        {this.props.children && !this.props.minimal &&
          <div className="uicore-children">
            {this.props.children}
          </div>
        }
      </div>
    );
  }
}
