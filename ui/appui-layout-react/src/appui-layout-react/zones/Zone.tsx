/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Zone
 */

import "./Zone.scss";
import classnames from "classnames";
import * as React from "react";
import type { CommonProps, RectangleProps } from "@itwin/core-react";
import { CssProperties } from "../utilities/Css";
import type { SafeAreaInsets} from "../utilities/SafeAreaInsets";
import { SafeAreaInsetsHelpers } from "../utilities/SafeAreaInsets";
import type { WidgetZoneId } from "./manager/Zones";

/** Properties of [[Zone]] component.
 * @internal
 */
export interface ZoneProps extends CommonProps {
  /** Zone bounds. */
  bounds?: RectangleProps;
  /** Zone content. I.e. [[Stacked]], [[Footer]], [[ToolSettings]], [[ToolSettingsTab]], [[Outline]] */
  children?: React.ReactNode;
  /** Describes if the zone is in footer mode. */
  isInFooterMode?: boolean;
  /** Describes if the zone is floating. */
  isFloating?: boolean;
  /** Describes if the zone is hidden. */
  isHidden?: boolean;
  /** Zone id. */
  id: WidgetZoneId;
  /** Describes respected safe area insets. */
  safeAreaInsets?: SafeAreaInsets;
}

/** Zone component of 9-Zone UI app.
 * @internal
 */
export class Zone extends React.PureComponent<ZoneProps> {
  public override render() {
    const className = classnames(
      "nz-zones-zone",
      this.props.isFloating && "nz-floating",
      this.props.isHidden && "nz-hidden",
      this.props.isInFooterMode && "nz-footer-mode",
      this.props.safeAreaInsets && SafeAreaInsetsHelpers.getCssClassNames(this.props.safeAreaInsets),
      `nz-zone-${this.props.id}`,
      this.props.className);

    const style: React.CSSProperties = {
      ...!this.props.bounds ? undefined : {
        ...CssProperties.fromBounds(this.props.bounds),
        position: "absolute",
      },
      ...this.props.style,
    };

    return (
      <div
        className={className}
        style={style}
      >
        <div>
          {this.props.children}
        </div>
      </div>
    );
  }
}
