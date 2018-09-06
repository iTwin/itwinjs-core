/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../utilities/Props";
import { RectangleProps } from "../utilities/Rectangle";
import "./GhostOutline.scss";
import { CssProperties } from "../utilities/Css";

/** Properties of [[GhostOutline]] component. */
export interface GhostOutlineProps extends CommonProps {
  /** Actual bounds of this [[GhostOutline]]. */
  bounds?: RectangleProps;
}

/**
 * Component used to visualize merge/unmerge action by displaying zone outline.
 * @note Should be placed in [[Zone]] component.
 */
// tslint:disable-next-line:variable-name
export const GhostOutline: React.StatelessComponent<GhostOutlineProps> = (props: GhostOutlineProps) => {
  const className = classnames(
    "nz-zones-ghostOutline",
    props.className);

  const style: React.CSSProperties = {
    ...props.bounds ? CssProperties.fromRectangle(props.bounds) : undefined,
    ...props.style,
  };

  return (
    <div
      className={className}
      style={style}
    />
  );
};

export default GhostOutline;
