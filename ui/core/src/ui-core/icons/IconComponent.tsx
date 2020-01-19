/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Icon
 */

import * as React from "react";
import { SvgSprite } from "./SvgSprite";
import { IconSpecUtilities } from "@bentley/ui-abstract";

import "./IconComponent.scss";

/** Prototype for an IconSpec which can be a string or a ReactNode.
 * @public
 */
export type IconSpec = string | React.ReactNode;

/** Properties for the [[Icon]] React component
 * @public
 */
export interface IconProps {
  /** CSS class name or SvgSprite for icon */
  iconSpec?: IconSpec;
}

/** Icon Functional component
 * @public
 */
export const Icon: React.FunctionComponent<IconProps> = (props: IconProps) => {  // tslint:disable-line:variable-name
  if (!props.iconSpec)
    return null;

  if (typeof props.iconSpec === "string") {
    const svgSource = IconSpecUtilities.getSvgSource(props.iconSpec);
    // if string begins with "svg:" then we assume it was imported (into plugin source file) using webpack loader svg-sprite-loader
    if (svgSource !== undefined)
      return (
        <i className="icon core-svg-icon">
          <SvgSprite src={svgSource} />
        </i>
      );

    const className = "icon " + props.iconSpec;
    return (<i className={className} />);
  }

  return (
    <i className="icon core-svg-icon">
      {props.iconSpec}
    </i>
  );
};
