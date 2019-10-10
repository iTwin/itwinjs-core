/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";
import * as classnames from "classnames";
import { CommonProps, SvgSprite } from "@bentley/ui-core";

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
      <div className={classnames("uifw-badge", this.props.className)} style={this.props.style}>
        <SvgSprite src={this.props.svg} />
      </div>
    );
  }
}
