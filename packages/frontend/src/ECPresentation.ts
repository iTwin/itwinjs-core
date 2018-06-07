/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { I18N } from "@bentley/imodeljs-i18n";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { ECPresentationError, ECPresentationStatus } from "@bentley/ecpresentation-common";
import ECPresentationManager, { Props as ECPresentationManagerProps } from "./ECPresentationManager";
import SelectionManager from "./selection/SelectionManager";

let presentationManager: ECPresentationManager | undefined;
let selectionManager: SelectionManager | undefined;
let i18n: I18N | undefined;

/**
 * Static class used to statically set up ECPresentation library for the frontend.
 * Basically what it does is:
 * - Create a singleton [[ECPresentationManager]] instance
 * - Create a singleton [[SelectionManager]] instance
 */
export default class ECPresentation {

  /* istanbul ignore next */
  private constructor() { }

  /**
   * Initializes ECPresentation library for the frontend.
   *
   * Example:
   * ``` ts
   * [[include:Frontend.Initialization.ECPresentation]]
   * ```
   *
   * The method should be called after a call
   * to [IModelApp.startup]($imodeljs-frontend)
   *
   * @param props Optional properties to use when creating [[ECPresentationManager]]. If not provided
   * or provided with `activeLocale` not set, `ECPresentation.i18n.languageList()[0]` is used as active locale.
   */
  public static initialize(props?: ECPresentationManagerProps): void {
    if (!IModelApp.initialized) {
      throw new ECPresentationError(ECPresentationStatus.NotInitialized,
        "IModelApp.startup must be called before calling ECPresentation.initialize");
    }
    if (!i18n) {
      i18n = IModelApp.i18n;
    }
    if (!presentationManager) {
      if (!props)
        props = {};
      if (!props.activeLocale) {
        const languages = ECPresentation.i18n.languageList();
        props.activeLocale = (languages.length ? languages[0] : undefined);
      }
      presentationManager = ECPresentationManager.create(props);
    }
    if (!selectionManager) {
      selectionManager = new SelectionManager();
    }
  }

  /**
   * Terminates ECPresentation library frontend. This method should be called
   * before a call to [IModelApp.shutdown]($imodeljs-frontend)
   */
  public static terminate(): void {
    presentationManager = undefined;
    selectionManager = undefined;
    i18n = undefined;
  }

  /**
   * Get the singleton [[ECPresentationManager]]
   */
  public static get presentation(): ECPresentationManager {
    if (!presentationManager)
      throw new Error("ECPresentation must be first initialized by calling ECPresentation.initialize");
    return presentationManager;
  }

  /** @hidden */
  public static set presentation(value: ECPresentationManager) {
    presentationManager = value;
  }

  /**
   * Get the singleton [[SelectionManager]]
   */
  public static get selection(): SelectionManager {
    if (!selectionManager)
      throw new Error("ECPresentation must be first initialized by calling ECPresentation.initialize");
    return selectionManager;
  }

  /** @hidden */
  public static set selection(value: SelectionManager) {
    selectionManager = value;
  }

  /**
   * Get localization manager used by ECPresentation frontend.
   * Returns the result of `IModelApp.i18n`.
   */
  public static get i18n(): I18N {
    if (!i18n)
      throw new Error("ECPresentation must be first initialized by calling ECPresentation.initialize");
    return i18n;
  }

  /** @hidden */
  public static set i18n(value: I18N) {
    i18n = value;
  }
}
