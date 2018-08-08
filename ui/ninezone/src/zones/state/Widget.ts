/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import { Zone } from "./Zone";
import Cell from "../../utilities/Cell";

export default interface WidgetProps {
  readonly id: number;
  readonly defaultZoneId?: number;
  readonly tabIndex: number;
}

export const getDefaultProps = (id: number): WidgetProps => {
  return {
    id,
    tabIndex: -1,
  };
};

export class Widget {
  public static sort(widgets: ReadonlyArray<Widget>) {
    return widgets.slice().sort((a, b) => a.getDefaultZone().props.id - b.getDefaultZone().props.id);
  }

  public static isCellBetweenWidgets(cell: Cell, widgets: ReadonlyArray<Widget>) {
    if (widgets.length !== 2)
      return false;

    const w0 = widgets[0];
    const w1 = widgets[1];
    if (cell.isBetween(w0.getDefaultZone().getCell(), w1.getDefaultZone().getCell()))
      return true;

    return false;
  }

  private _defaultZone: Zone | undefined = undefined;

  public constructor(public readonly zone: Zone, public readonly props: WidgetProps) {
  }

  public getDefaultZone(): Zone {
    if (!this._defaultZone)
      this._defaultZone = this.zone.nineZone.getZone(this.props.defaultZoneId || this.props.id);
    return this._defaultZone;
  }

  public equals(other: Widget) {
    return this.props.id === other.props.id;
  }
}
