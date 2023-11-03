/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ConvexClipPlaneSet, CurvePrimitive, Geometry, GrowableXYZArray, LineString3d, Loop, Matrix3d, Point3d, Polyface, PolyfaceClip, PolyfaceQuery, Range3d, SweepLineStringToFacetsOptions, Transform, Vector3d } from "@itwin/core-geometry";
import { ColorDef, LinePixels } from "@itwin/core-common";
import {
  BeButtonEvent, CollectTileStatus, DecorateContext, DisclosedTileTreeSet, EventHandled, GeometryTileTreeReference, GraphicType, HitDetail, IModelApp,
  LocateFilterStatus, LocateResponse, PrimitiveTool, Tile, TileGeometryCollector, TileUser, Viewport,
} from "@itwin/core-frontend";

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

  public drapeLinear(outStrings: CurvePrimitive[], outMeshes: Polyface[], inPoints: GrowableXYZArray, tolerance: number, maxDistance = 1.0E5): "loading" | "complete" {
    const tree = this.treeRef.treeOwner.load();
    if (!tree)
      return "loading";

    const range = Range3d.createNull();
    range.extendArray(inPoints);
    range.extendZOnly(-maxDistance);  // Expand - but not so much that we get opposite side of globe.
    range.extendZOnly(maxDistance);

    // when current point is near start point, create a polygon to drape
    let polygon: Loop | undefined;
    const isClosed = (inPoints.length > 2) && Geometry.isDistanceWithinTol(inPoints.distanceIndexIndex(0, inPoints.length - 1)!, 100 * tolerance);
    if (isClosed) {
      const flatPoints = inPoints.clone();
      flatPoints.multiplyMatrix3dInPlace(Matrix3d.createRowValues(1, 0, 0, 0, 1, 0, 0, 0, 0));
      polygon = Loop.createPolygon(flatPoints);
    }

    const collector = new DrapeLineStringCollector(this, tolerance, range, tree.iModelTransform, inPoints);
    this.treeRef.collectTileGeometry(collector);
    collector.requestMissingTiles();

    for (const polyface of collector.polyfaces) {
      if (polygon) {
        const mesh = PolyfaceClip.drapeRegion(polyface, polygon);
        if (mesh?.tryTranslateInPlace(0, 0, 10 * tolerance)) // shift up to see it better
          outMeshes.push(mesh);
      } else {
        const sweepDir = Vector3d.unitZ();
        const options = SweepLineStringToFacetsOptions.create(sweepDir, undefined, true, true, true, true);
        outStrings.push(...PolyfaceQuery.sweepLineStringToFacets(inPoints, polyface, options));
      }
    }
    return collector.isAllGeometryLoaded ? "complete" : "loading";
  }
}

/** Demonstrates draping line strings and polygons on terrain meshes.  The terrain can be defined by map terrain (from Cesium World Terrain) or a reality model.
 */
export class TerrainDrapeTool extends PrimitiveTool {
  private _drapePoints = new GrowableXYZArray();
  private _drapedStrings?: LineString3d[];
  private _drapedMeshes?: Polyface[];
  private _motionPoint?: Point3d;
  private _draper?: TerrainDraper;
  public static override toolId = "TerrainDrape";

  public override requireWriteableTarget(): boolean {
    return false;
  }

  public override async onPostInstall() {
    await super.onPostInstall();
    this.setupAndPromptForNextAction();
  }

  public override async onCleanup() {
    this.disposeDraper();
  }

  private disposeDraper(): void {
    this._draper?.dispose();
    this._draper = undefined;
  }

  public override async onUnsuspend(): Promise<void> {
    this.showPrompt();
  }

  public createDecorations(context: DecorateContext, _suspend: boolean): void {
    if (!this._draper)
      return;

    if (this._drapePoints.length > 1) {
      const builder = context.createGraphicBuilder(GraphicType.WorldDecoration);
      builder.setSymbology(ColorDef.red, ColorDef.red, 5);

      let loading = false;
      if (!this._drapedStrings && !this._drapedMeshes) {
        this._drapedStrings = [];
        this._drapedMeshes = [];
        const drapeRange = Range3d.createNull();
        drapeRange.extendArray(this._drapePoints);

        const tolerance = drapeRange.diagonal().magnitude() / 5000;
        loading = "loading" === this._draper.drapeLinear(this._drapedStrings, this._drapedMeshes, this._drapePoints, tolerance);
      }

      if (this._drapedStrings) {
        for (const lineString of this._drapedStrings)
          builder.addLineString(lineString.points);
      }
      if (this._drapedMeshes) {
        for (const mesh of this._drapedMeshes)
          builder.addPolyface(mesh, true);
      }

      if (loading)
        this._drapedStrings = this._drapedMeshes = undefined;

      context.addDecorationFromBuilder(builder);
    }

    if (this._motionPoint) {
      const builder = context.createGraphicBuilder(GraphicType.WorldOverlay);
      builder.setSymbology(ColorDef.white, ColorDef.white, 1, LinePixels.Code0);
      builder.addLineString([this._drapePoints.getPoint3dAtUncheckedPointIndex(this._drapePoints.length - 1), this._motionPoint]);
      context.addDecorationFromBuilder(builder);
    }
  }

  public override decorate(context: DecorateContext): void {
    this.createDecorations(context, false);
  }

  public override decorateSuspended(context: DecorateContext): void {
    this.createDecorations(context, true);
  }

  private setupAndPromptForNextAction(): void {
    this.initLocateElements(undefined === this._draper);
    IModelApp.locateManager.options.allowDecorations = true;    // So we can select "contextual" reality models.
    this.showPrompt();
  }

  private showPrompt(): void {
    IModelApp.notifications.outputPromptByKey(`SVTTools:tools.TerrainDrape.Prompts.${undefined === this._draper ? "SelectDrapeRealityModel" : "EnterDrapePoint"}`);
  }

  private getGeometryTreeRef(vp: Viewport, modelId: string): GeometryTileTreeReference | undefined {
    let treeRef: GeometryTileTreeReference | undefined;
    vp.forEachTileTreeRef((ref) => {
      if (!treeRef) {
        const tree = ref.treeOwner.load();
        if (tree?.modelId === modelId)
          treeRef = ref.createGeometryTreeReference();
      }
    });

    return treeRef;
  }

  public override async filterHit(hit: HitDetail, _out?: LocateResponse): Promise<LocateFilterStatus> {
    if (undefined !== this._draper)
      return LocateFilterStatus.Accept;

    if (!hit.modelId)
      return LocateFilterStatus.Reject;

    return this.getGeometryTreeRef(hit.viewport, hit.modelId) ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    this._motionPoint = ev.point;
    if (ev.viewport)
      ev.viewport.invalidateDecorations();
  }

  public override async onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    this._drapedStrings = this._drapedMeshes = undefined;
    if (this._drapePoints.length)
      this._drapePoints.pop();
    else
      this.disposeDraper();

    if (ev.viewport)
      ev.viewport.invalidateDecorations();

    this.setupAndPromptForNextAction();
    return EventHandled.No;
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    this._motionPoint = undefined;
    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    if (undefined === this._draper) {
      if (hit?.modelId) {
        this._drapePoints.push(hit.hitPoint);
        const drapeTreeRef = this.getGeometryTreeRef(hit.viewport, hit.modelId);
        if (drapeTreeRef)
          this._draper = new TerrainDraper(hit.viewport, drapeTreeRef);
      }
    } else {
      this._drapePoints.push(hit ? hit.hitPoint : ev.point);
    }

    this._drapedStrings = this._drapedMeshes = undefined;
    this.setupAndPromptForNextAction();
    return EventHandled.No;
  }

  public override async onRestartTool(): Promise<void> {
    const tool = new TerrainDrapeTool();
    if (!await tool.run())
      await this.exitTool();
  }

  public override async parseAndRun(..._args: string[]): Promise<boolean> {
    return this.run();
  }
}
