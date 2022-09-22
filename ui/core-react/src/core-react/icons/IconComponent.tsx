/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module Icon
 */

import "./IconComponent.scss";
import * as React from "react";
import classnames from "classnames";
import { ConditionalStringValue, IconSpecUtilities } from "@itwin/appui-abstract";
import { SvgSprite } from "./SvgSprite";
import { CommonProps } from "../utils/Props";
import DOMPurify, * as DOMPurifyNS from "dompurify";

/** Prototype for an IconSpec which can be a string, ReactNode or ConditionalStringValue.
 * @public
 */
export type IconSpec = string | ConditionalStringValue | React.ReactNode;

/** Properties for the [[Icon]] React component
 * @public
 */
export interface IconProps extends CommonProps {
  /** CSS class name or SvgSprite/SvgPath for icon. This is optional because it is improperly
   * used to extend other interfaces and changing it would break existing API.
   */
  iconSpec?: IconSpec;
}

/** Icon Functional component displays an icon based on an [[IconSpec]].
 * @public
 */
export function Icon(props: IconProps) {
  if (!props.iconSpec)
    return null;

  const iconString = (typeof props.iconSpec === "string" || props.iconSpec instanceof ConditionalStringValue) ?
    ConditionalStringValue.getValue(props.iconSpec) : undefined;

  if (iconString) {
    const svgSource = IconSpecUtilities.getSvgSource(iconString);
    // if string begins with "svg:" then we assume it was imported (into extension source file) using webpack loader svg-sprite-loader
    if (svgSource !== undefined)
      return (
        <i className={classnames("icon", "core-svg-icon", props.className)} style={props.style}>
          <SvgSprite src={svgSource} />
        </i>
      );
    const webComponentString = IconSpecUtilities.getWebComponentSource(iconString);
    if (webComponentString) {
      const svgLoader = `<svg-loader src=${webComponentString}></svg-loader>`;
      const svgDiv = `<div>${svgLoader}</div>`;
      // the esm build of dompurify has a default import but the cjs build does not
      // if there is a default export, use it (likely esm), otherwise use the namespace
      // istanbul ignore next
      const sanitizer = DOMPurify ?? DOMPurifyNS;
      const sanitizedIconString = sanitizer.sanitize(svgDiv, { ALLOWED_TAGS: ["svg-loader"] });
      // we can safely disable jam3/no-sanitizer-with-danger as we are sanitizing above
      // eslint-disable-next-line @typescript-eslint/naming-convention, jam3/no-sanitizer-with-danger
      const webComponentNode = <div dangerouslySetInnerHTML={{ __html: sanitizedIconString }}></div>;
      return (
        <i className={classnames("icon", "core-svg-icon", props.className)} >
          {webComponentNode}
        </i>
      );
    }
    return (<i className={classnames("icon", iconString, props.className)} style={props.style} />);
  }

  return (
    <i className={classnames("icon", "core-svg-icon", props.className)} style={props.style}>
      {props.iconSpec}
    </i>
  );
}
