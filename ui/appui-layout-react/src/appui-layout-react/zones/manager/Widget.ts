/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Zone
 */

import { PointProps } from "@itwin/appui-abstract";
import { Point } from "@itwin/core-react";
import { HorizontalAnchor, VerticalAnchor } from "../../widget/Stacked";
import { WidgetZoneId } from "./Zones";

/** Widget properties used in [[ZonesManagerProps]].
 * @internal
 */
export interface WidgetManagerProps {
  readonly horizontalAnchor: HorizontalAnchor;
  readonly id: WidgetZoneId;
  readonly tabIndex: number;
  readonly verticalAnchor: VerticalAnchor;
}

/** Available modes of tool settings widget.
 * @internal
 */
export enum ToolSettingsWidgetMode {
  Tab,
  TitleBar,
}

/** Tool settings widget properties used in [[ZonesManagerProps]].
 * @internal
 */
export interface ToolSettingsWidgetManagerProps extends WidgetManagerProps {
  readonly mode: ToolSettingsWidgetMode;
}

/** Dragged widget properties used in [[ZonesManagerProps]].
 * @internal
 */
export interface DraggedWidgetManagerProps {
  readonly id: WidgetZoneId;
  readonly tabIndex: number;
  readonly lastPosition: PointProps;
  readonly isUnmerge: boolean;
}

/** @internal */
export const getDefaultWidgetHorizontalAnchor = (id: WidgetZoneId) => {
  switch (id) {
    case 1:
    case 4:
    case 7:
      return HorizontalAnchor.Left;
    default:
      return HorizontalAnchor.Right;
  }
};

/** @internal */
export const getDefaultWidgetVerticalAnchor = (id: WidgetZoneId) => {
  switch (id) {
    case 7:
    case 8:
    case 9:
      return VerticalAnchor.Bottom;
    default:
      return VerticalAnchor.Middle;
  }
};

/** @internal */
export const getDefaultWidgetManagerProps = (id: WidgetZoneId): WidgetManagerProps => ({
  horizontalAnchor: getDefaultWidgetHorizontalAnchor(id),
  id,
  tabIndex: -2,  // a -2 means the tabIndex has not been initialized. A tabIndex of -1 means initialized and non-selected
  verticalAnchor: getDefaultWidgetVerticalAnchor(id),
});

/** @internal */
export const getDefaultToolSettingsWidgetManagerProps = (): ToolSettingsWidgetManagerProps => ({
  ...getDefaultWidgetManagerProps(2),
  mode: ToolSettingsWidgetMode.TitleBar,
});

/** Class used to manage [[DraggedWidgetManagerProps]].
 * @internal
 */
export class DraggedWidgetManager {
  public setLastPosition(lastPosition: PointProps, props: DraggedWidgetManagerProps): DraggedWidgetManagerProps {
    if (Point.create(lastPosition).equals(props.lastPosition))
      return props;
    return {
      ...props,
      lastPosition,
    };
  }
}
