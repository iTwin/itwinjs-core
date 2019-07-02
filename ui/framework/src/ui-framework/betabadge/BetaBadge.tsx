/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";
import * as classnames from "classnames";
import { CommonProps, SvgSprite } from "@bentley/ui-core";

import "./BetaBadge.scss";
import betaBadgeIcon from "./technical-preview-badge.svg";

/** Beta Badge React component
 * @beta
 */
export class BetaBadge extends React.PureComponent<CommonProps> {
  public render(): JSX.Element {
    return (
      <div className={classnames("uifw-beta-badge", this.props.className)} style={this.props.style}>
        <SvgSprite src={betaBadgeIcon} />
      </div>
    );
  }
}
