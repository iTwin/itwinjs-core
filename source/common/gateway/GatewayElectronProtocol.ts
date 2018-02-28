/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway, GatewayDefinition } from "../Gateway";
import { GatewayProtocol } from "./GatewayProtocol";
import { GatewayConfiguration } from "./GatewayConfiguration";
import { IModelError } from "../IModelError";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";

/** IPC within an Electron application. */
export class GatewayElectronProtocol extends GatewayProtocol {
  private static id: number = 0;
  private static channel: string = "bentley.imodeljs.marshalling";
  private static _interop: any;

  public static get interop() {
    if (typeof (global) !== "undefined" && global && global.process && (global.process as any).type) {
      if (!GatewayElectronProtocol._interop) {
        // tslint:disable-next-line:no-eval
        GatewayElectronProtocol._interop = eval("require")("electron");
      }

      return GatewayElectronProtocol._interop;
    }

    return null;
  }

  /** Associates the gateways for the protocol with unique names. */
  protected gatewayRegistry: Map<string, GatewayDefinition> = new Map();

  /** Returns the registered backend implementation for a gateway operation. */
  public lookupGatewayImplementation(gatewayName: string): Gateway {
    const gateway = this.gatewayRegistry.get(gatewayName) as GatewayDefinition;
    return Gateway.getImplementationForGateway(gateway);
  }

  /** Returns deserialized gateway operation request parameters. */
  public deserializeOperationRequestParameters(request: string): any[] {
    return this.deserializeOperationValue(request);
  }

  /** Returns a serialized gateway operation result. */
  public serializeOperationResult(gatewayName: string, result: any): string {
    return this.serializeOperationValue(gatewayName, result);
  }

  /** Obtains the implementation result for a gateway operation. */
  public obtainGatewayImplementationResult<T>(gateway: GatewayDefinition, operation: string, ...parameters: any[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      try {
        const id = ++GatewayElectronProtocol.id;
        GatewayElectronProtocol.interop.ipcRenderer.once(GatewayElectronProtocol.channel + id, (evt: any, arg: string) => {
          evt;
          GatewayProtocol.recordOperationResponse();
          resolve(this.deserializeOperationResult(arg));
        });
        GatewayElectronProtocol.interop.ipcRenderer.send(GatewayElectronProtocol.channel, id, gateway.name, operation, this.serializeParametersForOperationRequest(gateway.name, ...parameters));
      } catch (e) {
        GatewayProtocol.recordOperationResponse();
        reject(e);
      }
    });
  }

  public handleMessagesInMainProcess() {
    GatewayElectronProtocol.interop.ipcMain.on(GatewayElectronProtocol.channel, async (evt: any, requestId: number, gatewayName: string, operation: string, body: string) => {
      const operationParameters = this.deserializeOperationRequestParameters(body);
      const operationResult = await this.lookupGatewayImplementation(gatewayName).invoke(operation, ...operationParameters);
      const operationResponse = this.serializeOperationResult(gatewayName, operationResult);

      evt.sender.send(GatewayElectronProtocol.channel + requestId, operationResponse);
    });
  }

  /** Returns a string serialization of the parameters for a gateway operation request. */
  protected serializeParametersForOperationRequest(gatewayName: string, ...parameters: any[]): string {
    return this.serializeOperationValue(gatewayName, Array.from(parameters));
  }

  /** Returns a deserialized gateway operation result. */
  protected deserializeOperationResult(response: string): any {
    return this.deserializeOperationValue(response);
  }

  /** Constructs an electron protocol. */
  constructor(configuration: GatewayConfiguration) {
    super(configuration);
    this.registerGateways();
  }

  /** Returns a name for a gateway that is unique within the scope of the protocol. */
  protected obtainGatewayName<T extends Gateway>(gateway: GatewayDefinition<T>): string {
    return gateway.name;
  }

  /** Registers the gateways for this protocol. */
  protected registerGateways() {
    this.configuration.gateways().forEach((gateway) => {
      const name = this.obtainGatewayName(gateway);
      if (this.gatewayRegistry.has(name))
        throw new IModelError(BentleyStatus.ERROR, `Gateway "${name}" is already registered within this protocol.`);

      this.gatewayRegistry.set(name, gateway);
    });
  }
}

/** Operating parameters for electron gateway. */
export abstract class GatewayElectronConfiguration extends GatewayConfiguration {
  public static get isElectron() { return GatewayElectronProtocol.interop !== null; }

  /** The protocol of the configuration. */
  public abstract protocol: GatewayElectronProtocol;

  /** Performs gateway configuration for the application. */
  public static initialize(params: { protocol?: typeof GatewayElectronProtocol }, gateways: GatewayDefinition[]) {
    const protocol = (params.protocol || GatewayElectronProtocol);

    const config = class extends GatewayElectronConfiguration {
      public gateways = () => gateways;
      public protocol: GatewayElectronProtocol = new protocol(this);
    };

    for (const gateway of gateways)
      Gateway.setConfiguration(gateway, () => config);

    const instance = GatewayConfiguration.getInstance(config);
    instance.initializeGateways();

    if (GatewayElectronProtocol.interop.ipcMain)
      instance.protocol.handleMessagesInMainProcess();

    return instance;
  }
}
