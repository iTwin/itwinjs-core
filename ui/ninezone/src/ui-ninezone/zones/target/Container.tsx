/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Container.scss";

/** Properties of [[Container]] component.
 * @alpha
 */
export interface ContainerProps extends CommonProps {
  /** Zone target. I.e. [[Back]], [[Merge]] */
  children?: React.ReactNode;
}

/** Container for zone targets.
 * @alpha
 */
export class Container extends React.PureComponent<ContainerProps> {
  public render() {
    const className = classnames(
      "nz-zones-target-container",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }
}
