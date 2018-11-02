/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";

/** Properties for the [[Icon]] React component */
export interface IconProps {
  /** CSS class name for icon */
  iconSpec?: string | React.ReactNode;
}

/** Icon React component */
export class Icon extends React.Component<IconProps> {
  public render(): React.ReactNode {
    if (!this.props.iconSpec) return null;

    if (typeof this.props.iconSpec === "string") {
      const className = "icon " + this.props.iconSpec;
      return (<i className={className} />);
    }
    return (
      <i className="icon item-svg-icon">
        {this.props.iconSpec}
      </i>
    );
  }
}
