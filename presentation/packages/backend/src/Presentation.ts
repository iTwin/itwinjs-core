/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { RpcManager } from "@bentley/imodeljs-common";
import { IModelHost } from "@bentley/imodeljs-backend";
import {
  PresentationRpcInterface,
  PresentationError, PresentationStatus,
} from "@bentley/presentation-common";
import PresentationRpcImpl from "./PresentationRpcImpl";
import IBackendPresentationManager, { Props } from "./IBackendPresentationManager";
import MultiClientPresentationManager from "./MultiClientPresentationManager";
import { DisposeFunc } from "@bentley/bentleyjs-core";

/**
 * Static class used to statically set up Presentation library for the backend.
 * Basically what it does is:
 * - Register a RPC implementation
 * - Create a singleton [[PresentationManager]] instance
 * - Subscribe for [IModelHost.onBeforeShutdown]($imodeljs-backend) event and terminate
 *   the presentation manager when that happens.
 */
export default class Presentation {

  private static _manager: IBackendPresentationManager | undefined;
  private static _shutdownListener: DisposeFunc | undefined;

  /* istanbul ignore next */
  private constructor() { }

  /**
   * Initializes Presentation library for the backend.
   *
   * Example:
   * ``` ts
   * [[include:Backend.Initialization.Presentation]]
   * ```
   *
   * **Important:** The method should be called after a call to [IModelHost.startup]($imodeljs-backend)
   *
   * @param props Optional properties for PresentationManager
   */
  public static initialize(props?: Props): void {
    try {
      RpcManager.registerImpl(PresentationRpcInterface, PresentationRpcImpl);
    } catch (_e) {
      // note: RpcManager.registerImpl throws when called more than once with the same
      // rpc interface. However, it doesn't provide any way to unregister a, interface so we end up
      // using the one registered first. At least we can avoid an exception...
    }
    Presentation._shutdownListener = IModelHost.onBeforeShutdown.addListener(Presentation.terminate);
    Presentation._manager = new MultiClientPresentationManager(props);
  }

  /**
   * Terminates Presentation. Consumers don't need to call this as it's automatically
   * called on [IModelHost.onBeforeShutdown]($imodeljs-backend) event.
   */
  public static terminate(): void {
    if (Presentation._manager) {
      Presentation._manager.dispose();
      Presentation._manager = undefined;
    }
    if (Presentation._shutdownListener) {
      Presentation._shutdownListener();
      Presentation._shutdownListener = undefined;
    }
  }

  /**
   * Get the single static instance of [[PresentationManager]]
   */
  public static get manager(): IBackendPresentationManager {
    if (!Presentation._manager)
      throw new PresentationError(PresentationStatus.NotInitialized, "Presentation must be first initialized by calling Presentation.initialize");
    return Presentation._manager;
  }

  /** @hidden */
  public static setManager(value: IBackendPresentationManager) {
    if (Presentation._manager)
      Presentation._manager.dispose();
    Presentation._manager = value;
  }

}
