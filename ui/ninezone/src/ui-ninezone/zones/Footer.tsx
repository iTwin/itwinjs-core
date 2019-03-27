/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { ZoneComponent, ZoneProps } from "./Zone";
import "./Footer.scss";

/** Properties of [[FooterZone]] component. */
export interface FooterZoneProps extends ZoneProps {
  /** Describes if the zone is in footer mode (stretched through the bottom of the app). */
  isInFooterMode?: boolean;
  /** Describes if the zone is hidden. */
  isHidden?: boolean;
}

/**
 * A footer zone that should contain [[Footer]]. This component is used for zone 8 (status zone).
 * @note For other zones use the [[ZoneComponent]] component.
 */
export class FooterZone extends React.PureComponent<FooterZoneProps> {
  public render() {
    const { isInFooterMode, className, isHidden, ...props } = this.props;
    const zoneClassName = classnames(
      "nz-zones-footer",
      isInFooterMode && "nz-is-in-footer-mode",
      isHidden && "nz-is-hidden",
      className);

    return (
      <ZoneComponent
        className={zoneClassName}
        {...props}
      />
    );
  }
}
