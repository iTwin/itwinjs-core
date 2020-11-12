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

// the interface and class are in alpha state - it may change after usability testing - test coverage not complete
/* istanbul ignore file */

/** Base class that provides solar data for animation control
 * @alpha
 */
export class BaseSolarDataProvider implements SolarDataProvider {
  private _day: Date;
  public viewId = ""; // View Id used to determine sunrise and sunset
  public timeOfDay: Date;
  public longitude: number = -75.17035;  // long/lat of Philadelphia
  public latitude: number = 39.954927;
  public supportsTimelineAnimation = false; // set to true when provider determines animation data is available.
  public animationFraction: number = 0; // value from 0.0 to 1.0 that specifies the percentage complete for the animation.
  protected _viewport: ScreenViewport | undefined;
  protected _cartographicCenter: Cartographic;
  protected _shadowColor = ColorDef.create(ColorByName.gray);

  constructor(viewport?: ScreenViewport, longitude?: number, latitude?: number) {
    this._viewport = viewport;
    if (longitude)
      this.longitude = longitude;
    if (latitude)
      this.latitude = latitude;

    if (viewport)
      this.viewId = viewport.view.id;

    const now = new Date(Date.now());
    this.timeOfDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(),
      now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()));

    // set day to be start of day
    const thisDay = new Date(this.timeOfDay.getTime());
    thisDay.setUTCHours(0, 0, 0, 0);
    this._day = thisDay;

    this._cartographicCenter = Cartographic.fromDegrees(this.longitude, this.latitude, 0.0);
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

  public get day(): Date {
    return this._day;
  }

  public set day(dayVal: Date) {
    const thisDay = new Date(Date.UTC(dayVal.getFullYear(), dayVal.getMonth(), dayVal.getDate(), 0, 0, 0, 0));
    this._day = thisDay;
  }

  public get dayStartMs(): number {
    return this._day.getTime();
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

  private getZone(location: Cartographic) {
    return Math.floor(.5 + location.longitudeDegrees / 15.0);
  }

  public get sunrise(): Date {
    // return date to nearest minute
    const utcSunrise = calculateSunriseOrSunset(this.day, this._cartographicCenter, true);
    const zone = this.getZone(this._cartographicCenter);
    utcSunrise.setUTCHours(utcSunrise.getUTCHours() + zone);
    utcSunrise.setUTCSeconds(0, 0);
    return new Date(utcSunrise);
  }

  public get sunset(): Date {
    // return date to nearest minute
    // return new Date(calculateSunriseOrSunset(this.day, this._cartographicCenter, false).setSeconds(0, 0));
    const utcSunset = calculateSunriseOrSunset(this.day, this._cartographicCenter, false);
    const zone = this.getZone(this._cartographicCenter);
    utcSunset.setUTCHours(utcSunset.getUTCHours() + zone);
    utcSunset.setUTCSeconds(0, 0);
    return new Date(utcSunset);
  }

  // instanbul ignore next
  public onTimeChanged = (_time: Date) => {
    // to be implemented by derived class
  };
}
