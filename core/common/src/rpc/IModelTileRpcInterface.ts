/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { AbandonedError, Id64Array, Id64String } from "@bentley/bentleyjs-core";
import { TransformProps } from "@bentley/geometry-core";
import { CloudStorageContainerDescriptor, CloudStorageContainerUrl } from "../CloudStorage";
import { CloudStorageTileCache } from "../CloudStorageTileCache";
import { IModelRpcProps } from "../IModel";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { IModelTileTreeProps, TileVersionInfo } from "../TileProps";
import { ContentFlags, TreeFlags } from "../tile/TileMetadata";

/** Wire format describing a request to produce graphics in [[TileFormat.IModelGraphics]] format for a single element.
 * @internal
 */
export interface ElementGraphicsRequestProps {
  /** Uniquely identifies this request among all requests for a given [[IModel]]. */
  readonly id: string;
  /** The element for which graphics are requested. */
  readonly elementId: Id64String;
  /** Log10 of the chord tolerance with which to stroke the element's geometry. e.g., for a chord tolerance of 0.01 (10^-2) meters, supply -2. */
  readonly toleranceLog10: number;
  /** The major version of the [[TileFormat.IModelGraphics]] format to use when producing the iMdl representation of the element's geometry. */
  readonly formatVersion: number;
  /** Optional flags. [[TreeFlags.UseProjectExtents]] has no effect. [[TreeFlags.EnforceDisplayPriority]] is not yet implemented. */
  readonly treeFlags?: TreeFlags;
  /** Optional flags. [[ContentFlags.ImprovedElision]] has no effect. */
  readonly contentFlags?: ContentFlags;
  /** Transform from element graphics to world coordinates. Defaults to identity. */
  readonly location?: TransformProps;
  /** If true, surface edges will be omitted from the graphics. */
  readonly omitEdges?: boolean;
  /** If true, the element's graphics will be clipped against the iModel's project extents. */
  readonly clipToProjectExtents?: boolean;
}

/** @public */
export abstract class IModelTileRpcInterface extends RpcInterface {
  public static getClient(): IModelTileRpcInterface { return RpcManager.getClientForInterface(IModelTileRpcInterface); }

  /** The immutable name of the interface. */
  public static readonly interfaceName = "IModelTileRpcInterface";

  /** The semantic version of the interface. */
  public static interfaceVersion = "2.3.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/

  /** @beta */
  public async getTileCacheContainerUrl(_tokenProps: IModelRpcProps, _id: CloudStorageContainerDescriptor): Promise<CloudStorageContainerUrl> {
    return this.forward(arguments);
  }

  /** Returns true if an external tile cache is configured on the backend.
   * @internal
   */
  public async isUsingExternalTileCache(): Promise<boolean> { // eslint-disable-line @bentley/prefer-get
    return this.forward(arguments);
  }

  /** @internal */
  public async requestTileTreeProps(_tokenProps: IModelRpcProps, _id: string): Promise<IModelTileTreeProps> { return this.forward(arguments); }

  /** @deprecated Use generateTileContent.
   * @internal
   */
  public async requestTileContent(iModelToken: IModelRpcProps, treeId: string, contentId: string, isCanceled?: () => boolean, guid?: string): Promise<Uint8Array> {
    const cached = await IModelTileRpcInterface.checkCache(iModelToken, treeId, contentId, guid);
    if (undefined === cached && undefined !== isCanceled && isCanceled())
      throw new AbandonedError();

    return cached || this.forward(arguments);
  }

  /** Ask the backend to generate content for the specified tile. This function, unlike the deprecated `requestTileContent`, does not check the cloud storage tile cache -
   * Use `CloudStorageTileCache.retrieve` for that.
   * @internal
   */
  public async generateTileContent(_rpcProps: IModelRpcProps, _treeId: string, _contentId: string, _guid: string | undefined): Promise<Uint8Array> {
    return this.forward(arguments);
  }

  /** @internal */
  public async queryVersionInfo(): Promise<TileVersionInfo> {
    return this.forward(arguments);
  }

  /** This is a temporary workaround for folks developing authoring applications, to be removed when proper support for such applications is introduced.
   * Given a set of model Ids, it purges any associated tile tree state on the back-end so that the next request for the tile tree or content will recreate that state.
   * Invoked after a modification is made to the model(s).
   * If no array of model Ids is supplied, it purges *all* tile trees, which can be quite inefficient.
   * @internal
   */
  public async purgeTileTrees(_tokenProps: IModelRpcProps, _modelIds: Id64Array | undefined): Promise<void> { return this.forward(arguments); }

  private static async checkCache(tokenProps: IModelRpcProps, treeId: string, contentId: string, guid: string | undefined): Promise<Uint8Array | undefined> {
    return CloudStorageTileCache.getCache().retrieve({ tokenProps, treeId, contentId, guid });
  }

  /** Requests graphics for a single element in [[TileFormat.IModel]] format.
   * @returns graphics in iMdl format, or `undefined` if the element's geometry produced no graphics or the request was canceled before completion.
   * @throws IModelError on bad request (nonexistent element, duplicate request Id, etc).
   * @internal
   */
  public async requestElementGraphics(_rpcProps: IModelRpcProps, _request: ElementGraphicsRequestProps): Promise<Uint8Array | undefined> {
    return this.forward(arguments);
  }
}
