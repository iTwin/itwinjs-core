/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */
import { ContextRealityModelProps, CartographicRange } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { IModelApp } from "./IModelApp";
import { TileTreeModelState } from "./ModelState";
import { TileTree, TileTreeState } from "./tile/TileTree";
import { RealityModelTileTree, RealityModelTileClient, RealityModelTileUtils } from "./tile/RealityModelTileTree";

export class ContextRealityModelState implements TileTreeModelState {
  protected _tilesetUrl: string;
  protected _name: string;
  protected _tileTreeState: TileTreeState;
  protected _iModel: IModelConnection;
  constructor(props: ContextRealityModelProps, iModel: IModelConnection) {
    this._name = props.name ? props.name : "";
    this._tilesetUrl = props.tilesetUrl;
    this._tileTreeState = new TileTreeState(iModel, true, "");
    this._iModel = iModel;
  }
  public get name() { return this._name; }
  public get url() { return this._tilesetUrl; }
  public get tileTree(): TileTree | undefined { return this._tileTreeState.tileTree; }
  public get loadStatus(): TileTree.LoadStatus { return this._tileTreeState.loadStatus; }
  public loadTileTree(_asClassifier?: boolean, _classifierExpansion?: number): TileTree.LoadStatus {
    const tileTreeState = this._tileTreeState;
    if (TileTree.LoadStatus.NotLoaded !== tileTreeState.loadStatus)
      return tileTreeState.loadStatus;

    tileTreeState.loadStatus = TileTree.LoadStatus.Loading;

    RealityModelTileTree.loadRealityModelTileTree(this._tilesetUrl, undefined, tileTreeState);
    return tileTreeState.loadStatus;
  }
  public async intersectsProjectExtents(): Promise<boolean> {
    if (undefined === this._iModel.ecefLocation || undefined === IModelApp.accessToken)
      return false;

    const client = new RealityModelTileClient(this._tilesetUrl, IModelApp.accessToken);
    const json = await client.getRootDocument(this._tilesetUrl);
    let tileTreeRange, tileTreeTransform;
    if (json === undefined ||
      undefined === json.root ||
      undefined === (tileTreeRange = RealityModelTileUtils.rangeFromBoundingVolume(json.root.boundingVolume)) ||
      undefined === (tileTreeTransform = RealityModelTileUtils.transformFromJson(json.root.transform)))
      return false;

    const treeCartographicRange = new CartographicRange(tileTreeRange, tileTreeTransform);
    const projectCartographicRange = new CartographicRange(this._iModel.projectExtents, this._iModel.ecefLocation.getTransform());

    return treeCartographicRange.intersectsRange(projectCartographicRange);
  }
  public matches(other: ContextRealityModelState) {
    return other.name === this.name && other.url === this.url;
  }
  public static findAvailableRealityModels(): ContextRealityModelProps[] {
    const availableRealityModels: ContextRealityModelProps[] = [];

    /* This is location to query all reality models available for this project.  They will be filtered spatially to only those
      that overlap the project extents later.... */

    availableRealityModels.push({ name: "Sample", tilesetUrl: "http://localhost:8080/TilesetWithDiscreteLOD/tileset.json" });
    /* Testing... should be quering RDS to find models.
    availableRealityModels.push({ name: "Clark Island", tilesetUrl: "http://localhost:8080/clarkIsland/74/TileRoot.json" });
    availableRealityModels.push({ name: "Philadelphia LoRes", tilesetUrl: "http://localhost:8080/PhiladelphiaLoResClassification/80/TileRoot.json" });
    availableRealityModels.push({ name: "Philadelphia HiRes", tilesetUrl: "http://localhost:8080/PhiladelphiaHiResClassification/80/TileRoot.json" });
    */

    return availableRealityModels;
  }
}
