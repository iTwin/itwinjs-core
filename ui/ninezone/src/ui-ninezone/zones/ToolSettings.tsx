/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { Zone, ZoneProps } from "./Zone";
import "./ToolSettings.scss";

/** A zone that should contain [[ToolSettings]] or [[ToolSettingsTab]].
 * @note It is a second zone in 9-Zone UI pattern. For other zones use [[Zone]] or [[StatusZone]] components.
 * @alpha
 */
export class ToolSettingsZone extends React.PureComponent<ZoneProps> {
  public render() {
    const { className, ...props } = this.props;
    const zoneClassName = classnames(
      "nz-zones-toolSettings",
      className);

    return (
      <Zone
        className={zoneClassName}
        {...props}
      />
    );
  }
}
