/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { RpcManager } from "@bentley/imodeljs-common";
import { IModelHost } from "@bentley/imodeljs-backend";
import {
  ECPresentationRpcInterface,
  ECPresentationError, ECPresentationStatus,
} from "@bentley/ecpresentation-common";
import ECPresentationRpcImpl from "./ECPresentationRpcImpl";
import IBackendECPresentationManager, { Props } from "./IBackendECPresentationManager";
import MultiClientECPresentationManager from "./MultiClientECPresentationManager";
import { DisposeFunc } from "@bentley/bentleyjs-core";

/**
 * Static class used to statically set up ECPresentation library for the backend.
 * Basically what it does is:
 * - Register a RPC implementation
 * - Create a singleton [[ECPresentationManager]] instance
 * - Subscribe for [IModelHost.onBeforeShutdown]($imodeljs-backend) event and terminate
 *   the presentation manager when that happens.
 */
export default class ECPresentation {

  private static _manager: IBackendECPresentationManager | undefined;
  private static _shutdownListener: DisposeFunc | undefined;

  /* istanbul ignore next */
  private constructor() { }

  /**
   * Initializes ECPresentation library for the backend.
   *
   * Example:
   * ``` ts
   * [[include:Backend.Initialization.ECPresentation]]
   * ```
   *
   * **Important:** The method should be called after a call to [IModelHost.startup]($imodeljs-backend)
   *
   * @param props Optional properties for ECPresentationManager
   */
  public static initialize(props?: Props): void {
    try {
      RpcManager.registerImpl(ECPresentationRpcInterface, ECPresentationRpcImpl);
    } catch (_e) {
      // note: RpcManager.registerImpl throws when called more than once with the same
      // rpc interface. However, it doesn't provide any way to unregister a, interface so we end up
      // using the one registered first. At least we can avoid an exception...
    }
    ECPresentation._shutdownListener = IModelHost.onBeforeShutdown.addListener(ECPresentation.terminate);
    ECPresentation._manager = new MultiClientECPresentationManager(props);
  }

  /**
   * Terminates ECPresentation. Consumers don't need to call this as it's automatically
   * called on [IModelHost.onBeforeShutdown]($imodeljs-backend) event.
   */
  public static terminate(): void {
    if (ECPresentation._manager) {
      ECPresentation._manager.dispose();
      ECPresentation._manager = undefined;
    }
    if (ECPresentation._shutdownListener) {
      ECPresentation._shutdownListener();
      ECPresentation._shutdownListener = undefined;
    }
  }

  /**
   * Get the single static instance of [[ECPresentationManager]]
   */
  public static get manager(): IBackendECPresentationManager {
    if (!ECPresentation._manager)
      throw new ECPresentationError(ECPresentationStatus.NotInitialized, "ECPresentation must be first initialized by calling ECPresentation.initialize");
    return ECPresentation._manager;
  }

  /** @hidden */
  public static setManager(value: IBackendECPresentationManager) {
    if (ECPresentation._manager)
      ECPresentation._manager.dispose();
    ECPresentation._manager = value;
  }

}
