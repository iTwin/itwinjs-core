/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention, no-console */

// __PUBLISH_EXTRACT_START__ ExtensionSample-SmartDeviceDecorator.example-code
import {
  DecorateContext,
  Decorator,
  IModelConnection,
  Marker,
  QueryRowFormat,
  ScreenViewport,
} from "@itwin/core-extension";
import { SmartDeviceMarker } from "./SmartDeviceMarker";

export class SmartDeviceDecorator implements Decorator {
  private iModel: IModelConnection;
  private markerSet: Marker[];

  constructor(vp: ScreenViewport) {
    this.iModel = vp.iModel;
    this.markerSet = [];
    this.addMarkers().catch(console.error);
  }

  private async getSmartDeviceData() {
    const query = `
      SELECT  SmartDeviceId,
              SmartDeviceType,
              ECInstanceId,
              Origin
              FROM DgnCustomItemTypes_HouseSchema.SmartDevice
              WHERE Origin IS NOT NULL
    `;

    const results = this.iModel.createQueryReader(query, undefined, {
      rowFormat: QueryRowFormat.UseJsPropertyNames,
    });

    const values = [];
    for await (const row of results) {
      values.push(row);
    }
    return values;
  }

  private async addMarkers() {
    const values = await this.getSmartDeviceData();

    values.forEach((value) => {
      const smartDeviceMarker = new SmartDeviceMarker(
        { x: value.origin.x, y: value.origin.y, z: value.origin.z },
        { x: 40, y: 40 },
        value.smartDeviceId,
        value.smartDeviceType,
        value.id,
      );

      this.markerSet.push(smartDeviceMarker);
    });
  }

  public decorate(context: DecorateContext): void {
    this.markerSet.forEach((marker) => {
      marker.addDecoration(context);
    });
  }
}
// __PUBLISH_EXTRACT_END__
