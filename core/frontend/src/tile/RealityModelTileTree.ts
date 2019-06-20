/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { IModelError, TileTreeProps, TileProps, ViewFlag, ViewFlags, RenderMode, Cartographic } from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import {
  assert,
  BentleyStatus,
  compareNumbers,
  compareStrings,
  compareStringsOrUndefined,
  Guid,
  Id64String,
} from "@bentley/bentleyjs-core";
import { Point3d, TransformProps, Range3dProps, Range3d, Transform, Vector3d, Matrix3d, XYZ } from "@bentley/geometry-core";
import { RealityDataServicesClient, AccessToken, getArrayBuffer, getJson, RealityData } from "@bentley/imodeljs-clients";
import { TileTree, TileLoader, BatchedTileIdMap } from "./TileTree";
import { Tile } from "./Tile";
import { TileRequest } from "./TileRequest";
import { IModelApp } from "../IModelApp";
import { AuthorizedFrontendRequestContext, FrontendRequestContext } from "../FrontendRequestContext";
import { HitDetail } from "../HitDetail";
import { createClassifierTileTreeReference, SpatialClassifiers } from "../SpatialClassification";
import { SceneContext } from "../ViewContext";
import { RenderMemory } from "../render/System";

function getUrl(content: any) {
  return content ? (content.url ? content.url : content.uri) : undefined;
}

interface RealityTreeId {
  url: string;
  transform?: Transform;
  modelId?: Id64String;
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

class RealityTreeSupplier implements TileTree.Supplier {
  public getOwner(treeId: RealityTreeId, iModel: IModelConnection): TileTree.Owner {
    return iModel.tiles.getTileTreeOwner(treeId, this);
  }

  public async createTileTree(treeId: RealityTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    const modelId = undefined !== treeId.modelId ? treeId.modelId : iModel.transientIds.next;
    return RealityModelTileTree.createRealityModelTileTree(treeId.url, iModel, modelId, treeId.transform);
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

    const l = lhs.transform!, r = rhs.transform!;
    cmp = compareOrigins(l.origin, r.origin);
    return 0 !== cmp ? cmp : compareMatrices(l.matrix, r.matrix);
  }
}

const realityTreeSupplier = new RealityTreeSupplier();

/** Supplies a reality data [[TileTree]] from a URL. May be associated with a persistent [[GeometricModelState]], or attached at run-time via a [[ContextRealityModelState]].  */
class RealityTreeReference extends TileTree.Reference {
  public readonly treeOwner: TileTree.Owner;
  private readonly _name: string;
  private readonly _url: string;
  private readonly _classifier?: TileTree.Reference;
  private _mapDrapeTree?: TileTree.Reference;

  public constructor(props: RealityModelTileTree.ReferenceProps) {
    super();
    let transform;
    if (undefined !== props.tilesetToDbTransform) {
      const tf = Transform.fromJSON(props.tilesetToDbTransform);
      if (!tf.isIdentity)
        transform = tf;
    }

    const treeId = { url: props.url, transform, modelId: props.modelId };
    this.treeOwner = realityTreeSupplier.getOwner(treeId, props.iModel);
    this._name = undefined !== props.name ? props.name : "";
    this._url = props.url;

    if (undefined !== props.classifiers)
      this._classifier = createClassifierTileTreeReference(props.classifiers, this, props.iModel);
  }

  public addToScene(context: SceneContext): void {
    // NB: The classifier must be added first, so we can find it when adding our own tiles.
    if (undefined !== this._classifier)
      this._classifier.addToScene(context);

    const tree = this.treeOwner.tileTree;
    if (undefined !== tree && (tree.loader as RealityModelTileLoader).doDrapeBackgroundMap) {
      // NB: We save this off strictly so that discloseTileTrees() can find it...better option?
      this._mapDrapeTree = context.viewport.displayStyle.backgroundMap;
      context.addBackgroundDrapedModel(tree);
    }

    super.addToScene(context);
  }

  public discloseTileTrees(trees: Set<TileTree>): void {
    super.discloseTileTrees(trees);

    if (undefined !== this._classifier)
      this._classifier.discloseTileTrees(trees);

    if (undefined !== this._mapDrapeTree)
      this._mapDrapeTree.discloseTileTrees(trees);
  }

  public getToolTip(hit: HitDetail): HTMLElement | string | undefined {
    const tree = this.treeOwner.tileTree;
    if (undefined === tree)
      return undefined;

    const map = tree.loader.getBatchIdMap();
    const batch = undefined !== map ? map.getBatchProperties(hit.sourceId) : undefined;
    if (undefined === batch && tree.modelId !== hit.sourceId)
      return undefined;

    const strings = [];
    strings.push(this._name ? this._name : this._url);
    if (batch !== undefined)
      for (const key of Object.keys(batch))
        strings.push(key + ": " + batch[key]);

    return strings.join("<br>");
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    super.collectStatistics(stats);

    const tree = undefined !== this._classifier ? this._classifier.treeOwner.tileTree : undefined;
    if (undefined !== tree)
      tree.collectStatistics(stats);
  }
}

/** @internal */
export function createRealityTileTreeReference(props: RealityModelTileTree.ReferenceProps): TileTree.Reference {
  return new RealityTreeReference(props);
}

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
    const minToleranceRatio = 1.0;   // Nominally the error on screen size of a tile.  Increasing generally increases performance (fewer draw calls) at expense of higher load times.
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
class RealityModelTileTreeProps implements TileTreeProps {
  private _featureMap = new Map<string, { id: Id64String, properties: any }>();
  public id: string = "";
  public rootTile: TileProps;
  public location: TransformProps;
  public tilesetJson: object;
  public yAxisUp: boolean = false;
  public doDrapeBackgroundMap: boolean = false;
  constructor(json: any, public client: RealityModelTileClient, tilesetTransform: Transform) {
    this.tilesetJson = json.root;
    this.rootTile = new RealityModelTileProps(json.root, "");
    this.location = tilesetTransform.toJSON();
    this.doDrapeBackgroundMap = (json.root && json.root.SMMasterHeader && SMTextureType.Streaming === json.root.SMMasterHeader.IsTextured);
    if (json.asset.gltfUpAxis === undefined || json.asset.gltfUpAxis === "y" || json.asset.gltfUpAxis === "Y")
      this.yAxisUp = true;
  }
  public getBatchId(properties: any, iModel: IModelConnection): Id64String | undefined {
    const keyString = JSON.stringify(properties);
    const found = this._featureMap.get(keyString);
    if (found)
      return found.id;

    const id = iModel.transientIds.next;
    this._featureMap.set(keyString, { id, properties });
    return id;
  }
}

/** @internal */
class RealityModelTileProps implements TileProps {
  public readonly contentId: string;
  public readonly range: Range3dProps;
  public readonly contentRange?: Range3dProps;
  public readonly maximumSize: number;
  public readonly isLeaf: boolean;
  public readonly transformToRoot?: TransformProps;
  public geometry?: string | ArrayBuffer;
  public hasContents: boolean;
  constructor(json: any, thisId: string, transformToRoot?: Transform) {
    this.contentId = thisId;
    this.range = RealityModelTileUtils.rangeFromBoundingVolume(json.boundingVolume)!;
    this.isLeaf = !Array.isArray(json.children) || 0 === json.children.length;
    this.hasContents = undefined !== getUrl(json.content);
    this.transformToRoot = transformToRoot;
    if (this.hasContents) {
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

/** @internal */
class RealityModelTileLoader extends TileLoader {
  private readonly _tree: RealityModelTileTreeProps;
  private readonly _batchedIdMap?: BatchedTileIdMap;

  public constructor(tree: RealityModelTileTreeProps, batchedIdMap?: BatchedTileIdMap) {
    super();
    this._tree = tree;
    this._batchedIdMap = batchedIdMap;
  }

  public get doDrapeBackgroundMap(): boolean { return this._tree.doDrapeBackgroundMap; }

  public get maxDepth(): number { return 32; }  // Can be removed when element tile selector is working.
  public get priority(): Tile.LoadPriority { return Tile.LoadPriority.Context; }
  public tileRequiresLoading(params: Tile.Params): boolean { return 0.0 !== params.maximumSize; }
  protected static _viewFlagOverrides = new ViewFlag.Overrides(ViewFlags.fromJSON({ renderMode: RenderMode.SmoothShade }));
  public get viewFlagOverrides() { return RealityModelTileLoader._viewFlagOverrides; }
  public getBatchIdMap(): BatchedTileIdMap | undefined { return this._batchedIdMap; }

  public async getChildrenProps(parent: Tile): Promise<TileProps[]> {
    const props: RealityModelTileProps[] = [];
    const thisId = parent.contentId;
    const prefix = thisId.length ? thisId + "_" : "";
    const findResult = await this.findTileInJson(this._tree.tilesetJson, thisId, "", undefined, true);
    if (undefined !== findResult && Array.isArray(findResult.json.children)) {
      for (let i = 0; i < findResult.json.children.length; i++) {
        const childId = prefix + i;
        const foundChild = await this.findTileInJson(this._tree.tilesetJson, childId, "", undefined, true);
        if (undefined !== foundChild)
          props.push(new RealityModelTileProps(foundChild.json, foundChild.id, foundChild.transformToRoot));
      }
    }
    return props;
  }

  public async requestTileContent(tile: Tile): Promise<TileRequest.Response> {
    const foundChild = await this.findTileInJson(this._tree.tilesetJson, tile.contentId, "");
    if (undefined === foundChild)
      return undefined;

    return this._tree.client.getTileContent(getUrl(foundChild.json.content));
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
    const thisParentId = parentId.length ? (parentId + "_" + childId) : childId;
    if (foundChild.transform) {
      const thisTransform = RealityModelTileUtils.transformFromJson(foundChild.transform);
      transformToRoot = transformToRoot ? transformToRoot.multiplyTransformTransform(thisTransform) : thisTransform;
    }

    if (separatorIndex >= 0) {
      return this.findTileInJson(foundChild, id.substring(separatorIndex + 1), thisParentId, transformToRoot);
    }

    const childUrl = getUrl(foundChild.content);
    if (undefined !== childUrl && childUrl.endsWith("json")) {    // A child may contain a subTree...
      const subTree = await this._tree.client.getTileJson(childUrl);
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
export namespace RealityModelTileTree {
  export interface ReferenceProps {
    url: string;
    iModel: IModelConnection;
    modelId?: Id64String;
    tilesetToDbTransform?: TransformProps;
    name?: string;
    classifiers?: SpatialClassifiers;
  }

  export async function createRealityModelTileTree(url: string, iModel: IModelConnection, modelId: Id64String, tilesetToDb?: Transform): Promise<TileTree | undefined> {
    const props = await getTileTreeProps(url, tilesetToDb, iModel);
    const loader = new RealityModelTileLoader(props, new BatchedTileIdMap(iModel));
    const params = TileTree.paramsFromJSON(props, iModel, true, loader, modelId);
    return new TileTree(params);
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
    const tileClient = new RealityModelTileClient(url, accessToken);
    const json = await tileClient.getRootDocument(url);
    const ecefLocation = iModel.ecefLocation;
    let rootTransform = ecefLocation ? ecefLocation.getTransform().inverse()! : Transform.createIdentity();
    if (json.root.transform)
      rootTransform = rootTransform.multiplyTransformTransform(RealityModelTileUtils.transformFromJson(json.root.transform));
    else if (json.root.boundingVolume && Array.isArray(json.root.boundingVolume.region))
      rootTransform = Transform.createTranslationXYZ(0, 0, (json.root.boundingVolume.region[4] + json.root.boundingVolume.region[5]) / 2.0).multiplyTransformTransform(rootTransform);

    if (undefined !== tilesetToDbJson)
      rootTransform = Transform.fromJSON(tilesetToDbJson).multiplyTransformTransform(rootTransform);

    return new RealityModelTileTreeProps(json, tileClient, rootTransform);
  }
}

interface RDSClientProps {
  projectId: string;
  tilesId: string;
}

/**
 * ###TODO temporarly here for testing, needs to be moved to the clients repo
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
  private static _client = new RealityDataServicesClient();  // WSG Client for accessing Reality Data on PW Context Share

  // ###TODO we should be able to pass the projectId / tileId directly, instead of parsing the url
  // But if the present can also be used by non PW Context Share stored data then the url is required and token is not. Possibly two classes inheriting from common interface.
  constructor(url: string, accessToken?: AccessToken) {
    this.rdsProps = this.parseUrl(url); // Note that returned is undefined if url does not refer to a PW Context Share reality data.
    this._token = accessToken;
  }

  private async initializeRDSRealityData(requestContext: AuthorizedFrontendRequestContext): Promise<void> {
    requestContext.enter();

    if (undefined !== this.rdsProps) {
      if (!this._realityData) {
        // TODO Temporary fix ... the root document may not be located at the root. We need to set the base URL even for RD stored on server
        // though this base URL is only the part relative to the root of the blob contining the data.
        this._realityData = await RealityModelTileClient._client.getRealityData(requestContext, this.rdsProps.projectId, this.rdsProps.tilesId);
        requestContext.enter();

        // A reality data that has not root document set should not be considered.
        const rootDocument: string = (this._realityData!.rootDocument ? this._realityData!.rootDocument as string : "");
        this.setBaseUrl(rootDocument);
      }
    }
  }

  // ###TODO temporary means of extracting the tileId and projectId from the given url
  // This is the method that determines if the url refers to Reality Data stored on PW Context Share. If not then undefined is returned.
  private parseUrl(url: string): RDSClientProps | undefined {
    const urlParts = url.split("/").map((entry: string) => entry.replace(/%2D/g, "-"));
    const tilesId = urlParts.find(Guid.isGuid);
    let props: RDSClientProps | undefined;
    if (undefined !== tilesId) {
      let projectId = urlParts.find((val: string) => val.includes("--"))!.split("--")[1];

      // ###TODO This is a temporary workaround for accessing the reality meshes with a test account
      // The hardcoded project id corresponds to a project setup to yied access to the test account which is linked to the tileId
      if (projectId === "Server")
        projectId = "fb1696c8-c074-4c76-a539-a5546e048cc6";

      props = { projectId, tilesId };
    }
    return props;
  }

  // This is to set the root url fromt he provided root document path.
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
      this._baseUrl = urlParts.join("/") + "/";
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
    this.setBaseUrl(url);
    const requestContext = new FrontendRequestContext();
    return getJson(requestContext, url);
  }

  /**
   * Returns the tile content. The path to the tile is relative to the base url of present reality data whatever the type.
   */
  public async getTileContent(url: string): Promise<any> {
    const requestContext = this._token ? new AuthorizedFrontendRequestContext(this._token) : new FrontendRequestContext();
    requestContext.enter();

    if (this.rdsProps && this._token) {
      await this.initializeRDSRealityData(requestContext as AuthorizedFrontendRequestContext); // Only needed for PW Context Share data ... return immediately otherwise.
      requestContext.enter();
    }

    let tileUrl: string = url;
    if (undefined !== this._baseUrl) {
      tileUrl = this._baseUrl + url;

      if (undefined !== this.rdsProps && undefined !== this._token)
        return this._realityData!.getTileContent(requestContext as AuthorizedFrontendRequestContext, tileUrl);

      return getArrayBuffer(requestContext, tileUrl);
    }
    throw new IModelError(BentleyStatus.ERROR, "Unable to determine reality data content url");
  }

  /**
   * Returns the tile content in json format. The path to the tile is relative to the base url of present reality data whatever the type.
   */
  public async getTileJson(url: string): Promise<any> {
    const requestContext = this._token ? new AuthorizedFrontendRequestContext(this._token) : new FrontendRequestContext();
    requestContext.enter();

    if (this.rdsProps && this._token) {
      await this.initializeRDSRealityData(requestContext as AuthorizedFrontendRequestContext); // Only needed for PW Context Share data ... return immediately otherwise.
      requestContext.enter();
    }

    let tileUrl: string = url;
    if (undefined !== this._baseUrl) {
      tileUrl = this._baseUrl + url;

      if (undefined !== this.rdsProps && undefined !== this._token)
        return this._realityData!.getTileJson(requestContext as AuthorizedFrontendRequestContext, tileUrl);

      return getJson(requestContext, tileUrl);
    }
    throw new IModelError(BentleyStatus.ERROR, "Unable to determine reality data json url");
  }
}
