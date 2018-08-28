/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import { CellProps } from "../../utilities/Cell";
import { SizeProps } from "../../utilities/Size";
import Root from "./layout/Root";
import Target, { TargetProps } from "./Target";
import Widget, { DraggingWidgetProps, DraggingWidget } from "./Widget";
import Zone, { getDefaultProps as getDefaultZoneProps, ZoneProps, ContentZone, WidgetZone, StatusZone, StatusZoneProps, getDefaultStatusZoneProps } from "./Zone";

export type ContentZoneIndex = 5;
export type StatusZoneIndex = 8;
export type WidgetZoneIndex = 1 | 2 | 3 | 4 | 6 | 7 | StatusZoneIndex | 9;
export type ZoneIndex = WidgetZoneIndex | ContentZoneIndex;

export type ZonesType =
  { [id in Exclude<WidgetZoneIndex, StatusZoneIndex>]: ZoneProps } &
  { [id in StatusZoneIndex]: StatusZoneProps };

export interface NineZoneProps {
  readonly zones: Readonly<ZonesType>;
  readonly size: SizeProps;
  readonly draggingWidget?: DraggingWidgetProps;
  readonly target?: TargetProps;
}

export const getDefaultZonesProps = (): Readonly<ZonesType> => {
  return {
    1: getDefaultZoneProps(1),
    2: getDefaultZoneProps(2),
    3: getDefaultZoneProps(3),
    4: getDefaultZoneProps(4),
    6: getDefaultZoneProps(6),
    7: getDefaultZoneProps(7),
    8: getDefaultStatusZoneProps(),
    9: getDefaultZoneProps(9),
  };
};

export const getDefaultProps = (): NineZoneProps => (
  {
    zones: getDefaultZonesProps(),
    size: {
      width: 0,
      height: 0,
    },
  }
);

export default class NineZone implements Iterable<Zone> {
  private _zones: { [id: number]: Zone } = {};
  private _root: Root | undefined;
  private _target?: Target;
  private _draggingWidget?: DraggingWidget;

  public constructor(public readonly props: NineZoneProps) {
  }

  public [Symbol.iterator]() {
    let currentId = 1;
    const zones = this;
    return {
      next(): IteratorResult<Zone> {
        if (currentId > 10)
          return {
            done: true,
            value: {} as Zone,
          };

        return {
          done: false,
          value: zones.getZone(currentId++ as ZoneIndex),
        };
      },
    };
  }

  public get root() {
    if (!this._root)
      this._root = new Root(this);
    return this._root;
  }

  public getZone(zoneId: ZoneIndex): Zone {
    if (this._zones[zoneId])
      return this._zones[zoneId];

    if (zoneId === 5)
      this._zones[zoneId] = new ContentZone(this);
    else if (zoneId === 8)
      this._zones[zoneId] = new StatusZone(this, this.props.zones[zoneId]);
    else
      this._zones[zoneId] = new WidgetZone(this, this.props.zones[zoneId]);
    return this._zones[zoneId];
  }

  public getWidgetZone(zoneId: WidgetZoneIndex): WidgetZone {
    return this.getZone(zoneId) as WidgetZone;
  }

  public getStatusZone(): StatusZone {
    return this.getZone(StatusZone.id) as StatusZone;
  }

  public getContentZone(): ContentZone {
    return this.getZone(ContentZone.id) as ContentZone;
  }

  public getWidget(widgetId: number): Widget {
    for (const zone of this) {
      if (!zone.isWidgetZone())
        continue;

      const widget = zone.getWidgets().find((w) => w.props.id === widgetId);
      if (widget)
        return widget;
    }

    throw new RangeError();
  }

  public findZone(cell: CellProps): Zone {
    for (const zone of this) {
      if (zone.cell.equals(cell))
        return zone;
    }

    throw new RangeError();
  }

  public get draggingWidget(): DraggingWidget | undefined {
    if (!this._draggingWidget && this.props.draggingWidget)
      this._draggingWidget = new DraggingWidget(this, this.props.draggingWidget);
    return this._draggingWidget;
  }

  public get target(): Target | undefined {
    if (!this._target && this.props.target)
      this._target = new Target(this, this.props.target);
    return this._target;
  }
}
