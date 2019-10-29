/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import * as React from "react";
import * as classnames from "classnames";

import { CommonProps } from "../utils/Props";
import { SvgSprite } from "../icons/SvgSprite";

import "./Badge.scss";

/** Properties for the [[Badge]] React component
 * @internal
 */
export interface BadgeProps extends CommonProps {
  svg: any;
}

/** Beta Badge React component
 * @internal
 */
export class Badge extends React.PureComponent<BadgeProps> {
  public render(): JSX.Element {
    return (
      <div className={classnames("core-badge", this.props.className)} style={this.props.style}>
        <SvgSprite src={this.props.svg} />
      </div>
    );
  }
}
