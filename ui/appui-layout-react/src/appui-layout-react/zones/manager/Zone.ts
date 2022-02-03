/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Zone
 */

import type { RectangleProps } from "@itwin/core-react";
import { Rectangle } from "@itwin/core-react";
import { RECTANGULAR_DEFAULT_MIN_HEIGHT, RECTANGULAR_DEFAULT_MIN_WIDTH } from "./ResizeStrategy";
import type { WidgetZoneId } from "./Zones";
import { getZoneCell } from "./Zones";

/** Zone properties used in [[ZonesManagerProps]].
 * @internal
 */
export interface ZoneManagerProps {
  readonly allowsMerging: boolean;
  readonly id: WidgetZoneId;
  readonly bounds: RectangleProps;
  readonly isLayoutChanged: boolean;
  readonly floating?: ZoneManagerFloatingProps;
  readonly widgets: ReadonlyArray<WidgetZoneId>;
}

/** Floating zone properties used in [[ZoneManagerProps]].
 * @internal
 */
export interface ZoneManagerFloatingProps {
  readonly bounds: RectangleProps;
  readonly stackId: number;
}

/** @internal */
export const getDefaultAllowsMerging = (id: WidgetZoneId): boolean => {
  switch (id) {
    case 2:
    case 4:
    case 6:
    case 7:
    case 8:
    case 9:
      return true;
  }
  return false;
};

/** @internal */
export const getDefaultZoneManagerProps = (id: WidgetZoneId): ZoneManagerProps => ({
  allowsMerging: getDefaultAllowsMerging(id),
  id,
  bounds: {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  isLayoutChanged: false,
  widgets: id === 2 ? [] : [id],
});

/** @internal */
export interface ZoneWindowResizeSettings {
  hMode: "Minimum" | "Percentage";  // Horizontal resize mode
  hEnd: number;                     // Ratio of zone right bound to zones width
  hStart: number;                   // Ratio of zone left bound to zones width
  minHeight: number;
  minWidth: number;
  vMode: "Minimum" | "Percentage";  // Vertical resize mode
  vEnd: number;                     // Ratio of zone bottom bound to zones height
  vStart: number;                   // Ratio of zone top bound to zones height
}

/** @internal */
export const getWindowResizeSettings = (zoneId: WidgetZoneId): ZoneWindowResizeSettings => {
  const cell = getZoneCell(zoneId);
  return {
    hMode: "Percentage",
    hEnd: (cell.col + 1) * 1 / 3,
    hStart: cell.col * 1 / 3,
    minHeight: RECTANGULAR_DEFAULT_MIN_HEIGHT,
    minWidth: RECTANGULAR_DEFAULT_MIN_WIDTH,
    vMode: "Percentage",
    vEnd: (cell.row + 1) * 1 / 3,
    vStart: cell.row * 1 / 3,
  };
};

/** Class used to manage [[ZoneManagerProps]].
 * @internal
 */
export class ZoneManager {
  public constructor(
    public windowResize: ZoneWindowResizeSettings = getWindowResizeSettings(1),
  ) {
  }

  public setAllowsMerging(allowsMerging: boolean, props: ZoneManagerProps): ZoneManagerProps {
    if (allowsMerging === props.allowsMerging)
      return props;
    return {
      ...props,
      allowsMerging,
    };
  }

  public setBounds(bounds: RectangleProps, props: ZoneManagerProps): ZoneManagerProps {
    if (Rectangle.create(bounds).equals(props.bounds))
      return props;
    return {
      ...props,
      bounds,
    };
  }

  public setIsLayoutChanged(isLayoutChanged: boolean, props: ZoneManagerProps): ZoneManagerProps {
    if (isLayoutChanged === props.isLayoutChanged)
      return props;
    return {
      ...props,
      isLayoutChanged,
    };
  }

  public setFloatingProps(floating: ZoneManagerFloatingProps | undefined, props: ZoneManagerProps): ZoneManagerProps {
    if (floating === props.floating)
      return props;
    return {
      ...props,
      floating,
    };
  }

  public setFloatingBounds(bounds: RectangleProps, props: ZoneManagerProps): ZoneManagerProps {
    if (!props.floating)
      throw new ReferenceError();
    if (Rectangle.create(bounds).equals(props.floating.bounds))
      return props;
    return {
      ...props,
      floating: {
        ...props.floating,
        bounds,
      },
    };
  }
}
