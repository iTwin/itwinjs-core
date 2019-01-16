/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";
import classnames from "classnames";

import "./TabIcon.scss";

/** Properties for the [[TabIcon]] React component. This is used to specify an icon for a Widget's tab. */
export interface TabIconProps {
  /** CSS class name for icon */
  iconSpec?: string | React.ReactNode;
  isActive: boolean;
}

/** Icon component used to specify an icon for a Widget's tab. */
export class TabIcon extends React.Component<TabIconProps> {
  public render(): React.ReactNode {
    if (!this.props.iconSpec) return null;

    if (typeof this.props.iconSpec === "string") {
      const fontIconClassNames = classnames(
        "icon",
        this.props.iconSpec,
        "nz-tab-icon",
        this.props.isActive && "is-active",
      );
      return (<i className={fontIconClassNames} />);
    }

    const svgClassNames = classnames(
      "icon",
      "item-svg-icon",
      "nz-tab-icon",
      this.props.isActive && "is-active",
    );
    return (
      <i className={svgClassNames}>
        {this.props.iconSpec}
      </i>
    );
  }
}
