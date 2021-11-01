/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { RpcInterface, RpcManager } from "@itwin/core-common";

/** Display Test App RPC interface. */
export class DtaRpcInterface extends RpcInterface {
  /** The immutable name of the interface. */
  public static readonly interfaceName = "SVTRpcInterface";

  /** The version of the interface. */
  public static interfaceVersion = "1.0.0";

  /** The types that can be marshaled by the interface. */
  public static types = () => [];

  public static getClient(): DtaRpcInterface { return RpcManager.getClientForInterface(DtaRpcInterface); }
  public async readExternalSavedViews(_filename: string): Promise<string> { return this.forward(arguments); }
  public async writeExternalSavedViews(_filename: string, _namedViews: string): Promise<void> { return this.forward(arguments); }
  public async writeExternalFile(_filename: string, _content: string): Promise<void> { return this.forward(arguments); }
}
