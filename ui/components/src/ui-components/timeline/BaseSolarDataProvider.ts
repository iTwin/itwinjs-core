/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Timeline */

import { Cartographic, ColorDef, ColorByName } from "@bentley/imodeljs-common";
import { Point3d } from "@bentley/geometry-core";
import { IModelConnection, ScreenViewport, calculateSunriseOrSunset } from "@bentley/imodeljs-frontend";
import {
  SolarDataProvider,
} from "./interfaces";

// the interface and class are in alpha state - it may change after usability testing - test coverage not complete
/* istanbul ignore file */

/** Base class that provides solar data for animation control
 * @alpha
 */
export class BaseSolarDataProvider implements SolarDataProvider {
  private _day: Date;
  public viewId = ""; // View Id used to determine sunrise and sunset
  public timeOfDay: Date = new Date(Date.now());
  public longitude: number = -75.17035;  // long/lat of Philadelphia
  public latitude: number = 39.954927;
  public supportsTimelineAnimation = false; // set to true when provider determines animation data is available.
  public animationFraction: number = 0; // value from 0.0 to 1.0 that specifies the percentage complete for the animation.
  protected _viewport: ScreenViewport | undefined;
  protected _cartographicCenter: Cartographic;
  protected _shadowColor = new ColorDef(ColorByName.gray);

  constructor(viewport?: ScreenViewport, longitude?: number, latitude?: number) {
    this._viewport = viewport;
    if (longitude)
      this.longitude = longitude;
    if (latitude)
      this.latitude = latitude;

    if (viewport)
      this.viewId = viewport.view.id;

    // set day to be start of day
    const thisDay = new Date(this.timeOfDay);
    thisDay.setHours(0, 0, 0, 0);
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
    const thisDay = new Date(dayVal);
    thisDay.setHours(0, 0, 0, 0);
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

  public get sunrise(): Date {
    // return date to nearest minute
    return new Date(calculateSunriseOrSunset(this.day, this._cartographicCenter, true).setSeconds(0, 0));
  }

  public get sunset(): Date {
    // return date to nearest minute
    return new Date(calculateSunriseOrSunset(this.day, this._cartographicCenter, false).setSeconds(0, 0));
  }

  // instanbul ignore next
  public onTimeChanged = (_time: Date) => {
    // to be implemented by derived class
  }
}
