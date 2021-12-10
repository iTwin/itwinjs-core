/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import {
  assert, compareBooleans, compareNumbers, compareStringsOrUndefined, CompressedId64Set, Id64String,
} from "@itwin/core-bentley";
import {
  Cartographic, DefaultSupportedTypes, GeoCoordStatus, PlanarClipMaskPriority, PlanarClipMaskSettings,
  RealityDataProvider,
  RealityDataSourceKey,
  SpatialClassifiers, ViewFlagOverrides,
} from "@itwin/core-common";
import { Angle, Constant, Ellipsoid, Matrix3d, Point3d, Range3d, Ray3d, Transform, TransformProps, Vector3d, XYZ } from "@itwin/core-geometry";
import { calculateEcefToDbTransformAtLocation } from "../BackgroundMapGeometry";
import { DisplayStyleState } from "../DisplayStyleState";
import { HitDetail } from "../HitDetail";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { PlanarClipMaskState } from "../PlanarClipMaskState";
import { RealityDataSource } from "../RealityDataSource";
import { RenderMemory } from "../render/RenderMemory";
import { SceneContext } from "../ViewContext";
import { ScreenViewport } from "../Viewport";
import { ViewState } from "../ViewState";
import {
  BatchedTileIdMap, CesiumIonAssetProvider, createClassifierTileTreeReference, createDefaultViewFlagOverrides, DisclosedTileTreeSet, getGcsConverterAvailable, RealityTile, RealityTileLoader, RealityTileParams,
  RealityTileTree, RealityTileTreeParams, SpatialClassifierTileTreeReference, Tile, TileDrawArgs, TileLoadPriority, TileRequest, TileTree,
  TileTreeOwner, TileTreeReference, TileTreeSupplier,
} from "./internal";

function getUrl(content: any) {
  return content ? (content.url ? content.url : content.uri) : undefined;
}

interface RealityTreeId {
  rdSourceKey: RealityDataSourceKey;
  transform?: Transform;
  modelId: Id64String;
  maskModelIds?: string;
  deduplicateVertices: boolean;
  toEcefTransform?: Transform;
}

function compareOrigins(lhs: XYZ, rhs: XYZ): number {
  let cmp = compareNumbers(lhs.x, rhs.x);
  if (0 === cmp) {
    cmp = compareNumbers(lhs.y, rhs.y);
    if (0 === cmp)
      cmp = compareNumbers(lhs.z, rhs.z);
  }

  return cmp;
}

function compareMatrices(lhs: Matrix3d, rhs: Matrix3d): number {
  for (let i = 0; i < 9; i++) {
    const cmp = compareNumbers(lhs.coffs[i], rhs.coffs[i]);
    if (0 !== cmp)
      return cmp;
  }

  return 0;
}

function compareTransforms(lhs?: Transform, rhs?: Transform) {
  if (undefined === lhs)
    return undefined !== rhs ? -1 : 0;

  else if (undefined === rhs)
    return 1;

  const cmp = compareOrigins(lhs.origin, rhs.origin);
  return 0 !== cmp ? cmp : compareMatrices(lhs.matrix, rhs.matrix);
}

class RealityTreeSupplier implements TileTreeSupplier {
  public readonly isEcefDependent = true;

  public getOwner(treeId: RealityTreeId, iModel: IModelConnection): TileTreeOwner {
    return iModel.tiles.getTileTreeOwner(treeId, this);
  }

  public async createTileTree(treeId: RealityTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    if (treeId.maskModelIds)
      await iModel.models.load(CompressedId64Set.decompressSet(treeId.maskModelIds));

    return RealityModelTileTree.createRealityModelTileTree(treeId.rdSourceKey, iModel, treeId.modelId, treeId.transform, treeId.deduplicateVertices);
  }

  public compareTileTreeIds(lhs: RealityTreeId, rhs: RealityTreeId): number {
    let cmp = compareStringsOrUndefined(lhs.rdSourceKey.id, rhs.rdSourceKey.id);
    if (0 === cmp) {
      cmp = compareStringsOrUndefined(lhs.rdSourceKey.format, rhs.rdSourceKey.format);
      if (0 === cmp) {
        cmp = compareStringsOrUndefined(lhs.rdSourceKey.iTwinId, rhs.rdSourceKey.iTwinId);
        if (0 === cmp) {
          cmp = compareStringsOrUndefined(lhs.modelId, rhs.modelId);
          if (0 === cmp)
            cmp = compareBooleans(lhs.deduplicateVertices, rhs.deduplicateVertices);
        }
      }
    }

    if (0 !== cmp)
      return cmp;

    cmp = compareStringsOrUndefined(lhs.maskModelIds, rhs.maskModelIds);
    if (0 !== cmp)
      return cmp;

    cmp = compareTransforms(lhs.transform, rhs.transform);
    if (0 !== cmp)
      return cmp;

    return compareTransforms(lhs.toEcefTransform, rhs.toEcefTransform);
  }
}

const realityTreeSupplier = new RealityTreeSupplier();

/** @internal */
export function createRealityTileTreeReference(props: RealityModelTileTree.ReferenceProps): RealityModelTileTree.Reference {
  return new RealityTreeReference(props);
}

const zeroPoint = Point3d.createZero();
const earthEllipsoid = Ellipsoid.createCenterMatrixRadii(zeroPoint, undefined, Constant.earthRadiusWGS84.equator, Constant.earthRadiusWGS84.equator, Constant.earthRadiusWGS84.polar);
const scratchRay = Ray3d.createXAxis();

/** @internal */
export class RealityTileRegion {
  constructor(values: { minLongitude: number, minLatitude: number, minHeight: number, maxLongitude: number, maxLatitude: number, maxHeight: number }) {
    this.minLongitude = values.minLongitude;
    this.minLatitude = values.minLatitude;
    this.minHeight = values.minHeight;
    this.maxLongitude = values.maxLongitude;
    this.maxLatitude = values.maxLatitude;
    this.maxHeight = values.maxHeight;
  }
  public minLongitude: number;
  public minLatitude: number;
  public minHeight: number;
  public maxLongitude: number;
  public maxLatitude: number;
  public maxHeight: number;

  public static create(region: number[]): RealityTileRegion {
    const minHeight = region[4];
    const maxHeight = region[5];
    const minLongitude = region[0];
    const maxLongitude = region[2];
    const minLatitude = Cartographic.parametricLatitudeFromGeodeticLatitude(region[1]);
    const maxLatitude = Cartographic.parametricLatitudeFromGeodeticLatitude(region[3]);
    return new RealityTileRegion({ minLongitude, minLatitude, minHeight, maxLongitude, maxLatitude, maxHeight });
  }

  public static isGlobal(boundingVolume: any) {
    return Array.isArray(boundingVolume?.region) && (boundingVolume.region[2] - boundingVolume.region[0]) > Angle.piRadians && (boundingVolume.region[3] - boundingVolume.region[1]) > Angle.piOver2Radians;
  }
  public getRange(): { range: Range3d, corners?: Point3d[] } {
    const maxAngle = Math.max(Math.abs(this.maxLatitude - this.minLatitude), Math.abs(this.maxLongitude - this.minLongitude));
    let corners;
    let range: Range3d;
    if (maxAngle < Math.PI / 8) {
      corners = new Array<Point3d>(8);
      const chordTolerance = (1 - Math.cos(maxAngle / 2)) * Constant.earthRadiusWGS84.polar;
      const addEllipsoidCorner = ((long: number, lat: number, index: number) => {
        const ray = earthEllipsoid.radiansToUnitNormalRay(long, lat, scratchRay)!;
        corners[index] = ray.fractionToPoint(this.minHeight - chordTolerance);
        corners[index + 4] = ray.fractionToPoint(this.maxHeight + chordTolerance);
      });
      addEllipsoidCorner(this.minLongitude, this.minLatitude, 0);
      addEllipsoidCorner(this.minLongitude, this.maxLatitude, 1);
      addEllipsoidCorner(this.maxLongitude, this.minLatitude, 2);
      addEllipsoidCorner(this.maxLongitude, this.maxLatitude, 3);
      range = Range3d.createArray(corners);
    } else {
      const minEq = Constant.earthRadiusWGS84.equator + this.minHeight, maxEq = Constant.earthRadiusWGS84.equator + this.maxHeight;
      const minEllipsoid = Ellipsoid.createCenterMatrixRadii(zeroPoint, undefined, minEq, minEq, Constant.earthRadiusWGS84.polar + this.minHeight);
      const maxEllipsoid = Ellipsoid.createCenterMatrixRadii(zeroPoint, undefined, maxEq, maxEq, Constant.earthRadiusWGS84.polar + this.maxHeight);
      range = minEllipsoid.patchRangeStartEndRadians(this.minLongitude, this.maxLongitude, this.minLatitude, this.maxLatitude);
      range.extendRange(maxEllipsoid.patchRangeStartEndRadians(this.minLongitude, this.maxLongitude, this.minLatitude, this.maxLatitude));
    }
    return { range, corners };
  }
}

/** @internal */
export class RealityModelTileUtils {
  public static rangeFromBoundingVolume(boundingVolume: any): { range: Range3d, corners?: Point3d[], region?: RealityTileRegion } | undefined {
    if (undefined === boundingVolume)
      return undefined;

    let corners: Point3d[] | undefined;
    let range: Range3d | undefined;
    if (undefined !== boundingVolume.box) {
      const box: number[] = boundingVolume.box;
      const center = Point3d.create(box[0], box[1], box[2]);
      const ux = Vector3d.create(box[3], box[4], box[5]);
      const uy = Vector3d.create(box[6], box[7], box[8]);
      const uz = Vector3d.create(box[9], box[10], box[11]);
      corners = new Array<Point3d>();
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 2; k++) {
          for (let l = 0; l < 2; l++) {
            corners.push(center.plus3Scaled(ux, (j ? -1.0 : 1.0), uy, (k ? -1.0 : 1.0), uz, (l ? -1.0 : 1.0)));
          }
        }
      }
      range = Range3d.createArray(corners);
    } else if (Array.isArray(boundingVolume.sphere)) {
      const sphere: number[] = boundingVolume.sphere;
      const center = Point3d.create(sphere[0], sphere[1], sphere[2]);
      const radius = sphere[3];
      range = Range3d.createXYZXYZ(center.x - radius, center.y - radius, center.z - radius, center.x + radius, center.y + radius, center.z + radius);
    } else if (Array.isArray(boundingVolume.region)) {
      const region = RealityTileRegion.create(boundingVolume.region);
      const regionRange = region.getRange();
      return { range: regionRange.range, corners: regionRange.corners, region };
    }
    return range ? { range, corners } : undefined;

  }
  public static maximumSizeFromGeometricTolerance(range: Range3d, geometricError: number): number {
    const minToleranceRatio = true === IModelApp.renderSystem.isMobile ? IModelApp.tileAdmin.mobileRealityTileMinToleranceRatio : 1.0;   // Nominally the error on screen size of a tile.  Increasing generally increases performance (fewer draw calls) at expense of higher load times.

    // NB: We increase the above minToleranceRatio on mobile devices in order to help avoid pruning too often based on the memory threshold for
    // pruning currently used by reality tile trees on mobile.

    return minToleranceRatio * range.diagonal().magnitude() / geometricError;
  }
  public static transformFromJson(jTrans: number[] | undefined): Transform {
    return (jTrans === undefined) ? Transform.createIdentity() : Transform.createOriginAndMatrix(Point3d.create(jTrans[12], jTrans[13], jTrans[14]), Matrix3d.createRowValues(jTrans[0], jTrans[4], jTrans[8], jTrans[1], jTrans[5], jTrans[9], jTrans[2], jTrans[6], jTrans[10]));
  }
}

/** @internal */
enum SMTextureType {
  None = 0, // no textures
  Embedded = 1, // textures are available and stored in the nodes
  Streaming = 2, // textures need to be downloaded, Bing Maps, etc…
}

/** @internal */
class RealityModelTileTreeProps {
  public location: Transform;
  public tilesetJson: any;
  public doDrapeBackgroundMap: boolean = false;
  public rdSource: RealityDataSource;
  public yAxisUp = false;
  public root: any;

  constructor(json: any, root: any, rdSource: RealityDataSource, tilesetToDbTransform: Transform, public readonly tilesetToEcef?: Transform) {
    this.tilesetJson = root;
    this.rdSource = rdSource;
    this.location = tilesetToDbTransform;
    this.doDrapeBackgroundMap = (json.root && json.root.SMMasterHeader && SMTextureType.Streaming === json.root.SMMasterHeader.IsTextured);
    if (json.asset.gltfUpAxis === undefined || json.asset.gltfUpAxis === "y" || json.asset.gltfUpAxis === "Y")
      this.yAxisUp = true;
  }
}

class RealityModelTileTreeParams implements RealityTileTreeParams {
  public id: string;
  public modelId: string;
  public iModel: IModelConnection;
  public is3d = true;
  public loader: RealityModelTileLoader;
  public rootTile: RealityTileParams;

  public get location() { return this.loader.tree.location; }
  public get yAxisUp() { return this.loader.tree.yAxisUp; }
  public get priority() { return this.loader.priority; }

  public constructor(tileTreeId: string, iModel: IModelConnection, modelId: Id64String, loader: RealityModelTileLoader, public readonly gcsConverterAvailable: boolean, public readonly rootToEcef: Transform | undefined) {
    this.loader = loader;
    this.id = tileTreeId;
    this.modelId = modelId;
    this.iModel = iModel;
    this.rootTile = new RealityModelTileProps(loader.tree.tilesetJson, undefined, "", undefined, undefined === loader.tree.tilesetJson.refine ? undefined : loader.tree.tilesetJson.refine === "ADD");
  }
}

/** @internal */
class RealityModelTileProps implements RealityTileParams {
  public readonly contentId: string;
  public readonly range: Range3d;
  public readonly contentRange?: Range3d;
  public readonly maximumSize: number;
  public readonly isLeaf: boolean;
  public readonly transformToRoot?: Transform;
  public readonly additiveRefinement?: boolean;
  public readonly parent?: RealityTile;
  public readonly noContentButTerminateOnSelection?: boolean;
  public readonly rangeCorners?: Point3d[];
  public readonly region?: RealityTileRegion;

  constructor(json: any, parent: RealityTile | undefined, thisId: string, transformToRoot?: Transform, additiveRefinement?: boolean) {
    this.contentId = thisId;
    this.parent = parent;
    const boundingVolume = RealityModelTileUtils.rangeFromBoundingVolume(json.boundingVolume);
    if (boundingVolume) {
      this.range = boundingVolume.range;
      this.rangeCorners = boundingVolume.corners;
      this.region = boundingVolume?.region;
    } else {
      this.range = Range3d.createNull();
      assert(false, "Unbounded tile");
    }
    this.isLeaf = !Array.isArray(json.children) || 0 === json.children.length;
    this.transformToRoot = transformToRoot;
    this.additiveRefinement = additiveRefinement;
    const hasContents = undefined !== getUrl(json.content);
    if (hasContents)
      this.contentRange = RealityModelTileUtils.rangeFromBoundingVolume(json.content.boundingVolume)?.range;
    else {
      // A node without content should probably be selectable even if not additive refinement - But restrict it to that case here
      // to avoid potential problems with existing reality models, but still avoid overselection in the OSM world building set.
      if (this.additiveRefinement || parent?.additiveRefinement)
        this.noContentButTerminateOnSelection = true;
    }

    this.maximumSize = (this.noContentButTerminateOnSelection || hasContents) ? RealityModelTileUtils.maximumSizeFromGeometricTolerance(Range3d.fromJSON(this.range), json.geometricError) : 0;
  }
}

/** @internal */
class FindChildResult {
  constructor(public id: string, public json: any, public transformToRoot?: Transform) { }
}

/** @internal */
function assembleUrl(prefix: string, url: string): string {

  if (url.startsWith("./")) {
    url = url.substring(2);
  } else {
    const prefixParts = prefix.split("/");
    prefixParts.pop();
    while (url.startsWith("../")) {
      prefixParts.pop();
      url = url.substring(3);
    }
    prefixParts.push("");
    prefix = prefixParts.join("/");
  }
  return prefix + url;
}

/** @internal */
function addUrlPrefix(subTree: any, prefix: string) {
  if (undefined === subTree)
    return;

  if (undefined !== subTree.content) {
    if (undefined !== subTree.content.url)
      subTree.content.url = assembleUrl(prefix, subTree.content.url);
    else if (undefined !== subTree.content.uri)
      subTree.content.uri = assembleUrl(prefix, subTree.content.uri);
  }

  if (undefined !== subTree.children)
    for (const child of subTree.children)
      addUrlPrefix(child, prefix);
}

/** @internal */
async function expandSubTree(root: any, rdsource: RealityDataSource): Promise<any> {
  const childUrl = getUrl(root.content);
  if (undefined !== childUrl && childUrl.endsWith("json")) {    // A child may contain a subTree...
    const subTree = await rdsource.getTileJson(childUrl);
    const prefixIndex = childUrl.lastIndexOf("/");
    if (prefixIndex > 0)
      addUrlPrefix(subTree.root, childUrl.substring(0, prefixIndex + 1));

    return subTree.root;
  } else {
    return root;
  }
}

/** @internal */
class RealityModelTileLoader extends RealityTileLoader {
  public readonly tree: RealityModelTileTreeProps;
  private readonly _batchedIdMap?: BatchedTileIdMap;
  private _viewFlagOverrides: ViewFlagOverrides;
  private readonly _deduplicateVertices: boolean;

  public constructor(tree: RealityModelTileTreeProps, batchedIdMap?: BatchedTileIdMap, deduplicateVertices=false) {
    super();
    this.tree = tree;
    this._batchedIdMap = batchedIdMap;
    this._deduplicateVertices = deduplicateVertices;

    let clipVolume;
    if (RealityTileRegion.isGlobal(tree.tilesetJson.boundingVolume))
      clipVolume = false;
    this._viewFlagOverrides = createDefaultViewFlagOverrides({ lighting: true, clipVolume });

    // Display edges if they are present (Cesium outline extension) and enabled for view.
    this._viewFlagOverrides.visibleEdges = undefined;
    this._viewFlagOverrides.hiddenEdges = undefined;

    // Allow wiremesh display.
    this._viewFlagOverrides.wiremesh = undefined;
  }

  public get doDrapeBackgroundMap(): boolean { return this.tree.doDrapeBackgroundMap; }
  public override get wantDeduplicatedVertices() { return this._deduplicateVertices; }

  public get maxDepth(): number { return 32; }  // Can be removed when element tile selector is working.
  public get minDepth(): number { return 0; }
  public get priority(): TileLoadPriority { return TileLoadPriority.Context; }
  public override getBatchIdMap(): BatchedTileIdMap | undefined { return this._batchedIdMap; }
  public get clipLowResolutionTiles(): boolean { return true; }
  public override get viewFlagOverrides(): ViewFlagOverrides { return this._viewFlagOverrides; }

  public async loadChildren(tile: RealityTile): Promise<Tile[] | undefined> {
    const props = await this.getChildrenProps(tile);
    if (undefined === props)
      return undefined;

    const children = [];
    for (const prop of props)
      children.push(tile.realityRoot.createTile(prop));

    return children;
  }

  public async getChildrenProps(parent: RealityTile): Promise<RealityTileParams[]> {
    const props: RealityModelTileProps[] = [];
    const thisId = parent.contentId;
    const prefix = thisId.length ? `${thisId}_` : "";
    const findResult = await this.findTileInJson(this.tree.tilesetJson, thisId, "", undefined);
    if (undefined !== findResult && Array.isArray(findResult.json.children)) {
      for (let i = 0; i < findResult.json.children.length; i++) {
        const childId = prefix + i;
        const foundChild = await this.findTileInJson(this.tree.tilesetJson, childId, "", undefined);
        if (undefined !== foundChild)
          props.push(new RealityModelTileProps(foundChild.json, parent, foundChild.id, foundChild.transformToRoot, foundChild.json.refine === undefined ? undefined : foundChild.json.refine === "ADD"));
      }
    }
    return props;
  }

  public getRequestChannel(_tile: Tile) {
    // ###TODO: May want to extract the hostname from the URL.
    return IModelApp.tileAdmin.channels.getForHttp("itwinjs-reality-model");
  }

  public async requestTileContent(tile: Tile, isCanceled: () => boolean): Promise<TileRequest.Response> {
    const foundChild = await this.findTileInJson(this.tree.tilesetJson, tile.contentId, "");
    if (undefined === foundChild || undefined === foundChild.json.content || isCanceled())
      return undefined;

    return this.tree.rdSource.getTileContent(getUrl(foundChild.json.content));
  }

  private async findTileInJson(tilesetJson: any, id: string, parentId: string, transformToRoot?: Transform): Promise<FindChildResult | undefined> {
    if (id.length === 0)
      return new FindChildResult(id, tilesetJson, transformToRoot);    // Root.

    const separatorIndex = id.indexOf("_");
    const childId = (separatorIndex < 0) ? id : id.substring(0, separatorIndex);
    const childIndex = parseInt(childId, 10);

    if (isNaN(childIndex) || tilesetJson === undefined || tilesetJson.children === undefined || childIndex >= tilesetJson.children.length) {
      assert(false, "scalable mesh child not found.");
      return undefined;
    }

    const foundChild = tilesetJson.children[childIndex];
    const thisParentId = parentId.length ? (`${parentId}_${childId}`) : childId;
    if (foundChild.transform) {
      const thisTransform = RealityModelTileUtils.transformFromJson(foundChild.transform);
      transformToRoot = transformToRoot ? transformToRoot.multiplyTransformTransform(thisTransform) : thisTransform;
    }

    if (separatorIndex >= 0) {
      return this.findTileInJson(foundChild, id.substring(separatorIndex + 1), thisParentId, transformToRoot);
    }

    tilesetJson.children[childIndex] = await expandSubTree(foundChild, this.tree.rdSource);

    return new FindChildResult(thisParentId, tilesetJson.children[childIndex], transformToRoot);
  }
}

/** @internal */
export type RealityModelSource = ViewState | DisplayStyleState;

/** @internal */
export class RealityModelTileTree extends RealityTileTree {
  private readonly _isContentUnbounded: boolean;
  public constructor(params: RealityTileTreeParams) {
    super(params);

    this._isContentUnbounded = this.rootTile.contentRange.diagonal().magnitude() > 2 * Constant.earthRadiusWGS84.equator;
    if (!this.isContentUnbounded && !this.rootTile.contentRange.isNull) {
      const worldContentRange = this.iModelTransform.multiplyRange(this.rootTile.contentRange);
      this.iModel.expandDisplayedExtents(worldContentRange);
    }
  }
  public override get isContentUnbounded() { return this._isContentUnbounded; }
}

/** @internal */
// eslint-disable-next-line no-redeclare
export namespace RealityModelTileTree {

  export interface ReferenceBaseProps {
    iModel: IModelConnection;
    source: RealityModelSource;
    rdSourceKey: RealityDataSourceKey;
    modelId?: Id64String;
    tilesetToDbTransform?: TransformProps;
    tilesetToEcefTransform?: TransformProps;
    name?: string;
    classifiers?: SpatialClassifiers;
    planarClipMask?: PlanarClipMaskSettings;
  }
  export interface ReferenceProps extends ReferenceBaseProps {
    url?: string;
    requestAuthorization?: string;
  }

  export abstract class Reference extends TileTreeReference {
    protected readonly _name: string;

    protected _transform?: Transform;
    protected _iModel: IModelConnection;
    private _modelId: Id64String;
    private _isGlobal?: boolean;
    protected readonly _source: RealityModelSource;
    protected _planarClipMask?: PlanarClipMaskState;
    protected _classifier?: SpatialClassifierTileTreeReference;
    protected _mapDrapeTree?: TileTreeReference;
    public get modelId() { return this._modelId; }
    public get classifiers(): SpatialClassifiers | undefined { return undefined !== this._classifier ? this._classifier.classifiers : undefined; }
    public get planarClipMask(): PlanarClipMaskState | undefined { return this._planarClipMask; }
    public set planarClipMask(planarClipMask: PlanarClipMaskState | undefined) { this._planarClipMask = planarClipMask; }
    public get planarClipMaskPriority(): number {
      if (this._planarClipMask?.settings.priority !== undefined)
        return this._planarClipMask.settings.priority;

      return this.isGlobal ? PlanarClipMaskPriority.GlobalRealityModel : PlanarClipMaskPriority.RealityModel;
    }

    protected get maskModelIds(): string | undefined {
      return this._planarClipMask?.settings.compressedModelIds;
    }

    public constructor(props: RealityModelTileTree.ReferenceBaseProps) {
      super();
      this._name = undefined !== props.name ? props.name : "";
      this._modelId = props.modelId ? props.modelId : props.iModel.transientIds.next;
      this._source = props.source;
      let transform;
      if (undefined !== props.tilesetToDbTransform) {
        const tf = Transform.fromJSON(props.tilesetToDbTransform);
        if (!tf.isIdentity)
          transform = tf;

        this._transform = transform;
      }

      this._iModel = props.iModel;
      if (props.planarClipMask)
        this._planarClipMask = PlanarClipMaskState.create(props.planarClipMask);

      if (undefined !== props.classifiers)
        this._classifier = createClassifierTileTreeReference(props.classifiers, this, props.iModel, props.source);
    }

    public get planarClassifierTreeRef() { return this._classifier && this._classifier.activeClassifier && this._classifier.isPlanar ? this._classifier : undefined; }

    public override unionFitRange(union: Range3d): void {
      const contentRange = this.computeWorldContentRange();
      if (!contentRange.isNull && contentRange.diagonal().magnitude() < Constant.earthRadiusWGS84.equator)
        union.extendRange(contentRange);
    }
    public override get isGlobal() {
      if (undefined === this._isGlobal) {
        const range = this.computeWorldContentRange();
        if (!range.isNull)
          this._isGlobal = range.diagonal().magnitude() > 2 * Constant.earthRadiusWGS84.equator;
      }
      return this._isGlobal === undefined ? false : this._isGlobal;
    }

    public override addToScene(context: SceneContext): void {
      // NB: The classifier must be added first, so we can find it when adding our own tiles.
      if (this._classifier && this._classifier.activeClassifier)
        this._classifier.addToScene(context);

      this.addPlanarClassifierOrMaskToScene(context);
      super.addToScene(context);
    }
    protected addPlanarClassifierOrMaskToScene(context: SceneContext) {
      // A planarClassifier is required if there is a classification tree OR planar masking is required.
      const classifierTree = this.planarClassifierTreeRef;
      const planarClipMask = this._planarClipMask ?? context.viewport.displayStyle.getPlanarClipMaskState(this.modelId);
      if (!classifierTree && !planarClipMask)
        return;

      if (classifierTree && !classifierTree.treeOwner.load())
        return;

      context.addPlanarClassifier(this.modelId, classifierTree, planarClipMask);
    }

    public override discloseTileTrees(trees: DisclosedTileTreeSet): void {
      super.discloseTileTrees(trees);

      if (undefined !== this._classifier)
        this._classifier.discloseTileTrees(trees);

      if (undefined !== this._mapDrapeTree)
        this._mapDrapeTree.discloseTileTrees(trees);

      if (undefined !== this._planarClipMask)
        this._planarClipMask.discloseTileTrees(trees);
    }
    public override collectStatistics(stats: RenderMemory.Statistics): void {
      super.collectStatistics(stats);

      const tree = undefined !== this._classifier ? this._classifier.treeOwner.tileTree : undefined;
      if (undefined !== tree)
        tree.collectStatistics(stats);
    }
  }

  export async function createRealityModelTileTree(rdSourceKey: RealityDataSourceKey, iModel: IModelConnection, modelId: Id64String, tilesetToDb: Transform | undefined, deduplicateVertices: boolean): Promise<TileTree | undefined> {
    const rdSource = await RealityDataSource.fromKey(rdSourceKey, iModel.iTwinId);
    // If we can get a valid connection from sourceKey, returns the tile tree
    if (rdSource) {
      // Serialize the reality data source key into a string to uniquely identify this tile tree
      const tileTreeId = rdSource.key.toString();
      if (tileTreeId === undefined)
        return undefined;
      const props = await getTileTreeProps(rdSource, tilesetToDb, iModel);
      const loader = new RealityModelTileLoader(props, new BatchedTileIdMap(iModel), deduplicateVertices);
      const gcsConverterAvailable = await getGcsConverterAvailable(iModel);
      const params = new RealityModelTileTreeParams(tileTreeId, iModel, modelId, loader, gcsConverterAvailable, props.tilesetToEcef);
      return new RealityModelTileTree(params);
    }
    return undefined;
  }

  async function getTileTreeProps(rdSource: RealityDataSource, tilesetToDbJson: any, iModel: IModelConnection): Promise<RealityModelTileTreeProps> {
    const json = await rdSource.getRootDocument(iModel.iTwinId);
    let rootTransform = iModel.ecefLocation ? iModel.getMapEcefToDb(0) : Transform.createIdentity();
    const geoConverter = iModel.noGcsDefined ? undefined : iModel.geoServices.getConverter("WGS84");
    if (geoConverter !== undefined) {
      let realityTileRange = RealityModelTileUtils.rangeFromBoundingVolume(json.root.boundingVolume)!.range;
      if (json.root.transform) {
        const realityToEcef = RealityModelTileUtils.transformFromJson(json.root.transform);
        realityTileRange = realityToEcef.multiplyRange(realityTileRange);
      }

      if (iModel.ecefLocation) {
        // In initial publishing version the iModel ecef Transform was used to locate the reality model.
        // This would work well only for tilesets published from that iModel but for iModels the ecef transform is calculated
        // at the center of the project extents and the reality model location may differ greatly, and the curvature of the earth
        // could introduce significant errors.
        // The publishing was modified to calculate the ecef transform at the reality model range center and at the same time the "iModelPublishVersion"
        // member was added to the root object.  In order to continue to locate reality models published from older versions at the
        // project extents center we look for Tileset version 0.0 and no root.iModelVersion.
        const ecefOrigin = realityTileRange.localXYZToWorld(.5, .5, .5)!;
        const dbOrigin = rootTransform.multiplyPoint3d(ecefOrigin);
        const realityOriginToProjectDistance = iModel.projectExtents.distanceToPoint(dbOrigin);
        const maxProjectDistance = 1E5;     // Only use the project GCS projection if within 100KM of the project.   Don't attempt to use GCS if global reality model or in another locale - Results will be unreliable.
        if (realityOriginToProjectDistance < maxProjectDistance && json.asset?.version !== "0.0" || undefined !== json.root?.iModelPublishVersion) {
          const cartographicOrigin = Cartographic.fromEcef(ecefOrigin);

          if (cartographicOrigin !== undefined) {
            const geoOrigin = Point3d.create(cartographicOrigin.longitudeDegrees, cartographicOrigin.latitudeDegrees, cartographicOrigin.height);
            const response = await geoConverter.getIModelCoordinatesFromGeoCoordinates([geoOrigin]);
            if (response.iModelCoords[0].s === GeoCoordStatus.Success) {
              const ecefToDb = await calculateEcefToDbTransformAtLocation(Point3d.fromJSON(response.iModelCoords[0].p), iModel);
              if (ecefToDb)
                rootTransform = ecefToDb;
            }
          }
        }
      }
    }
    let tilesetToEcef = Transform.createIdentity();

    if (json.root.transform) {
      tilesetToEcef = RealityModelTileUtils.transformFromJson(json.root.transform);
      rootTransform = rootTransform.multiplyTransformTransform(tilesetToEcef);
    }

    if (undefined !== tilesetToDbJson)
      rootTransform = Transform.fromJSON(tilesetToDbJson).multiplyTransformTransform(rootTransform);

    const root = await expandSubTree(json.root, rdSource);
    return new RealityModelTileTreeProps(json, root, rdSource, rootTransform, tilesetToEcef);
  }
}

/** Supplies a reality data [[TileTree]] from a URL. May be associated with a persistent [[GeometricModelState]], or attached at run-time via a [[ContextRealityModelState]].
 * @internal
 */
class RealityTreeReference extends RealityModelTileTree.Reference {
  protected _rdSourceKey: RealityDataSourceKey;

  public constructor(props: RealityModelTileTree.ReferenceProps) {
    super(props);

    // Maybe we should throw if both props.rdSourceKey && props.url are undefined
    this._rdSourceKey = props.rdSourceKey ? props.rdSourceKey : props.url ? RealityDataSource.createKeyFromUrl(props.url, RealityDataProvider.ContextShare) :
      RealityDataSource.createKeyFromUrl("", RealityDataProvider.ContextShare);
  }
  public get treeOwner(): TileTreeOwner {
    const treeId: RealityTreeId = {
      rdSourceKey: this._rdSourceKey,
      transform: this._transform,
      modelId: this.modelId,
      maskModelIds: this.maskModelIds,
      deduplicateVertices: this._wantWiremesh,
    };

    return realityTreeSupplier.getOwner(treeId, this._iModel);
  }

  private get _wantWiremesh(): boolean {
    return this._source.viewFlags.wiremesh;
  }

  public override get castsShadows() {
    return true;
  }

  protected override get _isLoadingComplete(): boolean {
    return !this._mapDrapeTree || this._mapDrapeTree.isLoadingComplete;
  }

  public override createDrawArgs(context: SceneContext): TileDrawArgs | undefined {
    // For global reality models (OSM Building layer only) - offset the reality model by the BIM elevation bias.  This would not be necessary
    // if iModels had their elevation set correctly but unfortunately many GCS erroneously report Sea (Geoid) elevation rather than
    // Geodetic.
    const tree = this.treeOwner.load();
    if (undefined === tree)
      return undefined;

    const drawArgs = super.createDrawArgs(context);
    if (drawArgs !== undefined && this._iModel.isGeoLocated && tree.isContentUnbounded) {
      const elevationBias = context.viewport.view.displayStyle.backgroundMapElevationBias;

      if (undefined !== elevationBias)
        drawArgs.location.origin.z -= elevationBias;
    }

    return drawArgs;
  }

  public override addToScene(context: SceneContext): void {
    const tree = this.treeOwner.tileTree as RealityTileTree;
    if (undefined !== tree && context.viewport.iModel.isGeoLocated && (tree.loader as RealityModelTileLoader).doDrapeBackgroundMap) {
      // NB: We save this off strictly so that discloseTileTrees() can find it...better option?
      this._mapDrapeTree = context.viewport.backgroundDrapeMap;
      context.addBackgroundDrapedModel(this, undefined);
    }

    super.addToScene(context);
  }

  public override async getToolTip(hit: HitDetail): Promise<HTMLElement | string | undefined> {
    const tree = this.treeOwner.tileTree;
    if (undefined === tree || hit.iModel !== tree.iModel)
      return undefined;

    const map = (tree as RealityTileTree).loader.getBatchIdMap();
    const batch = undefined !== map ? map.getBatchProperties(hit.sourceId) : undefined;
    if (undefined === batch && tree.modelId !== hit.sourceId)
      return undefined;

    const strings = [];

    const loader = (tree as RealityModelTileTree).loader;
    const type = (loader as RealityModelTileLoader).tree.rdSource.realityDataType;

    // If a type is specified, display it
    if (type !== undefined) {
      // Case insensitive
      switch (type.toUpperCase()) {
        case DefaultSupportedTypes.RealityMesh3dTiles.toUpperCase():
          strings.push(IModelApp.localization.getLocalizedString("iModelJs:RealityModelTypes.RealityMesh3DTiles"));
          break;
        case DefaultSupportedTypes.Terrain3dTiles.toUpperCase():
          strings.push(IModelApp.localization.getLocalizedString("iModelJs:RealityModelTypes.Terrain3DTiles"));
          break;
        case DefaultSupportedTypes.Cesium3dTiles.toUpperCase():
          strings.push(IModelApp.localization.getLocalizedString("iModelJs:RealityModelTypes.Cesium3DTiles"));
          break;
      }
    }

    if (this._name) {
      strings.push(`${IModelApp.localization.getLocalizedString("iModelJs:TooltipInfo.Name")} ${this._name}`);
    } else {
      const cesiumAsset = this._rdSourceKey.provider === RealityDataProvider.CesiumIonAsset ? CesiumIonAssetProvider.parseCesiumUrl(this._rdSourceKey.id) : undefined;
      strings.push(cesiumAsset ? `Cesium Asset: ${cesiumAsset.id}` : this._rdSourceKey.id);
    }

    if (batch !== undefined)
      for (const key of Object.keys(batch))
        if (-1 === key.indexOf("#"))     // Avoid internal cesium
          strings.push(`${key}: ${batch[key]}`);

    const div = document.createElement("div");
    div.innerHTML = strings.join("<br>");
    return div;
  }

  public override addLogoCards(cards: HTMLTableElement, _vp: ScreenViewport): void {
    if (this._rdSourceKey.provider === RealityDataProvider.CesiumIonAsset) {
      cards.appendChild(IModelApp.makeLogoCard({ heading: "OpenStreetMap", notice: `&copy;<a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> ${IModelApp.localization.getLocalizedString("iModelJs:BackgroundMap:OpenStreetMapContributors")}` }));
    }
  }
}

