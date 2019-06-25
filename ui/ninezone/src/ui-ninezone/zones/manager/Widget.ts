/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import { Cell } from "../../utilities/Cell";
import { PointProps } from "../../utilities/Point";
import { HorizontalAnchor, VerticalAnchor } from "../../widget/Stacked";
import { WidgetZone } from "./Zone";
import { NineZone, WidgetZoneIndex } from "./Zones";

/** @alpha */
export interface WidgetProps {
  readonly horizontalAnchor: HorizontalAnchor;
  readonly id: WidgetZoneIndex;
  readonly tabIndex: number;
  readonly verticalAnchor: VerticalAnchor;
}

/** @alpha */
export interface DraggingWidgetProps {
  readonly id: WidgetZoneIndex;
  readonly tabIndex: number;
  readonly lastPosition: PointProps;
  readonly isUnmerge: boolean;
}

/** @alpha */
export const getDefaultWidgetHorizontalAnchor = (id: WidgetZoneIndex) => {
  switch (id) {
    case 1:
    case 4:
    case 7:
      return HorizontalAnchor.Left;
    default:
      return HorizontalAnchor.Right;
  }
};

/** @alpha */
export const getDefaultWidgetVerticalAnchor = (id: WidgetZoneIndex) => {
  switch (id) {
    case 7:
    case 8:
    case 9:
      return VerticalAnchor.Bottom;
    default:
      return VerticalAnchor.Middle;
  }
};

/** @alpha */
export const getDefaultWidgetProps = (id: WidgetZoneIndex): WidgetProps => {
  return {
    horizontalAnchor: getDefaultWidgetHorizontalAnchor(id),
    id,
    tabIndex: -2,  // a -2 means the tabIndex has not been initialized. A tabIndex of -1 means initialized and non-selected
    verticalAnchor: getDefaultWidgetVerticalAnchor(id),
  };
};

/** @alpha */
export class Widget {
  public static sort(widgets: ReadonlyArray<Widget>) {
    return widgets.slice().sort((a, b) => a.defaultZone.props.id - b.defaultZone.props.id);
  }

  public static isCellBetweenWidgets(cell: Cell, widgets: ReadonlyArray<Widget>) {
    if (widgets.length !== 2)
      return false;

    const w0 = widgets[0];
    const w1 = widgets[1];
    if (cell.isBetween(w0.defaultZone.cell, w1.defaultZone.cell))
      return true;

    return false;
  }

  private _defaultZone: WidgetZone | undefined = undefined;

  public constructor(public readonly nineZone: NineZone, public readonly props: WidgetProps) {
  }

  public equals(other: Widget) {
    return this.props.id === other.props.id;
  }

  public get defaultZone(): WidgetZone {
    if (!this._defaultZone)
      this._defaultZone = this.nineZone.getWidgetZone(this.props.id);
    return this._defaultZone;
  }

  public get zone(): WidgetZone | undefined {
    for (const zone of this.nineZone) {
      if (zone.id === 5)
        continue;
      const widgetZone = zone as WidgetZone;
      if (widgetZone.getWidgets().indexOf(this) >= 0)
        return widgetZone;
    }
    return undefined;
  }

  public get isMiddle(): boolean {
    if (!this.zone)
      return false;
    if (this.zone.props.widgets.length === 3 && this.zone.props.widgets[1] === this.props.id)
      return true;
    return false;
  }

  public get isAlone(): boolean {
    if (!this.zone)
      return false;
    if (this.zone.props.widgets.length === 1)
      return true;
    return false;
  }
}

/** @alpha */
export class DraggingWidget {
  private _widget: Widget;

  public constructor(public readonly nineZone: NineZone, public readonly props: DraggingWidgetProps) {
    this._widget = this.nineZone.getWidget(this.props.id);
  }

  public get widget() {
    return this._widget;
  }

  public get zone() {
    return this.widget.zone;
  }

  public get defaultZone(): WidgetZone {
    return this.widget.defaultZone;
  }
}
