/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { assert, BentleyStatus, compareNumbers, compareStrings, compareStringsOrUndefined, Guid, Id64String } from "@bentley/bentleyjs-core";
import { Matrix3d, Point3d, Range3d, Transform, TransformProps, Vector3d, XYZ, YawPitchRollAngles } from "@bentley/geometry-core";
import { Cartographic, IModelError } from "@bentley/imodeljs-common";
import { AccessToken, request, RequestOptions } from "@bentley/itwin-client";
import { RealityData, RealityDataClient } from "@bentley/reality-data-client";
import { DisplayStyleState } from "../DisplayStyleState";
import { AuthorizedFrontendRequestContext, FrontendRequestContext } from "../FrontendRequestContext";
import { HitDetail } from "../HitDetail";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { RenderMemory } from "../render/RenderMemory";
import { SpatialClassifiers } from "../SpatialClassifiers";
import { SceneContext } from "../ViewContext";
import { ViewState } from "../ViewState";
import {
  BatchedTileIdMap, createClassifierTileTreeReference, createDefaultViewFlagOverrides, getCesiumAccessTokenAndEndpointUrl, RealityTile, RealityTileLoader, RealityTileParams,
  RealityTileTree, RealityTileTreeParams, SpatialClassifierTileTreeReference, Tile, TileLoadPriority, TileRequest, TileTree, TileTreeOwner,
  TileTreeReference, TileTreeSet, TileTreeSupplier,
} from "./internal";

function getUrl(content: any) {
  return content ? (content.url ? content.url : content.uri) : undefined;
}

interface RealityTreeId {
  url: string;
  transform?: Transform;
  modelId: Id64String;
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

class RealityTreeSupplier implements TileTreeSupplier {
  public readonly isEcefDependent = true;

  public getOwner(treeId: RealityTreeId, iModel: IModelConnection): TileTreeOwner {
    return iModel.tiles.getTileTreeOwner(treeId, this);
  }

  public async createTileTree(treeId: RealityTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    return RealityModelTileTree.createRealityModelTileTree(treeId.url, iModel, treeId.modelId, treeId.transform);
  }

  public compareTileTreeIds(lhs: RealityTreeId, rhs: RealityTreeId): number {
    let cmp = compareStrings(lhs.url, rhs.url);
    if (0 === cmp)
      cmp = compareStringsOrUndefined(lhs.modelId, rhs.modelId);

    if (0 !== cmp)
      return cmp;

    if (undefined === lhs.transform)
      return undefined !== rhs.transform ? -1 : 0;
    else if (undefined === rhs.transform)
      return 1;

    const l = lhs.transform, r = rhs.transform;
    cmp = compareOrigins(l.origin, r.origin);
    return 0 !== cmp ? cmp : compareMatrices(l.matrix, r.matrix);
  }
}

const realityTreeSupplier = new RealityTreeSupplier();

/** @internal */
export function createRealityTileTreeReference(props: RealityModelTileTree.ReferenceProps): RealityModelTileTree.Reference { return new RealityTreeReference(props); }

/** @internal */
export class RealityModelTileUtils {
  public static rangeFromBoundingVolume(boundingVolume: any): Range3d | undefined {
    if (undefined === boundingVolume)
      return undefined;
    if (undefined !== boundingVolume.box) {
      const box: number[] = boundingVolume.box;
      const center = Point3d.create(box[0], box[1], box[2]);
      const ux = Vector3d.create(box[3], box[4], box[5]);
      const uy = Vector3d.create(box[6], box[7], box[8]);
      const uz = Vector3d.create(box[9], box[10], box[11]);
      const corners: Point3d[] = [];
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 2; k++) {
          for (let l = 0; l < 2; l++) {
            corners.push(center.plus3Scaled(ux, (j ? -1.0 : 1.0), uy, (k ? -1.0 : 1.0), uz, (l ? -1.0 : 1.0)));
          }
        }
      }
      return Range3d.createArray(corners);
    } else if (Array.isArray(boundingVolume.sphere)) {
      const sphere: number[] = boundingVolume.sphere;
      const center = Point3d.create(sphere[0], sphere[1], sphere[2]);
      const radius = sphere[3];
      return Range3d.createXYZXYZ(center.x - radius, center.y - radius, center.z - radius, center.x + radius, center.y + radius, center.z + radius);
    } else if (Array.isArray(boundingVolume.region)) {
      const ecefLow = (new Cartographic(boundingVolume.region[0], boundingVolume.region[1], boundingVolume.region[4])).toEcef();
      const ecefHigh = (new Cartographic(boundingVolume.region[2], boundingVolume.region[3], boundingVolume.region[5])).toEcef();
      return Range3d.create(ecefLow, ecefHigh);
    } else return undefined;

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
  public tilesetJson: object;
  public doDrapeBackgroundMap: boolean = false;
  public client: RealityModelTileClient;
  public yAxisUp = false;

  constructor(json: any, client: RealityModelTileClient, tilesetTransform: Transform) {
    this.tilesetJson = json.root;
    this.client = client;
    this.location = tilesetTransform;
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

  public constructor(url: string, iModel: IModelConnection, modelId: Id64String, loader: RealityModelTileLoader) {
    this.loader = loader;
    this.id = url;
    this.modelId = modelId;
    this.iModel = iModel;
    this.rootTile = new RealityModelTileProps(loader.tree.tilesetJson, undefined, "", undefined);
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
  public readonly parent?: RealityTile;

  constructor(json: any, parent: RealityTile | undefined, thisId: string, transformToRoot?: Transform) {
    this.contentId = thisId;
    this.parent = parent;
    this.range = RealityModelTileUtils.rangeFromBoundingVolume(json.boundingVolume)!;
    this.isLeaf = !Array.isArray(json.children) || 0 === json.children.length;
    this.transformToRoot = transformToRoot;

    const hasContents = undefined !== getUrl(json.content);
    if (hasContents) {
      this.contentRange = RealityModelTileUtils.rangeFromBoundingVolume(json.content.boundingVolume);
      this.maximumSize = RealityModelTileUtils.maximumSizeFromGeometricTolerance(Range3d.fromJSON(this.range), json.geometricError);
    } else {
      this.maximumSize = 0.0;
    }
  }
}

/** @internal */
class FindChildResult {
  constructor(public id: string, public json: any, public transformToRoot?: Transform) { }
}

// Smooth shade, no lighting; clip volume and shadows if enabled for view.
const realityModelViewFlagOverrides = createDefaultViewFlagOverrides({ lighting: false });

/** @internal */
class RealityModelTileLoader extends RealityTileLoader {
  public readonly tree: RealityModelTileTreeProps;
  private readonly _batchedIdMap?: BatchedTileIdMap;

  public constructor(tree: RealityModelTileTreeProps, batchedIdMap?: BatchedTileIdMap) {
    super();
    this.tree = tree;
    this._batchedIdMap = batchedIdMap;
  }

  public get doDrapeBackgroundMap(): boolean { return this.tree.doDrapeBackgroundMap; }

  public get maxDepth(): number { return 32; }  // Can be removed when element tile selector is working.
  public get priority(): TileLoadPriority { return TileLoadPriority.Context; }
  public get viewFlagOverrides() { return realityModelViewFlagOverrides; }
  public getBatchIdMap(): BatchedTileIdMap | undefined { return this._batchedIdMap; }
  public get clipLowResolutionTiles(): boolean { return true; }

  public async loadChildren(tile: RealityTile): Promise<Tile[] | undefined> {
    const props = await this.getChildrenProps(tile);
    if (undefined === props)
      return undefined;

    const children = [];
    const parentRange = (tile.hasContentRange || undefined !== tile.tree.contentRange) ? undefined : new Range3d();
    for (const prop of props) {
      const child = tile.realityRoot.createTile(prop);
      children.push(child);
      if (undefined !== parentRange && !child.isEmpty)
        parentRange.extendRange(child.contentRange);
    }

    return children;
  }

  public async getChildrenProps(parent: RealityTile): Promise<RealityTileParams[]> {
    const props: RealityModelTileProps[] = [];
    const thisId = parent.contentId;
    const prefix = thisId.length ? `${thisId}_` : "";
    const findResult = await this.findTileInJson(this.tree.tilesetJson, thisId, "", undefined, true);
    if (undefined !== findResult && Array.isArray(findResult.json.children)) {
      for (let i = 0; i < findResult.json.children.length; i++) {
        const childId = prefix + i;
        const foundChild = await this.findTileInJson(this.tree.tilesetJson, childId, "", undefined, true);
        if (undefined !== foundChild)
          props.push(new RealityModelTileProps(foundChild.json, parent, foundChild.id, foundChild.transformToRoot));
      }
    }
    return props;
  }

  public async requestTileContent(tile: Tile, isCanceled: () => boolean): Promise<TileRequest.Response> {
    const foundChild = await this.findTileInJson(this.tree.tilesetJson, tile.contentId, "");
    if (undefined === foundChild || isCanceled())
      return undefined;

    return this.tree.client.getTileContent(getUrl(foundChild.json.content));
  }

  private addUrlPrefix(subTree: any, prefix: string) {
    if (undefined === subTree)
      return;

    if (undefined !== subTree.content && undefined !== subTree.content.url)
      subTree.content.url = prefix + subTree.content.url;

    if (undefined !== subTree.children)
      for (const child of subTree.children)
        this.addUrlPrefix(child, prefix);
  }

  private async findTileInJson(tilesetJson: any, id: string, parentId: string, transformToRoot?: Transform, isRoot: boolean = false): Promise<FindChildResult | undefined> {
    if (!isRoot && tilesetJson.transform) {   // Child tiles may have their own transform.
      const thisTransform = RealityModelTileUtils.transformFromJson(tilesetJson.transform);
      transformToRoot = transformToRoot ? transformToRoot.multiplyTransformTransform(thisTransform) : thisTransform;
    }

    if (id.length === 0)
      return new FindChildResult(id, tilesetJson, transformToRoot);    // Root.

    const separatorIndex = id.indexOf("_");
    const childId = (separatorIndex < 0) ? id : id.substring(0, separatorIndex);
    const childIndex = parseInt(childId, 10);

    if (isNaN(childIndex) || tilesetJson === undefined || tilesetJson.children === undefined || childIndex >= tilesetJson.children.length) {
      assert(false, "scalable mesh child not found.");
      return undefined;
    }

    let foundChild = tilesetJson.children[childIndex];
    const thisParentId = parentId.length ? (`${parentId}_${childId}`) : childId;
    if (foundChild.transform) {
      const thisTransform = RealityModelTileUtils.transformFromJson(foundChild.transform);
      transformToRoot = transformToRoot ? transformToRoot.multiplyTransformTransform(thisTransform) : thisTransform;
    }

    if (separatorIndex >= 0) {
      return this.findTileInJson(foundChild, id.substring(separatorIndex + 1), thisParentId, transformToRoot);
    }

    const childUrl = getUrl(foundChild.content);
    if (undefined !== childUrl && childUrl.endsWith("json")) {    // A child may contain a subTree...
      const subTree = await this.tree.client.getTileJson(childUrl);
      const prefixIndex = childUrl.lastIndexOf("/");
      if (prefixIndex > 0)
        this.addUrlPrefix(subTree.root, childUrl.substring(0, prefixIndex + 1));
      foundChild = subTree.root;
      tilesetJson.children[childIndex] = subTree.root;
    }

    return new FindChildResult(thisParentId, foundChild, transformToRoot);
  }
}

/** @internal */
export type RealityModelSource = ViewState | DisplayStyleState;

/** @internal */
export class RealityModelTileTree extends RealityTileTree {
  public constructor(params: RealityTileTreeParams) {
    super(params);

    if (!this.isContentUnbounded && !this.rootTile.contentRange.isNull) {
      const worldContentRange = this.iModelTransform.multiplyRange(this.rootTile.contentRange);
      this.iModel.expandDisplayedExtents(worldContentRange);
    }
  }
}

/** @internal */
// eslint-disable-next-line no-redeclare
export namespace RealityModelTileTree {
  export interface ReferenceProps {
    url: string;
    iModel: IModelConnection;
    source: RealityModelSource;
    modelId?: Id64String;
    tilesetToDbTransform?: TransformProps;
    name?: string;
    classifiers?: SpatialClassifiers;
    requestAuthorization?: string;
  }

  export abstract class Reference extends TileTreeReference {
    public abstract get classifiers(): SpatialClassifiers | undefined;
  }

  export async function createRealityModelTileTree(url: string, iModel: IModelConnection, modelId: Id64String, tilesetToDb?: Transform): Promise<TileTree | undefined> {
    const props = await getTileTreeProps(url, tilesetToDb, iModel);
    const loader = new RealityModelTileLoader(props, new BatchedTileIdMap(iModel));
    const params = new RealityModelTileTreeParams(url, iModel, modelId, loader);

    return new RealityModelTileTree(params);
  }

  async function getAccessToken(): Promise<AccessToken | undefined> {
    if (!IModelApp.authorizationClient || !IModelApp.authorizationClient.hasSignedIn)
      return undefined; // Not signed in
    let accessToken: AccessToken;
    try {
      accessToken = await IModelApp.authorizationClient.getAccessToken();
    } catch (error) {
      return undefined;
    }
    return accessToken;
  }

  async function getTileTreeProps(url: string, tilesetToDbJson: any, iModel: IModelConnection): Promise<RealityModelTileTreeProps> {
    if (!url)
      throw new IModelError(BentleyStatus.ERROR, "Unable to read reality data");
    const accessToken = await getAccessToken();
    const tileClient = new RealityModelTileClient(url, accessToken, iModel.contextId);
    const json = await tileClient.getRootDocument(url);
    const ecefLocation = iModel.ecefLocation;
    let rootTransform = ecefLocation ? ecefLocation.getTransform().inverse()! : Transform.createIdentity();
    if (json.root.transform) {
      const realityToEcef = RealityModelTileUtils.transformFromJson(json.root.transform);
      rootTransform = rootTransform.multiplyTransformTransform(realityToEcef);
      if (undefined !== ecefLocation) {
        const carto = Cartographic.fromEcef(realityToEcef.getOrigin());
        const ypr = YawPitchRollAngles.createFromMatrix3d(rootTransform.matrix);
        // If the reality model is located in the same region and height and their is significant misalignment in their orientation,
        //  then align the cartesian systems as otherwise different origins
        // can result in a misalignment from the curvature of the earth. (EWR - large point cloud)
        if (undefined !== ypr && undefined !== carto && Math.abs(ypr.roll.degrees) > 1.0E-6 && carto.height < 300.0) {  // Don't test yaw- it may be present from eccentricity fix.
          ypr.pitch.setRadians(0);
          ypr.roll.setRadians(0);
          ypr.toMatrix3d(rootTransform.matrix);
          rootTransform.origin.z = carto.height;
        }
      }
    } else if (json.root.boundingVolume && Array.isArray(json.root.boundingVolume.region))
      rootTransform = Transform.createTranslationXYZ(0, 0, (json.root.boundingVolume.region[4] + json.root.boundingVolume.region[5]) / 2.0).multiplyTransformTransform(rootTransform);

    if (undefined !== tilesetToDbJson)
      rootTransform = Transform.fromJSON(tilesetToDbJson).multiplyTransformTransform(rootTransform);

    return new RealityModelTileTreeProps(json, tileClient, rootTransform);
  }
}

/** Supplies a reality data [[TileTree]] from a URL. May be associated with a persistent [[GeometricModelState]], or attached at run-time via a [[ContextRealityModelState]].
 * @internal
 */
export class RealityTreeReference extends RealityModelTileTree.Reference {
  private readonly _name: string;
  private readonly _url: string;
  private readonly _classifier?: SpatialClassifierTileTreeReference;
  private _mapDrapeTree?: TileTreeReference;
  private _transform?: Transform;
  private _modelId: Id64String;
  private _iModel: IModelConnection;
  public get modelId() { return this._modelId; }

  public constructor(props: RealityModelTileTree.ReferenceProps) {
    super();
    let transform;
    if (undefined !== props.tilesetToDbTransform) {
      const tf = Transform.fromJSON(props.tilesetToDbTransform);
      if (!tf.isIdentity)
        transform = tf;
    }

    this._name = undefined !== props.name ? props.name : "";
    this._url = props.url;
    this._transform = transform;
    this._iModel = props.iModel;
    this._modelId = props.modelId ? props.modelId : this._iModel.transientIds.next;

    if (undefined !== props.classifiers)
      this._classifier = createClassifierTileTreeReference(props.classifiers, this, props.iModel, props.source);
  }
  public get treeOwner(): TileTreeOwner {
    const treeId = { url: this._url, transform: this._transform, modelId: this._modelId };
    return realityTreeSupplier.getOwner(treeId, this._iModel);
  }

  public get castsShadows() {
    return true;
  }

  protected get _isLoadingComplete(): boolean {
    return !this._mapDrapeTree || this._mapDrapeTree.isLoadingComplete;
  }

  public get classifiers(): SpatialClassifiers | undefined { return undefined !== this._classifier ? this._classifier.classifiers : undefined; }

  public addToScene(context: SceneContext): void {
    // NB: The classifier must be added first, so we can find it when adding our own tiles.
    if (undefined !== this._classifier)
      this._classifier.addToScene(context);

    const tree = this.treeOwner.tileTree as RealityTileTree;
    if (undefined !== tree && (tree.loader as RealityModelTileLoader).doDrapeBackgroundMap) {
      // NB: We save this off strictly so that discloseTileTrees() can find it...better option?
      this._mapDrapeTree = context.viewport.displayStyle.backgroundDrapeMap;
      context.addBackgroundDrapedModel(this, undefined);
    }

    super.addToScene(context);
  }

  public discloseTileTrees(trees: TileTreeSet): void {
    super.discloseTileTrees(trees);

    if (undefined !== this._classifier)
      this._classifier.discloseTileTrees(trees);

    if (undefined !== this._mapDrapeTree)
      this._mapDrapeTree.discloseTileTrees(trees);
  }

  public async getToolTip(hit: HitDetail): Promise<HTMLElement | string | undefined> {
    const tree = this.treeOwner.tileTree;
    if (undefined === tree || hit.iModel !== tree.iModel)
      return undefined;

    const map = (tree as RealityTileTree).loader.getBatchIdMap();
    const batch = undefined !== map ? map.getBatchProperties(hit.sourceId) : undefined;
    if (undefined === batch && tree.modelId !== hit.sourceId)
      return undefined;

    const strings = [];
    strings.push(this._name ? this._name : this._url);
    if (batch !== undefined)
      for (const key of Object.keys(batch))
        strings.push(`${key}: ${batch[key]}`);

    const div = document.createElement("div");
    div.innerHTML = strings.join("<br>");
    return div;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    super.collectStatistics(stats);

    const tree = undefined !== this._classifier ? this._classifier.treeOwner.tileTree : undefined;
    if (undefined !== tree)
      tree.collectStatistics(stats);
  }
}

interface RDSClientProps {
  projectId: string;
  tilesId: string;
}

/**
 * ###TODO temporarily here for testing, needs to be moved to the clients repo
 * @internal
 * This class encapsulates access to a reality data wether it be from local access, http or RDS
 * The url provided at the creation is parsed to determine if this is a RDS (ProjectWise Context Share) reference.
 * If not then it is considered local (ex: C:\temp\TileRoot.json) or plain http access (http://someserver.com/data/TileRoot.json)
 * There is a one to one relationship between a reality data and the instances of present class.
 */
export class RealityModelTileClient {
  public readonly rdsProps?: RDSClientProps; // For reality data stored on PW Context Share only. If undefined then Reality Data is not on Context Share.
  private _realityData?: RealityData;        // For reality data stored on PW Context Share only.
  private _baseUrl: string = "";             // For use by all Reality Data. For RD stored on PW Context Share, represents the portion from the root of the Azure Blob Container
  private readonly _token?: AccessToken;     // Only used for accessing PW Context Share.
  private static _client = new RealityDataClient();  // WSG Client for accessing Reality Data on PW Context Share
  private _requestAuthorization?: string;      // Request authorization for non PW ContextShare requests.

  // ###TODO we should be able to pass the projectId / tileId directly, instead of parsing the url
  // But if the present can also be used by non PW Context Share stored data then the url is required and token is not. Possibly two classes inheriting from common interface.
  constructor(url: string, accessToken?: AccessToken, contextId?: string) {
    this.rdsProps = this.parseUrl(url); // Note that returned is undefined if url does not refer to a PW Context Share reality data.
    if (contextId && this.rdsProps)
      this.rdsProps.projectId = contextId;
    this._token = accessToken;
  }

  private async initializeRDSRealityData(requestContext: AuthorizedFrontendRequestContext): Promise<void> {
    requestContext.enter();

    if (undefined !== this.rdsProps) {
      if (!this._realityData) {
        // TODO Temporary fix ... the root document may not be located at the root. We need to set the base URL even for RD stored on server
        // though this base URL is only the part relative to the root of the blob containing the data.
        this._realityData = await RealityModelTileClient._client.getRealityData(requestContext, this.rdsProps.projectId, this.rdsProps.tilesId);
        requestContext.enter();

        // A reality data that has not root document set should not be considered.
        const rootDocument: string = (this._realityData.rootDocument ? this._realityData.rootDocument : "");
        this.setBaseUrl(rootDocument);
      }
    }
  }

  // ###TODO temporary means of extracting the tileId and projectId from the given url
  // This is the method that determines if the url refers to Reality Data stored on PW Context Share. If not then undefined is returned.
  // ###TODO This method should be replaced by realityDataServiceClient.getRealityDataIdFromUrl()
  // We obtain the projectId from URL but it should be used normally. The iModel context should be used everywhere: verify!
  private parseUrl(url: string): RDSClientProps | undefined {
    // We have URLs with incorrect slashes that must be supported. The ~2F are WSG encoded slashes and may prevent parsing out the reality data id.
    const workUrl: string = url.replace(/~2F/g, "/").replace(/\\/g, "/");
    const urlParts = workUrl.split("/").map((entry: string) => entry.replace(/%2D/g, "-"));
    const tilesId = urlParts.find(Guid.isGuid);
    let props: RDSClientProps | undefined;
    if (undefined !== tilesId) {
      let projectId = urlParts.find((val: string) => val.includes("--"))!.split("--")[1];

      // ###TODO This is a temporary workaround for accessing the reality meshes with a test account
      // The hardcoded project id corresponds to a project setup to yield access to the test account which is linked to the tileId
      if (projectId === "Server")
        projectId = "fb1696c8-c074-4c76-a539-a5546e048cc6";

      props = { projectId, tilesId };
    }
    return props;
  }

  // This is to set the root url fromt the provided root document path.
  // If the root document is stored on PW Context Share then the root document property of the Reality Data is provided,
  // otherwise the full path to root document is given.
  // The base URL contains the base URL from which tile relative path are constructed.
  // The tile's path root will need to be reinserted for child tiles to return a 200
  private setBaseUrl(url: string): void {
    const urlParts = url.split("/");
    urlParts.pop();
    if (urlParts.length === 0)
      this._baseUrl = "";
    else
      this._baseUrl = `${urlParts.join("/")}/`;
  }

  private async _doRequest(url: string, responseType: string, requestContext: FrontendRequestContext): Promise<any> {
    const options: RequestOptions = {
      method: "GET",
      responseType,
      headers: this._requestAuthorization ? { authorization: this._requestAuthorization } : undefined,
    };
    const data = await request(requestContext, url, options);
    return data.body;
  }

  // ### TODO. Technically the url should not be required. If the reality data encapsulated is stored on PW Context Share then
  // the relative path to root document is extracted from the reality data. Otherwise the full url to root document should have been provided at
  // the construction of the instance.
  public async getRootDocument(url: string): Promise<any> {
    if (this.rdsProps && this._token) {
      const authRequestContext = new AuthorizedFrontendRequestContext(this._token);
      authRequestContext.enter();

      await this.initializeRDSRealityData(authRequestContext); // Only needed for PW Context Share data ... return immediately otherwise.
      authRequestContext.enter();

      return this._realityData!.getRootDocumentJson(authRequestContext);
    }

    // The following is only if the reality data is not stored on PW Context Share.
    const cesiumSuffix = "$CesiumIonAsset=";
    const cesiumIndex = url.indexOf(cesiumSuffix);
    if (cesiumIndex >= 0) {
      const cesiumIonString = url.slice(cesiumIndex + cesiumSuffix.length);
      const cesiumParts = cesiumIonString.split(":");
      const assetId = parseInt(cesiumParts[0], 10);
      const tokenAndUrl = await getCesiumAccessTokenAndEndpointUrl(assetId, cesiumParts[1]);
      if (tokenAndUrl.url && tokenAndUrl.token) {
        url = tokenAndUrl.url;
        this._requestAuthorization = `Bearer ${tokenAndUrl.token}`;
      }
    }

    // The following is only if the reality data is not stored on PW Context Share.
    this.setBaseUrl(url);
    return this._doRequest(url, "json", new FrontendRequestContext(""));
  }

  /**
   * Returns the tile content. The path to the tile is relative to the base url of present reality data whatever the type.
   */
  public async getTileContent(url: string): Promise<any> {
    const useRds = this.rdsProps !== undefined && this._token !== undefined;
    const requestContext = useRds ? new AuthorizedFrontendRequestContext(this._token!) : new FrontendRequestContext("");
    if (useRds) {
      await this.initializeRDSRealityData(requestContext as AuthorizedFrontendRequestContext); // Only needed for PW Context Share data ... return immediately otherwise.
      requestContext.enter();
    }

    const tileUrl = this._baseUrl + url;
    if (useRds)
      return this._realityData!.getTileContent(requestContext as AuthorizedFrontendRequestContext, tileUrl);

    return this._doRequest(tileUrl, "arraybuffer", requestContext);
  }

  /**
   * Returns the tile content in json format. The path to the tile is relative to the base url of present reality data whatever the type.
   */
  public async getTileJson(url: string): Promise<any> {
    const useRds = this.rdsProps !== undefined && this._token !== undefined;
    const requestContext = useRds ? new AuthorizedFrontendRequestContext(this._token!) : new FrontendRequestContext();
    requestContext.enter();

    if (this.rdsProps && this._token) {
      await this.initializeRDSRealityData(requestContext as AuthorizedFrontendRequestContext); // Only needed for PW Context Share data ... return immediately otherwise.
      requestContext.enter();
    }

    const tileUrl = this._baseUrl + url;

    if (undefined !== this.rdsProps && undefined !== this._token)
      return this._realityData!.getTileJson(requestContext as AuthorizedFrontendRequestContext, tileUrl);

    return this._doRequest(tileUrl, "json", requestContext);
  }
}
