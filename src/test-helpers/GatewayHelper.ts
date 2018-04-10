/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway, GatewayDefinition } from "@bentley/imodeljs-common";

// MUST be called to use ECPresentation gateway but AFTER ECPresentation.initialize(),
// otherwise does nothing
export const initializeGateway = (gateway: GatewayDefinition) => {
  // calling it more than once throws, so we have to wrap it with try/catch.
  try {
    Gateway.initialize(gateway);
  } catch (_e) {
  }
};
