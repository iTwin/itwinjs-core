/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, Id64String } from "@bentley/bentleyjs-core";
import { ColorDef, FeatureAppearance } from "@bentley/imodeljs-common";
import { FeatureOverrideProvider, FeatureSymbology, HitDetail, IModelApp, ScreenViewport, Viewport } from "@bentley/imodeljs-frontend";
import { AnimationType, IoTDeviceType } from "./IoTDefinitions";
import { ColorValue, IoTAnimation, IoTDemoExtension } from "./iotDemo";

export class IoTMonitor implements FeatureOverrideProvider {
  private _animation: IoTAnimation | undefined;
  private _animationView: ScreenViewport | undefined;
  private _intervalHandle: NodeJS.Timer | any | undefined;
  private _overrideMap: Map<Id64String, ColorValue> | undefined;
  private _expectedTypes: IoTDeviceType[] | undefined;
  private _latestReadingTime: number;

  constructor(public extension: IoTDemoExtension) {
    this._intervalHandle = undefined;
    this._expectedTypes = undefined;
    this._latestReadingTime = 0;
  }

  public startMonitor(animationType: AnimationType): void {
    this._animationView = IModelApp.viewManager.selectedView;
    if (undefined === this._animationView)
      return;
    switch (animationType) {
      case AnimationType.Temperature:
        this._expectedTypes = [IoTDeviceType.Thermostat, IoTDeviceType.TemperatureSensor];
        break;
      case AnimationType.Co2:
        this._expectedTypes = [IoTDeviceType.CO2Sensor];
        break;
      case AnimationType.HeatingCooling:
        this._expectedTypes = [IoTDeviceType.Thermostat];
        break;
      case AnimationType.Fire:
        this._expectedTypes = [IoTDeviceType.FireAlarm];
        break;
      case AnimationType.Smoke:
        this._expectedTypes = [IoTDeviceType.SmokeDetector];
        break;
      case AnimationType.Occupancy:
        this._expectedTypes = [IoTDeviceType.OccupancySensor];
        break;
    }

    this._animation = this.extension.createAnimation(this._animationView, animationType, "Floor 1", -1);
    this._latestReadingTime = 0;
    this._showLatestReadings().catch((_err) => { });
    this._intervalHandle = setInterval(this._showLatestReadings.bind(this), 2 * 1000);
  }

  public stopMonitor(): void {
    if (this._animationView)
      this._animationView.dropFeatureOverrideProvider(this);

    // throw away current animation.
    this._latestReadingTime = 0.0;
    this._animation = undefined;
    this._overrideMap = undefined;
    if (this._intervalHandle) {
      clearInterval(this._intervalHandle);
      this._intervalHandle = undefined;
    }
  }

  private _wantReadingForOverride(deviceType: IoTDeviceType) {
    if (!this._expectedTypes)
      return false;

    for (const thisType of this._expectedTypes) {
      if (thisType === deviceType)
        return true;
    }
    return false;
  }

  private async _showLatestReadings() {
    if (!this._animation)
      return;

    // wait for current readings.
    const currentReading: { readingTime: number, readings: any[] } = await this._animation.getLatestTimeAndReading();
    if (this._latestReadingTime >= currentReading.readingTime)
      return;
    this._latestReadingTime = currentReading.readingTime;

    // set up overrides.
    this._overrideMap = new Map<Id64String, ColorValue>();
    // we expect the readings to be either of the type we requested, or alarms.
    for (const thisReading of currentReading.readings) {
      const idString: Id64String | undefined = await this._animation.getElementIdFromDeviceId(thisReading.id);
      if (undefined === idString)
        continue;

      let animationColorValue: ColorValue | undefined;
      let alarmColorValue: ColorValue | undefined;

      if (this._wantReadingForOverride(thisReading.ty)) {
        animationColorValue = this._animation.colorFromReading(thisReading);
      } else {
        // it may be an alarm.
        alarmColorValue = new ColorValue(255, 0, 0);
      }
      if (alarmColorValue) {
        this._overrideMap.set(idString, alarmColorValue);
      } else if (animationColorValue) {
        this._overrideMap.set(idString, animationColorValue);
      }
    }

    // set the feature overrides.
    assert(undefined !== this._animationView);
    const provider = this._animationView.findFeatureOverrideProvider((x) => x === this);
    if (!provider)
      this._animationView.addFeatureOverrideProvider(this);
    else
      this._animationView.setFeatureOverrideProviderChanged();

    this.extension.iotUiProvider!.syncCurrentDateInUi(new Date(this._latestReadingTime));
  }

  public addFeatureOverrides(overrides: FeatureSymbology.Overrides, _viewport: Viewport): void {
    if (!this._overrideMap)
      return;

    for (const [elementId, color] of this._overrideMap) {
      const colorDef = ColorDef.from(color.red, color.green, color.blue, 14);
      const appearance = FeatureAppearance.fromRgba(colorDef);
      overrides.overrideElement(elementId, appearance);
    }
  }

  public async getToolTip(hit: HitDetail): Promise<string[] | undefined> {
    if ((undefined === this._overrideMap) || (undefined === this._animationView) || (undefined === this._animation))
      return undefined;

    const currentReading: { readingTime: number, readings: any[] } = await this._animation.getLatestTimeAndReading();

    // we expect the readings to be either of the type we requested, or alarms.
    for (const thisReading of currentReading.readings) {
      const idString: Id64String | undefined = await this._animation.getElementIdFromDeviceId(thisReading.id);
      if ((undefined === idString) || (idString !== hit.sourceId))
        continue;

      if (this._wantReadingForOverride(thisReading.ty)) {
        return this._animation.toolTipFromReading(thisReading);
      } else {
        // it may be an alarm.
        return [`${thisReading.ty} Alarm!`];
      }
    }
    return undefined;
  }

}
