/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Separator.scss";

/** Item separator in the [[Backstage]] component.
 * @beta
 */
export class BackstageSeparator extends React.PureComponent<CommonProps> {
  public render() {
    const className = classnames(
      "nz-backstage-separator",
      this.props.className);

    return (
      <li className={className} style={this.props.style} />
    );
  }
}
