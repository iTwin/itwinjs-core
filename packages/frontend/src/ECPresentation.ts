/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import ECPresentationManager from "./ECPresentationManager";
import SelectionManager from "./selection/SelectionManager";

let presentationManager: ECPresentationManager | undefined;
let selectionManager: SelectionManager | undefined;

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
   */
  public static initialize(): void {
    presentationManager = new ECPresentationManager();
    selectionManager = new SelectionManager();
  }

  /**
   * Terminates ECPresentation library frontend. This method should be called
   * before a call to [IModelApp.shutdown]($imodeljs-frontend)
   */
  public static terminate(): void {
    presentationManager = undefined;
    selectionManager = undefined;
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
}
