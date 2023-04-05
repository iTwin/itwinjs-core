/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */
import { ColorDef } from "@itwin/core-common";
import { CollectTileStatus, DecorateContext, Decorator, DisclosedTileTreeSet, GeometryTileTreeReference, GraphicPrimitive, GraphicType, HitDetail, IModelApp, MapTileTree, MapTileTreeReference, RenderGraphic, Tile, TileGeometryCollector, TileTreeReference, TileUser, Viewport } from "@itwin/core-frontend";
import { ConvexClipPlaneSet, GrowableXYZArray, LineString3d, PolyfaceQuery, Range3d, Transform } from "@itwin/core-geometry";
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
    const clipper = ConvexClipPlaneSet.createRange3dPlanes (range, true, true, true, true, false, false);
    if (this._options.transform)
      clipper.transformInPlace(this._options.transform);

    for (let i = 0; i < this._points.length - 1 && !inside; i++)
      inside = clipper.announceClippedSegmentIntervals (0, 1, this._points.getPoint3dAtUncheckedPointIndex(i), this._points.getPoint3dAtUncheckedPointIndex(i+1));

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

export class MapFeatureInfoDecorator implements Decorator {

  // private _graphicPrimitives: GraphicPrimitive[]|undefined;
  private _drapePoints = new GrowableXYZArray();
  private _drapedStrings?: LineString3d[];
  private _draper?: TerrainDraper;

  private _state: MapFeatureInfoDataUpdate|undefined;
  private _cachedGraphics: RenderGraphic|undefined;
  // private readonly _graphicType = GraphicType.WorldDecoration;
  private readonly _graphicType = GraphicType.WorldOverlay;

  private _computeChordTolerance(viewport: Viewport, applyAspectRatioSkew: boolean, computeRange: () => Range3d)  {
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

  public setState(state: MapFeatureInfoDataUpdate) {
    this._cachedGraphics = undefined;
    this._drapedStrings  = undefined;
    // this._graphicPrimitives = graphics;
    this._state = state;

    this._drapePoints.clear();

    if (this._state.graphics && state.mapHit.viewport.displayStyle.displayTerrain) {
      const isLineStrings = this._state.graphics.length > 0 && this._state.graphics[0].type === "linestring";
      // if (state.mapHit.viewport.view.displayStyle.displayTerrain && state.mapHit?.modelId && isLineStrings) {
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

  // private getGeometryTreeRef(vp: Viewport, modelId: string): GeometryTileTreeReference | undefined {
  //   let treeRef: GeometryTileTreeReference | undefined;
  //   vp.forEachTileTreeRef((ref) => {
  //     if (!treeRef) {
  //       const tree = ref.treeOwner.load();
  //       if (tree?.modelId === modelId)
  //         treeRef = ref.createGeometryTreeReference();
  //     }
  //   });

  //   return treeRef;
  // }
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
      return;
    }
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

        // const tolerance = drapeRange.diagonal().magnitude() / 5000;
        const tolerance = this._computeChordTolerance(context.viewport, true, ()=>drapeRange) * 10;  // 10 pixels
        if ("loading" !== this._draper.drapeLineString(drapedStrings, this._drapePoints, tolerance)) {
          console.log("Got draped geometries");
          this._drapedStrings = drapedStrings;
          if (drapedStrings.length > 0) {
            builder.setSymbology(ColorDef.from(0, 255, 255, 100), ColorDef.from(0, 255, 255, 100), lineWidth);
            drapedStrings.forEach((line) => builder.addLineString(line.points));
          } else {
            console.log("No draped line string");
          }
        }

      } else {
        builder.setSymbology(ColorDef.from(0, 255, 255, 100), ColorDef.from(0, 255, 255, 100), lineWidth);
        this._drapedStrings.forEach((line) => builder.addLineString(line.points));
      }
    } else {
    // builder.addRangeBox(vp.iModel.projectExtents);
    // builder.setSymbology(ColorDef.blue, ColorDef.blue, 15 /* lineWidth */);

      if (graphics.length > 0 && graphics[0].type === "pointstring") {
        lineWidth = 15;

      }
      builder.setSymbology(ColorDef.from(0, 255, 255, 100), ColorDef.from(0, 255, 255, 100), lineWidth);
      graphics.forEach((primitive) => builder.addPrimitive(primitive));
    }

    this._cachedGraphics = builder.finish();
  }

  public decorate(context: DecorateContext): void {
    if (this._state?.graphics === undefined)
      return;

    // Render graphics if not already in cache
    if (this._cachedGraphics === undefined) {
      this.renderGraphics(context);
    }

    if (this._cachedGraphics) {
      context.addDecoration(this._graphicType, this._cachedGraphics);
      this._cachedGraphics = undefined;
    }

    /*
    const vp = context.viewport;
    if (!vp.view.isSpatialView())
      return;
    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration, undefined);
    // Set edge color to white or black depending on current view background color and set line weight to 2.
    builder.setSymbology(vp.getContrastToBackgroundColor(), ColorDef.red, 2);
    // Add range box edge geometry to builder.
    builder.addRangeBox(vp.iModel.projectExtents);
    context.addDecorationFromBuilder(builder);
    */

    return;
  }

}
