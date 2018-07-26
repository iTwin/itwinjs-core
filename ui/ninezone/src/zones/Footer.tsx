/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import Zone, { ZoneProps } from "./Zone";
import "./Footer.scss";

/** Properties of [[FooterZone]] component. */
export interface FooterZoneProps extends ZoneProps {
  /** Declares if the zone is in footer mode (stretched through the bottom of the app). */
  isInFooterMode?: boolean;
}

/**
 * A footer zone that should contain [[Footer]]. This component is used for zone 8 (status zone).
 * @note For other zones use the [[Zone]] component.
 */
export default class FooterZone extends React.Component<FooterZoneProps> {
  public render() {
    const zoneClassName = classnames(
      "nz-zones-footer",
      this.props.isInFooterMode && "nz-is-in-footer-mode",
      this.props.className);

    const { isInFooterMode, className, ...props } = this.props;

    return (
      <Zone
        className={zoneClassName}
        {...props}
      />
    );
  }
}
