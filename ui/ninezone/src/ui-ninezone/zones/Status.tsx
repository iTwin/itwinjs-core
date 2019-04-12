/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { Zone, ZoneProps } from "./Zone";
import "./Status.scss";

/** Properties of [[StatusZone]] component.
 * @alpha
 */
export interface StatusZoneProps extends ZoneProps {
  /** Describes if the zone is in footer mode (stretched through the bottom of the app). */
  isInFooterMode?: boolean;
}

/** A footer zone that should contain [[Footer]].
 * @note It is an eight zone in 9-Zone UI pattern. For other zones use [[Zone]] or [[ToolSettingsZone]] components.
 * @alpha
 */
export class StatusZone extends React.PureComponent<StatusZoneProps> {
  public render() {
    const { isInFooterMode, className, ...props } = this.props;
    const zoneClassName = classnames(
      "nz-zones-status",
      isInFooterMode && "nz-footer-mode",
      className);

    return (
      <Zone
        className={zoneClassName}
        {...props}
      />
    );
  }
}
