/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp,
  NotifyMessageDetails,
  OutputMessagePriority,
  Plugin,
  PluginAdmin,
  RenderScheduleState,
  ScreenViewport,
} from "@bentley/imodeljs-frontend";
import { Gradient, ColorDef } from "@bentley/imodeljs-common";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { ClientRequestContext, Id64String } from "@bentley/bentleyjs-core";
import { request, Response, RequestOptions } from "@bentley/imodeljs-clients";

enum AnimationType {
  Temperature,
  Co2,
  Smoke,
  Fire,
  Occupancy,
  HeatingCooling,
}

// type of device to request for each animation type.
enum IoTDeviceType {
  TemperatureSensor,
  CO2Sensor,
  SmokeDetector,
  FireAlarm,
  OccupancySensor,
  Thermostat,
}

// runs an IoT Animation
abstract class IoTAnimation {
  private _requestContext: ClientRequestContext;
  protected _elementMap: Map<string, Id64String> | undefined;
  protected _modelId: Id64String | undefined;

  constructor(private _serverUrl: string, private _selectedView: ScreenViewport, private _type: AnimationType, private _floor: string, private _startMsec?: number, private _duration?: number) {
    this._requestContext = new ClientRequestContext();
  }

  private async _makeRequest(): Promise<any> {
    const requestOptions: RequestOptions = {
      method: "POST",
      responseType: "json",
      body: { query: { building: "Building 41", type: IoTDeviceType[this._type] } },
    };

    requestOptions.retries = 0;
    if (this._floor)
      requestOptions.body.query.floor = this._floor;
    if (this._startMsec)
      requestOptions.body.start = this._startMsec;
    if (this._duration)
      requestOptions.body.duration = this._duration;

    try {
      const response: Response = await request(this._requestContext, this._serverUrl + "/iot/getreadings", requestOptions);
      return Promise.resolve(response.body.sequence);
    } catch (error) {
      // this shouldn't happen
      return Promise.resolve(`Can't get IoT Readings: ${error.toString}`);
    }
  }

  private _showAnimationSchedule(schedule: any) {
    const displayStyleState = this._selectedView.displayStyle;
    const renderSchedule: RenderScheduleState.Script = RenderScheduleState.Script.fromJSON(displayStyleState.id, this._selectedView.iModel, schedule)!;
    (displayStyleState as any)._scheduleScript = renderSchedule;
    this._selectedView.displayStyle = displayStyleState;
  }

  private async _getElementMap(): Promise<void> {
    const iModel = this._selectedView.iModel;
    this._elementMap = new Map<string, Id64String>();

    // get the elementId of the floor we are looking for. NOTE: The "Building_41" part is a generated schema and depends on the iModel.
    let floorElementId: string | undefined;
    for await (const row of iModel.query("SELECT ECInstanceId FROM Building_41.Floor WHERE UserLabel=:floor", { floor: this._floor })) {
      floorElementId = row.id;
    }
    // get the elementId and architectural space number for all of the spaces on the floor.
    for await (const row of iModel.query("SELECT ECInstanceId,ArchSpace_number,model.Id AS modelId FROM Building_41.space WHERE ComposingElement.id=:floorEId", { floorEId: floorElementId })) {
      this._modelId = row.modelId;
      this._elementMap.set(row.archSpace_number, row.id);
    }
  }

  public async run() {
    const sequence: any = await this._makeRequest();
    await this._getElementMap();
    const schedule: any = this.makeAnimationSchedule(sequence);
    this._showAnimationSchedule(schedule);
  }

  protected abstract colorFromReading(reading: any): ColorValue;

  protected makeAnimationSchedule(sequence: any) {
    const scheduleMap = new Map<Id64String, ColorTime[]>();

    if (!Array.isArray(sequence))
      throw new Error("sequence should be an array");
    if (!this._elementMap)
      throw new Error("Don't have element map");

    let stepNumber: number = 0;
    for (const entry of sequence) {
      if (undefined === entry.msec)
        throw new Error(`sequence[${stepNumber}] does not contain msec property`);
      if ((undefined === entry.readings) || !Array.isArray(entry.readings))
        throw new Error(`sequence[${stepNumber}] does not include readings array`);

      let readingNumber: number = 0;
      for (const reading of entry.readings) {
        if (undefined === reading.id || (typeof reading.id !== "string"))
          throw new Error(`reading[${readingNumber}] of sequence[${stepNumber} does not include string id property`);

        const elementId: Id64String | undefined = this._elementMap!.get(reading.id);
        if (undefined === elementId) {
          // tslint:disable-next-line:no-console
          console.log(`reading[${readingNumber}] of sequence[${stepNumber} includes a space id that does not match any element`);
          continue;
        }

        let thisColorArray: ColorTime[] | undefined = scheduleMap.get(elementId);
        if (undefined === thisColorArray) {
          thisColorArray = [];
          scheduleMap.set(elementId, thisColorArray);
        }

        thisColorArray.push(new ColorTime(entry.msec / 1000.0, this.colorFromReading(reading), 2));
        ++readingNumber;
      }
      ++stepNumber;
    }

    const elementTimelines: any[] = [];
    for (const mapEntry of scheduleMap.entries()) {
      const scheduleEntry: any = {};
      scheduleEntry.elementIds = [];
      scheduleEntry.elementIds.push(mapEntry[0]);
      scheduleEntry.colorTimeline = mapEntry[1];
      scheduleEntry.batchId = 0;
      // Override transparency to 50% - else rooms spaces don't display or colrs are difficult to discern...
      scheduleEntry.visibilityTimeline = [{ time: scheduleEntry.colorTimeline[0].time, interpolation: 2, value: 93 }];
      elementTimelines.push(scheduleEntry);
    }

    const schedule: any[] = [];
    schedule.push({ modelId: this._modelId, elementTimelines });
    return schedule;
  }
}

class ColorValue {
  constructor(public red: number, public blue: number, public green: number) { }
}

class ColorTime {
  constructor(public time: number, public value: ColorValue, public interpolation: number) { }

}

class IoTTemperatureAnimation extends IoTAnimation {
  private _gradient: Gradient.Symb;

  constructor(simulatorUrl: string, selectedView: ScreenViewport, type: AnimationType, floor: string, startMsec?: number, duration?: number) {
    super(simulatorUrl, selectedView, type, floor, startMsec, duration);
    const thematicSettings = Gradient.ThematicSettings.fromJSON({ colorScheme: Gradient.ThematicColorScheme.BlueRed, mode: Gradient.ThematicMode.Smooth, stepCount: 0, rangeLow: 0.0, rangeHigh: 1.0, marginColor: new ColorDef("blanchedAlmond") });
    this._gradient = Gradient.Symb.createThematic(thematicSettings);
  }

  protected colorFromReading(reading: any): ColorValue {
    // RBB -- Temperatures don't seem to vary much -- temporarily set range to 70 to 72 so we can see color variation.
    const temperature = reading.temp;
    let fraction = (temperature - 70.0) / 3.0;
    if (fraction < 0)
      fraction = 0;
    if (fraction > 1.0)
      fraction = 1.0;

    const gradientColor = this._gradient.mapColor(fraction);
    return new ColorValue(gradientColor.colors.r, gradientColor.colors.b, gradientColor.colors.g);
  }
}

class IoTStateAnimation extends IoTAnimation {
  constructor(simulatorUrl: string, selectedView: ScreenViewport, type: AnimationType, private _stateProperty: string, private _onColor: ColorValue,
    private _offColor: ColorValue, floor: string, startMsec?: number, duration?: number) {
    super(simulatorUrl, selectedView, type, floor, startMsec, duration);
  }

  protected colorFromReading(reading: any): ColorValue {
    return reading[this._stateProperty] ? this._onColor : this._offColor;
  }
}

class IoTDemoPlugin extends Plugin {
  private _i18NNamespace?: I18NNamespace;
  private _simulationUrl: string;
  private _animationType: AnimationType;

  public constructor(name: string) {
    super(name);
    // args might override this.
    this._simulationUrl = "http://localhost:3007";
    this._animationType = AnimationType.HeatingCooling;
  }

  private _createAnimation(simulatorUrl: string, selectedView: ScreenViewport, type: AnimationType, floor: string, duration?: number, startMsec?: number): IoTAnimation | undefined {
    switch (type) {
      case AnimationType.Temperature:
      case AnimationType.HeatingCooling:
        return new IoTTemperatureAnimation(simulatorUrl, selectedView, type, floor, startMsec, duration);

      case AnimationType.Occupancy:
        return new IoTStateAnimation(simulatorUrl, selectedView, type, "occupied", new ColorValue(220, 220, 220), new ColorValue(50, 50, 50), floor, startMsec, duration);

      case AnimationType.Smoke:
        return new IoTStateAnimation(simulatorUrl, selectedView, type, "smoke", new ColorValue(255, 255, 200), new ColorValue(50, 50, 50), floor, startMsec, duration);

      case AnimationType.Fire:
        return new IoTStateAnimation(simulatorUrl, selectedView, type, "fire", new ColorValue(255, 255, 255), new ColorValue(50, 50, 50), floor, startMsec, duration);
    }
    return undefined;
  }

  /** Invoked the first time this plugin is loaded. */
  public onLoad(_args: string[]): void {
    this._i18NNamespace = this.i18n.registerNamespace("IoTDemo");

    this._i18NNamespace!.readFinished.then(() => {
      const message: string = this.i18n.translate("IoTDemo:Messages.Start");
      const msgDetails: NotifyMessageDetails = new NotifyMessageDetails(OutputMessagePriority.Info, message);
      IModelApp.notifications.outputMessage(msgDetails);
    }).catch(() => { });
  }

  /** Invoked each time this plugin is loaded. */
  public async onExecute(args: string[]): Promise<void> {
    let animType = AnimationType.HeatingCooling;
    if (args.length > 1) {
      const typeString: string = args[1].toLowerCase();
      switch (typeString) {
        case "temperature": {
          animType = AnimationType.HeatingCooling;
          break;
        }
        case "smoke": {
          animType = AnimationType.Smoke;
          break;
        }
        case "fire": {
          animType = AnimationType.Fire;
          break;
        }
        case "occupancy": {
          animType = AnimationType.Occupancy;
          break;
        }
        case "co2": {
          animType = AnimationType.Co2;
          break;
        }
      }
      this._animationType = animType;
    }

    let duration = 120;
    if (args.length > 2) {
      duration = parseInt(args[2], 10);
    }

    if (args.length > 3) {
      this._simulationUrl = args[3];
    }

    const selectedView = IModelApp.viewManager.selectedView;
    if ((undefined === selectedView) || (undefined === selectedView.iModel))
      return;

    const animation = this._createAnimation(this._simulationUrl, selectedView, this._animationType, "Floor 1", duration, undefined);
    if (animation) {
      await animation.run();
    }
  }
}

declare var PLUGIN_NAME: string;

PluginAdmin.register(new IoTDemoPlugin(PLUGIN_NAME));
