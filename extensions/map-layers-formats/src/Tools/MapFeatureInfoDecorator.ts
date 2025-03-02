/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Base64EncodedString, ColorDef } from "@itwin/core-common";
import {
  BeButtonEvent, Cluster, DecorateContext, Decorator,
  GeometryTileTreeReference, GraphicBuilder, GraphicPrimitive, GraphicType, IModelApp, MapTileTreeReference, Marker, MarkerImage, MarkerSet,
  ScreenViewport,
  TileTreeReference, Viewport } from "@itwin/core-frontend";
import { GrowableXYZArray, LineString3d, Point2d, Point3d, Polyface, Range3d, Transform, XAndY, XYAndZ } from "@itwin/core-geometry";
import { MapFeatureInfoToolData } from "./MapFeatureInfoTool";
import { GeometryTerrainDraper } from "./GeometryTerrainDraper";
import { Logger } from "@itwin/core-bentley";
const loggerCategory = "MapLayersFormats.MapFeatureInfoDecorator";

/** @internal */
class PinMarker extends Marker {
  public constructor(worldLocation: XYAndZ, size: XAndY, image: MarkerImage) {
    super(worldLocation, size);
    this.image = image;
    this.imageOffset = new Point3d(0, Math.floor(size.y * .5));
  }
}

/** @internal */
class PinMarkerCluster extends Marker {
  /** Create a new cluster marker */
  constructor(location: XYAndZ, size: XAndY, cluster: Cluster<PinMarker>, image: MarkerImage | Promise<MarkerImage> | undefined) {
    super(location, size);

    this.title = IModelApp.localization.getLocalizedString("mapLayersFormats:Messages.MapFeatureInfoDecorator.clusterZoomIn", { nbInstances: cluster.markers.length});

    this.imageOffset = new Point3d(0, size.y * 0.5);
    this.label = cluster.markers.length.toLocaleString();
    this.labelColor = "black";
    this.labelFont = "bold 14px sans-serif";

    if (image)
      this.setImage(image);
  }

  /** Show the cluster as a white circle with an outline */
  public override drawFunc(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.strokeStyle = "#372528";
    ctx.fillStyle = "white";
    ctx.lineWidth = 5;
    ctx.arc(0, 0, this.size.x * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  public override onMouseButton(_ev: BeButtonEvent): boolean { return true; } // Don't allow clicks to be sent to active tool...
}

/** @internal */
class PinMarkerSet extends MarkerSet<PinMarker> {
  protected getClusterMarker(cluster: Cluster<PinMarker>): Marker {
    // No image passed to the cluster, we prefer to have the circle only
    return new PinMarkerCluster(cluster.getClusterLocation(), cluster.markers[0].size, cluster, undefined);
  }
}

interface DrapeGraphicState {
  graphic: GraphicPrimitive;
  collectorState: string;
  chordTolerance: number;
  range: Range3d;
}

class DrapedPrimitives {
  private _strings?: LineString3d[];
  private _meshes?: Polyface[];
  private _points = new GrowableXYZArray();

  public get strings() {
    return this._strings;
  }

  public get meshes() {
    return this._meshes;
  }

  public get points() {
    return this._points;
  }

  public clear() {
    this._strings = undefined;
    this._meshes = undefined;
    this._points.clear();
  }

  public addStrings(drapedStrings: LineString3d[]) {
    if (!this._strings) {
      this._strings = [];
    }
    for (const ds of drapedStrings)
      this._strings.push(ds);
  }

  public addMeshes(drapedMeshes: Polyface[]) {
    if (!this._meshes)
      this._meshes = [];
    drapedMeshes.forEach((ds) => this._meshes!.push(ds));
  }
}

/** @internal */
export class MapFeatureInfoDecorator implements Decorator {
  public hidden = false;
  public readonly useCachedDecorations = true;
  public readonly disableTerrainDraper = false;
  public markerSize = new Point2d(32, 32);
  public lineWidth =  3;

  // This is the maximum allowed size of a geometry, in pixels, to be draped.
  // If the value is too large, we will end up downloading tons of terrain tiles, and possibly hang for too long.
  public maxDrapeSizePixels = 50000;

  // This value controls the chord tolerance used to collect terrain tiles
  // at the "right" resolution.  Higher values, will give coarser terrain tiles.
  public chordTolerancePixels = 20;

  private _highlightColor = ColorDef.from(0, 255, 255, 127);
  public get highlightColor() { return this._highlightColor;}
  public set highlightColor(color: ColorDef) {
    this.updateMarkerImage();
    this._highlightColor = color;
  }

  public get defaultMarkerIconSvgXml() { return `<svg class="indicator" viewBox="0 0 22 22" width="22" height="22" xmlns="http://www.w3.org/2000/svg"><path d="m11 0a7.44506 7.44506 0 0 0 -7.5 7.2875c0 1.65 1.132 4.2625 3.25477 8.1125 1.55652 2.75 4.24523 6.6 4.24523 6.6s2.68865-3.9875 4.24528-6.7375c2.12272-3.85 3.25472-6.4625 3.25472-8.1125a7.4215 7.4215 0 0 0 -7.5-7.15z" fill="black"/><path d="m11 1.01715a6.46476 6.46476 0 0 0 -6.48285 6.27033c0 1.72619 1.67181 4.97973 3.12836 7.62139.97564 1.7237 2.42828 3.92176 3.34118 5.27161.91413-1.39148 2.385-3.673 3.37336-5.41907 1.451-2.63171 3.1228-5.88525 3.1228-7.61139a6.39982 6.39982 0 0 0 -6.48285-6.13287zm.00183 8.98285a3 3 0 1 1 3-3 3 3 0 0 1 -3 3z" fill="${this.highlightColor.toRgbString()}"/></svg>`; }

  private _scratchPoints = new GrowableXYZArray();

  private _drapeGraphicsStates: DrapeGraphicState[] = [];
  private _drapedPrimitives = new DrapedPrimitives();
  private _allGeomDraped = false;
  private _draper?: GeometryTerrainDraper;
  private _markerImage: HTMLImageElement;
  private _markerSet = new PinMarkerSet();

  // Extra markers can be added outside the normal state
  public extraMarkers: Point3d[]|undefined;

  private _data: MapFeatureInfoToolData | undefined;

  private readonly _graphicType = GraphicType.WorldOverlay;

  public constructor() {
    this._markerImage = new Image();
    this.updateMarkerImage();
  }

  private updateMarkerImage() {
    const base64 = Base64EncodedString.encode(this.defaultMarkerIconSvgXml);
    this._markerImage.src = `data:image/svg+xml;base64,${base64}`;
  }

  private computePixelSize(viewport: Viewport, applyAspectRatioSkew: boolean, pointWorld: Point3d) {
    let pixelSize = 1;
    // Compute the horizontal distance in meters between two adjacent pixels at the center of the geometry.
    pixelSize = viewport.getPixelSizeAtPoint(pointWorld);
    pixelSize = viewport.target.adjustPixelSizeForLOD(pixelSize);

    // Aspect ratio skew > 1.0 stretches the view in Y. In that case use the smaller vertical pixel distance for our stroke tolerance.
    const skew = applyAspectRatioSkew ? viewport.view.getAspectRatioSkew() : 0;
    if (skew > 1)
      pixelSize /= skew;
    return pixelSize * 0.25;
  }

  private computeChordTolerance(viewport: Viewport, drapeRange: Range3d) {
    const drapeSizeWorld = Math.max(drapeRange.xLength(),  drapeRange.yLength());
    const pixelSize = this.computePixelSize(viewport, true, drapeRange.center);
    const maxDrapeRangeSizeRatio = this.maxDrapeSizePixels /  (drapeSizeWorld / pixelSize);
    if (maxDrapeRangeSizeRatio < 1) {
      Logger.logWarning(loggerCategory, "Element too large; chord tolerance was adjusted");
      return (pixelSize / maxDrapeRangeSizeRatio)*this.chordTolerancePixels;
    }
    return pixelSize*this.chordTolerancePixels;
  };

  public clearData = () => {
    this._data = undefined;
  };

  public setData = (data: MapFeatureInfoToolData) => {

    this._drapedPrimitives.clear();
    this._allGeomDraped = false;
    this.hidden = false;

    this._data = data;
    IModelApp.viewManager.invalidateCachedDecorationsAllViews(this);

    this._drapeGraphicsStates = [];

    if (!this.disableTerrainDraper && this._data.mapInfo?.layerInfos && data.hit.viewport.displayStyle.displayTerrain) {

      if (data.hit?.modelId) {
        const drapeTreeRef = this.getGeometryTreeRef(data.hit.viewport);
        if (drapeTreeRef) {
          this._draper = new GeometryTerrainDraper(data.hit.viewport, drapeTreeRef);
          return;
        }
      }
    }

    if (this._draper) {
      // Dispose draper every time?
      this._draper.dispose();
      this._draper = undefined;
    }
  };

  private getGeometryTreeRef(vp: Viewport): GeometryTileTreeReference | undefined {
    let treeRef: GeometryTileTreeReference | undefined;
    if (vp.backgroundMapSettings.applyTerrain) {
      vp.forEachMapTreeRef((ref: TileTreeReference) => {
        if (!treeRef && ref instanceof MapTileTreeReference) {
          treeRef = ref.createGeometryTreeReference();
        }
      });
    }

    return treeRef;
  }

  protected renderGraphics(context: DecorateContext) {
    this._markerSet.markers.clear();

    if (this._data?.mapInfo?.layerInfos === undefined || this.hidden) {
      return undefined;
    }

    let transform: Transform|undefined;
    const groundBias = context.viewport.displayStyle.backgroundMapSettings.groundBias;
    if (groundBias !== 0) {
      transform = Transform.createTranslationXYZ(0, 0 , groundBias);
    }
    const builder = context.createGraphicBuilder(this._graphicType, transform);

    if (this._draper) {
      this.initializeDrapeState(context.viewport);

      // We need to call drapeGeometries() until it returns true (i.e. fully complete)
      if (!this._allGeomDraped) {
        if (!this.drapeGeometries(context.viewport))
          return undefined;
      }

      this.appendDrapedGeometries(builder);
    } else {
      // Append geometries straight from the state to the builder
      this.appendGeometries(builder);
    }

    // Add extra markers if any specified
    if ( this.extraMarkers !== undefined) {
      this.extraMarkers.forEach((markerPoint)=> {
        builder.setSymbology(this.highlightColor, this.highlightColor, this.lineWidth);
        this._markerSet.markers.add(new PinMarker(markerPoint, this.markerSize, this._markerImage));
      });
    }

    return builder.finish();
  }

  // Iterates the mapfeatureinfo data and create a draping state for each entry
  private initializeDrapeState(viewport: ScreenViewport) {
    if (this._drapeGraphicsStates.length === 0) {
      const getGraphicRange = (graphic: GraphicPrimitive) => {
        if (graphic.type === "linestring")
          return Range3d.createArray(graphic.points);
        else if (graphic.type === "loop")
          return graphic.loop.range();
        else if (graphic.type === "pointstring")
          return Range3d.createArray(graphic.points);
        else
          return Range3d.createNull();
      };

      for (const layerInfo of this._data?.mapInfo?.layerInfos??[]) {
        for (const subLayerInfo of layerInfo?.subLayerInfos??[]) {
          for (const feature of subLayerInfo.features) {

            feature.geometries?.forEach(((geom)=> {
              const range = getGraphicRange(geom.graphic);
              this._drapeGraphicsStates.push({
                graphic: geom.graphic,
                collectorState: "loading",
                chordTolerance: this.computeChordTolerance(viewport, range),
                range,
              });
            } ));
          }
        }
      }
    }
  }

  // returns true when all geometries are fully draped; otherwise false
  private drapeGeometries(_viewport: ScreenViewport): boolean {
    if (!this._draper)
      return false;

    let hasMissingDrapeGeoms = false;
    for (const state of this._drapeGraphicsStates) {
      if (state.collectorState === "loading") {
        this._scratchPoints.clear();

        if (state.graphic.type === "linestring") {
          this._scratchPoints.pushAll(state.graphic.points);
          const drapedStrings: LineString3d[] = [];
          if ("loading" === this._draper.drapeLineString(drapedStrings, this._scratchPoints, state.chordTolerance, state.range)) {
            hasMissingDrapeGeoms = true;
            break;
          } else {
            this._drapedPrimitives.addStrings(drapedStrings);
            state.collectorState = "complete";
          }
        } else if (state.graphic.type === "loop") {
          const loop =  state.graphic.loop;
          const outMeshes: Polyface[] = [];
          if ("loading" === this._draper.drapeLoop(outMeshes, loop, state.chordTolerance, state.range)) {
            hasMissingDrapeGeoms = true;
            break; // We drape each graphic sequentially,  otherwise collector get messed up.
          } else {
            this._drapedPrimitives.addMeshes(outMeshes);
            state.collectorState = "complete";
          }
        } else if (state.graphic.type === "pointstring") {
          const outPoint = Point3d.createZero();
          for (const point of state.graphic.points) {
            if ("loading" === this._draper.drapePoint(outPoint, point, state.chordTolerance, state.range)) {
              this._allGeomDraped = false;
              return false;
            } else if (!outPoint.isZero) {
              this._drapedPrimitives.points.push(outPoint);
            }
          }
        }
      }
    }

    this._allGeomDraped = !hasMissingDrapeGeoms;
    return this._allGeomDraped;
  }

  private appendDrapedGeometries(builder: GraphicBuilder) {
    if (this._drapedPrimitives.strings) {
      builder.setSymbology(this.highlightColor, this.highlightColor, this.lineWidth);
      this._drapedPrimitives.strings.forEach((line) => builder.addLineString(line.points));
    }

    if (this._drapedPrimitives.meshes) {
      builder.setSymbology(this.highlightColor, this.highlightColor, this.lineWidth);
      this._drapedPrimitives.meshes.forEach((polyface) => builder.addPolyface(polyface, true));
    }

    if (this._drapedPrimitives.points.length > 0) {
      for (let i = 0; i < this._drapedPrimitives.points.length; i++) {
        this._markerSet.markers.add(new PinMarker(this._drapedPrimitives.points.getPoint3dAtUncheckedPointIndex(i), this.markerSize, this._markerImage));
      }
    }
  }

  private appendGeometries(builder: GraphicBuilder) {
    if (!this._data?.mapInfo?.layerInfos)
      return;

    builder.setSymbology(this.highlightColor, this.highlightColor, this.lineWidth);
    for (const layerInfo of this._data.mapInfo.layerInfos) {
      if (layerInfo.subLayerInfos && !(layerInfo.subLayerInfos instanceof HTMLElement)) {
        for (const subLayerInfo of layerInfo.subLayerInfos) {
          for (const feature of subLayerInfo.features) {
            if (feature.geometries) {
              for (const geom of feature.geometries) {
                if (geom.graphic.type === "pointstring") {
                  for (const point of geom.graphic.points)
                    this._markerSet.markers.add(new PinMarker(point, this.markerSize, this._markerImage));
                } else {
                  builder.addPrimitive(geom.graphic);
                }

              }
            }
          }
        }

      }

    }
  }

  public decorate(context: DecorateContext): void {
    const graphics = this.renderGraphics(context);
    if (graphics) {
      context.addDecoration(this._graphicType, graphics);
      IModelApp.toolAdmin.setCursor(undefined);
    }

    this._markerSet.addDecoration(context);
    return;
  }
}
