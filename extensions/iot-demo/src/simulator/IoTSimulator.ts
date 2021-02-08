/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { request, RequestOptions, Response } from "@bentley/itwin-client";
import { calculateSolarAngles, degToRad } from "./SolarCalculate";

/* eslint-disable no-console, @typescript-eslint/no-shadow */

enum IoTDeviceType {
  TemperatureSensor,
  CO2Sensor,
  SmokeDetector,
  FireAlarm,
  OccupancySensor,
  Thermostat,
}

enum TemperatureUnits {
  Fahrenheit,
  Celsius,
}

class SolarPosition {
  constructor(public azimuth: number, public elevation: number) { }
}

class Utilities {

  public static checkRequireProperties(deviceProps: any, deviceType: string, deviceNum: number, ...props: string[]) {
    for (const prop of props) {
      if (!deviceProps[prop]) {
        throw new Error(`Device number ${deviceNum}, type ${deviceType}, with properties ${deviceProps}, does not have required ${prop} property`);
      }
    }
  }

  public static getTemperatureUnits(deviceProp: any, unitProp: any, deviceNum: number): TemperatureUnits {
    if (!unitProp)
      return TemperatureUnits.Fahrenheit;
    if (typeof unitProp !== "string") {
      throw new Error(`Device number ${deviceNum} of type ${deviceProp.type} has an invalid temperature unit: ${unitProp}`);
    }

    const unitString: string = unitProp.toLowerCase();
    if ((unitString === "f") || (unitString.startsWith("fah")))
      return TemperatureUnits.Fahrenheit;
    if ((unitString === "c") || (unitString.startsWith("ce")))
      return TemperatureUnits.Celsius;

    throw new Error(`Device number ${deviceNum} of type ${deviceProp.type} has an invalid temperature unit: ${unitProp}`);
  }

  public static checkPropSet(container: any, ...props: string[]): boolean {
    for (const prop of props) {
      if (undefined === container[prop]) {
        return false;
      }
    }
    return true;
  }
}

/*
interface Alarm {
  isAlarmed(): boolean;
}
*/

class IoTDeviceResponse {
  constructor(public id: string, public ty: IoTDeviceType) { }
}

abstract class IoTReading {
  constructor(public id: string, public ty: IoTDeviceType) {
  }
}

class IoTTemperatureReading extends IoTReading {
  constructor(id: string, public temp: number) {
    super(id, IoTDeviceType.TemperatureSensor);
  }
}

class IoTThermostatReading extends IoTReading {
  constructor(id: string, public temp: number,
    public setHt: number, public setCool: number, public heat: number, public cool: number) {
    super(id, IoTDeviceType.Thermostat);
  }
}

class IoTCo2Reading extends IoTReading {
  constructor(id: string, public ppm: number) {
    super(id, IoTDeviceType.CO2Sensor);
  }
}

class IoTOccupancyReading extends IoTReading {
  constructor(id: string, public occupied: boolean) {
    super(id, IoTDeviceType.OccupancySensor);
  }
}

class IoTSmokeReading extends IoTReading {
  constructor(id: string, public smoke: boolean) {
    super(id, IoTDeviceType.SmokeDetector);
  }
}

class IoTFireReading extends IoTReading {
  constructor(id: string, public fire: boolean) {
    super(id, IoTDeviceType.FireAlarm);
  }
}

class IoTReadingResponse {
  constructor(public msec: number, public readings: IoTReading[]) { }
}

// abstract device type.
abstract class IoTDevice {
  public space: Space | undefined;
  constructor(public type: IoTDeviceType, public hasInput: boolean, public hasOutput: boolean, public hasAlarm: boolean, public componentId?: string) { }

  public inDeviceList(typeList: IoTDeviceType[] | undefined) {
    if (undefined === typeList)
      return true;
    return undefined !== typeList.find((element) => element === this.type);
  }

  public abstract getReading(lastState: SpaceState[] | undefined, index: number, stepNumber: number): IoTReading | undefined;

  // look backwards until we find the property we want.
  protected _findStepPrecedingWithProperty(startStep: number, propertyName: string): SpaceState {
    if (0 === startStep)
      return this.space!.states[0];

    for (let iStep = startStep - 1; iStep >= 0; --iStep) {
      const state: SpaceState = this.space!.states[iStep];
      if ((state as any)[propertyName])
        return state;
    }
    throw new Error(`No state preceding with ${propertyName} found`);
  }
}

class TemperatureSensor extends IoTDevice {
  constructor(deviceProps: any, _deviceNum: number) {
    // check for required properties
    super(IoTDeviceType.TemperatureSensor, false, true, false, deviceProps.componentId);
  }

  public getReading(lastState: SpaceState[] | undefined, index: number, stepNumber: number): IoTReading | undefined {
    const space: Space = this.space!;
    let changeState: SpaceState | undefined;
    if ((lastState === undefined) || (lastState[index] === undefined)) {
      changeState = this._findStepPrecedingWithProperty(stepNumber, "temperature");
    } else if (space.states[stepNumber].temperature) {
      changeState = space.states[stepNumber];
    }

    if (!changeState)
      return undefined;

    if (lastState !== undefined)
      lastState[index] = changeState;
    return new IoTTemperatureReading(space.id, changeState.temperature!.current);
  }
}

class CO2Sensor extends IoTDevice {
  constructor(deviceProps: any, _deviceNum: number) {
    super(IoTDeviceType.CO2Sensor, false, true, false, deviceProps.componentId);
  }

  public getReading(lastState: SpaceState[] | undefined, index: number, stepNumber: number): IoTReading | undefined {
    const space: Space = this.space!;
    let changeState: SpaceState | undefined;
    if ((lastState === undefined) || (lastState[index] === undefined)) {
      changeState = this._findStepPrecedingWithProperty(stepNumber, "co2");
    } else if (space.states[stepNumber].co2) {
      changeState = space.states[stepNumber];
    }

    if (!changeState)
      return undefined;

    if (lastState !== undefined)
      lastState[index] = changeState;
    return new IoTCo2Reading(space.id, changeState.co2!.current);
  }
}

class OccupancySensor extends IoTDevice {
  constructor(deviceProps: any, _deviceNum: number) {
    super(IoTDeviceType.OccupancySensor, false, false, false, deviceProps.componentId);
  }

  public getReading(lastState: SpaceState[] | undefined, index: number, stepNumber: number): IoTReading | undefined {
    const space: Space = this.space!;
    let changeState: SpaceState | undefined;
    if ((lastState === undefined) || (lastState[index] === undefined)) {
      changeState = this._findStepPrecedingWithProperty(stepNumber, "occupancy");
    } else if (space.states[stepNumber].occupancy) {
      changeState = space.states[stepNumber];
    }

    if (!changeState)
      return undefined;

    if (lastState !== undefined)
      lastState[index] = changeState;
    return new IoTOccupancyReading(space.id, changeState.occupancy!.current);
  }
}

class SmokeDetector extends IoTDevice {
  constructor(deviceProps: any, _deviceNum: number) {
    super(IoTDeviceType.SmokeDetector, false, false, false, deviceProps.componentId);
  }

  public getReading(lastState: SpaceState[] | undefined, index: number, stepNumber: number): IoTReading | undefined {
    const space: Space = this.space!;
    let changeState: SpaceState | undefined;
    if ((lastState === undefined) || (lastState[index] === undefined)) {
      changeState = this._findStepPrecedingWithProperty(stepNumber, "smoke");
    } else if (space.states[stepNumber].smoke) {
      changeState = space.states[stepNumber];
    }

    if (!changeState)
      return undefined;

    if (lastState !== undefined)
      lastState[index] = changeState;
    return new IoTSmokeReading(space.id, changeState.smoke!.current);
  }
}

class FireAlarm extends IoTDevice {
  constructor(deviceProps: any, _deviceNum: number) {
    super(IoTDeviceType.FireAlarm, false, false, false, deviceProps.componentId);
  }

  public getReading(lastState: SpaceState[] | undefined, index: number, stepNumber: number): IoTReading | undefined {
    const space: Space = this.space!;
    let changeState: SpaceState | undefined;
    if ((lastState === undefined) || (lastState[index] === undefined)) {
      changeState = this._findStepPrecedingWithProperty(stepNumber, "fire");
    } else if (space.states[stepNumber].fire) {
      changeState = space.states[stepNumber];
    }

    if (!changeState)
      return undefined;

    if (lastState !== undefined)
      lastState[index] = changeState;
    return new IoTFireReading(space.id, changeState.fire!.current);
  }
}

class Thermostat extends IoTDevice {
  constructor(deviceProps: any, _deviceNum: number) {
    super(IoTDeviceType.Thermostat, true, false, false, deviceProps.componentId);
  }

  public getReading(lastState: SpaceState[] | undefined, index: number, stepNumber: number): IoTReading | undefined {
    const space: Space = this.space!;
    let changeState: SpaceState | undefined;
    if ((lastState === undefined) || (lastState[index] === undefined)) {
      changeState = this._findStepPrecedingWithProperty(stepNumber, "temperature");
    } else if (space.states[stepNumber].temperature) {
      changeState = space.states[stepNumber];
    }

    if (!changeState)
      return undefined;

    if (lastState !== undefined)
      lastState[index] = changeState;
    const tState: TemperatureState = changeState.temperature!;
    return new IoTThermostatReading(space.id, tState.current, tState.setPointHeat, tState.setPointCool, tState.heating, tState.cooling);
  }
}

class Site {
  public name: string;
  public id: string;
  public buildings: Building[];
  constructor() {
    this.name = "";
    this.id = "";
    this.buildings = [];
  }
}

class Building {
  public floors: Floor[];
  constructor(public name: string, public id: string) {
    this.floors = [];
  }
  public inBuildingList(idList: string[] | undefined) {
    if (undefined === idList)
      return true;
    return undefined !== idList.find((element) => element === this.id);
  }
}

class Floor {
  public spaces: Space[];
  constructor(public name: string, public id: string) {
    this.spaces = [];
  }
  public inFloorList(idList: string[] | undefined) {
    if (undefined === idList)
      return true;
    return undefined !== idList.find((element) => element === this.id);
  }
}

class Space {
  public configuration: SpaceConfiguration;
  public states: SpaceState[];
  private _mostRecentTemperature: SpaceState | undefined;
  private _mostRecentCo2: SpaceState | undefined;
  private _mostRecentOccupancy: SpaceState | undefined;
  private _mostRecentSmoke: SpaceState | undefined;
  private _mostRecentFire: SpaceState | undefined;
  private _wasOfficeHours: boolean | undefined;

  constructor(public name: string, public id: string, configuration: SpaceConfiguration) {
    this.states = [];
    this.configuration = configuration;
    // set the space for every device it owns.
    for (const device of configuration.devices) {
      device.space = this;
    }
  }

  public inSpaceList(idList: string[] | undefined) {
    if (undefined === idList)
      return true;
    return undefined !== idList.find((element) => element === this.id);
  }

  public calculateState(_stepNumber: number, currentMsec: number, officeHours: boolean, solarPosition?: SolarPosition) {
    let temperature: TemperatureState | undefined = this._calculateTemperature(currentMsec, officeHours, solarPosition);
    let occupancy: OccupancyState | undefined = this._calculateOccupancy(currentMsec, officeHours);
    let co2: CO2State | undefined = this._calculateCO2(currentMsec, officeHours);
    let smoke: SmokeState | undefined = this._calculateSmoke();
    let fire: FireState | undefined = this._calculateFire();

    // we need to keep track of when this changes.
    if (undefined === this._wasOfficeHours)
      this._wasOfficeHours = officeHours;

    if (temperature.equals(this._mostRecentTemperature))
      temperature = undefined;
    if (occupancy.equals(this._mostRecentOccupancy))
      occupancy = undefined;
    if (co2.equals(this._mostRecentCo2))
      co2 = undefined;
    if (smoke.equals(this._mostRecentSmoke))
      smoke = undefined;
    if (fire.equals(this._mostRecentFire))
      fire = undefined;

    // I used to avoid storing a state for which nothing changed, but that proved to be a pain in the neck.
    const newState = new SpaceState(currentMsec, temperature, occupancy, co2, smoke, fire);
    this.states.push(newState);
    if (temperature)
      this._mostRecentTemperature = newState;
    if (occupancy)
      this._mostRecentOccupancy = newState;
    if (co2)
      this._mostRecentCo2 = newState;
    if (smoke)
      this._mostRecentSmoke = newState;
    if (fire)
      this._mostRecentFire = newState;

    this._wasOfficeHours = officeHours;
  }

  private _calculateSolarGain(solarPosition: SolarPosition | undefined) {
    // do we have an orientation for the space?
    if (undefined === this.configuration.orientation)
      return 0.0;

    // is there a solarPosition?
    if (undefined === solarPosition)
      return 0.0;

    // is it night time?
    if (solarPosition.elevation < 0)
      return 0.0;

    // if the solarPosition is not in the same half-plane as the orientation, no solar gain.
    let checkAngle = solarPosition.azimuth - (this.configuration.orientation - 90.0);
    if (checkAngle < 0)
      checkAngle += 360.0;

    if (checkAngle >= 180.0)
      return 0.0;

    // solar position too low in the sky doesn't contribute because the attenuation is too great.
    if (solarPosition.elevation < 5)
      return 0.0;

    // get exposure fraction
    const horizontalExposure = Math.cos(degToRad(this.configuration.orientation - solarPosition.azimuth));
    const verticalExposure = Math.cos(degToRad(solarPosition.elevation));
    // see Wikipedia "Air_Mass_(astronomy)" for explanation.
    const zenith = 90.0 - solarPosition.elevation;
    const secZ = 1.0 / Math.cos(degToRad(zenith));
    const secZM1 = 1 - secZ;
    const atmosphericAttenuation = secZ - (0.0018167 * secZM1) - (0.002875 * secZM1 * secZM1) - (0.0008083 * secZM1 * secZM1 * secZM1);
    // console.log ("angle:", solarPosition.elevation, "attenuation:", atmosphericAttenuation, "1/aa:",  1.0 / atmosphericAttenuation);
    const solarFactor = horizontalExposure * verticalExposure / atmosphericAttenuation;

    // temperature change in 5 minutes?
    return solarFactor * 2.0;
  }

  private _calculateTemperature(currentMsec: number, officeHours: boolean, solarPosition?: SolarPosition): TemperatureState {
    const previousTemperatureState: SpaceState | undefined = this._mostRecentTemperature;
    const temperatureParams: TemperatureParams = officeHours ? this.configuration.temperatures.officeHours : this.configuration.temperatures.offHours;
    let currentTemp: number;
    if (undefined === previousTemperatureState) {
      // start at the average heat/cool setPoint plus some noise.
      currentTemp = (temperatureParams.setPointCool + temperatureParams.setPointHeat) / 2.0;
      // add some random noise
      currentTemp += (0.5 - Math.random()) * 1.5;
    } else {
      const previousState: TemperatureState = previousTemperatureState.temperature!;
      const previousOccupancy: SpaceState | undefined = this._mostRecentOccupancy;
      const occupied = (undefined === previousOccupancy) ? false : previousOccupancy.occupancy!.current;
      const minutesSinceChange = (currentMsec - previousTemperatureState.msec) / (1000 * 60);
      // if occupied, there is some temperature increase.
      const occupancyIncrement: number = occupied ? minutesSinceChange * 0.05 : 0.0;
      const coolingIncrement: number = previousState.cooling * minutesSinceChange * -0.2;
      const heatingIncrement: number = previousState.heating * minutesSinceChange * 0.2;
      const solarGain: number = this._calculateSolarGain(solarPosition);
      const randomIncrement: number = (0.5 - Math.random()) * 0.3;
      currentTemp = previousState.current + occupancyIncrement + coolingIncrement + heatingIncrement + solarGain + randomIncrement;
    }
    // compare to set points to see if we should be heating or cooling.
    let cooling: number = 0;
    const coolingDiff = currentTemp - temperatureParams.setPointCool;
    if (coolingDiff > 2.0)
      cooling = 2;
    else if (coolingDiff > .5)
      cooling = 1;

    let heating: number = 0;
    const heatingDiff = temperatureParams.setPointHeat - currentTemp;
    if (heatingDiff > 2.0)
      heating = 2;
    else if (heatingDiff > .5) {
      heating = 1;
    }

    currentTemp = 0.20 * Math.floor(currentTemp * 5);
    return new TemperatureState(currentTemp, temperatureParams.setPointCool, temperatureParams.setPointHeat, cooling, heating);
  }

  private _calculateCO2(currentMsec: number, officeHours: boolean): CO2State {
    const previousCO2State: SpaceState | undefined = this._mostRecentCo2;
    const co2Config: CO2Configuration = this.configuration.CO2;
    const ambientCO2 = 405;
    let currentPPM: number;
    if (undefined === previousCO2State) {
      // start at the low CO2 limits plus some noise (higher average if office hours.).
      const highNormal = officeHours ? co2Config.highNormal : (co2Config.highNormal - co2Config.lowNormal) / 2.0;
      currentPPM = co2Config.lowNormal + (highNormal - co2Config.lowNormal) * 0.3 * Math.random();
    } else {
      const previousState: CO2State = previousCO2State.co2!;
      const previousOccupancy: SpaceState | undefined = this._mostRecentOccupancy;
      const occupied = (undefined === previousOccupancy) ? false : previousOccupancy.occupancy!.current;
      const minutesSinceChange = (currentMsec - previousCO2State.msec) / (1000 * 60);
      // if occupied, there is some temperature increase.
      const occupancyIncrement: number = occupied ? minutesSinceChange * .6 : 0;
      const meanRevisionIncrement: number = (ambientCO2 - previousState.current) * Math.random() * minutesSinceChange * .015;
      const randomIncrement: number = (0.5 - Math.random()) * 10;
      currentPPM = previousState.current + occupancyIncrement + meanRevisionIncrement + randomIncrement;
    }
    // round to nearest 20 ppm
    currentPPM = 20.0 * Math.floor((currentPPM + 9) / 20.0);
    return new CO2State(currentPPM);
  }

  private _calculateDuration(params: OccupancyParams, occupied: boolean): number {
    let duration: number = occupied ? params.averageStay : ((1.0 - params.probability) * params.averageStay) / params.probability;
    duration = duration * (1.0 + (0.5 - Math.random()) * 0.2);
    duration = duration * (1000 * 60); // change from minutes to .
    return duration;
  }

  private _calculateOccupancy(currentMsec: number, officeHours: boolean) {
    const previousOccupancy: SpaceState | undefined = this._mostRecentOccupancy;
    const occupancyParams: OccupancyParams = officeHours ? this.configuration.occupancy.officeHours : this.configuration.occupancy.offHours;
    let occupied: boolean = false;
    let duration: number;
    if (undefined === previousOccupancy || officeHours !== this._wasOfficeHours) {
      occupied = Math.random() < occupancyParams.probability;
      duration = this._calculateDuration(occupancyParams, occupied);
    } else {
      // have a previous occupancy.
      duration = previousOccupancy.occupancy!.duration;
      occupied = previousOccupancy.occupancy!.current;
      if ((currentMsec - previousOccupancy.msec) > duration) {
        // recalculate.
        occupied = Math.random() < occupancyParams.probability;
        duration = this._calculateDuration(occupancyParams, occupied);
      }
    }
    return new OccupancyState(occupied, officeHours, duration);
  }

  private _calculateSmoke(): SmokeState {
    const previousSmoke: SpaceState | undefined = this._mostRecentSmoke;
    const smokeConfig: SmokeConfiguration = this.configuration.smoke;
    let smokeAlarm: boolean = false;
    if (undefined === previousSmoke) {
      smokeAlarm = Math.random() < smokeConfig.probability;
    } else {
      if (Math.random() > smokeConfig.inertia) {
        smokeAlarm = Math.random() < smokeConfig.probability;
      } else {
        smokeAlarm = previousSmoke.smoke!.current;
      }
    }
    return new SmokeState(smokeAlarm);
  }

  private _calculateFire(): FireState {
    const previousFire: SpaceState | undefined = this._mostRecentFire;
    const fireConfig: FireConfiguration = this.configuration.fire;
    let fireAlarm: boolean = false;
    if (undefined === previousFire) {
      fireAlarm = Math.random() < fireConfig.probability;
    } else {
      if (Math.random() > fireConfig.inertia) {
        fireAlarm = Math.random() < fireConfig.probability;
      } else {
        fireAlarm = previousFire.fire!.current;
      }
    }
    return new FireState(fireAlarm);
  }
}

// Classes used to configuration the simulation.
class OfficeHours {
  constructor(public day: number, public startHour: number, public endHour: number) { }
}

class OfficeHourConfiguration {
  constructor(public officeHours: OfficeHours[]) { }

  public isOfficeHours(date: Date): boolean {
    const dayOfWeek = date.getUTCDay();
    const hourOfDay = date.getUTCHours();

    for (const checkHours of this.officeHours) {
      if (dayOfWeek === checkHours.day) {
        if ((hourOfDay >= checkHours.startHour) && (hourOfDay <= checkHours.endHour))
          return true;
      }
    }
    return false;
  }
}

class SimulationParameters {
  constructor(public temperatures: number[], public startMsec: number, public endMsec: number, public interval: number,
    public officeHours: OfficeHourConfiguration, public tzHourOffset: number, public longitude: number | undefined, public latitude: number | undefined) { }

  public isOfficeHours(date: Date): boolean {
    return this.officeHours.isOfficeHours(date);
  }

  public getStepFromTime(timeMsec: number): number {
    if (timeMsec <= this.startMsec)
      return 0;
    const timeDelta = timeMsec - this.startMsec;
    return Math.floor(timeDelta / (this.interval * 60 * 1000));
  }
  public getTimeFromStep(stepNumber: number) {
    return this.startMsec + (stepNumber * this.interval * 60 * 1000);
  }
}

// Classes used to configure Spaces.
class TemperatureParams {
  constructor(public setPointHeat: number, public setPointCool: number, public lowLimit: number, public highLimit: number) { }
}

class TemperatureConfiguration {
  constructor(public officeHours: TemperatureParams, public offHours: TemperatureParams) { }
}

class OccupancyParams {
  constructor(public probability: number, public averageStay: number) { }
}

class OccupancyConfiguration {
  constructor(public officeHours: OccupancyParams, public offHours: OccupancyParams) { }
}

class CO2Configuration {
  constructor(public lowNormal: number, public highNormal: number) { }
}

class SmokeConfiguration {
  constructor(public probability: number, public inertia: number) { }
}

class FireConfiguration {
  constructor(public probability: number, public inertia: number) { }
}

class SpaceConfiguration {
  public orientation: number | undefined;

  constructor(orientation: any | undefined, public temperatures: TemperatureConfiguration, public occupancy: OccupancyConfiguration,
    public CO2: CO2Configuration, public smoke: SmokeConfiguration, public fire: FireConfiguration, public devices: IoTDevice[]) {    // eslint-disable-line @typescript-eslint/naming-convention
    this.orientation = this._findOrientation(orientation);
  }

  private _findOrientation(orientation: any | undefined): number | undefined {
    if (undefined === orientation)
      return undefined;

    if (typeof orientation !== "number" || (orientation < 0) || (orientation > 359)) {
      throw new Error("Orientation must be a number between 0 and 359");
    }

    return orientation;
  }
}

class TemperatureState {
  constructor(public current: number, public setPointCool: number, public setPointHeat: number, public cooling: number, public heating: number) { }
  public equals(otherState?: SpaceState): boolean {
    if (undefined === otherState)
      return false;
    const other = otherState.temperature;
    if (undefined === other)
      return false;
    return (other.current === this.current) && (other.setPointCool === this.setPointCool) && (other.setPointHeat === this.setPointHeat) && (
      other.cooling === this.cooling) && (other.heating === this.heating);
  }
}

class OccupancyState {
  constructor(public current: boolean, public officeHours: boolean, public duration: number) { }
  public equals(otherState?: SpaceState): boolean {
    if (undefined === otherState)
      return false;
    const other = otherState.occupancy;
    if (undefined === other)
      return false;
    return (other.current === this.current && other.officeHours === this.officeHours);
  }
}

class CO2State {
  constructor(public current: number) { }
  public equals(otherState?: SpaceState): boolean {
    if (undefined === otherState)
      return false;
    const other = otherState.co2;
    if (undefined === other)
      return false;
    return (other.current === this.current);
  }
}

class SmokeState {
  constructor(public current: boolean) { }
  public equals(otherState?: SpaceState): boolean {
    if (undefined === otherState)
      return false;
    const other = otherState.smoke;
    if (undefined === other)
      return false;
    return (other.current === this.current);
  }
}

class FireState {
  constructor(public current: boolean) { }
  public equals(otherState?: SpaceState): boolean {
    if (undefined === otherState)
      return false;
    const other = otherState.fire;
    if (undefined === other)
      return false;
    return (other.current === this.current);
  }
}

class SpaceState {
  constructor(
    public msec: number,
    public temperature: TemperatureState | undefined,
    public occupancy: OccupancyState | undefined,
    public co2: CO2State | undefined,
    public smoke: SmokeState | undefined,
    public fire: FireState | undefined) { }
}

export class IoTSimulator {
  private _setupProps: any;
  private _siteInfo: Site;
  private _spaceDefaults: Map<string, SpaceConfiguration>;
  private _simulationParameters: SimulationParameters;
  private _showSimulation: boolean;
  private _showSite: boolean;
  private _currentMSec: number;
  private _currentStep: number;
  private _continuing: boolean;

  public constructor(private _jsonConfigUrl: string) {
    // set up the express server.
    this._siteInfo = new Site();
    this._spaceDefaults = new Map<string, SpaceConfiguration>();
    this._showSimulation = false;
    this._showSite = false;
    this._currentStep = 0;
    this._currentMSec = Date.now();
    this._continuing = false;

    const officeHoursDefault: OfficeHours[] = [];
    for (let iDay: number = 1; iDay <= 5; ++iDay) {
      officeHoursDefault.push(new OfficeHours(iDay, 8, 5));
    }
    const officeHours: OfficeHourConfiguration = new OfficeHourConfiguration(officeHoursDefault);

    this._simulationParameters = new SimulationParameters([62, 61, 59, 58, 58, 58, 58, 57, 58, 59, 60, 63, 66, 67, 69, 70, 71, 71, 71, 70, 68, 65, 64, 63],
      Date.now(), Date.now() + (1000 * 60 * 60 * 240), 10, officeHours, 4, undefined, undefined);
  }

  // ==============================================
  // The methods below perform the simulation calculations
  // ==============================================
  private _calculateSolarPosition(currentTime: Date): SolarPosition | undefined {
    if ((undefined === this._simulationParameters.longitude) || (undefined === this._simulationParameters.latitude))
      return undefined;
    return calculateSolarAngles(currentTime, this._simulationParameters.longitude, this._simulationParameters.latitude);
  }

  private _doSimulationStep(currentMsec: number, stepNumber: number) {
    const currentTime = new Date(currentMsec);
    const solarPosition: SolarPosition | undefined = this._calculateSolarPosition(currentTime);
    const isOfficeHours: boolean = this._simulationParameters.isOfficeHours(currentTime);
    for (const thisBuilding of this._siteInfo.buildings) {
      for (const thisFloor of thisBuilding.floors) {
        for (const thisSpace of thisFloor.spaces) {
          thisSpace.calculateState(stepNumber, currentMsec, isOfficeHours, solarPosition);
        }
      }
    }
  }

  private _extendSimulation() {
    this._currentMSec += this._simulationParameters.interval * 60 * 1000;
    this._currentStep++;
    this._doSimulationStep(this._currentMSec, this._currentStep);
  }

  public continueSimulation() {
    // do another simulation step every 5 seconds.
    if (this._continuing)
      return;
    this._continuing = true;
    setInterval(this._extendSimulation.bind(this), 5 * 1000);
  }

  // ==============================================
  // The methods below read the JSON file that configures the building and simulation.
  // ==============================================

  // populates the Site information from the JSON5 file.
  private _readSite(): void {
    if ((undefined === this._setupProps.site) || !Utilities.checkPropSet(this._setupProps.site, "name", "id", "buildings"))
      throw new Error("The devices JSON file must contain a 'site' property with 'name', 'id', and 'buildings' properties");
    if (!Array.isArray(this._setupProps.site.buildings))
      throw new Error("The 'site.buildings' property must be an array of Building objects");

    this._siteInfo.name = this._setupProps.site.name;
    this._siteInfo.id = this._setupProps.site.id;

    let buildingNum: number = 1;
    for (const buildingProps of this._setupProps.site.buildings) {
      this._readBuildingProps(buildingProps, buildingNum);
      ++buildingNum;
    }
  }

  // reads the building array.
  private _readBuildingProps(buildingProps: any, buildingNum: number): void {
    // expect the building to have name, id, and spaces properties.
    if (!Utilities.checkPropSet(buildingProps, "name", "id", "floors")) {
      throw new Error(`Building number ${buildingNum} must have 'name', 'id', and 'floors' properties`);
    }

    if (!Array.isArray(buildingProps.floors)) {
      throw new Error(`Building ${buildingProps.name} [${buildingProps.id}] has a 'floors' property that is not an array`);
    }

    const building = new Building(buildingProps.name, buildingProps.id);
    this._siteInfo.buildings.push(building);

    let floorNum: number = 1;
    for (const floorProps of buildingProps.floors) {
      this._readFloorProps(floorProps, floorNum, building);
      ++floorNum;
    }
  }

  // reads the floors for each building.
  private _readFloorProps(floorProps: any, floorNum: number, building: Building) {
    if (!Utilities.checkPropSet(floorProps, "name", "id", "spaces")) {
      throw new Error(`Floor number ${floorNum} of building ${building.name} [${building.id}] does not contain the required 'name', 'id', and 'spaces' properties`);
    }
    if (!Array.isArray(floorProps.spaces)) {
      throw new Error(`Floor ${floorProps.name} [${floorProps.id}] in Building ${building.name} [${building.id}] has a 'spaces' property that is not an array`);
    }

    const floor = new Floor(floorProps.name, floorProps.id);
    building.floors.push(floor);

    let spaceNum: number = 1;
    for (const spaceProps of floorProps.spaces) {
      this._readSpaceProps(spaceProps, spaceNum, building, floor);
      spaceNum++;
    }
  }

  // reads the spaces for each floor.
  private _readSpaceProps(spaceProps: any, spaceNum: number, building: Building, floor: Floor): void {
    if (!Utilities.checkPropSet(spaceProps, "name", "id")) {
      throw new Error(`Space number ${spaceNum} on floor ${floor.name} [${floor.id}] in Building ${building.name} [${building.id}] does not contain the required 'name' and 'id' properties`);
    }

    // first try to get the default configuration from the space "name". If we don't have it get "Default", which we know we have.
    let defaultConfiguration: SpaceConfiguration | undefined = this._spaceDefaults.get(spaceProps.name);
    if (undefined === defaultConfiguration)
      defaultConfiguration = this._spaceDefaults.get("Default");

    let configuration: SpaceConfiguration;
    if (undefined !== spaceProps.configuration) {
      configuration = this._readSpaceConfiguration(spaceProps, spaceProps.name, spaceProps.id, building.name, building.id, floor.name, floor.id, defaultConfiguration!);
    } else {
      configuration = this._copyDefaultConfiguration(spaceProps.orientation, defaultConfiguration!);
    }

    const space = new Space(spaceProps.name, spaceProps.id, configuration!);
    floor.spaces.push(space);
  }

  private _readDevices(devicesProps: any, spaceName: string, spaceId: string, buildingName: string, buildingId: string, floorName: string, floorId: string): IoTDevice[] {
    let deviceNum = 1;
    const devices: IoTDevice[] = [];
    for (const deviceProps of devicesProps) {
      devices.push(this._readDevice(deviceProps, deviceNum, spaceName, spaceId, floorName, floorId, buildingName, buildingId));
      deviceNum++;
    }
    return devices;
  }

  // reads the devices for each space.
  private _readDevice(deviceProps: any, deviceNum: number, spaceName: string, spaceId: string, buildingName: string, buildingId: string, floorName: string, floorId: string): IoTDevice {
    if (!Utilities.checkPropSet(deviceProps, "type")) {
      throw new Error(`Device ${deviceNum} in space ${spaceName} [${spaceId}] on floor ${floorName} [${floorId}] in Building ${buildingName} [${buildingId}] is missing the 'type' property`);
    }
    switch (deviceProps.type) {
      case "TemperatureSensor": {
        return new TemperatureSensor(deviceProps, deviceNum);
      }
      case "CO2Sensor": {
        return new CO2Sensor(deviceProps, deviceNum);
      }
      case "SmokeDetector": {
        return new SmokeDetector(deviceProps, deviceNum);
      }
      case "OccupancySensor": {
        return new OccupancySensor(deviceProps, deviceNum);
      }
      case "FireAlarm": {
        return new FireAlarm(deviceProps, deviceNum);
      }
      case "Thermostat": {
        return new Thermostat(deviceProps, deviceNum);
      }
      default: {
        throw new Error(`Device ${deviceNum} of space '${spaceName} [${spaceId}]' on floor '${floorName} [${floorId}]' of building '${buildingName} [${buildingId}]' : Unrecognized Device type ${deviceProps.type}`);
      }
    }
  }

  private _setupDefaultSpace() {
    const officeHourTemps = new TemperatureParams(70, 72, 65, 79);
    const offHourTemps = new TemperatureParams(68, 75, 60, 82);
    const temperature = new TemperatureConfiguration(officeHourTemps, offHourTemps);
    const officeHourOcc = new OccupancyParams(0.7, 50);
    const offHourOcc = new OccupancyParams(0.1, 5);
    const occupancy = new OccupancyConfiguration(officeHourOcc, offHourOcc);
    const CO2 = new CO2Configuration(405, 800);
    const smoke = new SmokeConfiguration(0.01, 0.95);
    const fire = new FireConfiguration(0.001, 0.95);
    const devices: IoTDevice[] = [];
    const spaceDefaults = new SpaceConfiguration(undefined, temperature, occupancy, CO2, smoke, fire, devices);
    this._spaceDefaults.set("Default", spaceDefaults);
  }

  // get the space defaults from the JSON5 file.
  private _readSpaceDefaults() {
    // set up a "defaults" in case there is nothing in the file, or no "Default" space type in the file.
    this._setupDefaultSpace();

    let spaceNum: number = 1;
    for (const spaceProps of this._setupProps.spaceDefaults) {
      // get default space every time in case we just read the default.
      const defaultSpace: SpaceConfiguration | undefined = this._spaceDefaults.get("Default");
      this._readSpaceDefault(spaceProps, spaceNum, defaultSpace!);
      spaceNum++;
    }
  }

  private _readSpaceDefault(spaceProps: any, spaceNum: number, defaultValues: SpaceConfiguration) {
    if (!Utilities.checkPropSet(spaceProps, "type")) {
      throw new Error(`Space number ${spaceNum} is missing the required 'type' property`);
    }
    if (!Utilities.checkPropSet(spaceProps, "configuration")) {
      throw new Error(`Space type ${spaceProps.type} is missing the required 'configuration' property`);
    }

    const spaceConfiguration: SpaceConfiguration = this._readSpaceConfiguration(spaceProps, spaceProps.type, "*", "*", "*", "*", "*", defaultValues);
    this._spaceDefaults.set(spaceProps.type, spaceConfiguration);
  }

  private _readSpaceConfiguration(spaceProps: any, spaceName: string, spaceId: string, buildingName: string, buildingId: string, floorName: string, floorId: string, defaultValues: SpaceConfiguration) {
    const configurationProps = spaceProps.configuration;
    const orientation: any = spaceProps.orientation;
    const temperature: TemperatureConfiguration = this._readTemperatureConfiguration(configurationProps.temperature, defaultValues.temperatures);
    const occupancy: OccupancyConfiguration = this._readOccupancyConfiguration(configurationProps.occupancy, defaultValues.occupancy);
    const CO2: CO2Configuration = this._readCO2Configuration(configurationProps.CO2, defaultValues.CO2);
    const smoke: SmokeConfiguration = this._readSmokeConfiguration(configurationProps.smoke, defaultValues.smoke);
    const fire: FireConfiguration = this._readFireConfiguration(configurationProps.fire, defaultValues.fire);
    let devices: IoTDevice[];
    if (undefined !== configurationProps.devices) {
      devices = this._readDevices(configurationProps.devices, spaceName, spaceId, buildingName, buildingId, floorName, floorId);
    } else {
      devices = this._copyDefaultDevices(defaultValues.devices);
    }
    return new SpaceConfiguration(orientation, temperature, occupancy, CO2, smoke, fire, devices);
  }

  private _copyDefaultConfiguration(orientation: any, defaultConfig: SpaceConfiguration): SpaceConfiguration {
    const copiedDevices = this._copyDefaultDevices(defaultConfig.devices);
    const newConfig = new SpaceConfiguration(orientation, defaultConfig.temperatures, defaultConfig.occupancy, defaultConfig.CO2, defaultConfig.smoke, defaultConfig.fire, copiedDevices);
    return newConfig;
  }

  private _copyDefaultDevices(defaultDevices: IoTDevice[]): IoTDevice[] {
    const localDevices: IoTDevice[] = [];
    for (const defaultDevice of defaultDevices) {
      localDevices.push(Object.create(defaultDevice));
    }
    return localDevices;
  }

  private _readTemperatureConfiguration(tempProps: any, defaultValues: TemperatureConfiguration): TemperatureConfiguration {
    if (undefined === tempProps) {
      return defaultValues;
    }

    const officeHours: TemperatureParams = this._readTemperatureSimParams(tempProps.officeHours, defaultValues.officeHours);
    const offHours: TemperatureParams = this._readTemperatureSimParams(tempProps.offHours, defaultValues.offHours);
    return new TemperatureConfiguration(officeHours, offHours);
  }

  private _readTemperatureSimParams(simProps: any, defaultValues: TemperatureParams): TemperatureParams {
    if (undefined === simProps) {
      return defaultValues;
    }
    const setPointHeat: number = (undefined !== simProps.setPointHeat) ? simProps.setPointHeat : defaultValues.setPointHeat;
    const setPointCool: number = (undefined !== simProps.setPointCool) ? simProps.setPointCool : defaultValues.setPointCool;
    const lowLimit: number = (undefined !== simProps.lowLimit) ? simProps.lowLimit : defaultValues.lowLimit;
    const highLimit: number = (undefined !== simProps.highLimit) ? simProps.highLimit : defaultValues.highLimit;
    return new TemperatureParams(setPointHeat, setPointCool, lowLimit, highLimit);
  }

  private _readOccupancyConfiguration(occProps: any, defaultValues: OccupancyConfiguration): OccupancyConfiguration {
    if (undefined === occProps) {
      return defaultValues;
    }

    const officeHours = this._readOccupancySimParams(occProps.officeHours, defaultValues.officeHours);
    const offHours = this._readOccupancySimParams(occProps.offHours, defaultValues.offHours);
    return new OccupancyConfiguration(officeHours, offHours);
  }

  private _readOccupancySimParams(occProps: any, defaultValues: OccupancyParams): OccupancyParams {
    const probability: number = (undefined !== occProps.probability) ? occProps.probability : defaultValues.probability;
    const inertia: number = (undefined !== occProps.averageStay) ? occProps.averageStay : defaultValues.averageStay;
    return new OccupancyParams(probability, inertia);
  }

  private _readCO2Configuration(co2Props: any, defaultValues: CO2Configuration): CO2Configuration {
    if (undefined === co2Props) {
      return defaultValues;
    }
    const lowNormal: number = (undefined !== co2Props.lowNormal) ? co2Props.lowNormal : defaultValues.lowNormal;
    const highNormal: number = (undefined !== co2Props.highNormal) ? co2Props.highNormal : defaultValues.highNormal;
    return new CO2Configuration(lowNormal, highNormal);
  }

  private _readSmokeConfiguration(smokeProps: any, defaultValues: SmokeConfiguration): SmokeConfiguration {
    if (undefined === smokeProps) {
      return defaultValues;
    }

    const probability: number = (undefined === smokeProps.probability) ? smokeProps.probability : defaultValues.probability;
    const inertia: number = (undefined !== smokeProps.inertia) ? smokeProps.inertia : defaultValues.inertia;
    return new SmokeConfiguration(probability, inertia);
  }

  private _readFireConfiguration(fireProps: any, defaultValues: FireConfiguration): FireConfiguration {
    if (undefined === fireProps) {
      return defaultValues;
    }

    const probability: number = (undefined === fireProps.probability) ? fireProps.probability : defaultValues.probability;
    const inertia: number = (undefined !== fireProps.inertia) ? fireProps.inertia : defaultValues.inertia;
    return new FireConfiguration(probability, inertia);
  }

  private _readSimulationParameters() {
    // replace any of the default simulation parameters with those in the JSON file
    const simulationProps: any = this._setupProps.simulationParams;
    if (undefined === simulationProps) {
      return;
    }
    const durationMinutes = (undefined !== simulationProps.duration) ? simulationProps.duration : 7200;
    if (durationMinutes < 1440) {
      throw new Error("End time must be greater than start time by at least one day");
    }

    const durationMSec: number = durationMinutes * 60 * 1000;
    const endTime: number = Date.now();
    const startTime: number = endTime - durationMSec;
    const interval: number = (undefined !== simulationProps.interval) ? simulationProps.interval : 5; // minutes
    this._simulationParameters.startMsec = startTime;
    this._simulationParameters.endMsec = endTime;
    this._simulationParameters.interval = interval;

    if ((undefined === simulationProps.temperatures) || !Array.isArray(simulationProps.temperatures) || (24 !== simulationProps.temperatures.length)) {
      throw new Error("The 'condition' property must have a subproperty 'temperature' with an array of 24 hourly temperatures");
    } else {
      this._simulationParameters.temperatures = simulationProps.temperatures;
    }

    if (undefined !== simulationProps.officeHours) {
      const officeHours: OfficeHours[] = [];
      if (!Array.isArray(simulationProps.officeHours))
        throw new Error("simulationParams.officeHours must be an array of {day, startHour, endHour");
      for (const officeHourProps of simulationProps.officeHours) {
        if (!Utilities.checkPropSet(officeHourProps, "day", "startHour", "endHour")) {
          throw new Error("simulationParams.officeHours must be an array of {day, startHour, endHour");
        }
        officeHours.push(new OfficeHours(officeHourProps.day, officeHourProps.startHour, officeHourProps.endHour));
      }
      this._simulationParameters.officeHours = new OfficeHourConfiguration(officeHours);
      if (simulationProps.tzHourOffset)
        this._simulationParameters.tzHourOffset = simulationProps.tzHourOffset;
      if (simulationProps.longitude)
        this._simulationParameters.longitude = simulationProps.longitude;
      if (simulationProps.latitude)
        this._simulationParameters.latitude = simulationProps.latitude;
    }
  }

  // outputs the site information to the console.
  private _logSite(): void {
    if (!this._siteInfo)
      return;
    for (const building of this._siteInfo.buildings) {
      console.log(`Building '${building.name} [${building.id}]':`);
      console.group();
      for (const floor of building.floors) {
        console.log(`Floor '${floor.name} [${floor.id}]':`);
        console.group();
        for (const space of floor.spaces) {
          console.log(`Space '${space.name} [${space.id}]':`);
          console.group();
          console.log(space.configuration);
          console.groupEnd();
        }
        console.groupEnd();
      }
      console.groupEnd();
    }
  }

  private _logSimulation() {
    if (!this._siteInfo)
      return;
    for (const building of this._siteInfo.buildings) {
      console.log(`Building '${building.name} [${building.id}]':`);
      console.group();
      for (const floor of building.floors) {
        console.log(`Floor '${floor.name} [${floor.id}]':`);
        console.group();
        for (const space of floor.spaces) {
          console.log(`Space '${space.name} [${space.id}] (${space.states.length} steps)':`);
          console.group();
          let stepNumber = 0;
          for (const thisState of space.states) {
            console.log("Step Number", stepNumber, " Date:", new Date(thisState.msec).toLocaleString());
            console.group();
            if (thisState.temperature)
              console.log("Temperature:", thisState.temperature);
            if (thisState.occupancy)
              console.log("Occupancy:", thisState.occupancy);
            if (thisState.co2)
              console.log("CO2:", thisState.co2);
            if (thisState.smoke)
              console.log("SmokeAlarm:", thisState.smoke);
            if (thisState.fire)
              console.log("FireAlarm:", thisState.fire);
            console.groupEnd();
            stepNumber++;
          }
          console.groupEnd();
        }
        console.groupEnd();
      }
      console.groupEnd();
    }
  }

  // sequences reading of the reads the configuration and simulation parameters
  public readFromFile(): void {
    this._readSpaceDefaults();
    this._readSite();
    if (this._showSite)
      this._logSite();
    this._readSimulationParameters();
    if (this._showSimulation)
      this._logSimulation();
  }

  private _findDeviceType(deviceType: string): IoTDeviceType {
    const dtLowerCase = deviceType.toLowerCase();
    switch (dtLowerCase) {
      case "temperaturesensor":
        return IoTDeviceType.TemperatureSensor;
      case "co2sensor":
        return IoTDeviceType.CO2Sensor;
      case "smokedetector":
        return IoTDeviceType.SmokeDetector;
      case "firealarm":
        return IoTDeviceType.FireAlarm;
      case "occupancysensor":
        return IoTDeviceType.OccupancySensor;
      case "thermostat":
        return IoTDeviceType.Thermostat;
    }
    throw new Error(`No match for specified type ${deviceType}`);
  }

  private _getTypeList(deviceTypes: any): IoTDeviceType[] | undefined {
    if (undefined === deviceTypes)
      return undefined;

    let deviceTypeArray: any[];
    if (Array.isArray(deviceTypes)) {
      deviceTypeArray = deviceTypes;
    } else {
      deviceTypeArray = [deviceTypes];
    }

    const typeList: IoTDeviceType[] = [];
    for (const deviceType of deviceTypeArray) {
      if (typeof deviceType === "string") {
        typeList.push(this._findDeviceType(deviceType));
      } else if (typeof deviceType === "number") {
        typeList.push(deviceType);
      }
    }
    // if we say we want temperature sensors, we also want thermostats;
    if ((undefined !== typeList.find((element) => element === IoTDeviceType.TemperatureSensor)) && (undefined === typeList.find((element) => element === IoTDeviceType.Thermostat)))
      typeList.push(IoTDeviceType.Thermostat);

    return typeList;
  }

  private _getSpecList(specifications: any): string[] | undefined {
    if (undefined === specifications)
      return undefined;
    if (typeof specifications === "string")
      return [specifications];
    if (Array.isArray(specifications))
      return specifications;

    return undefined;
  }

  private _getMatchingDevices(buildings: any, floors: any, spaces: any, types: any): IoTDevice[] {
    const deviceList: IoTDevice[] = [];
    if (!this._siteInfo)
      return deviceList;

    const typeList: IoTDeviceType[] | undefined = this._getTypeList(types);
    const buildingList: string[] | undefined = this._getSpecList(buildings);
    const floorList: string[] | undefined = this._getSpecList(floors);
    const spaceList: string[] | undefined = this._getSpecList(spaces);

    for (const building of this._siteInfo.buildings) {
      if (!building.inBuildingList(buildingList))
        continue;
      for (const floor of building.floors) {
        if (!floor.inFloorList(floorList))
          continue;
        for (const space of floor.spaces) {
          if (!space.inSpaceList(spaceList))
            continue;
          for (const device of space.configuration.devices) {
            if (device.inDeviceList(typeList))
              deviceList.push(device);
          }
        }
      }
    }
    return deviceList;
  }

  // ==============================================
  // The methods below handle the http requests from the application.
  // ==============================================
  private _getDeviceList(queryData: any): IoTDevice[] {
    /* the queryData can have one of these properties:
    "building": ["<building id>"] (either value or array of values.)
    "floor": ["<floor id>"]
    "space": ["<space id>"]
    It can also have a "type" field:
    "type": ["<type id>"]
    */

    const filteredDevices: IoTDevice[] = this._getMatchingDevices(queryData.building, queryData.floor, queryData.space, queryData.type);
    return filteredDevices;
  }

  private _getDevicesResponse(deviceList: IoTDevice[]): IoTDeviceResponse[] {
    const deviceResponses: IoTDeviceResponse[] = [];
    for (const device of deviceList) {
      deviceResponses.push(new IoTDeviceResponse(device.space!.id, device.type));
    }
    return deviceResponses;
  }

  /* ----------------------
  // handles iot/getdevices http POST request
  private _getIoTDevices(request: express.Request, response: express.Response) {
    try {
      const deviceList: IoTDevice[] = this._getDeviceList(request.body.query);
      const devices: IoTDeviceResponse[] = this._getDevicesResponse(deviceList);
      response.status(200);
      response.send({ devices });
    } catch (err) {
      response.status(400);
      response.send({ error: err.message });
    }
  }

  private _devicesFromQuery(query: any): IoTDevice[] {
    const building: any = (undefined !== query.building) ? query.building.split(",") : undefined;
    const floor: any = (undefined !== query.floor) ? query.floor.split(",") : undefined;
    const space: any = (undefined !== query.space) ? query.space.split(",") : undefined;
    const type: any = (undefined !== query.type) ? query.type.split(",") : undefined;

    return this._getMatchingDevices(building, floor, space, type);
  }

  private _getIoTDevicesByQuery(request: express.Request, response: express.Response) {
    try {
      const deviceList: IoTDevice[] = this._devicesFromQuery(request.query);
      const devices: IoTDeviceResponse[] = this._getDevicesResponse(deviceList);
      response.status(200);
      response.send({ devices });
      return;
    } catch (err) {
      response.status(400);
      response.send({ error: err.message });
    }
  }
  --------------------- */

  private _getStartTime(date: any): number {
    const startTime: number = this._simulationParameters.startMsec;
    if (undefined === date)
      return startTime;

    let proposedTime: number;
    if (typeof date === "number") {
      proposedTime = date;
    } else if (typeof date === "string") {
      if ("latest" === date) {
        proposedTime = this._currentMSec;
      } else {
        proposedTime = Date.parse(date);
      }
    } else {
      throw new Error("Date must be either javascript time number, 'latest' or date string");
    }

    if (proposedTime < startTime)
      return startTime;
    return proposedTime;
  }

  private _getEndTime(duration: any, startTime: number): number {
    if (undefined === duration)
      return this._currentMSec;

    let endTime = startTime;
    if (typeof duration === "number") {
      endTime = startTime + (duration * 60 * 1000);  // minutes.
    } else if (typeof duration === "string") {
      endTime = startTime + (Number.parseFloat(duration) * 60 * 1000);
    }

    if (endTime > this._currentMSec)
      endTime = this._currentMSec;

    return endTime;
  }

  private _getReadingsResponse(deviceList: IoTDevice[], startTime: number, endTime: number): IoTReadingResponse[] {
    // we return an array of times. Each time has a list of devices and their readings.
    const startStepNumber: number = this._simulationParameters.getStepFromTime(startTime);
    if (endTime > this._currentMSec)
      endTime = this._currentMSec;
    const endStepNumber: number = this._simulationParameters.getStepFromTime(endTime);

    const responses: IoTReadingResponse[] = [];

    // keep the last readings so we can see if they change.
    const lastStates: SpaceState[] = [];
    lastStates.length = deviceList.length;
    for (let stepNumber = startStepNumber; stepNumber < endStepNumber; ++stepNumber) {
      const currentMsec = this._simulationParameters.getTimeFromStep(stepNumber);
      const readings: IoTReading[] = [];
      for (let iDevice = 0; iDevice < deviceList.length; ++iDevice) {
        const device: IoTDevice = deviceList[iDevice];
        const thisReading: IoTReading | undefined = device.getReading(lastStates, iDevice, stepNumber);
        if (undefined !== thisReading) {
          readings.push(thisReading);
        }
      }
      if (readings.length > 0)
        responses.push(new IoTReadingResponse(currentMsec, readings));
    }
    return responses;
  }

  /* -------------------------
  private _getIoTReadings(request: express.Request, response: express.Response) {
    try {
      const deviceList: IoTDevice[] = this._getDeviceList(request.body.query);
      const startTime: number = this._getStartTime(request.body.start);
      const endTime: number = this._getEndTime(request.body.duration, startTime);
      const readingResponses: IoTReadingResponse[] = this._getReadingsResponse(deviceList, startTime, endTime);
      response.status(200);
      response.send({ sequence: readingResponses });
    } catch (err) {
      response.status(400);
      response.send({ error: err.message });
    }
  }

  private _getDateRange(_request: express.Request, response: express.Response) {
    // request not used.
    response.send({
      start: this._simulationParameters.startMsec, end: this._simulationParameters.endMsec, interval: this._simulationParameters.interval,
      startDate: new Date(this._simulationParameters.startMsec).toTimeString(), endDate: new Date(this._simulationParameters.endMsec).toTimeString(), intervalString: `${this._simulationParameters.interval}`,
    });
  }
  ------------------------ */

  // public methods called from iotDemo.
  public getReadings(query: any, startMsec?: number, duration?: number): IoTReadingResponse[] {
    const deviceList: IoTDevice[] = this._getDeviceList(query);
    const startTime: number = this._getStartTime(startMsec);
    const endTime: number = this._getEndTime(duration, startTime);
    const readingResponses: IoTReadingResponse[] = this._getReadingsResponse(deviceList, startTime, endTime);
    return readingResponses;
  }

  public getDevices(query: any): IoTDeviceResponse[] {
    const deviceList: IoTDevice[] = this._getDeviceList(query);
    return this._getDevicesResponse(deviceList);
  }

  // run the simulation from the beginning to the end with the given interval
  public async runSimulation(): Promise<void> {
    // retrieve the json file from the server.
    const requestOptions: RequestOptions = {
      method: "GET",
      responseType: "json",
      retries: 0,
    };
    try {
      const response: Response = await request(new ClientRequestContext(), this._jsonConfigUrl, requestOptions);
      this._setupProps = response.body;
    } catch (error) {
      // this shouldn't happen
      return;
    }

    this.readFromFile();
    const msecStart = this._simulationParameters.startMsec;
    const msecEnd = this._simulationParameters.endMsec;
    const msecStep = this._simulationParameters.interval * 60 * 1000; // interval is in minutes
    for (this._currentMSec = msecStart, this._currentStep = 0; this._currentMSec < msecEnd; this._currentMSec += msecStep, ++this._currentStep) {
      this._doSimulationStep(this._currentMSec, this._currentStep);
    }
  }

  public getStartTime(): Date {
    return new Date(this._simulationParameters.startMsec);
  }

  public getEndTime(): Date {
    return new Date(this._simulationParameters.endMsec);
  }

  public getLatestTimeAndReading(query: any): { readingTime: number, readings: any[] } {
    const deviceList: IoTDevice[] = this._getDeviceList(query);
    const lastStepNumber: number = this._currentStep - 1;

    // keep the last readings so we can see if they change.
    const readings: IoTReading[] = [];
    for (let iDevice = 0; iDevice < deviceList.length; ++iDevice) {
      const device: IoTDevice = deviceList[iDevice];
      const thisReading: IoTReading | undefined = device.getReading(undefined, iDevice, lastStepNumber);
      if (undefined !== thisReading) {
        readings.push(thisReading);
      }
    }
    return { readingTime: this._currentMSec, readings };
  }
}
