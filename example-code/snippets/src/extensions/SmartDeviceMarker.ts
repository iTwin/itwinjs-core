/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention, no-console */

// __PUBLISH_EXTRACT_START__ ExtensionSample-SmartDeviceMarker.example-code
import {
  BeButtonEvent,
  ExtensionHost,
  Marker,
  StandardViewId,
} from "@itwin/core-extension";
import { XAndY, XYAndZ } from "@itwin/core-geometry";

import Bed from "../assets/Bed.png";
import DishWasher from "../assets/DishWasher.png";
import Garage from "../assets/Garage.png";
import Jacuzzi from "../assets/Jacuzzi.png";
import Light from "../assets/Light.png";
import Lock from "../assets/Lock.png";
import Oven from "../assets/Oven.png";
import Speaker from "../assets/Speaker.png";
import Thermostat from "../assets/Thermostat.png";
import TV from "../assets/TV.png";
import Washer from "../assets/Washer.png";

const getIcon = (iotType: string) => {
  switch (iotType) {
    case "Bed":
      return Bed;
    case "DishWasher":
      return DishWasher;
    case "Garage":
      return Garage;
    case "Jacuzzi":
      return Jacuzzi;
    case "Light":
      return Light;
    case "Lock":
      return Lock;
    case "Oven":
      return Oven;
    case "Speaker":
      return Speaker;
    case "Thermostat":
      return Thermostat;
    case "TV":
      return TV;
    case "Washer":
      return Washer;
    default:
      return "";
  }
};

export class SmartDeviceMarker extends Marker {
  private elementId: string;

  constructor(
    location: XYAndZ,
    size: XAndY,
    _smartDeviceId: string,
    smartDeviceType: string,
    elementId: string,
  ) {
    super(location, size);
    this.elementId = elementId;

    const image = new Image();
    image.src = getIcon(smartDeviceType);
    this.setImage(image);
  }

  public override onMouseButton(ev: BeButtonEvent): boolean {
    if (!ev.isDown)
      return true;
    const vp = ExtensionHost.viewManager.selectedView;
    if (!vp)
      return true;
    vp.zoomToElements(this.elementId, {
      animateFrustumChange: true,
      standardViewId: StandardViewId.RightIso,
    }).catch(console.error);
    return true;
  }
}
// __PUBLISH_EXTRACT_END__
