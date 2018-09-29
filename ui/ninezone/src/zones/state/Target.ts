/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import NineZone, { WidgetZoneIndex } from "./NineZone";

export enum TargetType {
  Merge,
  Back,
}

export interface TargetProps {
  readonly zoneId: WidgetZoneIndex;
  readonly type: TargetType;
}

export default class Target {
  public constructor(
    public readonly nineZone: NineZone,
    public readonly props: TargetProps,
  ) {
  }

  public get zone() {
    return this.nineZone.getWidgetZone(this.props.zoneId);
  }

  public get type() {
    return this.props.type;
  }
}
