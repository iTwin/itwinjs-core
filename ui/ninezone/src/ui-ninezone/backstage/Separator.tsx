/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
      <div className={className} style={this.props.style} />
    );
  }
}
