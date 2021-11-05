/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { request, RequestOptions, Response } from "@bentley/itwin-client";
import { Logger } from "@itwin/core-bentley";
import { Cartographic } from "@itwin/core-common";
import {
  BeButton, BeButtonEvent, Cluster, DecorateContext, imageElementFromUrl, IModelApp, InputSource, Marker, MarkerSet, NotifyMessageDetails,
  OutputMessagePriority, ScreenViewport, Tool, ViewState3d,
} from "@itwin/core-frontend";
import { Angle, Point2d, Point3d, Range2d, XYAndZ } from "@itwin/core-geometry";

/*-----------------------------------------------------------------------
This is the source for an iTwin.js Extension that displays on-screen markers
at the latitude and longitude of cities extracted from the geoNames website
(https://www.geonames.org/).
-------------------------------------------------------------------------*/

/** Properties that define a geographic entity
 * @beta
 */
export interface GeoNameProps {
  name: string;
  lat: number;
  lng: number;
  wikipedia?: string;
  population?: number;
}

/** Marker positioned where there is a geographic entity. */
class GeoNameMarker extends Marker {
  private static _size = Point2d.create(20, 20);
  private static _imageSize = Point2d.create(30, 30);

  constructor(location: XYAndZ, public props: GeoNameProps, icon: HTMLImageElement) {
    super(location, GeoNameMarker._size);
    this.setImage(icon); // save icon
    this.imageSize = GeoNameMarker._imageSize; // 40x40
    // set the tooltip when promise resolves. We won't need it for a while anyway.
    this.setScaleFactor({ low: 1, high: 1 }); // no size dependence for now.
    this.labelOffset = { x: 0, y: -24 };
    this.title = props.name;
    if (props.population)
      this.title = `${this.title} (${IModelApp.localization.getLocalizedString("geoNames:misc.Population")}: ${props.population})`;

    // it would be better to use "this.label" here for a pure text string. We'll do it this way just to show that you can use HTML too
    // this.htmlElement = document.createElement("div");
    // this.htmlElement.innerHTML = props.name; // put the name of the location.
    this.label = props.name;
  }
  public override onMouseButton(ev: BeButtonEvent): boolean {
    if (InputSource.Mouse === ev.inputSource && ev.isDown && ev.viewport !== undefined && ev.viewport.view instanceof ViewState3d) {
      if (BeButton.Data === ev.button) {
        const evViewport = ev.viewport;
        (async () => {
          await evViewport.animateFlyoverToGlobalLocation({ center: Cartographic.fromRadians({ longitude: this.props.lng * Angle.radiansPerDegree, latitude: this.props.lat * Angle.radiansPerDegree }) });
        })().catch(() => { });
      } else if (BeButton.Reset === ev.button && undefined !== this.props.wikipedia && 0 !== this.props.wikipedia.length)
        window.open(`https://${this.props.wikipedia}`);
    }
    return true;
  }
}

class GeoNameMarkerSet extends MarkerSet<GeoNameMarker> {
  public override minimumClusterSize = 5;
  protected getClusterMarker(cluster: Cluster<GeoNameMarker>): Marker { return Marker.makeFrom(cluster.markers[0], cluster, cluster.markers[0].image); }
}

export class GeoNameMarkerManager {
  private _markerSet: GeoNameMarkerSet;
  public static decorator?: GeoNameMarkerManager; // static variable so we can tell if the manager is active.
  private static _scratchCarto = Cartographic.createZero();
  private static _scratchPoint = Point3d.createZero();

  public constructor(vp: ScreenViewport, private _cityMarkerImage: HTMLImageElement, private _cityCount = 50) { this._markerSet = new GeoNameMarkerSet(vp); }
  public decorate(context: DecorateContext): void {
    if (this._markerSet !== undefined)
      this._markerSet.addDecoration(context);
  }

  private synch(viewport: ScreenViewport) {
    const currentViewport = this._markerSet.viewport;
    if (currentViewport !== viewport)
      this._markerSet.changeViewport(viewport);

    const view = viewport.view as ViewState3d;
    const worldFrust = viewport.getFrustum();
    const longLatRange = Range2d.createNull();

    for (const corner of worldFrust.points) {
      const carto = view.rootToCartographic(corner);
      if (undefined !== carto)
        longLatRange.extendXY(carto.longitude, carto.latitude);
    }
    this.doCitySearch(longLatRange, this._cityCount).then((cities) => {
      if (cities !== undefined) {
        for (const city of cities) {
          GeoNameMarkerManager._scratchCarto.longitude = city.lng * Angle.radiansPerDegree;
          GeoNameMarkerManager._scratchCarto.latitude = city.lat * Angle.radiansPerDegree;
          this._markerSet.markers.add(new GeoNameMarker(view.cartographicToRoot(GeoNameMarkerManager._scratchCarto, GeoNameMarkerManager._scratchPoint)!, city, this._cityMarkerImage));
        }
        this._markerSet.markDirty();
        IModelApp.viewManager.invalidateDecorationsAllViews();
        IModelApp.requestNextAnimation();
      }
    }).catch(() => { });
  }

  // Load one image, logging if there was an error
  private static async loadImage(src: string): Promise<HTMLImageElement | undefined> {
    try {
      return await imageElementFromUrl(src); // note: "return await" is necessary inside try/catch
    } catch (err) {
      Logger.logError("SectionLocationSetDecoration", `Could not load image ${src}`);
    }
    return undefined;
  }

  private outputInfoMessage(messageKey: string) {
    const message: string = IModelApp.localization.getLocalizedString(`geoNames:messages.${messageKey}`);
    const msgDetails: NotifyMessageDetails = new NotifyMessageDetails(OutputMessagePriority.Info, message);
    IModelApp.notifications.outputMessage(msgDetails);
  }

  private radiansToString(radians: number) { return (radians * Angle.degreesPerRadian).toFixed(5); }
  private async doCitySearch(longLatRange: Range2d, cityCount: number): Promise<GeoNameProps[] | undefined> {
    const urlTemplate = "http://api.geonames.org/citiesJSON?&north={north}&south={south}&east={east}&west={west}&lang=en&username=BentleySystems&maxRows={count}";
    const url = urlTemplate.replace("{west}", this.radiansToString(longLatRange.low.x)).replace("{south}", this.radiansToString(longLatRange.low.y)).replace("{east}", this.radiansToString(longLatRange.high.x)).replace("{north}", this.radiansToString(longLatRange.high.y)).replace("{count}", cityCount.toString());
    const requestOptions: RequestOptions = { method: "GET", responseType: "json" };

    try {
      this.outputInfoMessage("LoadingLocations");
      const locationResponse: Response = await request(url, requestOptions);

      const cities = new Array<GeoNameProps>();
      for (const geoName of locationResponse.body.geonames) {
        cities.push(geoName);
      }
      this.outputInfoMessage("LoadingComplete");

      return cities;
    } catch (error) {
      return undefined;
    }
  }
  /** Start showing markers if not currently active (or optionally refresh when currently displayed). */
  public static async show(vp: ScreenViewport): Promise<void> {
    if (undefined === GeoNameMarkerManager.decorator) {
      const cityMarkerImage = await this.loadImage("./city.ico");
      if (undefined === cityMarkerImage)
        return; // No point continuing if we don't have a marker image to show...

      GeoNameMarkerManager.decorator = new GeoNameMarkerManager(vp, cityMarkerImage);
      IModelApp.viewManager.addDecorator(GeoNameMarkerManager.decorator);
    }
    GeoNameMarkerManager.decorator.synch(vp);
  }
  public static clear(_vp: ScreenViewport) {
    if (undefined !== GeoNameMarkerManager.decorator) {
      IModelApp.viewManager.dropDecorator(GeoNameMarkerManager.decorator);
      GeoNameMarkerManager.decorator = undefined;
    }
  }
  public static update(vp: ScreenViewport) {
    if (undefined !== GeoNameMarkerManager.decorator) {
      GeoNameMarkerManager.decorator.synch(vp);
    }
  }
}

/** An Immediate Tool that attempts to use the geoLocation API to find the given feature */

abstract class GeoNameTool extends Tool {
  public static override get maxArgs() { return 1; }
  public static override get minArgs() { return 0; }

  public abstract doRunWithViewport(vp: ScreenViewport): void;

  public override async run(viewport?: ScreenViewport): Promise<boolean> {
    if (undefined === viewport)
      viewport = IModelApp.viewManager.selectedView;

    if (undefined !== viewport)
      this.doRunWithViewport(viewport);

    return true;
  }
}

class GeoNameOnTool extends GeoNameTool {
  public static override toolId = "GeoNamesOnTool";
  public doRunWithViewport(vp: ScreenViewport): void {
    GeoNameMarkerManager.show(vp).then(() => { }).catch(() => { });
  }
}

class GeoNameOffTool extends GeoNameTool {
  public static override toolId = "GeoNamesOffTool";
  public doRunWithViewport(vp: ScreenViewport): void { GeoNameMarkerManager.clear(vp); }
}
class GeoNameUpdateTool extends GeoNameTool {
  public static override toolId = "GeoNamesUpdateTool";
  public doRunWithViewport(vp: ScreenViewport): void { GeoNameMarkerManager.update(vp); }
}

export class GeoNameExtension {
  private static _defaultNs = "mapLayers";

  public static async initialize(): Promise<void> {
    await IModelApp.localization.registerNamespace(this._defaultNs);
    IModelApp.tools.register(GeoNameOnTool, this._defaultNs);
    IModelApp.tools.register(GeoNameOffTool, this._defaultNs);
    IModelApp.tools.register(GeoNameUpdateTool, this._defaultNs);
    if (undefined !== IModelApp.viewManager.selectedView)
      await GeoNameMarkerManager.show(IModelApp.viewManager.selectedView);
  }
}
