/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { GatewayDefinition } from "../../Gateway";
import { GatewayConfiguration } from "../core/GatewayConfiguration";
import { GatewayElectronProtocol, interop } from "./GatewayElectronProtocol";

/** @module Gateway */

/** Initialization parameters for GatewayElectronConfiguration. */
export interface GatewayElectronParams {
  protocol?: typeof GatewayElectronProtocol;
}

/** Operating parameters for electron gateway. */
export abstract class GatewayElectronConfiguration extends GatewayConfiguration {
  public static get isElectron() { return interop !== null; }

  /** The protocol of the configuration. */
  public abstract protocol: GatewayElectronProtocol;

  /** Performs gateway configuration for the application. */
  public static initialize(params: GatewayElectronParams, gateways: GatewayDefinition[]): GatewayElectronConfiguration {
    const protocol = (params.protocol || GatewayElectronProtocol);

    const config = class extends GatewayElectronConfiguration {
      public gateways = () => gateways;
      public protocol: GatewayElectronProtocol = new protocol(this);
    };

    for (const gateway of gateways) {
      GatewayConfiguration.assign(gateway, () => config);
    }

    const instance = GatewayConfiguration.obtain(config);
    GatewayConfiguration.initializeGateways(instance);

    return instance;
  }
}
