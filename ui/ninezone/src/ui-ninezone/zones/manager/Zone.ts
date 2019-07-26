/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import { RectangleProps, Rectangle } from "../../utilities/Rectangle";
import { WidgetZoneId } from "./Zones";

/** Zone properties used in [[ZonesManagerProps]].
 * @beta
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
 * @beta
 */
export interface ZoneManagerFloatingProps {
  readonly bounds: RectangleProps;
  readonly stackId: number;
}

/** @internal */
export const getDefaultAllowsMerging = (id: WidgetZoneId): boolean => {
  switch (id) {
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
export const FOOTER_HEIGHT = 40;  // Must match $footer-height in footer\_variables.scss

/** @internal */
export const getDefaultZoneManagerProps = (id: WidgetZoneId): ZoneManagerProps => ({
  allowsMerging: getDefaultAllowsMerging(id),
  id,
  bounds: {
    left: 0,
    top: 0,
    right: 0,
    bottom: id === 8 ? FOOTER_HEIGHT : 0,
  },
  isLayoutChanged: false,
  widgets: [id],
});

/** Class used to manage [[ZoneManagerProps]].
 * @internal
 */
export class ZoneManager {
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
