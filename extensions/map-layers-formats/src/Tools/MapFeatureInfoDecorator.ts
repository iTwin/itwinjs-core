/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */
import { Base64EncodedString, ColorDef } from "@itwin/core-common";
import { BeButtonEvent, Cluster, CollectTileStatus, DecorateContext, Decorator, DisclosedTileTreeSet, GeometryTileTreeReference, GraphicPrimitive, GraphicType, HitDetail, IModelApp, MapTileTreeReference, Marker, MarkerImage, MarkerSet, Tile, TileGeometryCollector, TileTreeReference, TileUser, Viewport } from "@itwin/core-frontend";
import { ConvexClipPlaneSet, GrowableXYZArray, LineString3d, Point2d, Point3d, PolyfaceQuery, Range3d, Transform, XAndY, XYAndZ } from "@itwin/core-geometry";
// import { MapFeatureInfoDataUpdate } from "./widget/FeatureInfoDataProvider";

export interface MapFeatureInfoDataUpdate {
  mapHit: HitDetail;
  graphics?: GraphicPrimitive[];
}

/** A TileGeometryCollector that restricts collection to tiles that overlap a line string. */
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

  public drapeLineString(outStrings: LineString3d[], inPoints: GrowableXYZArray, tolerance: number, maxDistance = 1.0E5): "loading" | "complete" {
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

    if (collector.isAllGeometryLoaded) {
      console.log("AllGeometryLoaded");
      for (const polyface of collector.polyfaces)
        outStrings.push(...PolyfaceQuery.sweepLinestringToFacetsXYReturnChains(inPoints, polyface));
      return "complete";
    }

    return "loading";
  }
}



class SimplePinMarker extends Marker {
  public constructor(worldLocation: XYAndZ, size: XAndY, image: MarkerImage) {
    super(worldLocation, size);
    this.image = image;
    this.imageOffset = new Point3d(0, Math.floor(size.y * .5));
  }
}

class SimplePinMarkerCluster extends Marker {
  /** Create a new cluster marker */
  constructor(location: XYAndZ, size: XAndY, cluster: Cluster<SimplePinMarker>, image: MarkerImage | Promise<MarkerImage> | undefined) {
    super(location, size);

    this.imageOffset = new Point3d(0, 30);
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
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  public override onMouseButton(_ev: BeButtonEvent): boolean { return true; } // Don't allow clicks to be sent to active tool...
}

class SimplePinMarkerSet extends MarkerSet<SimplePinMarker> {
  protected getClusterMarker(cluster: Cluster<SimplePinMarker>): Marker {
    return new SimplePinMarkerCluster(cluster.getClusterLocation(), cluster.markers[0].size, cluster, cluster.markers[0].image);
  }
}

export class MapFeatureInfoDecorator implements Decorator {

  public readonly useCachedDecorations = true;
  public readonly disableTerrainDraper = true;


  public pointStringSize = 15;    // ignored if 'useMarker' is used
  public readonly useMarker = true;
  public markerSize = new Point2d(32, 32);

  private _highlightColor = ColorDef.from(0, 255, 255, 127);


  public get highlightColor() { return this._highlightColor; this.updateMarkerImage(); }
  public set highlightColor(color: ColorDef) { this._highlightColor = color; }


  public get defaultMarkerIconSvgXml() { return `<svg class="indicator" viewBox="0 0 22 22" width="22" height="22" xmlns="http://www.w3.org/2000/svg"><path d="m11 0a7.44506 7.44506 0 0 0 -7.5 7.2875c0 1.65 1.132 4.2625 3.25477 8.1125 1.55652 2.75 4.24523 6.6 4.24523 6.6s2.68865-3.9875 4.24528-6.7375c2.12272-3.85 3.25472-6.4625 3.25472-8.1125a7.4215 7.4215 0 0 0 -7.5-7.15z" fill="black"/><path d="m11 1.01715a6.46476 6.46476 0 0 0 -6.48285 6.27033c0 1.72619 1.67181 4.97973 3.12836 7.62139.97564 1.7237 2.42828 3.92176 3.34118 5.27161.91413-1.39148 2.385-3.673 3.37336-5.41907 1.451-2.63171 3.1228-5.88525 3.1228-7.61139a6.39982 6.39982 0 0 0 -6.48285-6.13287zm.00183 8.98285a3 3 0 1 1 3-3 3 3 0 0 1 -3 3z" fill="${this.highlightColor.toRgbString()}"/></svg>` };

  private _drapePoints = new GrowableXYZArray();
  private _drapedStrings?: LineString3d[];
  private _draper?: TerrainDraper;
  private _marker?: Marker;
  private _markerImage: HTMLImageElement;
  private _markerSet = new SimplePinMarkerSet();

  private _state: MapFeatureInfoDataUpdate | undefined;

  private readonly _graphicType = GraphicType.WorldOverlay;

  public constructor() {
    this._markerImage = new Image();
    this.updateMarkerImage();
  }

  private updateMarkerImage() {
    this._markerImage.src = "data:image/svg+xml;base64," + Base64EncodedString.encode(this.defaultMarkerIconSvgXml);
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

  public setState = (state: MapFeatureInfoDataUpdate) => {

    this._drapedStrings = undefined;

    IModelApp.viewManager.invalidateCachedDecorationsAllViews(this);
    this._state = state;

    this._drapePoints.clear();

    if (!this.disableTerrainDraper && this._state.graphics && state.mapHit.viewport.displayStyle.displayTerrain) {
      const isLineStrings = this._state.graphics.length > 0 && this._state.graphics[0].type === "linestring";
      if (state.mapHit?.modelId && isLineStrings) {
        const drapeTreeRef = this.getGeometryTreeRef(state.mapHit.viewport);
        if (drapeTreeRef) {
          this._draper = new TerrainDraper(state.mapHit.viewport, drapeTreeRef);
          return;
        }
      }
    }

    if (this._draper) {
      // Dispose drapper everytime?
      this._draper.dispose();
      this._draper = undefined;
    }

  }

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
    if (this._state?.graphics === undefined) {
      return undefined;
    }
    this._markerSet.markers.clear();

    const graphics = this._state?.graphics;

    const builder = context.createGraphicBuilder(this._graphicType);

    let lineWidth = 3;
    if (this._draper && this._state.graphics) {
      if (this._drapePoints.length === 0) {

        for (const graphic of this._state.graphics) {
          if (graphic.type === "linestring") {
            this._drapePoints.pushAll(graphic.points);
          }
        }
      }

      if (this._drapedStrings === undefined) {

        const drapedStrings: LineString3d[] = [];
        const drapeRange = Range3d.createNull();
        drapeRange.extendArray(this._drapePoints);

        const tolerance = this._computeChordTolerance(context.viewport, true, () => drapeRange) * 10;  // 10 pixels
        if ("loading" !== this._draper.drapeLineString(drapedStrings, this._drapePoints, tolerance)) {
          this._drapedStrings = drapedStrings;
          if (drapedStrings.length > 0) {
            builder.setSymbology(this.highlightColor, this.highlightColor, lineWidth);
            drapedStrings.forEach((line) => builder.addLineString(line.points));
          }
        }

      } else {
        builder.setSymbology(this.highlightColor, this.highlightColor, lineWidth);
        this._drapedStrings.forEach((line) => builder.addLineString(line.points));
      }
    } else {

      let addPrimitives = true;
      if (graphics.length > 0 && graphics[0].type === "pointstring") {
        if (this.useMarker) {
          addPrimitives = false;
          for (const primitive of graphics) {
            if (primitive.type == "pointstring") {
              for (const point of primitive.points)
                this._markerSet.markers.add(new SimplePinMarker(point, this.markerSize, this._markerImage));
            }

          }
        } else {
          lineWidth = this.pointStringSize;
        }
      }

      if (addPrimitives) {
        builder.setSymbology(this.highlightColor, this.highlightColor, lineWidth);
        graphics.forEach((primitive) => builder.addPrimitive(primitive));
      }

    }

    return builder.finish();
  }

  public decorate(context: DecorateContext): void {
    if (this._state?.graphics === undefined)
      return;


    const graphics = this.renderGraphics(context);
    if (graphics)
      context.addDecoration(this._graphicType, graphics);

    this._markerSet.addDecoration(context);


    return;
  }

}
