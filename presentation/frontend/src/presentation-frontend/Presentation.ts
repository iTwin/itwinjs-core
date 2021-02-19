/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { isIDisposable } from "@bentley/bentleyjs-core";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { I18N } from "@bentley/imodeljs-i18n";
import { PresentationError, PresentationStatus } from "@bentley/presentation-common";
import { ConnectivityInformationProvider, IConnectivityInformationProvider } from "./ConnectivityInformationProvider";
import { FavoritePropertiesManager } from "./favorite-properties/FavoritePropertiesManager";
import { IModelAppFavoritePropertiesStorage, OfflineCachingFavoritePropertiesStorage } from "./favorite-properties/FavoritePropertiesStorage";
import { LocalizationHelper } from "./LocalizationHelper";
import { PresentationManager, PresentationManagerProps } from "./PresentationManager";
import { SelectionManager } from "./selection/SelectionManager";
import { SelectionScopesManager } from "./selection/SelectionScopesManager";

let connectivityInfoProvider: IConnectivityInformationProvider | undefined;
let i18n: I18N | undefined;
let presentationManager: PresentationManager | undefined;
let selectionManager: SelectionManager | undefined;
let favoritePropertiesManager: FavoritePropertiesManager | undefined;
const initializationHandlers: Array<() => Promise<(() => void) | void>> = [];
const terminationHandlers: Array<() => void> = [];

/**
 * Static class used to statically set up Presentation library for the frontend.
 * Basically what it does is:
 * - Create a singleton [[PresentationManager]] instance
 * - Create a singleton [[SelectionManager]] instance
 * - Create a singleton [[FavoritePropertiesManager]]] instance
 *
 * @public
 */
export class Presentation {

  /* istanbul ignore next */
  private constructor() { }

  /**
   * Initializes Presentation library for the frontend.
   *
   * Example:
   * ``` ts
   * [[include:Presentation.Frontend.Initialization]]
   * ```
   *
   * The method should be called after a call
   * to [IModelApp.startup]($imodeljs-frontend)
   *
   * @param props Optional properties to use when creating [[PresentationManager]]. If not provided
   * or provided with `activeLocale` not set, `Presentation.i18n.languageList()[0]` is used as active locale.
   */
  public static async initialize(props?: PresentationManagerProps): Promise<void> {
    if (!IModelApp.initialized) {
      throw new PresentationError(PresentationStatus.NotInitialized,
        "IModelApp.startup must be called before calling Presentation.initialize");
    }
    if (!i18n) {
      i18n = IModelApp.i18n;
    }
    if (!connectivityInfoProvider) {
      connectivityInfoProvider = new ConnectivityInformationProvider();
    }
    if (!presentationManager) {
      if (!props)
        props = {};
      if (!props.activeLocale) {
        const languages = Presentation.i18n.languageList();
        props.activeLocale = (languages.length ? languages[0] : undefined);
      }
      presentationManager = PresentationManager.create(props);
    }
    if (!selectionManager) {
      const scopesManager = new SelectionScopesManager({
        rpcRequestsHandler: presentationManager.rpcRequestsHandler,
        localeProvider: () => this.presentation.activeLocale,
      });
      selectionManager = new SelectionManager({
        scopes: scopesManager,
      });
    }
    if (!favoritePropertiesManager) {
      const storage = new OfflineCachingFavoritePropertiesStorage({
        connectivityInfo: connectivityInfoProvider,
        impl: new IModelAppFavoritePropertiesStorage(),
      });
      favoritePropertiesManager = new FavoritePropertiesManager({ storage });
    }
    // eslint-disable-next-line @typescript-eslint/unbound-method
    presentationManager.onNewiModelConnection = favoritePropertiesManager.initializeConnection.bind(favoritePropertiesManager);
    await LocalizationHelper.registerNamespaces();
    for (const handler of initializationHandlers) {
      const cleanup = await handler();
      if (cleanup)
        terminationHandlers.push(cleanup);
    }
  }

  /**
   * Terminates Presentation library frontend. This method should be called
   * before a call to [IModelApp.shutdown]($imodeljs-frontend)
   */
  public static terminate(): void {
    terminationHandlers.forEach((handler) => handler());
    terminationHandlers.length = 0;

    if (i18n)
      LocalizationHelper.unregisterNamespaces();

    if (connectivityInfoProvider && isIDisposable(connectivityInfoProvider))
      connectivityInfoProvider.dispose();
    connectivityInfoProvider = undefined;

    if (presentationManager)
      presentationManager.dispose();
    presentationManager = undefined;

    if (favoritePropertiesManager)
      favoritePropertiesManager.dispose();
    favoritePropertiesManager = undefined;

    selectionManager = undefined;
    i18n = undefined;
  }

  /**
   * Registers an additional handler which will be invoked during Presentation library frontend
   * initialization.
   *
   * @internal
   */
  public static registerInitializationHandler(handler: () => Promise<() => void>): void {
    initializationHandlers.push(handler);
  }

  /** The singleton [[PresentationManager]] */
  public static get presentation(): PresentationManager {
    if (!presentationManager)
      throw new Error("Presentation must be first initialized by calling Presentation.initialize");
    return presentationManager;
  }

  /** @internal */
  public static setPresentationManager(value: PresentationManager) {
    if (presentationManager)
      presentationManager.dispose();
    presentationManager = value;
  }

  /** The singleton [[SelectionManager]] */
  public static get selection(): SelectionManager {
    if (!selectionManager)
      throw new Error("Presentation must be first initialized by calling Presentation.initialize");
    return selectionManager;
  }

  /** @internal */
  public static setSelectionManager(value: SelectionManager) {
    selectionManager = value;
  }

  /**
   * The singleton [[FavoritePropertiesManager]]
   * @beta
   */
  public static get favoriteProperties(): FavoritePropertiesManager {
    if (!favoritePropertiesManager)
      throw new Error("Favorite Properties must be first initialized by calling Presentation.initialize");
    return favoritePropertiesManager;
  }

  /** @internal */
  public static setFavoritePropertiesManager(value: FavoritePropertiesManager) {
    if (favoritePropertiesManager)
      favoritePropertiesManager.dispose();
    favoritePropertiesManager = value;
  }

  /**
   * The localization manager used by Presentation frontend. Returns the result of `IModelApp.i18n`.
   */
  public static get i18n(): I18N {
    if (!i18n)
      throw new Error("Presentation must be first initialized by calling Presentation.initialize");
    return i18n;
  }

  /** @internal */
  public static setI18nManager(value: I18N) {
    i18n = value;
  }

  /** Provides information about current connection status. */
  public static get connectivity(): IConnectivityInformationProvider {
    if (!connectivityInfoProvider)
      throw new Error("Presentation must be first initialized by calling Presentation.initialize");
    return connectivityInfoProvider;
  }

  /** @internal */
  public static setConnectivityInformationProvider(value: IConnectivityInformationProvider) {
    if (connectivityInfoProvider && isIDisposable(connectivityInfoProvider))
      connectivityInfoProvider.dispose();
    connectivityInfoProvider = value;
  }
}
