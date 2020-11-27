/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ClientRequestContext, Id64String } from "@bentley/bentleyjs-core";
import { ColorDef, Gradient, ThematicGradientColorScheme, ThematicGradientMode, ThematicGradientSettings } from "@bentley/imodeljs-common";
import {
  Extension, HitDetail, IModelApp, NotifyMessageDetails, OutputMessagePriority, RenderScheduleState, ScreenViewport, ToolTipProvider,
} from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { request, RequestOptions, Response } from "@bentley/itwin-client";
import { UiItemsManager } from "@bentley/ui-abstract";
import { AnimationType, IoTDeviceType } from "./IoTDefinitions";
import { IoTMonitor } from "./iotMonitor";
import { IoTSimulator } from "./simulator/IoTSimulator";
import { IotUiProvider } from "./ui/IotUiProvider";

export class ColorValue {
  constructor(public red: number, public blue: number, public green: number) { }
}

class ColorTime {
  constructor(public time: number, public value: ColorValue, public interpolation: number, public reading: any) { }
}

// runs an IoT Animation
export abstract class IoTAnimation {
  private _requestContext: ClientRequestContext;
  protected _elementMap: Map<string, Id64String> | undefined;
  protected _modelId: Id64String | undefined;
  // we keep the scheduleMap that we generate so we can use it in the toolTip.
  public scheduleMap: Map<Id64String, ColorTime[]> | undefined;

  constructor(protected _extension: IoTDemoExtension, private _selectedView: ScreenViewport, private _type: AnimationType, private _visibility: number, private _interpolation: number, private _floor: string, public startMsec?: number, public duration?: number) {
    this._requestContext = new ClientRequestContext();
  }

  private async _makeRequest(): Promise<any> {
    if (this._extension.simulationUrl) {
      const requestOptions: RequestOptions = {
        method: "POST",
        responseType: "json",
        body: { query: { building: "Building 41", type: IoTDeviceType[this._type] } },
      };

      requestOptions.retries = 0;
      if (this._floor)
        requestOptions.body.query.floor = this._floor;
      if (this.startMsec)
        requestOptions.body.start = this.startMsec;
      if (this.duration)
        requestOptions.body.duration = this.duration;

      try {
        const response: Response = await request(this._requestContext, `${this._extension.simulationUrl}/iot/getreadings`, requestOptions);
        return response.body.sequence;
      } catch (error) {
        // this shouldn't happen
        return `Can't get IoT Readings: ${error.toString}`;
      }
    } else {
      await (this._extension.simulationPromise);
      const query: any = { building: "Building 41", type: IoTDeviceType[this._type] };
      if (this._floor)
        query.floor = this._floor;
      const sequence: any = this._extension.localSimulator!.getReadings(query, this.startMsec, this.duration);
      this._extension.startTime = this._extension.localSimulator!.getStartTime();
      this._extension.endTime = this._extension.localSimulator!.getEndTime();
      return sequence;
    }
  }

  private _showAnimationSchedule(schedule: any) {
    const displayStyleState = this._selectedView.displayStyle;
    const renderSchedule: RenderScheduleState.Script = RenderScheduleState.Script.fromJSON(displayStyleState.id, schedule)!;
    displayStyleState.scheduleScript = renderSchedule;
    this._selectedView.displayStyle = displayStyleState;
  }

  // cancel any animation schedule.
  public stopAnimationSchedule(): void {
    const displayStyleState = this._selectedView.displayStyle;
    if (displayStyleState.scheduleScript) {
      displayStyleState.scheduleScript = undefined;
      this._selectedView.displayStyle = displayStyleState;
    }
  }

  private async _getElementMap(): Promise<void> {
    if (undefined !== this._elementMap)
      return;

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

  public async getElementIdFromDeviceId(deviceId: string): Promise<Id64String | undefined> {
    await this._getElementMap();
    return this._elementMap!.get(deviceId);
  }

  public async run(): Promise<void> {
    const sequence: any = await this._makeRequest();
    await this._getElementMap();
    const schedule = this.makeAnimationSchedule(sequence);
    this._showAnimationSchedule(schedule);
  }

  protected makeAnimationSchedule(sequence: any): any[] {
    this.scheduleMap = new Map<Id64String, ColorTime[]>();
    if (undefined === this.startMsec)
      this.startMsec = sequence[0].msec;

    if (!Array.isArray(sequence))
      throw new Error("sequence should be an array");
    if (!this._elementMap)
      throw new Error("Don't have element map");

    let stepNumber: number = 0;
    // let previousTime: number = 0;
    for (const entry of sequence) {
      if (undefined === entry.msec)
        throw new Error(`sequence[${stepNumber}] does not contain msec property`);
      if ((undefined === entry.readings) || !Array.isArray(entry.readings))
        throw new Error(`sequence[${stepNumber}] does not include readings array`);

      // this is now in seconds since 1/1/1970.
      const currentTime = entry.msec / 1000.0;

      let readingNumber: number = 0;
      for (const reading of entry.readings) {
        if (undefined === reading.id || (typeof reading.id !== "string"))
          throw new Error(`reading[${readingNumber}] of sequence[${stepNumber} does not include string id property`);

        const elementId: Id64String | undefined = this._elementMap.get(reading.id);
        if (undefined === elementId) {
          // eslint-disable-next-line no-console
          console.log(`reading[${readingNumber}] of sequence[${stepNumber} includes a space id that does not match any element`);
          continue;
        }

        let thisColorArray: ColorTime[] | undefined = this.scheduleMap.get(elementId);
        if (undefined === thisColorArray) {
          thisColorArray = [];
          this.scheduleMap.set(elementId, thisColorArray);
        }

        const thisColor = this.colorFromReading(reading);
        /* ------
        // see if there is an entry for the interval immediately preceding this one. If not, we need to add one
        // with the old color so it will interpolate in one interval rather than from a stale old number to the new one.
        if ((this._interpolation === 2) && (thisColorArray.length !== 0)) {
          const previousColorTime: ColorTime = thisColorArray[length - 1];
          if ((previousTime - previousColorTime.time) > 0.5) {
            thisColorArray.push(new ColorTime(previousTime, previousColorTime.value, this._interpolation));
          }
        }
        ---------- */

        thisColorArray.push(new ColorTime(currentTime, thisColor, this._interpolation, reading));
        ++readingNumber;
      }
      // previousTime = currentTime;
      ++stepNumber;
    }

    const elementTimelines: any[] = [];
    for (const mapEntry of this.scheduleMap.entries()) {
      const scheduleEntry: any = {};
      scheduleEntry.elementIds = [];
      scheduleEntry.elementIds.push(mapEntry[0]);
      scheduleEntry.colorTimeline = mapEntry[1];
      scheduleEntry.batchId = 0;
      // Override transparency else rooms spaces don't display or colors are difficult to discern...
      scheduleEntry.visibilityTimeline = [{ time: scheduleEntry.colorTimeline[0].time, interpolation: 1, value: this._visibility }];
      elementTimelines.push(scheduleEntry);
    }

    const schedule: any[] = [];
    schedule.push({ modelId: this._modelId, elementTimelines });
    return schedule;
  }

  public async getLatestTimeAndReading(): Promise<any> {
    // get the latest time from the animation.
    if (this._extension.simulationUrl) {
      // TBD
    } else {
      await (this._extension.simulationPromise);
      const query: any = { building: "Building 41", type: IoTDeviceType[this._type] };
      if (this._floor)
        query.floor = this._floor;
      const thisReading: { readingTime: number, readings: any[] } = this._extension.localSimulator!.getLatestTimeAndReading(query);
      return thisReading;
    }
  }

  // get the tool tip from the current position in the animation.
  public getToolTip(hit: HitDetail): string[] | undefined {
    if ((undefined === this.scheduleMap) || (undefined === this._selectedView))
      return undefined;

    const renderScript: RenderScheduleState.Script | undefined = this._selectedView.displayStyle.scheduleScript;
    if (undefined === renderScript)
      return undefined;

    // here we have a scheduleScript.
    let animationFraction = 0;
    const script = this._selectedView.displayStyle.scheduleScript;
    if (script && undefined !== this._selectedView.timePoint) {
      const timeRange = script.computeDuration();
      animationFraction = (this._selectedView.timePoint - timeRange.low) / timeRange.length();
    }

    const scheduleMap: Map<Id64String, ColorTime[]> = this.scheduleMap;
    const elementTimeList = scheduleMap.get(hit.sourceId);
    if (undefined === elementTimeList)
      return undefined;

    // find the msec from the animationFraction and our startTime and duration.
    // The duration is in minutes, but we want seconds since start.
    const msecSinceStart = animationFraction * this.duration! * 60 * 1000;
    const currentSeconds = (this.startMsec! + msecSinceStart) / 1000.0;

    // find where we are in the list of times
    let foundColorTime = elementTimeList[0];
    for (const thisTime of elementTimeList) {
      if (thisTime.time >= currentSeconds) {
        break;
      } else {
        foundColorTime = thisTime;
      }
    }
    return this.toolTipFromReading(foundColorTime.reading);
  }

  public abstract colorFromReading(reading: any): ColorValue;

  public abstract toolTipFromReading(reading: any): string[] | undefined;

}

class IoTHeatCoolAnimation extends IoTAnimation {
  constructor(extension: IoTDemoExtension, selectedView: ScreenViewport, type: AnimationType, visibility: number, interpolation: number, floor: string, startMsec?: number, duration?: number) {
    super(extension, selectedView, type, visibility, interpolation, floor, startMsec, duration);
  }

  public colorFromReading(reading: any): ColorValue {
    // RBB -- Temperatures don't seem to vary much -- temporarily set range to 70 to 72 so we can see color variation.
    const heating: number = reading.heat;
    const cooling: number = reading.cool;
    if (heating === 1)
      return new ColorValue(120, 0, 0);
    else if (heating === 2)
      return new ColorValue(230, 0, 0);
    else if (cooling === 1)
      return new ColorValue(0, 120, 0);
    else if (cooling === 2)
      return new ColorValue(0, 230, 0);
    else
      return new ColorValue(40, 40, 40);
  }

  public toolTipFromReading(reading: any): string[] | undefined {
    const messages: string[] = [];
    const i18n = this._extension.i18n;
    messages.push(i18n.translate("iotDemo:Messages.TemperatureToolTip", { temp: reading.temp.toFixed(1) }));

    if ((undefined !== reading.heat) && (0 !== reading.heat)) {
      const speedString: string = i18n.translate((reading.heat > 1) ? "iotDemo:Messages.High" : "iotDemo:Messages.Low");
      messages.push(i18n.translate("iotDemo:Messages.HeatToolTip", { highLow: speedString, setPoint: reading.setHt.toFixed(0) }));
    } else if ((undefined !== reading.cool) && (0 !== reading.cool)) {
      const speedString: string = i18n.translate((reading.cool > 1) ? "iotDemo:Messages.High" : "iotDemo:Messages.Low");
      messages.push(i18n.translate("iotDemo:Messages.CoolToolTip", { highLow: speedString, setPoint: reading.setCool.toFixed(0) }));
    }
    return messages;
  }
}

class IoTTemperatureAnimation extends IoTHeatCoolAnimation {
  private _gradient: Gradient.Symb;

  constructor(extension: IoTDemoExtension, selectedView: ScreenViewport, type: AnimationType, visibility: number, interpolation: number, floor: string, startMsec?: number, duration?: number) {
    super(extension, selectedView, type, visibility, interpolation, floor, startMsec, duration);
    const thematicSettings = ThematicGradientSettings.fromJSON({ colorScheme: ThematicGradientColorScheme.BlueRed, mode: ThematicGradientMode.Smooth, stepCount: 0, marginColor: ColorDef.computeTbgrFromString("blanchedAlmond") });
    this._gradient = Gradient.Symb.createThematic(thematicSettings);
  }

  public colorFromReading(reading: any): ColorValue {
    const temperature = reading.temp;
    let fraction = (temperature - 71.0) / 4.0;
    if (fraction < 0)
      fraction = 0;
    if (fraction > 1.0)
      fraction = 1.0;

    const gradientColor = this._gradient.mapColor(fraction);
    return new ColorValue(gradientColor.colors.r, gradientColor.colors.b, gradientColor.colors.g);
  }
}

class IoTCo2Animation extends IoTAnimation {
  constructor(extension: IoTDemoExtension, selectedView: ScreenViewport, type: AnimationType, visibility: number, interpolation: number, floor: string, startMsec?: number, duration?: number) {
    super(extension, selectedView, type, visibility, interpolation, floor, startMsec, duration);
  }

  public colorFromReading(reading: any): ColorValue {
    const ppm: number = reading.ppm;
    let fractionBad = (ppm - 400) / 300;
    if (fractionBad < 0)
      fractionBad = 0;
    if (fractionBad > 1)
      fractionBad = 1;

    // go from grey at 400 to orange
    const red: number = 55 + (fractionBad * (255 - 55));
    const green: number = 55 + (fractionBad * (69 - 55));
    const blue: number = 55 + (fractionBad * (55 - 0));
    return new ColorValue(red, blue, green);
  }

  public toolTipFromReading(reading: any): string[] | undefined {
    const i18n = this._extension.i18n;
    return [i18n.translate("iotDemo:Messages.Co2ToolTip", { co2ppm: reading.ppm.toFixed(0) })];
  }
}

class IoTStateAnimation extends IoTAnimation {
  constructor(extension: IoTDemoExtension, selectedView: ScreenViewport, type: AnimationType, visibility: number, interpolation: number,
    private _stateProperty: string, private _trueString: string | undefined, private _falseString: string | undefined, private _onColor: ColorValue,
    private _offColor: ColorValue, floor: string, startMsec?: number, duration?: number) {
    super(extension, selectedView, type, visibility, interpolation, floor, startMsec, duration);
  }

  public colorFromReading(reading: any): ColorValue {
    return reading[this._stateProperty] ? this._onColor : this._offColor;
  }

  public toolTipFromReading(reading: any): string[] | undefined {
    if (reading[this._stateProperty]) {
      if (this._trueString)
        return [this._trueString];
    } else {
      if (this._falseString)
        return [this._falseString];
    }
    return undefined;
  }
}

class IotToolTipProvider implements ToolTipProvider {
  constructor(public extension: IoTDemoExtension) {
  }

  public async augmentToolTip(hit: HitDetail, tooltipPromise: Promise<HTMLElement | string>): Promise<HTMLElement | string> {
    let iotInfo: string[] | undefined;
    if (this.extension.animation)
      iotInfo = this.extension.animation.getToolTip(hit);
    else if (this.extension.iotMonitor)
      iotInfo = await this.extension.iotMonitor.getToolTip(hit);

    if ((undefined === iotInfo) || (0 === iotInfo.length))
      return tooltipPromise;

    // wait for previous tooltip.
    tooltipPromise.then((tooltip) => {
      if (tooltip instanceof HTMLDivElement) {
        if (undefined === iotInfo)
          return tooltip;

        let out = "";
        iotInfo.forEach((augment) => out += `${this.extension.i18n.translateKeys(augment)}<br>`);
        const newDiv: HTMLDivElement = document.createElement("div");
        newDiv.innerHTML = out;
        tooltip.prepend(newDiv);
        return tooltip;
      } else {
        return tooltipPromise;
      }
    }).catch((_error) => { });

    return tooltipPromise;
  }
}

export class IoTDemoExtension extends Extension {
  private _i18NNamespace?: I18NNamespace;
  protected _defaultNs = "iotDemo";
  public iotMonitor: IoTMonitor | undefined;
  public iotUiProvider?: IotUiProvider;
  public simulationUrl: string | undefined;
  public animation: IoTAnimation | undefined;
  public animationView: ScreenViewport | undefined;
  public localSimulator: IoTSimulator | undefined;
  public simulationPromise: Promise<void> | undefined;
  public startTime: Date;
  public endTime: Date;

  public constructor(name: string) {
    super(name);
    // args might override this.
    this.simulationUrl = undefined;
    this.simulationPromise = undefined;
    this.endTime = new Date(Date.now());
    this.startTime = new Date(this.endTime.getTime() - (4 * 24 * 60 * 60 * 1000));
  }

  public createAnimation(selectedView: ScreenViewport, type: AnimationType, floor: string, duration?: number, startMsec?: number): IoTAnimation | undefined {
    switch (type) {
      case AnimationType.HeatingCooling:
        return new IoTHeatCoolAnimation(this, selectedView, type, 95, 2, floor, startMsec, duration);

      case AnimationType.Temperature:
        return new IoTTemperatureAnimation(this, selectedView, type, 95, 2, floor, startMsec, duration);

      case AnimationType.Co2: {
        return new IoTCo2Animation(this, selectedView, type, 95, 2, floor, startMsec, duration);
      }
      case AnimationType.Occupancy: {
        const trueString = this.i18n.translate("iotDemo:Messages.OccupiedToolTip");
        const falseString = this.i18n.translate("iotDemo:Messages.UnoccupiedToolTip");
        return new IoTStateAnimation(this, selectedView, type, 99, 1, "occupied", trueString, falseString, new ColorValue(220, 220, 220), new ColorValue(50, 50, 50), floor, startMsec, duration);
      }

      case AnimationType.Smoke: {
        const trueString = this.i18n.translate("iotDemo:Messages.SmokeToolTip");
        return new IoTStateAnimation(this, selectedView, type, 99, 1, "smoke", trueString, undefined, new ColorValue(255, 0, 0), new ColorValue(50, 50, 50), floor, startMsec, duration);
      }

      case AnimationType.Fire: {
        const trueString = this.i18n.translate("iotDemo:Messages.FireToolTip");
        return new IoTStateAnimation(this, selectedView, type, 99, 1, "fire", trueString, undefined, new ColorValue(255, 0, 0), new ColorValue(50, 50, 50), floor, startMsec, duration);
      }
    }
    return undefined;
  }

  // run the animation. Start time is in mSec (from Date.getTime()), duration is in minutes.
  public runAnimation(type: AnimationType, duration?: number, startMsec?: number): void {
    this.animationView = IModelApp.viewManager.selectedView;
    if (!this.animationView)
      return;

    if (this.iotMonitor) {
      this.iotMonitor.stopMonitor();
      this.iotMonitor = undefined;
    }

    this.animation = this.createAnimation(this.animationView, type, "Floor 1", duration, startMsec);
    if (this.animation) {
      this.animation.run().catch(() => { });
    }
  }

  public runMonitor(type: AnimationType): void {
    // stop any existing animation.
    if (this.animation) {
      this.animation.stopAnimationSchedule();
      this.animation = undefined;
    }
    if (!this.iotMonitor) {
      this.iotMonitor = new IoTMonitor(this);
    }
    if (this.localSimulator)
      this.localSimulator.continueSimulation();

    this.iotMonitor.startMonitor(type);
  }

  /** Invoked the first time this extension is loaded. */
  public async onLoad(args: string[]): Promise<void> {
    this._i18NNamespace = this.i18n.getNamespace(this._defaultNs);
    await this._i18NNamespace!.readFinished;
    const message: string = this.i18n.translate("iotDemo:Messages.Start");
    const msgDetails: NotifyMessageDetails = new NotifyMessageDetails(OutputMessagePriority.Info, message);
    IModelApp.notifications.outputMessage(msgDetails);

    IModelApp.viewManager.addToolTipProvider(new IotToolTipProvider(this));
    this.iotUiProvider = new IotUiProvider(this);
    // When a new UiProvider is registered the UI is typically refreshed so any extension provided items are displayed.
    // A call to UiItemsManager.unregister will allow any UI provided by the provider to be removed.
    UiItemsManager.register(this.iotUiProvider);
    // if we have a simulationUrl, we'll use it, otherwise we generate the simulated data in the front end.
    if (args.length > 1) {
      this.simulationUrl = args[1];
      // TBD: retrieve the start and end times from the server.
      // this.getStartEndTimesFromServer();
      this.iotUiProvider.showIotDialog();
    } else {
      this.localSimulator = new IoTSimulator(this.resolveResourceUrl("assets/microsoft-campus.json"));
      this.simulationPromise = this.localSimulator.runSimulation();
      await this.simulationPromise;
      this.iotUiProvider.minDate = this.localSimulator.getStartTime();
      this.iotUiProvider.maxDate = this.localSimulator.getEndTime();
      this.iotUiProvider.showIotDialog();
    }
  }

  /** Invoked each time this extension is loaded. */
  public async onExecute(_args: string[]): Promise<void> {
    // currently, everything is done in onLoad.
  }
}

// Register the extension with the extensionAdmin.
// NOTE: The name used here is how the Extension is registered with the whatever Extension server it is hosted on.
IModelApp.extensionAdmin.register(new IoTDemoExtension("iotDemo"));
