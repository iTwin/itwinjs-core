/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { AccessToken } from "@bentley/imodeljs-clients";
import { Point3d } from "@bentley/geometry-core";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { IModel, IModelToken } from "../IModel";
import { AxisAlignedBox3d } from "../geometry/Primitives";
import { IModelNotFoundResponse } from "./IModelReadRpcInterface";
import { Id64 } from "@bentley/bentleyjs-core";
import { ElementProps } from "../ElementProps";

/**
 * The RPC interface for writing to an iModel.
 * All operations require read+write access.
 * This interface is not normally used directly. See IModelConnection for higher-level and more convenient API for accessing iModels from a frontend.
 */
export abstract class IModelWriteRpcInterface extends RpcInterface {
    /** The version of the interface. */
    public static version = "1.0.0";

    /** The types that can be marshaled by the interface. */
    public static types = () => [
        AccessToken,
        AxisAlignedBox3d,
        IModelToken,
        Point3d,
        IModelNotFoundResponse,
    ]

    /** Returns the IModelWriteRpcInterface client instance for the frontend. */
    public static getClient(): IModelWriteRpcInterface { return RpcManager.getClientForInterface(IModelWriteRpcInterface); }

    public openForWrite(_accessToken: AccessToken, _iModelToken: IModelToken): Promise<IModel> { return this.forward.apply(this, arguments); }
    public saveChanges(_iModelToken: IModelToken, _description?: string): Promise<void> { return this.forward.apply(this, arguments); }
    public updateProjectExtents(_iModelToken: IModelToken, _newExtents: AxisAlignedBox3d): Promise<void> { return this.forward.apply(this, arguments); }
    public saveThumbnail(_iModelToken: IModelToken, _val: Uint8Array): Promise<void> { return this.forward.apply(this, arguments); }
    /** @hidden */
    public insertElement(_iModelToken: IModelToken, _elementProps: ElementProps): Promise<Id64> { return this.forward.apply(this, arguments); }
    /** @hidden */
    public createAndInsertPhysicalPartition(_iModelToken: IModelToken, _modelName: string): Promise<Id64> { return this.forward.apply(this, arguments); }
    /** @hidden */
    public createAndInsertPhysicalModel(_iModelToken: IModelToken, _modeledElementId: Id64, _privateModel: boolean = false): Promise<Id64> { return this.forward.apply(this, arguments); }
    /** @hidden */
    public createAndInsertSpatialCategory(_iModelToken: IModelToken, _categoryName: string): Promise<Id64> { return this.forward.apply(this, arguments); }
}
