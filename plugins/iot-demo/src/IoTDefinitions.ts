/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// type of device to request for each animation type.
export enum IoTDeviceType {
  TemperatureSensor,
  CO2Sensor,
  SmokeDetector,
  FireAlarm,
  OccupancySensor,
  Thermostat,
}

// type of device to request for each animation type as string.
export enum AnimationTypeName {
  Temperature = "Temperature",
  Co2 = "CO2",
  Smoke = "Smoke",
  Fire = "Fire",
  Occupancy = "Occupancy",
  HeatingCooling = "Heating/Cooling",
}

export enum AnimationType {
  Temperature,
  Co2,
  Smoke,
  Fire,
  Occupancy,
  HeatingCooling,
}
