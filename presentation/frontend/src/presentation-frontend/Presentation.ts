/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { IModelApp } from "@itwin/core-frontend";
import { Localization } from "@itwin/core-common";
import { PresentationError, PresentationStatus } from "@itwin/presentation-common";
import { FavoritePropertiesManager, FavoritePropertiesManagerProps } from "./favorite-properties/FavoritePropertiesManager";
import { createFavoritePropertiesStorage, DefaultFavoritePropertiesStorageTypes } from "./favorite-properties/FavoritePropertiesStorage";
import { LocalizationHelper } from "./LocalizationHelper";
import { PresentationManager, PresentationManagerProps } from "./PresentationManager";
import { SelectionManager, SelectionManagerProps } from "./selection/SelectionManager";
import { SelectionScopesManager } from "./selection/SelectionScopesManager";

let localization: Localization | undefined;
let presentationManager: PresentationManager | undefined;
let selectionManager: SelectionManager | undefined;
let favoritePropertiesManager: FavoritePropertiesManager | undefined;
const initializationHandlers: Array<() => Promise<(() => void) | void>> = [];
const terminationHandlers: Array<() => void> = [];

/**
 * Props for initializing [[Presentation]].
 * @public
 */
export interface PresentationProps {
  /** Props for [[PresentationManager]]. */
  presentation?: PresentationManagerProps;

  /** Props for [[SelectionManager]]. */
  selection?: SelectionManagerProps;

  /** Props for [[FavoritePropertiesManager]]. */
  favorites?: FavoritePropertiesManagerProps;
}

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
   * The method should be called after a call to [IModelApp.startup]($core-frontend).
   */
  public static async initialize(props?: PresentationProps): Promise<void> {
    if (!IModelApp.initialized) {
      throw new PresentationError(PresentationStatus.NotInitialized,
        "IModelApp.startup must be called before calling Presentation.initialize");
    }
    if (!localization) {
      localization = IModelApp.localization;
    }
    if (!presentationManager) {
      const managerProps = props?.presentation ?? {};
      if (!managerProps.activeLocale) {
        const languages = Presentation.localization.getLanguageList();
        managerProps.activeLocale = (languages.length ? languages[0] : undefined);
      }
      presentationManager = PresentationManager.create(managerProps);
    }
    if (!selectionManager) {
      selectionManager = new SelectionManager(props?.selection ?? {
        scopes: new SelectionScopesManager({
          rpcRequestsHandler: presentationManager.rpcRequestsHandler,
          localeProvider: () => this.presentation.activeLocale,
        }),
      });
    }
    if (!favoritePropertiesManager) {
      favoritePropertiesManager = new FavoritePropertiesManager({
        storage: props?.favorites ? props.favorites.storage : createFavoritePropertiesStorage(DefaultFavoritePropertiesStorageTypes.Noop),
      });
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
   * before a call to [IModelApp.shutdown]($core-frontend)
   */
  public static terminate(): void {
    terminationHandlers.forEach((handler) => handler());
    terminationHandlers.length = 0;

    if (localization)
      LocalizationHelper.unregisterNamespaces();

    if (presentationManager)
      presentationManager.dispose();
    presentationManager = undefined;

    if (favoritePropertiesManager)
      favoritePropertiesManager.dispose();
    favoritePropertiesManager = undefined;

    selectionManager = undefined;
    localization = undefined;
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
   * @public
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
  public static get localization(): Localization {
    if (!localization)
      throw new Error("Presentation must be first initialized by calling Presentation.initialize");
    return localization;
  }

  /** @internal */
  public static setLocalization(value: Localization) {
    localization = value;
  }
}
