/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { RpcManager } from "@bentley/imodeljs-common";
import { IModelHost } from "@bentley/imodeljs-backend";
import { ECPresentationRpcInterface } from "@bentley/ecpresentation-common";
import ECPresentationRpcImpl from "./ECPresentationRpcImpl";
import ECPresentationManager, { Props as ECPresentationManagerProps } from "./ECPresentationManager";
import { DisposeFunc } from "@bentley/bentleyjs-core";

export default class ECPresentation {

  private static _manager: ECPresentationManager | undefined;
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
   * @param [props] Optional properties for ECPresentationManager
   */
  public static initialize(props?: ECPresentationManagerProps): void {
    try {
      RpcManager.registerImpl(ECPresentationRpcInterface, ECPresentationRpcImpl);
    } catch (_e) {
      // note: RpcManager.registerImpl throws when called more than once with the same
      // rpc interface. However, it doesn't provide any way to unregister a, interface so we end up
      // using the one registered first. At least we can avoid an exception...
    }
    ECPresentation._shutdownListener = IModelHost.onBeforeShutdown.addListener(ECPresentation.terminate);
    ECPresentation._manager = new ECPresentationManager(props);
  }

  /**
   * Terminates ECPresentation. Should be called to clean up before shutting down.
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
   * Get the single static instance of ECPresentationManager
   */
  public static get manager(): ECPresentationManager {
    if (!ECPresentation._manager)
      throw new Error("ECPresentation must be first initialized by calling ECPresentation.initialize");
    return ECPresentation._manager;
  }

  /** @hidden */
  public static set manager(value: ECPresentationManager) {
    if (ECPresentation._manager)
      ECPresentation._manager.dispose();
    ECPresentation._manager = value;
  }

}
