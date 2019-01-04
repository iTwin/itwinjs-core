/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";

/** Prototype for an IconSpec which can be a string or a ReactNode. */
export type IconSpec = string | React.ReactNode;

/** Properties for the [[Icon]] React component */
export interface IconProps {
  /** CSS class name for icon */
  iconSpec?: IconSpec;
}

/** Icon Functional component */
// tslint:disable-next-line:variable-name
export const Icon: React.FunctionComponent<IconProps> = (props) => {
  if (!props.iconSpec) return null;

  if (typeof props.iconSpec === "string") {
    const className = "icon " + props.iconSpec;
    return (<i className={className} />);
  }
  return (
    <i className="icon item-svg-icon">
      {props.iconSpec}
    </i>
  );
};
