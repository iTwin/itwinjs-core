/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway } from "@bentley/imodeljs-common";
import { ECPresentationGatewayDefinition } from "@bentley/ecpresentation-common";
import ECPresentationGateway from "./ECPresentationGateway";
import ECPresentationManager, { Props as ECPresentationManagerProps } from "./ECPresentationManager";

let manager: ECPresentationManager | undefined;

export default class ECPresentation {

  private constructor() { }

  public static initialize(props?: ECPresentationManagerProps): void {
    try {
      Gateway.registerImplementation(ECPresentationGatewayDefinition, ECPresentationGateway);
    } catch (_e) {
      // note: Gateway.registerImplementation throws when called more than once with the same
      // gateway. However, it doesn't provide any way to unregister a gateway so we end up
      // using the one registered first. At least we can avoid an exception...
    }
    manager = new ECPresentationManager(props);
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
