/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelRpcProps, RpcInterface, RpcManager } from "@bentley/imodeljs-common";
import { SchemaKey, SchemaProps } from "@bentley/ecschema-metadata";

/***
 * Defines an RPC interface to get schema information from a given iModel context.
 * Method @see getSchemaNames will return the names of schemas that live in this iModel.
 * The actual schemas can be downloaded using @see getSchemaJSON to get the schema as JSON props.
 * @internal
 */
export abstract class ECSchemaRpcInterface extends RpcInterface {
  /** The version of the RPC Interface. */
  public static version = "1.0.0";

  public static readonly interfaceName = "ECSchemaRpcInterface";
  public static interfaceVersion = ECSchemaRpcInterface.version;

  /**
   * Returns the RPC client instance for the frontend.
   * @returns                 A client to communicate with the RPC Interface.
   */
  public static getClient(): ECSchemaRpcInterface {
    return RpcManager.getClientForInterface(ECSchemaRpcInterface);
  }

  /**
   * Returns an array of SchemaKey that exists in the current iModel context.
   * @param tokenProps        The iModelToken props that hold the information which iModel is used.
   * @returns                 An array of SchemaKey.
   */
  public async getSchemaKeys(_tokenProps: IModelRpcProps): Promise<SchemaKey[]> {
    return this.forward.apply(this, [arguments]) as Promise<SchemaKey[]>;
  }

  /**
   * Gets the schema JSON for the current iModel context and returns the schema as a string which the client can parse to SchemaProps.
   * @param tokenProps        The iModelToken props that hold the information which iModel is used.
   * @param schemaName        The name of the schema that shall be returned.
   * @returns                 The SchemaProps as a string.
   */
  public async getSchemaJSON(_tokenProps: IModelRpcProps, _schemaName: string): Promise<SchemaProps> {
    return this.forward.apply(this, [arguments]) as Promise<SchemaProps>;
  }

}
