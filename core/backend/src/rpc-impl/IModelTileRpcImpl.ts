/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { Id64Set } from "@bentley/bentleyjs-core";
import {
  IModelTileRpcInterface,
  IModelToken,
  TileProps,
  TileId,
  TileTreeProps,
  RpcInterface,
  RpcManager,
} from "@bentley/imodeljs-common";

/** @hidden */
export class IModelTileRpcImpl extends RpcInterface implements IModelTileRpcInterface {
  public static register() { RpcManager.registerImpl(IModelTileRpcInterface, IModelTileRpcImpl); }

  public async getTileTreeProps(_iModelToken: IModelToken, _ids: Id64Set): Promise<TileTreeProps[]> {
    const props: TileTreeProps[] = [];
    return props;
  }

  public async getTileProps(_iModelToken: IModelToken, _ids: TileId[]): Promise<TileProps[]> {
    const props: TileProps[] = [];
    return props;
  }
}
