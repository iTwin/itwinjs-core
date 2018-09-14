/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../utilities/Props";
import "./Zone.scss";
import { RectangleProps } from "../utilities/Rectangle";
import { CssProperties } from "../utilities/Css";

/** Properties of [[Zone]] component. */
export interface ZoneProps extends CommonProps {
  /** Actual bounds of this [[Zone]]. */
  bounds: RectangleProps;
  /** Zone content. I.e. available widgets: [[Stacked]], [[Tools]], [[ToolSettings]] */
  children?: React.ReactNode;
}

/**
 * A zone that may contain widgets.
 * @note For status zone (zone 8) [[FooterZone]] component should be used.
 */
// tslint:disable-next-line:variable-name
export const Zone: React.StatelessComponent<ZoneProps> = (props: ZoneProps) => {
  const className = classnames(
    "nz-zones-zone",
    props.className);

  const style: React.CSSProperties = {
    ...CssProperties.fromBounds(props.bounds),
    ...props.style,
  };

  return (
    <div
      className={className}
      style={style}
    >
      {props.children}
    </div>
  );
};

export default Zone;
