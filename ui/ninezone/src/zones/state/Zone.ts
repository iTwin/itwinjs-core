/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import { RectangleProps } from "../../utilities/Rectangle";

import Layout from "./layout/Layout";
import { Layout1, Layout2, Layout3, Layout4, Layout6, Layout7, Layout8, Layout9 } from "./layout/Layouts";
import { NineZone } from "./NineZone";
import WidgetProps, { Widget, getDefaultProps as getDefaultWidgetProps } from "./Widget";
import Cell from "../../utilities/Cell";

export default interface ZoneProps {
  readonly id: number;
  readonly bounds: RectangleProps;
  readonly floatingBounds: RectangleProps | undefined;
  readonly widgets: WidgetProps[];
}

export const getDefaultProps = (id: number): ZoneProps => {
  return {
    id,
    bounds: {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    },
    floatingBounds: undefined,
    widgets: [
      getDefaultWidgetProps(id),
    ],
  };
};

export class LayoutFactory {
  public create(zone: Zone): Layout {
    switch (zone.props.id) {
      case 1:
        return new Layout1(zone);
      case 2:
        return new Layout2(zone);
      case 3:
        return new Layout3(zone);
      case 4:
        return new Layout4(zone);
      case 6:
        return new Layout6(zone);
      case 7:
        return new Layout7(zone);
      case 8:
        return new Layout8(zone);
      case 9:
        return new Layout9(zone);
    }
    throw new RangeError();
  }
}

export class Zone {
  protected _layout: Layout | undefined = undefined;
  protected _widgets: Widget[] | undefined = undefined;
  protected _cell: Cell | undefined = undefined;
  protected _isWidgetOpen: boolean | undefined = undefined;

  public constructor(public readonly nineZone: NineZone, public readonly props: ZoneProps) {
  }

  public getCell() {
    if (!this._cell)
      this._cell = new Cell(Math.floor((this.props.id - 1) / 3), (this.props.id - 1) % 3);
    return this._cell;
  }

  public getLayout(): Layout {
    if (!this._layout)
      this._layout = new LayoutFactory().create(this);
    return this._layout;
  }

  public getWidgets(): ReadonlyArray<Widget> {
    if (!this._widgets) {
      this._widgets = [];
      for (const widget of this.props.widgets)
        this._widgets.push(new Widget(this, widget));
    }
    return this._widgets;
  }

  public get isWidgetOpen(): boolean {
    if (this._isWidgetOpen === undefined) {
      this._isWidgetOpen = false;
      for (const widget of this.props.widgets) {
        if (widget.tabIndex !== -1) {
          this._isWidgetOpen = true;
          break;
        }
      }
    }

    return this._isWidgetOpen;
  }

  public get isFloating() {
    if (this.props.floatingBounds)
      return true;
    return false;
  }

  public get isMergedVertically(): boolean {
    const widgets = this.getWidgets();
    return widgets.length > 1 && widgets[0].getDefaultZone().getCell().isColumnAlignedWith(widgets[1].getDefaultZone().getCell());
  }

  public get isMergedHorizontally(): boolean {
    const widgets = this.getWidgets();
    return widgets.length > 1 && widgets[0].getDefaultZone().getCell().isRowAlignedWith(widgets[1].getDefaultZone().getCell());
  }

  public isFirstWidget(widget: Widget): boolean {
    if (this.props.widgets.length > 0 && this.props.widgets[0].id === widget.props.id)
      return true;
    return false;
  }

  public isLastWidget(widget: Widget): boolean {
    if (this.props.widgets.length > 0 && this.props.widgets[this.props.widgets.length - 1].id === widget.props.id)
      return true;
    return false;
  }

  public equals(other: Zone) {
    return this.props.id === other.props.id;
  }
}
