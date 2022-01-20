/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ConvexClipPlaneSet, GrowableXYZArray, LineString3d, Point3d, PolyfaceQuery, Range3d, Transform } from "@bentley/geometry-core";
import { ColorDef, LinePixels } from "@bentley/imodeljs-common";
import {
  BeButtonEvent, CollectTileStatus, DecorateContext, DisclosedTileTreeSet, EventHandled, GraphicType, HitDetail, IModelApp, LocateFilterStatus, LocateResponse, PrimitiveTool,
  RealityTileTree, Tile, TileGeometryCollector, TileTreeReference, TileUser, Viewport,
} from "@bentley/imodeljs-frontend";

/** TileGeometryCollector that restricts collection to tiles that overlap a line string. */
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

class TerrainDrape implements TileUser {
  public readonly tileUserId: number;

  public constructor(public readonly viewport: Viewport, public readonly treeRef: TileTreeReference) {
    this.tileUserId = TileUser.generateId();
  }

  public get iModel() { return this.viewport.iModel; }

  public onRequestStateChanged() {
    this.viewport.invalidateDecorations();
  }

  public discloseTileTrees(trees: DisclosedTileTreeSet) {
    trees.disclose(this.treeRef);
  }
}

/** Demonstrates draping line strings on terrain meshes.  The terrain can be defined by map terrain (from Cesium World Terrain) or a reality model.
 */
export class TerrainDrapeTool extends PrimitiveTool {
  private _drapePoints = new GrowableXYZArray();
  private _drapedStrings?: LineString3d[];
  private _motionPoint?: Point3d;
  private _drapeViewport?: Viewport;
  private _drapeTreeRef?: TileTreeReference;
  public static override toolId = "TerrainDrape";

  public override requireWriteableTarget(): boolean {
    return false;
  }

  public override async onPostInstall() {
    super.onPostInstall();
    this.setupAndPromptForNextAction();
  }

  public override async onUnsuspend(): Promise<void> {
    this.showPrompt();
  }

  private drapeLineString(tree: RealityTileTree, outStrings: LineString3d[], inPoints: GrowableXYZArray, tolerance: number, viewport: Viewport, maxDistance = 1.0E5): RealityTileDrapeStatus {
    const range = Range3d.createNull();
    range.extendArray(inPoints);
    range.extendZOnly(-maxDistance);  // Expand - but not so much that we get opposite side of globe.
    range.extendZOnly(maxDistance);
    const tileSelector = new RealityTileByDrapeLineStringCollector(tolerance, range, tree.iModelTransform, inPoints);
    const collectionStatus = tree.collectRealityTiles(tileSelector);

    if (collectionStatus === RealityTileCollectionStatus.Loading)
      tileSelector.requestMissingTiles(viewport);

    for (const geometry of tileSelector.acceptedGeometry()) {
      if (geometry.polyfaces)
        geometry.polyfaces.forEach((polyface) => {
          const sweepStrings = PolyfaceQuery.sweepLinestringToFacetsXYReturnChains(inPoints, polyface);
          sweepStrings.forEach((sweepString) => outStrings.push(sweepString));
        });
    }

    return collectionStatus === RealityTileCollectionStatus.Loading ? RealityTileDrapeStatus.Loading : RealityTileDrapeStatus.Success;
  }

  public createDecorations(context: DecorateContext, _suspend: boolean): void {
    if (this._drapeTreeRef && this._drapeViewport && this._drapePoints.length > 0) {
      if (this._drapePoints.length > 1) {
        const drapeTree = this._drapeTreeRef.treeOwner.load();
        if (drapeTree instanceof RealityTileTree) {
          const builder =  context.createGraphicBuilder(GraphicType.WorldDecoration);
          builder.setSymbology(ColorDef.red, ColorDef.red, 5);
          let loading = false;
          if (!this._drapedStrings) {
            this._drapedStrings = new Array<LineString3d>();
            const drapeRange = Range3d.createNull();
            drapeRange.extendArray(this._drapePoints);
            const tolerance = drapeRange.diagonal().magnitude() / 5000.0;
            loading = RealityTileDrapeStatus.Loading ===  this.drapeLineString(drapeTree, this._drapedStrings, this._drapePoints, tolerance, this._drapeViewport);
          }

          this._drapedStrings.forEach((lineString) => builder.addLineString(lineString.points));
          if (loading)
            this._drapedStrings = undefined;

          context.addDecorationFromBuilder(builder);
        }
      }

      if (this._motionPoint) {
        const builder =  context.createGraphicBuilder(GraphicType.WorldOverlay);
        builder.setSymbology(ColorDef.white, ColorDef.white, 1, LinePixels.Code0);
        builder.addLineString([this._drapePoints.getPoint3dAtUncheckedPointIndex(this._drapePoints.length - 1), this._motionPoint]);
        context.addDecorationFromBuilder(builder);
      }
    }
  }

  public override decorate(context: DecorateContext): void {
    this.createDecorations(context, false);
  }

  public override decorateSuspended(context: DecorateContext): void {
    this.createDecorations(context, true);
  }

  private setupAndPromptForNextAction(): void {
    this.initLocateElements(undefined === this._drapeTreeRef);
    IModelApp.locateManager.options.allowDecorations = true;    // So we can select "contextual" reality models.
    this.showPrompt();
  }

  private showPrompt(): void {
    IModelApp.notifications.outputPromptByKey(`SVTTools:tools.TerrainDrape.Prompts.${undefined === this._drapeTreeRef ? "SelectDrapeRealityModel" : "EnterDrapePoint"}`);
  }

  private getGeometryTreeRef(vp: Viewport, modelId: string): TileTreeReference | undefined {
    let treeRef;
    vp.forEachTileTreeRef((ref) => {
      const tree = ref.treeOwner.load();
      if (tree?.modelId === modelId)
        treeRef = ref.createGeometryTreeRef();
    });

    return treeRef;
  }

  public override async filterHit(hit: HitDetail, _out?: LocateResponse): Promise<LocateFilterStatus> {
    if (undefined !== this._drapeTreeRef)
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
    this._drapedStrings = undefined;
    if (this._drapePoints.length) {
      this._drapePoints.pop();
    } else {
      this._drapeTreeRef = undefined;
      this._drapeViewport = undefined;
    }
    if (ev.viewport)
      ev.viewport.invalidateDecorations();

    this.setupAndPromptForNextAction();
    return EventHandled.No;
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    this._motionPoint = undefined;
    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    if (undefined === this._drapeTreeRef) {
      if (hit?.modelId) {
        this._drapePoints.push(hit.hitPoint);
        this._drapeViewport = hit.viewport;
        this._drapeTreeRef = this.getGeometryTreeRef(hit.viewport, hit.modelId);
      }
    } else {
      this._drapePoints.push(hit ? hit.hitPoint : ev.point);
    }
    this._drapedStrings = undefined;
    this.setupAndPromptForNextAction();
    return EventHandled.No;
  }

  public override async onRestartTool(): Promise<void> {
    const tool = new TerrainDrapeTool();
    if (!tool.run())
      this.exitTool();
  }

  public override async parseAndRun(..._args: string[]): Promise<boolean> {
    this.run();
    return true;
  }
}
