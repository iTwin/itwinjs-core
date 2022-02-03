/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Zone
 */

import * as React from "react";
import type { CommonProps } from "@itwin/core-react";
import type { WidgetZoneId} from "@itwin/appui-layout-react";
import { BackTarget, MergeTarget, ZoneTargetType } from "@itwin/appui-layout-react";
import type { TargetChangeHandler } from "../frontstage/FrontstageComposer";

/** Properties for the [[ZoneTargets]] component.
 * @internal
 */
export interface ZoneTargetsProps extends CommonProps {
  zoneId: WidgetZoneId; // eslint-disable-line deprecation/deprecation
  dropTarget: ZoneTargetType | undefined; // eslint-disable-line deprecation/deprecation
  targetChangeHandler: TargetChangeHandler; // eslint-disable-line deprecation/deprecation
}

/** Zone Targets React component.
 * @internal
 */
export class ZoneTargets extends React.Component<ZoneTargetsProps> {
  public override render(): React.ReactNode {
    switch (this.props.dropTarget) {
      case ZoneTargetType.Merge: // eslint-disable-line deprecation/deprecation
        return (
          <MergeTarget
            className={this.props.className}
            // eslint-disable-next-line deprecation/deprecation
            onTargetChanged={(isTargeted) => this.props.targetChangeHandler.handleTargetChanged(this.props.zoneId, ZoneTargetType.Merge, isTargeted)}
            style={this.props.style}
          />
        );
      case ZoneTargetType.Back: // eslint-disable-line deprecation/deprecation
        return (
          <BackTarget
            className={this.props.className}
            // eslint-disable-next-line deprecation/deprecation
            onTargetChanged={(isTargeted) => this.props.targetChangeHandler.handleTargetChanged(this.props.zoneId, ZoneTargetType.Back, isTargeted)}
            style={this.props.style}
            zoneIndex={this.props.zoneId}
          />
        );
      default:
        return null;
    }
  }
}
