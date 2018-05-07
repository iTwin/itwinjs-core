/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import ECPresentationManager from "./ECPresentationManager";
import SelectionManager from "./selection/SelectionManager";

let presentationManager: ECPresentationManager | undefined;
let selectionManager: SelectionManager | undefined;

export default class ECPresentation {
  /* istanbul ignore next */
  private constructor() { }

  public static initialize(): void {
    presentationManager = new ECPresentationManager();
    selectionManager = new SelectionManager();
  }

  public static terminate(): void {
    presentationManager = undefined;
    selectionManager = undefined;
  }

  public static get presentation(): ECPresentationManager {
    if (!presentationManager)
      throw new Error("ECPresentation must be first initialized by calling ECPresentation.initialize");
    return presentationManager;
  }

  /** @hidden */
  public static set presentation(value: ECPresentationManager) {
    presentationManager = value;
  }

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
