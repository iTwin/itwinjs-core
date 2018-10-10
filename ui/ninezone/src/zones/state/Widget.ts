/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import { WidgetZone } from "./Zone";
import Cell from "../../utilities/Cell";
import { PointProps } from "../../utilities/Point";
import NineZone, { WidgetZoneIndex } from "./NineZone";

export interface WidgetProps {
  readonly id: WidgetZoneIndex;
  readonly tabIndex: number;
}

export interface DraggingWidgetProps {
  readonly id: WidgetZoneIndex;
  readonly tabIndex: number;
  readonly lastPosition: PointProps;
  readonly isUnmerge: boolean;
}

export const getDefaultProps = (id: WidgetZoneIndex): WidgetProps => {
  return {
    id,
    tabIndex: -1,
  };
};

export default class Widget {
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

  public constructor(public readonly zone: WidgetZone, public readonly props: WidgetProps) {
  }

  public equals(other: Widget) {
    return this.props.id === other.props.id;
  }

  public get nineZone() {
    return this.zone.nineZone;
  }

  public get defaultZone(): WidgetZone {
    if (!this._defaultZone)
      this._defaultZone = this.nineZone.getWidgetZone(this.props.id);
    return this._defaultZone;
  }

  public get isInHomeZone() {
    if (this.zone.equals(this.defaultZone))
      return true;
    return false;
  }

  public get isFirst(): boolean {
    if (this.zone.props.widgets.length > 0 && this.zone.props.widgets[0].id === this.props.id)
      return true;
    return false;
  }

  public get isLast(): boolean {
    if (this.zone.props.widgets.length > 0 && this.zone.props.widgets[this.zone.props.widgets.length - 1].id === this.props.id)
      return true;
    return false;
  }

  public get isMiddle(): boolean {
    if (this.zone.props.widgets.length === 3 && this.zone.props.widgets[1].id === this.props.id)
      return true;
    return false;
  }

  public get isAlone(): boolean {
    if (this.zone.props.widgets.length === 1)
      return true;
    return false;
  }
}

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
