/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { BriefcaseDb, IModelHost, IpcHost } from "@itwin/core-backend";
import { DisposeFunc, Logger } from "@itwin/core-bentley";
import { RpcManager } from "@itwin/core-common";
import { PresentationError, PresentationRpcInterface, PresentationStatus } from "@itwin/presentation-common";
import { PresentationBackendLoggerCategory } from "./BackendLoggerCategory";
import { PresentationIpcHandler } from "./PresentationIpcHandler";
import { PresentationManager, PresentationManagerProps } from "./PresentationManager";
import { PresentationRpcImpl } from "./PresentationRpcImpl";
import { FactoryBasedTemporaryStorage } from "./TemporaryStorage";

/**
 * Base props for initializing the [[Presentation]] library.
 *
 * @public
 */
export interface PresentationPropsBase extends PresentationManagerProps {
  /**
   * Time in milliseconds after which the request will timeout.
   */
  requestTimeout?: number;

  /**
   * Should schemas preloading be enabled. If true, [[Presentation]] library listens
   * for `BriefcaseDb.onOpened` event and force pre-loads all ECSchemas.
   */
  enableSchemasPreload?: boolean;
}

/**
 * Props for initializing the [[Presentation]] library for using multiple [[PresentationManager]]
 * instances, one for each frontend.
 *
 * @public
 */
export interface MultiManagerPresentationProps extends PresentationPropsBase {
  /**
   * Factory method for creating separate managers for each client
   * @internal
   */
  clientManagerFactory?: (clientId: string, props: PresentationManagerProps) => PresentationManager;

  /**
   * How much time should an unused client manager be stored in memory
   * before it's disposed.
   */
  unusedClientLifetime?: number;
}

/**
 * Props for initializing the [[Presentation]] library with ability to use a single
 * [[PresentationManager]] instance for handling all requests.
 *
 * @public
 */
export interface SingleManagerPresentationProps extends PresentationPropsBase {
  /**
   * Specifies to use single manager for all clients.
   * @alpha
   */
  useSingleManager?: boolean;
}

/**
 * Properties that can be used to configure [[Presentation]] API
 * @public
 */
export type PresentationProps = MultiManagerPresentationProps | SingleManagerPresentationProps;

interface ClientStoreItem {
  manager: PresentationManager;
}

/**
 * Static class used to statically set up Presentation library for the backend.
 * Basically what it does is:
 * - Register a RPC implementation
 * - Create a singleton [[PresentationManager]] instance
 * - Subscribe for [IModelHost.onBeforeShutdown]($core-backend) event and terminate
 *   the presentation manager when that happens.
 *
 * @public
 */
export class Presentation {
  private static _initProps: PresentationProps | undefined;
  private static _clientsStorage: FactoryBasedTemporaryStorage<ClientStoreItem> | undefined;
  private static _disposeIpcHandler: DisposeFunc | undefined;
  private static _shutdownListener: DisposeFunc | undefined;
  private static _disposeIModelOpenedListener: DisposeFunc | undefined;
  private static _manager: PresentationManager | undefined;
  private static _rpcImpl: PresentationRpcImpl | undefined;

  /* istanbul ignore next */
  private constructor() {}

  /** Properties used to initialize the presentation framework */
  public static get initProps() {
    return this._initProps;
  }

  /**
   * Initializes Presentation library for the backend.
   *
   * See [Setting up iTwin.js Presentation library documentation page]($docs/presentation/setup/index.md#backend) for an example.
   *
   * **Important:** The method should be called after a call to [IModelHost.startup]($core-backend)
   *
   * @param props Optional properties for [[PresentationManager]]
   */
  public static initialize(props?: PresentationProps): void {
    this._initProps = props || {};
    this._shutdownListener = IModelHost.onBeforeShutdown.addListener(() => Presentation.terminate());

    this._rpcImpl = new PresentationRpcImpl({
      requestTimeout: this._initProps.requestTimeout,
    });
    RpcManager.registerImpl(PresentationRpcInterface, PresentationRpcImpl);
    RpcManager.supplyImplInstance(PresentationRpcInterface, this._rpcImpl);

    if (IpcHost.isValid) {
      this._disposeIpcHandler = PresentationIpcHandler.register();
    }

    if (isSingleManagerProps(this._initProps)) {
      this._manager = new PresentationManager(Presentation._initProps);
    } else {
      this._clientsStorage = new FactoryBasedTemporaryStorage<ClientStoreItem>({
        factory: this.createClientManager.bind(this),
        cleanupHandler: (_id, storeItem) => this.disposeClientManager(_id, storeItem),
        // cleanup unused managers every minute
        cleanupInterval: 60 * 1000,
        // by default, manager is disposed after 1 hour of being unused
        unusedValueLifetime: this._initProps.unusedClientLifetime ?? 60 * 60 * 1000,
        // add some logging
        onDisposedSingle: /* istanbul ignore next */ (id: string) =>
          Logger.logInfo(
            PresentationBackendLoggerCategory.PresentationManager,
            `Disposed PresentationManager instance with ID: ${id}. Total instances: ${this._clientsStorage!.values.length}.`,
          ),
        onDisposedAll: /* istanbul ignore next */ () =>
          Logger.logInfo(PresentationBackendLoggerCategory.PresentationManager, `Disposed all PresentationManager instances.`),
      });
    }

    if (this._initProps.enableSchemasPreload) {
      this._disposeIModelOpenedListener = BriefcaseDb.onOpened.addListener(this.onIModelOpened);
    }
  }

  /**
   * Terminates Presentation. Consumers don't need to call this as it's automatically
   * called on [IModelHost.onBeforeShutdown]($core-backend) event.
   */
  public static terminate(): void {
    if (this._clientsStorage) {
      this._clientsStorage.dispose();
      this._clientsStorage = undefined;
    }
    if (this._disposeIModelOpenedListener) {
      this._disposeIModelOpenedListener();
      this._disposeIModelOpenedListener = undefined;
    }
    if (this._shutdownListener) {
      this._shutdownListener();
      this._shutdownListener = undefined;
    }
    if (this._manager) {
      this._manager.dispose();
      this._manager = undefined;
    }
    RpcManager.unregisterImpl(PresentationRpcInterface);
    if (this._rpcImpl) {
      this._rpcImpl.dispose();
      this._rpcImpl = undefined;
    }
    if (this._disposeIpcHandler) {
      this._disposeIpcHandler();
    }
    this._initProps = undefined;
  }

  private static createClientManager(clientId: string, onManagerUsed: () => void): ClientStoreItem {
    const manager =
      Presentation._initProps && !isSingleManagerProps(Presentation._initProps) && Presentation._initProps.clientManagerFactory
        ? Presentation._initProps.clientManagerFactory(clientId, Presentation._initProps)
        : new PresentationManager({ ...Presentation._initProps, id: clientId });
    manager.setOnManagerUsedHandler(onManagerUsed);
    Logger.logInfo(
      PresentationBackendLoggerCategory.PresentationManager,
      `Created a PresentationManager instance with ID: ${clientId}. Total instances: ${this._clientsStorage!.values.length}.`,
    );
    return { manager };
  }

  private static disposeClientManager(_id: string, storeItem: ClientStoreItem) {
    storeItem.manager.dispose();
  }

  /**
   * Get an instance of [[PresentationManager]] for specific client
   * @param clientId ID of the client requesting presentation data. If no
   *        ID is provided, the default [[PresentationManager]] is returned.
   */
  public static getManager(clientId?: string): PresentationManager {
    if (this._initProps && isSingleManagerProps(this._initProps) && this._manager) {
      return this._manager;
    }
    if (this._clientsStorage) {
      return this._clientsStorage.getValue(clientId || "").manager;
    }

    throw new PresentationError(PresentationStatus.NotInitialized, "Presentation must be first initialized by calling Presentation.initialize");
  }

  /**
   * Get the time in milliseconds that backend should respond in .
   */
  public static getRequestTimeout(): number {
    if (this._rpcImpl === undefined) {
      throw new PresentationError(PresentationStatus.NotInitialized, "Presentation must be first initialized by calling Presentation.initialize");
    }
    return this._rpcImpl.requestTimeout;
  }

  private static onIModelOpened = (imodel: BriefcaseDb) => {
    const manager = this.getManager();
    const imodelAddon = manager.getNativePlatform().getImodelAddon(imodel);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    manager.getNativePlatform().forceLoadSchemas(imodelAddon);
  };
}

function isSingleManagerProps(props: PresentationProps): props is SingleManagerPresentationProps {
  return !!(props as SingleManagerPresentationProps).useSingleManager;
}
