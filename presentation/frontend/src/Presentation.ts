/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { I18N } from "@bentley/imodeljs-i18n";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { PresentationError, PresentationStatus } from "@bentley/presentation-common";
import PresentationManager, { Props as PresentationManagerProps } from "./PresentationManager";
import SelectionManager from "./selection/SelectionManager";

let presentationManager: PresentationManager | undefined;
let selectionManager: SelectionManager | undefined;
let i18n: I18N | undefined;

/**
 * Static class used to statically set up Presentation library for the frontend.
 * Basically what it does is:
 * - Create a singleton [[PresentationManager]] instance
 * - Create a singleton [[SelectionManager]] instance
 */
export default class Presentation {

  /* istanbul ignore next */
  private constructor() { }

  /**
   * Initializes Presentation library for the frontend.
   *
   * Example:
   * ``` ts
   * [[include:Frontend.Initialization.Presentation]]
   * ```
   *
   * The method should be called after a call
   * to [IModelApp.startup]($imodeljs-frontend)
   *
   * @param props Optional properties to use when creating [[PresentationManager]]. If not provided
   * or provided with `activeLocale` not set, `Presentation.i18n.languageList()[0]` is used as active locale.
   */
  public static initialize(props?: PresentationManagerProps): void {
    if (!IModelApp.initialized) {
      throw new PresentationError(PresentationStatus.NotInitialized,
        "IModelApp.startup must be called before calling Presentation.initialize");
    }
    if (!i18n) {
      i18n = IModelApp.i18n;
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
      selectionManager = new SelectionManager();
    }
  }

  /**
   * Terminates Presentation library frontend. This method should be called
   * before a call to [IModelApp.shutdown]($imodeljs-frontend)
   */
  public static terminate(): void {
    if (presentationManager)
      presentationManager.dispose();
    presentationManager = undefined;
    selectionManager = undefined;
    i18n = undefined;
  }

  /**
   * Get the singleton [[PresentationManager]]
   */
  public static get presentation(): PresentationManager {
    if (!presentationManager)
      throw new Error("Presentation must be first initialized by calling Presentation.initialize");
    return presentationManager;
  }

  /** @hidden */
  public static set presentation(value: PresentationManager) {
    if (presentationManager)
      presentationManager.dispose();
    presentationManager = value;
  }

  /**
   * Get the singleton [[SelectionManager]]
   */
  public static get selection(): SelectionManager {
    if (!selectionManager)
      throw new Error("Presentation must be first initialized by calling Presentation.initialize");
    return selectionManager;
  }

  /** @hidden */
  public static set selection(value: SelectionManager) {
    selectionManager = value;
  }

  /**
   * Get localization manager used by Presentation frontend.
   * Returns the result of `IModelApp.i18n`.
   */
  public static get i18n(): I18N {
    if (!i18n)
      throw new Error("Presentation must be first initialized by calling Presentation.initialize");
    return i18n;
  }

  /** @hidden */
  public static set i18n(value: I18N) {
    i18n = value;
  }
}
