/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";

/** Properties for the [[Icon]] React component */
export interface IconProps {
  /** CSS class name for icon */
  iconClass?: string;
  /** React element for icon */
  iconElement?: React.ReactNode;
}

/** Icon React component */
export class Icon extends React.Component<IconProps> {
  public render(): React.ReactNode {
    if (this.props.iconClass) {
      const className = "icon " + this.props.iconClass;
      return (
        <i className={className} />
      );
    } else if (this.props.iconElement) {
      return (
        <i className="icon item-svg-icon">
          {this.props.iconElement}
        </i>
      );
    }

    return null;
  }
}
