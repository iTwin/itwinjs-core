/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  assert,
  compareNumbers,
  compareStrings,
} from "@bentley/bentleyjs-core";
import {
  Angle,
  Matrix3d,
  Plane3dByOriginAndUnitNormal,
  Point3d,
  Range1d,
  Range3d,
  Transform,
} from "@bentley/geometry-core";
import {
  BackgroundMapSettings,
  RenderMode,
  TerrainHeightOriginMode,
  TerrainProviderName,
  TerrainSettings,
  ViewFlag,
} from "@bentley/imodeljs-common";
import {
  BingElevationProvider,
  GeographicTilingScheme,
  MapTileLoaderBase,
  MapTileTree,
  MapTileTreeReference,
  MapTilingScheme,
  TerrainTileLoaderBase,
  TileTree,
  TileTreeOwner,
  TileTreeParams,
  TileTreeReference,
  TileTreeSet,
  TileTreeSupplier,
  WebMapTileLoader,
  WebMapTileTreeProps,
  getCesiumWorldTerrainLoader,
  getGcsConverterAvailable,
  tileTreeParamsFromJSON,
} from "./internal";
import { IModelConnection } from "../IModelConnection";
import { SceneContext } from "../ViewContext";
import { HitDetail } from "../HitDetail";
import { FeatureSymbology } from "../render/FeatureSymbology";
import { ScreenViewport } from "../Viewport";

interface BackgroundTerrainTreeId {
  providerName: TerrainProviderName;
  heightOrigin: number;
  heightOriginMode: number;
  wantSkirts: boolean;
}

const lightsOnOverrides = new ViewFlag.Overrides();
lightsOnOverrides.setApplyLighting(true);
lightsOnOverrides.setRenderMode(RenderMode.SmoothShade);
lightsOnOverrides.setShowClipVolume(false);

class BackgroundTerrainTileTree extends MapTileTree {
  constructor(params: TileTreeParams, groundBias: number, public seaLevelOffset: number, gcsConverterAvailable: boolean, tilingScheme: MapTilingScheme, heightRange: Range1d) {
    super(params, groundBias, gcsConverterAvailable, tilingScheme, false, heightRange);
    this._fixedPoint = Point3d.create(0, 0, 0);   // Exaggerate about IModel zero.
  }
  private _fixedPoint: Point3d;
  public settings?: TerrainSettings;
  public getLocationTransform(settings?: TerrainSettings): Transform {
    if (settings === undefined)
      return Transform.createIdentity();

    const matrix = Matrix3d.createScale(1.0, 1.0, this.settings ? this.settings.exaggeration : 1.0);
    const origin = Matrix3d.xyzMinusMatrixTimesXYZ(this._fixedPoint, matrix, this._fixedPoint);
    return Transform.createRefs(origin, matrix);
  }
}

class BackgroundTerrainTreeSupplier implements TileTreeSupplier {
  public compareTileTreeIds(lhs: BackgroundTerrainTreeId, rhs: BackgroundTerrainTreeId): number {
    if (lhs.wantSkirts !== rhs.wantSkirts)
      return lhs.wantSkirts ? 1 : -1;

    let cmp = compareStrings(lhs.providerName, rhs.providerName);
    if (0 === cmp) {
      cmp = compareNumbers(lhs.heightOrigin, rhs.heightOrigin);
      if (0 === cmp)
        cmp = compareNumbers(lhs.heightOriginMode, rhs.heightOriginMode);
    }

    return cmp;
  }

  private async computeHeightBias(heightOrigin: number, heightOriginMode: TerrainHeightOriginMode, iModel: IModelConnection, elevationProvider: BingElevationProvider): Promise<number> {
    const projectCenter = iModel.projectExtents.center;
    switch (heightOriginMode) {
      case TerrainHeightOriginMode.Ground:
        return heightOrigin + await elevationProvider.getHeightValue(projectCenter, iModel, true);

      case TerrainHeightOriginMode.Geodetic:
        return heightOrigin;

      case TerrainHeightOriginMode.Geoid:
        return heightOrigin + await elevationProvider.getGeodeticToSeaLevelOffset(projectCenter, iModel);
    }
  }

  public async createTileTree(id: BackgroundTerrainTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    assert(id.providerName === "CesiumWorldTerrain");
    // ###TODO: Doesn't seem like each tile tree should need its own imagery provider instance...
    const elevationProvider = new BingElevationProvider();
    const heightRange = await elevationProvider.getHeightRange(iModel);
    const gcsConverterAvailable = await getGcsConverterAvailable(iModel);

    heightRange.scaleAboutCenterInPlace(1.1);    // Add some margin to avoid clipping, particularly in top view.

    const heightBias = - await this.computeHeightBias(id.heightOrigin, id.heightOriginMode, iModel, elevationProvider);

    heightRange.low += heightBias;
    heightRange.high += heightBias;
    const modelId = iModel.transientIds.next;
    const seaLevelOffset = await elevationProvider.getGeodeticToSeaLevelOffset(iModel.projectExtents.center, iModel);
    const loader = await getCesiumWorldTerrainLoader(iModel, modelId, heightBias, heightRange, id.wantSkirts);
    const treeProps = new WebMapTileTreeProps(heightBias, modelId, heightRange, 12);

    if (undefined === loader) {
      assert(false, "Invalid Terrain Provider");
      return undefined;
    }
    return new BackgroundTerrainTileTree(tileTreeParamsFromJSON(treeProps, iModel, true, loader, modelId), heightBias, seaLevelOffset, gcsConverterAvailable, new GeographicTilingScheme(), heightRange);
  }
}

const backgroundTerrainTreeSupplier = new BackgroundTerrainTreeSupplier();

/** Specialization of tile tree that represents background terrain.   Background terrain differs from conventional terrain as is assumed to be at least nominally available worldwide and is
 * an alternative to a planar background map
 * @internal
 */
export class BackgroundTerrainTileTreeReference extends TileTreeReference {
  public settings: BackgroundMapSettings;
  private readonly _iModel: IModelConnection;
  private _mapDrapeTree?: TileTreeReference;
  private _overrides?: FeatureSymbology.Overrides;
  private _doDrape = true;                      // Current settings configuration doesn't allow a terrain without a background drape...

  public constructor(settings: BackgroundMapSettings, iModel: IModelConnection) {
    super();
    this.settings = settings;
    this._iModel = iModel;
  }

  /** Terrain  tiles do not contribute to the range used by "fit view". */
  public unionFitRange(_range: Range3d): void { }

  public get treeOwner(): TileTreeOwner {
    const id = {
      providerName: this.settings.terrainSettings.providerName,
      heightOrigin: this.settings.terrainSettings.heightOrigin,
      heightOriginMode: this.settings.terrainSettings.heightOriginMode,
      wantSkirts: false === this.settings.transparency,
    };

    return this._iModel.tiles.getTileTreeOwner(id, backgroundTerrainTreeSupplier);
  }

  /** Adds this reference's graphics to the scene. By default this invokes [[TileTree.drawScene]] on the referenced TileTree, if it is loaded. */
  public addToScene(context: SceneContext): void {
    if (!context.viewFlags.backgroundMap)
      return;

    const tree = context.viewFlags.backgroundMap ? this.treeOwner.load() as BackgroundTerrainTileTree : undefined;
    if (undefined === tree)
      return;

    if (this._doDrape)
      context.addBackgroundDrapedModel(this);

    // NB: We save this off strictly so that discloseTileTrees() can find it...better option?
    this._mapDrapeTree = context.viewport.displayStyle.backgroundDrapeMap;

    tree.settings = context.viewport.displayStyle.backgroundMapSettings.terrainSettings;
    const args = this.createDrawArgs(context);
    if (undefined !== args)
      tree.draw(args);

    tree.settings = undefined;
  }

  protected getViewFlagOverrides(tree: TileTree) {
    const settings = (tree as BackgroundTerrainTileTree).settings;
    return undefined !== settings && settings.applyLighting ? lightsOnOverrides : super.getViewFlagOverrides(tree);
  }

  protected getSymbologyOverrides(_tree: TileTree) {
    return this._symbologyOverrides;
  }

  protected computeTransform(tree: TileTree) {
    const root = tree as BackgroundTerrainTileTree;
    return root.getLocationTransform(root.settings);
  }

  public discloseTileTrees(trees: TileTreeSet): void {
    super.discloseTileTrees(trees);

    if (undefined !== this._mapDrapeTree)
      trees.disclose(this._mapDrapeTree);
  }

  public getHeightRange(): Range1d | undefined {
    if (undefined !== this.treeOwner.tileTree && this.treeOwner.tileTree.loader instanceof MapTileLoaderBase)
      return this.treeOwner.tileTree.loader.heightRange;
    return undefined;
  }

  public addPlanes(planes: Plane3dByOriginAndUnitNormal[]): void {
    const heightRange = this.getHeightRange();
    if (undefined !== heightRange) {
      planes.push(Plane3dByOriginAndUnitNormal.createXYPlane(new Point3d(0, 0, heightRange.low)));
      planes.push(Plane3dByOriginAndUnitNormal.createXYPlane(new Point3d(0, 0, heightRange.high)));
    } else {
      // We don't yet know the range of the height... for now just push plane at BIM zero.
      planes.push(Plane3dByOriginAndUnitNormal.createXYPlane(new Point3d(0, 0, 0)));
    }
  }

  public getToolTip(hit: HitDetail): HTMLElement | string | undefined {
    const tree = this.treeOwner.tileTree as BackgroundTerrainTileTree;
    if (undefined === tree || hit.iModel !== tree.iModel || tree.modelId !== hit.sourceId)
      return undefined;

    const locationTransform = tree.getLocationTransform(hit.viewport.displayStyle.backgroundMapSettings.terrainSettings);
    const worldPoint = locationTransform.multiplyInversePoint3d(hit.hitPoint);
    const cartoGraphic = hit.iModel.spatialToCartographicFromEcef(worldPoint!);
    const strings = [];
    strings.push("Latitude: " + Angle.radiansToDegrees(cartoGraphic.latitude).toFixed(4));
    strings.push("Longitude: " + Angle.radiansToDegrees(cartoGraphic.longitude).toFixed(4));
    const geodeticHeight = cartoGraphic.height - tree.groundBias;
    strings.push("Height (Meters) Geodetic: " + geodeticHeight.toFixed(1) + " Sea Level: " + (geodeticHeight - tree.seaLevelOffset).toFixed(1));
    const div = document.createElement("div");
    div.innerHTML = strings.join("<br>");
    return div;
  }

  /** Add logo cards to logo div. */
  public addLogoCards(logoDiv: HTMLTableElement, vp: ScreenViewport): void {
    const drapeTree = this._mapDrapeTree as MapTileTreeReference;
    if (undefined !== drapeTree &&
      undefined !== drapeTree.treeOwner.tileTree &&
      undefined !== drapeTree.treeOwner.tileTree.loader as WebMapTileLoader &&
      undefined !== this.treeOwner.tileTree &&
      undefined !== this.treeOwner.tileTree.loader as TerrainTileLoaderBase) {
      (drapeTree.treeOwner.tileTree.loader as WebMapTileLoader).geometryAttributionProvider = (this.treeOwner.tileTree.loader as TerrainTileLoaderBase).geometryAttributionProvider;
      drapeTree.addLogoCards(logoDiv, vp);
    }
  }

  private get _symbologyOverrides(): FeatureSymbology.Overrides | undefined {
    if (undefined === this._overrides || this._overrides.defaultOverrides.transparency !== this.settings.transparencyOverride) {
      this._overrides = new FeatureSymbology.Overrides();
      const json: FeatureSymbology.AppearanceProps = {
        transparency: this.settings.transparencyOverride,
        nonLocatable: true,
      };
      this._overrides.setDefaultOverrides(FeatureSymbology.Appearance.fromJSON(json));
    }

    return this._overrides;
  }
}
