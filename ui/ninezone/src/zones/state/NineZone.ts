/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import { CellProps } from "../../utilities/Cell";
import { SizeProps } from "../../utilities/Size";
import Root from "./layout/Root";
import Target, { TargetProps } from "./Target";
import { Widget } from "./Widget";
import ZoneProps, { getDefaultProps as getDefaultZoneProps, Zone } from "./Zone";

export interface NineZoneProps {
  readonly zones: Readonly<{ [id: number]: ZoneProps }>;
  readonly isInFooterMode: boolean;
  readonly size: SizeProps;
  readonly draggingWidgetId?: number;
  readonly target?: TargetProps;
}

export const getDefaultProps = (): NineZoneProps => (
  {
    zones: {
      1: getDefaultZoneProps(1),
      2: getDefaultZoneProps(2),
      3: getDefaultZoneProps(3),
      4: getDefaultZoneProps(4),
      6: getDefaultZoneProps(6),
      7: getDefaultZoneProps(7),
      8: getDefaultZoneProps(8),
      9: getDefaultZoneProps(9),
    },
    isInFooterMode: true,
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

  public constructor(public readonly props: NineZoneProps) {
  }

  public [Symbol.iterator]() {
    let currentId = 1;
    const zones = this;
    return {
      next(): IteratorResult<Zone> {
        if (currentId === 5)
          currentId++;

        if (currentId > 10)
          return {
            done: true,
            value: {} as Zone,
          };

        return {
          done: false,
          value: zones.getZone(currentId++),
        };
      },
    };
  }

  public get root() {
    if (!this._root)
      this._root = new Root(this);
    return this._root;
  }

  public getZone(zoneId: number) {
    if (zoneId < 1 || zoneId === 5 || zoneId > 9)
      throw new RangeError();

    if (!this._zones[zoneId])
      this._zones[zoneId] = new Zone(this, this.props.zones[zoneId]);

    return this._zones[zoneId];
  }

  public getWidget(widgetId: number): Widget {
    for (const zone of this) {
      const widget = zone.getWidgets().find((w) => w.props.id === widgetId);
      if (widget)
        return widget;
    }

    throw new RangeError();
  }

  public findZone(cell: CellProps): Zone {
    for (const zone of this) {
      if (zone.getCell().equals(cell))
        return zone;
    }

    throw new RangeError();
  }

  public get draggingWidget(): Widget | undefined {
    if (this.props.draggingWidgetId)
      return this.getWidget(this.props.draggingWidgetId);
    return undefined;
  }

  public get target(): Target | undefined {
    if (!this._target && this.props.target)
      this._target = new Target(this, this.props.target);
    return this._target;
  }
}
