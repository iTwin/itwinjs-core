/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Arrow.scss";

/** Arrow icon.
 * @note Used in [[Merge]], [[Back]] components.
 * @alpha
 */
export class Arrow extends React.PureComponent<CommonProps> {
  public render() {
    const className = classnames(
      "nz-zones-target-arrow",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      />
    );
  }
}
