/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { AccessToken, BentleyError, BentleyStatus, GuidString, IModelStatus, Logger, RpcInterfaceStatus, StatusCategory, Tracing } from "@itwin/core-bentley";
import { CommonLoggerCategory } from "../../CommonLoggerCategory";
import { IModelRpcProps } from "../../IModel";
import { IModelError } from "../../IModelError";
import { RpcInterface } from "../../RpcInterface";
import { SessionProps } from "../../SessionProps";
import { RpcConfiguration } from "./RpcConfiguration";
import { RpcProtocolEvent, RpcRequestStatus } from "./RpcConstants";
import { RpcControlChannel, RpcNotFoundResponse, RpcPendingResponse } from "./RpcControl";
import { RpcMarshaling, RpcSerializedValue } from "./RpcMarshaling";
import { RpcOperation } from "./RpcOperation";
import { RpcManagedStatus, RpcProtocol, RpcProtocolVersion, RpcRequestFulfillment, SerializedRpcRequest } from "./RpcProtocol";
import { CURRENT_INVOCATION, RpcRegistry } from "./RpcRegistry";

/* eslint-disable @typescript-eslint/no-deprecated */

/** The properties of an RpcActivity.
 * @public
 * @extensions
 */
export interface RpcActivity extends SessionProps {
  /** Used for logging to correlate an Rpc activity between frontend and backend */
  readonly activityId: GuidString;

  /** access token for authorization  */
  readonly accessToken: AccessToken;

  /** the name of the current rpc method */
  readonly rpcMethod?: string;

  readonly user?: string;
}

/** Serialized format for sending the request across the RPC layer
 * @public
 */
export interface SerializedRpcActivity {
  id: string;
  applicationId: string;
  applicationVersion: string;
  sessionId: string;
  authorization: string;
  user?: string;
  csrfToken?: { headerName: string, headerValue: string };
}

/** @internal */
export type RpcActivityRun = (activity: RpcActivity, fn: () => Promise<any>) => Promise<any>;

/** An RPC operation invocation in response to a request.
 * @internal
 */
export class RpcInvocation {
  public static runActivity: RpcActivityRun = async (_activity, fn) => fn();
  private _threw: boolean = false;
  private _pending: boolean = false;
  private _notFound: boolean = false;
  private _noContent: boolean = false;
  private _timeIn: number = 0;
  private _timeOut: number = 0;

  /** The protocol for this invocation. */
  public readonly protocol: RpcProtocol;

  /** The received request. */
  public readonly request: SerializedRpcRequest;

  /** The operation of the request. */
  public readonly operation: RpcOperation = undefined as any;

  /** The implementation response. */
  public readonly result: Promise<any>;

  /** The fulfillment for this request. */
  public readonly fulfillment: Promise<RpcRequestFulfillment>;

  /** The status for this request. */
  public get status(): RpcRequestStatus {
    return this._threw ? RpcRequestStatus.Rejected :
      this._pending ? RpcRequestStatus.Pending :
        this._notFound ? RpcRequestStatus.NotFound :
          this._noContent ? RpcRequestStatus.NoContent :
            RpcRequestStatus.Resolved;
  }

  /** The elapsed time for this invocation. */
  public get elapsed(): number {
    return this._timeOut - this._timeIn;
  }

  /**
   * The invocation for the current RPC operation.
   * @note The return value of this function is only reliable in an RPC impl class member function where program control was received from the RpcInvocation constructor function.
   */
  public static current(rpcImpl: RpcInterface): RpcInvocation {
    return (rpcImpl as any)[CURRENT_INVOCATION];
  }

  /** Constructs an invocation. */
  public constructor(protocol: RpcProtocol, request: SerializedRpcRequest) {
    this._timeIn = new Date().getTime();
    this.protocol = protocol;
    this.request = request;

    try {
      try {
        this.operation = RpcOperation.lookup(this.request.operation.interfaceDefinition, this.request.operation.operationName);

        const backend = this.operation.interfaceVersion;
        const frontend = this.request.operation.interfaceVersion;
        if (!RpcInterface.isVersionCompatible(backend, frontend)) {
          throw new IModelError(RpcInterfaceStatus.IncompatibleVersion, `Backend version ${backend} does not match frontend version ${frontend} for RPC interface ${this.operation.operationName}.`);
        }
      } catch (error) {
        if (this.handleUnknownOperation(error)) {
          this.operation = RpcOperation.lookup(this.request.operation.interfaceDefinition, this.request.operation.operationName);
        } else {
          throw error;
        }
      }

      this.result = this.resolve();
    } catch (error) {
      this.result = this.reject(error);
    }

    this.fulfillment = this.result.then(async (value) => this._threw ? this.fulfillRejected(value) : this.fulfillResolved(value), async (reason) => this.fulfillRejected(reason));
  }

  private handleUnknownOperation(error: any): boolean {
    RpcControlChannel.ensureInitialized();
    return this.protocol.configuration.controlChannel.handleUnknownOperation(this, error);
  }

  public static sanitizeForLog(activity?: RpcActivity) {
    /* eslint-disable @typescript-eslint/naming-convention */
    return activity ? {
      ActivityId: activity.activityId, SessionId: activity.sessionId, ApplicationId: activity.applicationId, ApplicationVersion: activity.applicationVersion, rpcMethod: activity.rpcMethod,
    } : undefined;
    /* eslint-enable @typescript-eslint/naming-convention */
  }

  private async resolve(): Promise<any> {
    const request = this.request;
    const activity: RpcActivity = {
      activityId: request.id,
      applicationId: request.applicationId,
      applicationVersion: request.applicationVersion,
      sessionId: request.sessionId,
      user: request.user,
      accessToken: request.authorization,
      rpcMethod: request.operation.operationName,
    };

    try {
      this.protocol.events.raiseEvent(RpcProtocolEvent.RequestReceived, this);

      const parameters = request.parametersOverride || RpcMarshaling.deserialize(this.protocol, request.parameters);
      this.applyPolicies(parameters);
      const impl = RpcRegistry.instance.getImplForInterface(this.operation.interfaceDefinition);
      (impl as any)[CURRENT_INVOCATION] = this;
      const op = this.lookupOperationFunction(impl);

      return await RpcInvocation.runActivity(activity, async () => op.call(impl, ...parameters)
        .catch(async (error) => {
          // this catch block is intentionally placed inside `runActivity` to attach the right logging metadata and use the correct openTelemetry span.
          if (!(error instanceof RpcPendingResponse)) {
            Logger.logError(CommonLoggerCategory.RpcInterfaceBackend, "Error in RPC operation", { error: BentleyError.getErrorProps(error) });
            Tracing.recordException(error);
          }
          throw error;
        }));
    } catch (error: unknown) {
      return this.reject(error);
    }
  }

  private applyPolicies(parameters: any) {
    if (!parameters || !Array.isArray(parameters))
      return;

    for (let i = 0; i !== parameters.length; ++i) {
      const parameter = parameters[i];
      const isToken = typeof (parameter) === "object" && parameter !== null && parameter.hasOwnProperty("iModelId") && parameter.hasOwnProperty("iTwinId");
      if (isToken && this.protocol.checkToken && !this.operation.policy.allowTokenMismatch) {
        const inflated = this.protocol.inflateToken(parameter, this.request);
        parameters[i] = inflated;

        if (!RpcInvocation.compareTokens(parameter, inflated)) {
          if (RpcConfiguration.throwOnTokenMismatch) {
            throw new IModelError(BentleyStatus.ERROR, "IModelRpcProps mismatch detected for this request.");
          } else {
            Logger.logWarning(CommonLoggerCategory.RpcInterfaceBackend, "IModelRpcProps mismatch detected for this request.");
          }
        }
      }
    }
  }

  private static compareTokens(a: IModelRpcProps, b: IModelRpcProps): boolean {
    return a.key === b.key &&
      a.iTwinId === b.iTwinId &&
      a.iModelId === b.iModelId &&
      (undefined === a.changeset || (a.changeset.id === b.changeset?.id));
  }

  private async reject(error: any): Promise<any> {
    this._threw = true;
    return error;
  }

  private async fulfillResolved(value: any): Promise<RpcRequestFulfillment> {
    this._timeOut = new Date().getTime();
    this.protocol.events.raiseEvent(RpcProtocolEvent.BackendResponseCreated, this);
    const result = RpcMarshaling.serialize(this.protocol, value);
    return this.fulfill(result, value);
  }

  private async fulfillRejected(reason: any): Promise<RpcRequestFulfillment> {
    this._timeOut = new Date().getTime();
    if (!RpcConfiguration.developmentMode)
      reason.stack = undefined;

    const result = RpcMarshaling.serialize(this.protocol, reason);

    if (reason instanceof RpcPendingResponse) {
      this._pending = true;
      this._threw = false;
      result.objects = reason.message;
      this.protocol.events.raiseEvent(RpcProtocolEvent.BackendReportedPending, this);
    } else if (this.supportsNoContent() && reason?.errorNumber === IModelStatus.NoContent) {
      this._noContent = true;
      this._threw = false;
      this.protocol.events.raiseEvent(RpcProtocolEvent.BackendReportedNoContent, this);
    } else if (reason instanceof RpcNotFoundResponse) {
      this._notFound = true;
      this._threw = false;
      this.protocol.events.raiseEvent(RpcProtocolEvent.BackendReportedNotFound, this);
    } else {
      this._threw = true;
      this.protocol.events.raiseEvent(RpcProtocolEvent.BackendErrorOccurred, this);
    }

    return this.fulfill(result, reason);
  }

  private supportsNoContent() {
    if (!this.request.protocolVersion) {
      return false;
    }

    return RpcProtocol.protocolVersion >= RpcProtocolVersion.IntroducedNoContent && this.request.protocolVersion >= RpcProtocolVersion.IntroducedNoContent;
  }

  private supportsStatusCategory() {
    if (!this.request.protocolVersion) {
      return false;
    }

    if (!this.protocol.supportsStatusCategory) {
      return false;
    }

    return RpcProtocol.protocolVersion >= RpcProtocolVersion.IntroducedStatusCategory && this.request.protocolVersion >= RpcProtocolVersion.IntroducedStatusCategory;
  }

  private fulfill(result: RpcSerializedValue, rawResult: any): RpcRequestFulfillment {
    const fulfillment: RpcRequestFulfillment = {
      result,
      rawResult,
      status: this.protocol.getCode(this.status),
      id: this.request.id,
      interfaceName: (typeof (this.operation) === "undefined") ? "" : this.operation.interfaceDefinition.interfaceName,
      allowCompression: this.operation ? this.operation.policy.allowResponseCompression : true,
    };

    this.transformResponseStatus(fulfillment, rawResult);

    try {
      const impl = RpcRegistry.instance.getImplForInterface(this.operation.interfaceDefinition) as any;
      if (impl[CURRENT_INVOCATION] === this) {
        impl[CURRENT_INVOCATION] = undefined;
      }
    } catch { }

    return fulfillment;
  }

  private lookupOperationFunction(implementation: RpcInterface): (...args: any[]) => Promise<any> {
    const func = (implementation as any)[this.operation.operationName];
    if (!func || typeof (func) !== "function")
      throw new IModelError(BentleyStatus.ERROR, `RPC interface class "${implementation.constructor.name}" does not implement operation "${this.operation.operationName}".`);

    return func;
  }

  private transformResponseStatus(fulfillment: RpcRequestFulfillment, rawResult: any) {
    if (!this.supportsStatusCategory()) {
      return;
    }

    let managedStatus: "notFound" | "pending" | "noContent" | undefined;
    if (this._pending) {
      managedStatus = "pending";
    } else if (this._notFound) {
      managedStatus = "notFound";
    } else if (this._noContent) {
      managedStatus = "noContent";
    }

    if (managedStatus) {
      const responseValue = fulfillment.result.objects;
      const status: RpcManagedStatus = { iTwinRpcCoreResponse: true, managedStatus, responseValue };
      fulfillment.result.objects = JSON.stringify(status);
      status.responseValue = rawResult; // for ipc case
      fulfillment.rawResult = status;
    }

    if (rawResult instanceof Error) {
      fulfillment.status = StatusCategory.for(rawResult).code;
    }
  }
}
