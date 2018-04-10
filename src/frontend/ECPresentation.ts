/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import ECPresentationManager from "./ECPresentationManager";

let manager: ECPresentationManager | undefined;

export default class ECPresentation {

  private constructor() { }

  public static initialize(): void {
    manager = new ECPresentationManager();
  }

  public static terminate(): void {
    manager = undefined;
  }

  public static get manager(): ECPresentationManager {
    if (!manager)
      throw new Error("ECPresentation must be first initialized by calling ECPresentation.initialize");
    return manager;
  }

  /** @hidden */
  public static set manager(value: ECPresentationManager) {
    manager = value;
  }

}
