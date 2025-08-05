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
import { FavoritePropertiesManager, FavoritePropertiesManagerProps } from "./favorite-properties/FavoritePropertiesManager.js";
import { createFavoritePropertiesStorage, DefaultFavoritePropertiesStorageTypes } from "./favorite-properties/FavoritePropertiesStorage.js";
import { FrontendLocalizationHelper } from "./LocalizationHelper.js";
import { PresentationManager, PresentationManagerProps } from "./PresentationManager.js";
import { SelectionManager, SelectionManagerProps } from "./selection/SelectionManager.js";
import { SelectionScopesManager } from "./selection/SelectionScopesManager.js";
import { imodelInitializationHandlers } from "./IModelConnectionInitialization.js";
import { _presentation_manager_rpcRequestsHandler } from "./InternalSymbols.js";

let localization: Localization | undefined;
let presentationManager: PresentationManager | undefined;
let selectionManager: SelectionManager | undefined; // eslint-disable-line @typescript-eslint/no-deprecated
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

  /**
   * Props for [[SelectionManager]].
   *
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. The whole unified selection system in this package is deprecated in favor of the new
   * [@itwin/unified-selection](https://github.com/iTwin/presentation/blob/master/packages/unified-selection/README.md) package.
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  selection?: Partial<SelectionManagerProps>;

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
  /* c8 ignore next */
  private constructor() {}

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
      throw new PresentationError(PresentationStatus.NotInitialized, "IModelApp.startup must be called before calling Presentation.initialize");
    }
    if (!localization) {
      localization = IModelApp.localization;
    }
    if (!presentationManager) {
      const managerProps = props?.presentation ?? {};
      if (!managerProps.activeLocale) {
        const languages = Presentation.localization.getLanguageList();
        managerProps.activeLocale = languages.length ? languages[0] : undefined;
      }
      presentationManager = PresentationManager.create(managerProps);
    }
    if (!selectionManager) {
      /* eslint-disable @typescript-eslint/no-deprecated */
      selectionManager = new SelectionManager({
        ...props?.selection,
        scopes:
          props?.selection?.scopes ??
          new SelectionScopesManager({
            rpcRequestsHandler: presentationManager[_presentation_manager_rpcRequestsHandler],
            localeProvider: () => this.presentation.activeLocale,
          }),
      });
      /* eslint-enable @typescript-eslint/no-deprecated */
    }
    if (!favoritePropertiesManager) {
      favoritePropertiesManager = new FavoritePropertiesManager({
        storage: props?.favorites ? props.favorites.storage : createFavoritePropertiesStorage(DefaultFavoritePropertiesStorageTypes.Noop),
      });
    }

    await FrontendLocalizationHelper.registerNamespaces();
    for (const handler of initializationHandlers) {
      const cleanup = await handler();
      if (cleanup) {
        terminationHandlers.push(cleanup);
      }
    }
  }

  /**
   * Terminates Presentation library frontend. This method should be called
   * before a call to [IModelApp.shutdown]($core-frontend)
   */
  public static terminate(): void {
    terminationHandlers.forEach((handler) => handler());
    terminationHandlers.length = 0;

    imodelInitializationHandlers.clear();

    if (localization) {
      FrontendLocalizationHelper.unregisterNamespaces();
    }

    if (presentationManager) {
      presentationManager[Symbol.dispose]();
    }
    presentationManager = undefined;

    if (favoritePropertiesManager) {
      favoritePropertiesManager[Symbol.dispose]();
    }
    favoritePropertiesManager = undefined;

    if (selectionManager) {
      selectionManager[Symbol.dispose]();
    }
    selectionManager = undefined;
    localization = undefined;
  }

  /**
   * Registers an additional handler which will be invoked during Presentation library frontend
   * initialization.
   */
  public static registerInitializationHandler(handler: () => Promise<() => void>): void {
    initializationHandlers.push(handler);
  }

  /** The singleton [[PresentationManager]] */
  public static get presentation(): PresentationManager {
    if (!presentationManager) {
      throw new Error("Presentation must be first initialized by calling Presentation.initialize");
    }
    return presentationManager;
  }

  /**
   * The singleton [[SelectionManager]].
   *
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. The whole unified selection system in this package is deprecated in favor of the new
   * [@itwin/unified-selection](https://github.com/iTwin/presentation/blob/master/packages/unified-selection/README.md) package.
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public static get selection(): SelectionManager {
    if (!selectionManager) {
      throw new Error("Presentation must be first initialized by calling Presentation.initialize");
    }
    return selectionManager;
  }

  /**
   * The singleton [[FavoritePropertiesManager]]
   */
  public static get favoriteProperties(): FavoritePropertiesManager {
    if (!favoritePropertiesManager) {
      throw new Error("Favorite Properties must be first initialized by calling Presentation.initialize");
    }
    return favoritePropertiesManager;
  }

  /**
   * The localization manager used by Presentation frontend. Returns the result of `IModelApp.i18n`.
   */
  public static get localization(): Localization {
    if (!localization) {
      throw new Error("Presentation must be first initialized by calling Presentation.initialize");
    }
    return localization;
  }
}
