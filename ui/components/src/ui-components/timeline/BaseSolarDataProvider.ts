/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Timeline
 */

import { Point3d } from "@bentley/geometry-core";
import { calculateSunriseOrSunset, Cartographic, ColorByName, ColorDef } from "@bentley/imodeljs-common";
import { IModelConnection, ScreenViewport } from "@bentley/imodeljs-frontend";
import { SolarDataProvider } from "./interfaces";

const millisecPerMinute = 1000 * 60;
const millisecPerHour = millisecPerMinute * 60;
const millisecPerDay = millisecPerHour * 24;

// the interface and class are in alpha state - it may change after usability testing - test coverage not complete
/* istanbul ignore file */

/** Base class that provides solar data for animation control
 * @alpha
 */
export class BaseSolarDataProvider implements SolarDataProvider {
  protected _projectTimeZoneOffset: number; // used to convert between project time and local time
  protected _viewport: ScreenViewport | undefined;
  protected _cartographicCenter: Cartographic;
  protected _shadowColor = ColorDef.create(ColorByName.gray);

  public longitude: number = -75.17035;  // long/lat of Philadelphia
  public latitude: number = 39.954927;
  public viewId = ""; // View Id used to determine sunrise and sunset
  public supportsTimelineAnimation = false; // set to true when provider determines animation data is available.
  public animationFraction: number = 0; // value from 0.0 to 1.0 that specifies the percentage complete for the animation.

  private _projectDayStartMS = 0;
  private _projectSunriseMs = 0;
  private _projectSunsetMs = 0;
  private _zoneOffsetMs = 0;
  private _projectSunrise = new Date();
  private _projectSunset = new Date();
  private _projectDateTime = new Date();
  private _projectDay = new Date();

  // projectTimeZoneOffset = zone offset in hours
  protected initializeData(projectTimeZoneOffset: number, initialTime?: Date) {
    if (!initialTime)
      initialTime = new Date(Date.now()); // users local time

    this._zoneOffsetMs = projectTimeZoneOffset * millisecPerHour;
    const year=initialTime.getFullYear();
    const month=initialTime.getMonth();
    const date=initialTime.getDate();
    const hours=initialTime.getHours();
    const minutes=initialTime.getMinutes();
    const initialUtcMs = Date.UTC(year, month, date, hours, minutes, 0, 0);
    const initialProjectMs = initialUtcMs - this._zoneOffsetMs;
    this._projectDateTime = new Date (initialProjectMs);

    const utcDayMs = Date.UTC(year, month, date, 0, 0, 0, 0);
    const utcDay = new Date(utcDayMs);
    this._projectDayStartMS = utcDayMs - this._zoneOffsetMs;
    this._projectDay = new Date (this._projectDayStartMS);
    this._projectSunrise = calculateSunriseOrSunset(utcDay, this._cartographicCenter, true);
    this._projectSunset = calculateSunriseOrSunset(utcDay, this._cartographicCenter, false);
    this._projectSunriseMs = this._projectSunrise.getTime();
    this._projectSunsetMs = this._projectSunset.getTime();
  }

  constructor(viewport?: ScreenViewport, longitude?: number, latitude?: number) {
    this._viewport = viewport;
    if (longitude)
      this.longitude = longitude;
    if (latitude)
      this.latitude = latitude;

    if (viewport)
      this.viewId = viewport.view.id;

    // project location
    this._cartographicCenter = Cartographic.fromDegrees(this.longitude, this.latitude, 0.0);
    this._projectTimeZoneOffset = this.getZone(this._cartographicCenter);

    this.initializeData(this._projectTimeZoneOffset);
  }

  public get timeZoneOffset(): number {
    return this._projectTimeZoneOffset;
  }

  public get timeZoneOffsetMs(): number {
    return this._zoneOffsetMs;
  }

  public get shadowColor(): ColorDef {
    return this._shadowColor;
  }

  public set shadowColor(color: ColorDef) {
    this._shadowColor = color;
  }

  public get shouldShowTimeline() {
    return false;
  }

  /** Get current Time at project */
  public get timeOfDay(): Date {
    return this._projectDateTime;
  }

  /** Set current Time at project */
  public set timeOfDay(timeVal: Date) {
    this.setNewDay(timeVal, true );
  }

  /** User Day Start */
  public get userTime(): Date {
    const userOffset = this._projectDateTime.getTimezoneOffset() * millisecPerMinute;
    const userTime = new Date(this._projectDateTime.getTime() + userOffset + (this._zoneOffsetMs));
    return userTime;
  }

  public setNewDay(day: Date, isProjectDate?: boolean) {
    let userDay = day;

    // convert date from user date to project location
    if (isProjectDate) {
      const userOffset = day.getTimezoneOffset() * millisecPerMinute;
      userDay = new Date(day.getTime() - userOffset - this._zoneOffsetMs);
    }

    this.initializeData(this._projectTimeZoneOffset, userDay);
  }

  /** Project Day Start */
  public get day(): Date {
    return this._projectDay;
  }

  /** Project Day Start in milliseconds */
  public get dayStartMs(): number {
    return this._projectDayStartMS;
  }

  public getCartographicCenter(iModel: IModelConnection): Cartographic {
    if (iModel.isGeoLocated) {
      const projectExtents = iModel.projectExtents;
      const projectCenter = Point3d.createAdd2Scaled(projectExtents.low, .5, projectExtents.high, .5);
      return iModel.spatialToCartographicFromEcef(projectCenter);
    }
    return Cartographic.fromDegrees(this.longitude, this.latitude, 0.0);
  }

  public set viewport(viewport: ScreenViewport | undefined) {
    this._viewport = viewport;
    if (viewport)
      this.viewId = viewport.view.id;
    else
      this.viewId = "";
  }

  public get viewport(): ScreenViewport | undefined {
    return this._viewport;
  }

  protected getZone(location: Cartographic) {
    return Math.floor(.5 + location.longitudeDegrees / 15.0);
  }

  public get sunrise(): Date {
    return this._projectSunrise;
  }

  public get sunriseMs(): number {
    return this._projectSunriseMs;
  }

  public get sunset(): Date {
    return this._projectSunset;
  }

  public get sunsetMs(): number {
    return this._projectSunsetMs;
  }

  // instanbul ignore next
  public onTimeChanged = (_time: Date) => {
    // to be implemented by derived class
  };
}
