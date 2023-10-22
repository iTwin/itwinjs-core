/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */
import { Base64EncodedString, ColorDef } from "@itwin/core-common";
import {
  BeButtonEvent, Cluster, CollectTileStatus, DecorateContext, Decorator, DisclosedTileTreeSet,
  GeometryTileTreeReference, GraphicType, IModelApp, MapTileTreeReference, Marker, MarkerImage, MarkerSet,
  Tile, TileGeometryCollector, TileTreeReference, TileUser, Viewport } from "@itwin/core-frontend";
import { ConvexClipPlaneSet, CurvePrimitive, GrowableXYZArray, LineString3d, Point2d, Point3d, PolyfaceQuery, Range3d, SweepLineStringToFacetsOptions, Transform, Vector3d, XAndY, XYAndZ } from "@itwin/core-geometry";
import { MapFeatureInfoToolData } from "./MapFeatureInfoTool";

/** A TileGeometryCollector that restricts collection to tiles that overlap a line string.
/* @internal
*/
class DrapeLineStringCollector extends TileGeometryCollector {
  constructor(user: TileUser, chordTolerance: number, range: Range3d, transform: Transform, private _points: GrowableXYZArray) {
    super({ user, chordTolerance, range, transform });
  }

  public override collectTile(tile: Tile): CollectTileStatus {
    let status = super.collectTile(tile);
    if ("reject" !== status && !this.rangeOverlapsLineString(tile.range))
      status = "reject";

    return status;
  }

  private rangeOverlapsLineString(range: Range3d) {
    let inside = false;
    const clipper = ConvexClipPlaneSet.createRange3dPlanes(range, true, true, true, true, false, false);
    if (this._options.transform)
      clipper.transformInPlace(this._options.transform);

    for (let i = 0; i < this._points.length - 1 && !inside; i++)
      inside = clipper.announceClippedSegmentIntervals(0, 1, this._points.getPoint3dAtUncheckedPointIndex(i), this._points.getPoint3dAtUncheckedPointIndex(i + 1));

    return inside;
  }
}

/** @internal */
class TerrainDraper implements TileUser {
  public readonly tileUserId: number;

  public constructor(public readonly viewport: Viewport, public readonly treeRef: GeometryTileTreeReference) {
    this.tileUserId = TileUser.generateId();
    IModelApp.tileAdmin.registerUser(this);
  }

  public dispose(): void {
    IModelApp.tileAdmin.forgetUser(this);
  }

  public get iModel() { return this.viewport.iModel; }

  public onRequestStateChanged() {
    this.viewport.invalidateDecorations();
  }

  public discloseTileTrees(trees: DisclosedTileTreeSet) {
    trees.disclose(this.treeRef);
  }

  public drapeLineString(outStrings: CurvePrimitive[], inPoints: GrowableXYZArray, tolerance: number, maxDistance = 1.0E5): "loading" | "complete" {
    const tree = this.treeRef.treeOwner.load();
    if (!tree)
      return "loading";

    const range = Range3d.createNull();
    range.extendArray(inPoints);
    range.extendZOnly(-maxDistance);  // Expand - but not so much that we get opposite side of globe.
    range.extendZOnly(maxDistance);

    const collector = new DrapeLineStringCollector(this, tolerance, range, tree.iModelTransform, inPoints);
    this.treeRef.collectTileGeometry(collector);
    collector.requestMissingTiles();

    if (collector.isAllGeometryLoaded && collector.polyfaces.length > 0) {
      for (const polyface of collector.polyfaces)
        outStrings.push(...PolyfaceQuery.sweepLineStringToFacets(inPoints, polyface,
          SweepLineStringToFacetsOptions.create(Vector3d.unitZ(), undefined, true, true, false, false)));
      return "complete";
    }

    return "loading";
  }
}

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

/** @internal */
interface DrapePointState {
  count: number;
  collectorState: string;
}

/** @internal */
export class MapFeatureInfoDecorator implements Decorator {
  public hidden = false;
  public readonly useCachedDecorations = true;
  public readonly disableTerrainDraper = true;
  public markerSize = new Point2d(32, 32);
  public lineWidth =  3;
  private _highlightColor = ColorDef.from(0, 255, 255, 127);

  public get highlightColor() { return this._highlightColor;}
  public set highlightColor(color: ColorDef) {
    this.updateMarkerImage();
    this._highlightColor = color;
  }

  public get defaultMarkerIconSvgXml() { return `<svg class="indicator" viewBox="0 0 22 22" width="22" height="22" xmlns="http://www.w3.org/2000/svg"><path d="m11 0a7.44506 7.44506 0 0 0 -7.5 7.2875c0 1.65 1.132 4.2625 3.25477 8.1125 1.55652 2.75 4.24523 6.6 4.24523 6.6s2.68865-3.9875 4.24528-6.7375c2.12272-3.85 3.25472-6.4625 3.25472-8.1125a7.4215 7.4215 0 0 0 -7.5-7.15z" fill="black"/><path d="m11 1.01715a6.46476 6.46476 0 0 0 -6.48285 6.27033c0 1.72619 1.67181 4.97973 3.12836 7.62139.97564 1.7237 2.42828 3.92176 3.34118 5.27161.91413-1.39148 2.385-3.673 3.37336-5.41907 1.451-2.63171 3.1228-5.88525 3.1228-7.61139a6.39982 6.39982 0 0 0 -6.48285-6.13287zm.00183 8.98285a3 3 0 1 1 3-3 3 3 0 0 1 -3 3z" fill="${this.highlightColor.toRgbString()}"/></svg>`; }

  private _drapePoints = new GrowableXYZArray();
  private _scratchPoints = new GrowableXYZArray();

  private _drapePointsStates: DrapePointState[] = [];
  private _drapedStrings?: LineString3d[];
  private _allGeomDraped = false;
  private _draper?: TerrainDraper;
  private _markerImage: HTMLImageElement;
  private _markerSet = new PinMarkerSet();

  // Extra markers can be added outside the normal state
  public extraMarkers: Point3d[]|undefined;

  private _state: MapFeatureInfoToolData | undefined;

  private readonly _graphicType = GraphicType.WorldOverlay;

  public constructor() {
    this._markerImage = new Image();
    this.updateMarkerImage();
  }

  private updateMarkerImage() {
    const base64 = Base64EncodedString.encode(this.defaultMarkerIconSvgXml);
    this._markerImage.src = `data:image/svg+xml;base64,${base64}`;
  }

  private _computeChordTolerance(viewport: Viewport, applyAspectRatioSkew: boolean, computeRange: () => Range3d) {
    let pixelSize = 1;
    // Compute the horizontal distance in meters between two adjacent pixels at the center of the geometry.
    pixelSize = viewport.getPixelSizeAtPoint(computeRange().center);
    pixelSize = viewport.target.adjustPixelSizeForLOD(pixelSize);

    // Aspect ratio skew > 1.0 stretches the view in Y. In that case use the smaller vertical pixel distance for our stroke tolerance.
    const skew = applyAspectRatioSkew ? viewport.view.getAspectRatioSkew() : 0;
    if (skew > 1)
      pixelSize /= skew;
    return pixelSize * 0.25;
  }

  public clearState = () => {
    this._state = undefined;
  };

  public setState = (state: MapFeatureInfoToolData) => {

    this._drapedStrings = undefined;
    this._allGeomDraped = false;
    this.hidden = false;

    this._state = state;
    IModelApp.viewManager.invalidateCachedDecorationsAllViews(this);

    this._drapePoints.clear();
    this._drapePointsStates = [];

    if (!this.disableTerrainDraper && this._state.mapInfo?.layerInfos && state.hit.viewport.displayStyle.displayTerrain) {

      if (state.hit?.modelId) {
        const drapeTreeRef = this.getGeometryTreeRef(state.hit.viewport);
        if (drapeTreeRef) {
          this._draper = new TerrainDraper(state.hit.viewport, drapeTreeRef);
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

    if (this._state?.mapInfo?.layerInfos === undefined || this.hidden) {
      return undefined;
    }

    let transform: Transform|undefined;
    const groundBias = context.viewport.displayStyle.backgroundMapSettings.groundBias;
    if (groundBias !== 0) {
      transform = Transform.createTranslationXYZ(0, 0 , groundBias);
    }
    const builder = context.createGraphicBuilder(this._graphicType, transform);

    if (this._draper) {
      if (this._drapePoints.length === 0 && this._state.mapInfo.layerInfos) {

        for (const layerInfo of this._state.mapInfo.layerInfos) {
          if (layerInfo.subLayerInfos) {
            for (const subLayerInfo of layerInfo.subLayerInfos) {
              for (const feature of subLayerInfo.features) {
                if (feature.geometries) {
                  for (const geom of feature.geometries) {
                    if (geom.graphic.type === "linestring") {
                      this._drapePointsStates.push({ count: geom.graphic.points.length, collectorState: "loading" });
                      this._drapePoints.pushAll(geom.graphic.points);
                    }
                  }
                }
              }
            }

          }
        }
      }

      if (!this._allGeomDraped) {

        let hasMissingLineStrings = false;
        let drapePointsOffset = 0;
        for (const state of this._drapePointsStates) {

          if (state.collectorState === "loading") {
            this._scratchPoints.clear();
            this._scratchPoints.resize(state.count);

            let dstIdx = 0;
            for (let srcIdx = drapePointsOffset; srcIdx < drapePointsOffset + state.count; srcIdx++) {
              this._scratchPoints.transferFromGrowableXYZArray(dstIdx++, this._drapePoints, srcIdx);
            }

            const drapeRange = Range3d.createNull();
            drapeRange.extendArray(this._scratchPoints);
            const drapedStrings: LineString3d[] = [];
            const tolerance = this._computeChordTolerance(context.viewport, true, () => drapeRange) * 10;  // 10 pixels
            if ("loading" === this._draper.drapeLineString(drapedStrings, this._scratchPoints, tolerance)) {
              hasMissingLineStrings = true;
            } else {
              this.addDrapedStrings(drapedStrings);
              state.collectorState = "complete";
            }
          }
          drapePointsOffset += state.count;
        }
        this._allGeomDraped = !hasMissingLineStrings;
      }

      if (this._drapedStrings) {
        builder.setSymbology(this.highlightColor, this.highlightColor, this.lineWidth);
        this._drapedStrings.forEach((line) => builder.addLineString(line.points));
      }

    } else {
      builder.setSymbology(this.highlightColor, this.highlightColor, this.lineWidth);
      for (const layerInfo of this._state.mapInfo.layerInfos) {
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

    // Add extra markers if any specified
    if ( this.extraMarkers !== undefined) {
      this.extraMarkers.forEach((markerPoint)=> {
        builder.setSymbology(this.highlightColor, this.highlightColor, this.lineWidth);
        this._markerSet.markers.add(new PinMarker(markerPoint, this.markerSize, this._markerImage));
      });
    }

    return builder.finish();
  }

  public addDrapedStrings(drapedStrings: LineString3d[]) {
    if (!this._drapedStrings) {
      this._drapedStrings = [];
    }
    for (const ds of drapedStrings)
      this._drapedStrings.push(ds);
  }

  public decorate(context: DecorateContext): void {
    const graphics = this.renderGraphics(context);
    if (graphics)
      context.addDecoration(this._graphicType, graphics);

    this._markerSet.addDecoration(context);
    return;
  }
}
