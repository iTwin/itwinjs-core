/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { DisposeFunc } from "@bentley/bentleyjs-core";
import { RpcManager } from "@bentley/imodeljs-common";
import { IModelHost } from "@bentley/imodeljs-backend";
import {
  PresentationRpcInterface,
  PresentationError, PresentationStatus,
} from "@bentley/presentation-common";
import PresentationRpcImpl from "./PresentationRpcImpl";
import PresentationManager, { Props as PresentationManagerProps } from "./PresentationManager";
import TemporaryStorage from "./TemporaryStorage";

/**
 * Properties that can be used to configure [[Presentation]] API
 */
export interface Props extends PresentationManagerProps {
  /**
   * Factory method for creating separate managers for each client
   * @hidden
   */
  clientManagerFactory?: (clientId: string, props: PresentationManagerProps) => PresentationManager;

  /**
   * How much time should an unused client manager be stored in memory
   * before it's disposed.
   */
  unusedClientLifetime?: number;
}

/**
 * Static class used to statically set up Presentation library for the backend.
 * Basically what it does is:
 * - Register a RPC implementation
 * - Create a singleton [[PresentationManager]] instance
 * - Subscribe for [IModelHost.onBeforeShutdown]($imodeljs-backend) event and terminate
 *   the presentation manager when that happens.
 */
export default class Presentation {

  private static _initProps: Props | undefined;
  private static _clientsStorage: TemporaryStorage<PresentationManager> | undefined;
  private static _shutdownListener: DisposeFunc | undefined;

  /* istanbul ignore next */
  private constructor() { }

  public static get initProps() { return this._initProps; }

  /**
   * Initializes Presentation library for the backend.
   *
   * Example:
   * ``` ts
   * [[include:Presentation.Backend.Initialization]]
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
    this._initProps = props || {};
    this._shutdownListener = IModelHost.onBeforeShutdown.addListener(Presentation.terminate);
    this._clientsStorage = new TemporaryStorage<PresentationManager>({
      factory: this.createClientManager,
      cleanupHandler: this.disposeClientManager,
      // cleanup unused managers every minute
      cleanupInterval: 60 * 1000,
      // by default, manager is disposed after 1 hour of being unused
      valueLifetime: (props && props.unusedClientLifetime) ? props.unusedClientLifetime : 60 * 60 * 1000,
    });
  }

  /**
   * Terminates Presentation. Consumers don't need to call this as it's automatically
   * called on [IModelHost.onBeforeShutdown]($imodeljs-backend) event.
   */
  public static terminate(): void {
    if (this._clientsStorage) {
      this._clientsStorage.dispose();
      this._clientsStorage = undefined;
    }
    if (this._shutdownListener) {
      this._shutdownListener();
      this._shutdownListener = undefined;
    }
    this._initProps = undefined;
  }

  private static createClientManager(clientId: string): PresentationManager {
    if (Presentation._initProps && Presentation._initProps.clientManagerFactory)
      return Presentation._initProps.clientManagerFactory(clientId, Presentation._initProps);
    return new PresentationManager(Presentation._initProps);
  }

  private static disposeClientManager(manager: PresentationManager) {
    manager.dispose();
  }

  /**
   * Get an instance of [[PresentationManager]] for specific client
   * @param clientId ID of the client requesting presentation data. If no
   *        ID is provided, the default [[PresentationManager]] is returned.
   */
  public static getManager(clientId?: string): PresentationManager {
    if (!Presentation._clientsStorage)
      throw new PresentationError(PresentationStatus.NotInitialized, "Presentation must be first initialized by calling Presentation.initialize");
    return Presentation._clientsStorage.getValue(clientId || "");
  }

}
