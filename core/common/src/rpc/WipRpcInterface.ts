/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import type { ChangedElements } from "../ChangedElements";
import type { IModelRpcProps } from "../IModel";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";

/** The purpose of this class is to house WIP RPC methods. For example:
 * - WIP methods where signatures or behavior is still changing
 * - Experimental methods that we may decide are a bad idea and never release
 * The idea is to house these WIP RPC methods away from other RpcInterfaces that have stated compatibility goals.
 * Once stable, the goal is to move methods out to their rightful home.
 * Apps/services should understand the *flux* implied by registering this RpcInterface and should be in control of both the client and server before even considering using it.
 * @internal
 */
export abstract class WipRpcInterface extends RpcInterface {
  /** Returns the IModelReadRpcInterface instance for the frontend. */
  public static getClient(): WipRpcInterface { return RpcManager.getClientForInterface(WipRpcInterface); }

  /** The immutable name of the interface. */
  public static readonly interfaceName = "WipRpcInterface";

  /** The semantic version of the interface.
   * @note The WipRpcInterface will never progress to 1.0 since it is never intended to be public.
   */
  public static interfaceVersion = "0.5.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ==========================================================================================*/
  public async placeholder(_iModelToken: IModelRpcProps): Promise<string> { return this.forward(arguments); } // here to test that WipRpcInterface is configured properly
  public async isChangeCacheAttached(_iModelToken: IModelRpcProps): Promise<boolean> { return this.forward(arguments); }
  public async attachChangeCache(_iModelToken: IModelRpcProps): Promise<void> { return this.forward(arguments); }
  public async getChangedElements(_iModelToken: IModelRpcProps, _startChangesetId: string, _endChangesetId: string): Promise<ChangedElements | undefined> { return this.forward(arguments); }
  public async isChangesetProcessed(_iModelToken: IModelRpcProps, _changesetId: string): Promise<boolean> { return this.forward(arguments); }
}
