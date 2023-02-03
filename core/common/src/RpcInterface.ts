/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import * as semver from "semver";
import { RpcConfiguration, RpcConfigurationSupplier } from "./rpc/core/RpcConfiguration";
import { CURRENT_REQUEST } from "./rpc/core/RpcRegistry";
import { aggregateLoad, RpcRequest } from "./rpc/core/RpcRequest";
import { RpcRoutingToken } from "./rpc/core/RpcRoutingToken";
import { InterceptedRpcRequest, IpcSession } from "./ipc/IpcSession";
import { RpcSerializedValue } from "./rpc/core/RpcMarshaling";
import { RpcManagedStatus } from "./rpc/core/RpcProtocol";
import { BentleyStatus, IModelError, NoContentError } from "./IModelError";
import { RpcRequestEvent, RpcRequestStatus } from "./rpc/core/RpcConstants";
import { BeDuration } from "@itwin/core-bentley";
import { RpcNotFoundResponse } from "./rpc/core/RpcControl";

/* eslint-disable deprecation/deprecation */

/** @internal */
export interface RpcInterfaceDefinition<T extends RpcInterface = RpcInterface> { prototype: T, interfaceName: string, interfaceVersion: string }

/** @internal */
export type RpcInterfaceImplementation<T extends RpcInterface = RpcInterface> = new () => T;

/** An RPC interface is a set of operations exposed by a service that a client can call, using configurable protocols,
 * in a platform-independent way. TheRpcInterface class is the base class for RPC interface definitions and implementations.
 * @public
 */
export abstract class RpcInterface {
  /** Determines whether the backend version of an RPC interface is compatible (according to semantic versioning) with the frontend version of the interface. */
  public static isVersionCompatible(backend: string, frontend: string): boolean {
    const difference = semver.diff(backend, frontend);
    if (semver.prerelease(backend) || semver.prerelease(frontend)) {
      return difference === null;
    } else if (semver.major(backend) === 0 || semver.major(frontend) === 0) {
      return difference === null || (difference === "patch" && semver.patch(frontend) < semver.patch(backend));
    } else {
      return difference === null || difference === "patch" || (difference === "minor" && semver.minor(frontend) < semver.minor(backend));
    }
  }

  /** The configuration for the RPC interface.
   * @internal
   */
  public readonly configuration: RpcConfiguration;

  /** @internal */
  public readonly routing: RpcRoutingToken;

  /** @internal */
  public constructor(routing: RpcRoutingToken = RpcRoutingToken.default) {
    this.routing = routing;
    this.configuration = RpcConfiguration.supply(this);
  }

  /** Obtains the implementation result for an RPC operation. */
  public async forward<T = any>(parameters: IArguments): Promise<T> {
    const parametersCompat = (arguments.length === 1 && typeof (parameters) === "object") ? parameters : arguments;
    const parametersArray = Array.isArray(parametersCompat) ? parametersCompat : Array.prototype.slice.call(parametersCompat);
    const operationName = parametersArray.pop();

    const session = IpcSession.active;
    if (session) {
      return intercept(session, this, operationName, parametersArray);
    } else {
      const request = new (this.configuration.protocol.requestType as any)(this, operationName, parametersArray) as RpcRequest;
      request.submit(); // eslint-disable-line @typescript-eslint/no-floating-promises
      (this as any)[CURRENT_REQUEST] = request;
      return request.response;
    }
  }

  /** @internal */
  public configurationSupplier: RpcConfigurationSupplier | undefined;
}

RpcInterface.prototype.configurationSupplier = undefined;

class InterceptedRequest extends RpcRequest {
  protected override async load(): Promise<RpcSerializedValue> { throw new Error(); }
  protected override async send(): Promise<number> { throw new Error(); }
  protected override setHeader(_name: string, _value: string): void { throw new Error(); }
}

async function intercept(session: IpcSession, client: RpcInterface, operation: string, parameters: any[]) {
  const request = new InterceptedRequest(client, operation, []);
  (client as any)[CURRENT_REQUEST] = request;

  const context = await client.configuration.protocol.serialize(request);
  request.parameters = parameters;

  const info: InterceptedRpcRequest = {
    definition: {
      interfaceName: context.operation.interfaceDefinition,
      interfaceVersion: context.operation.interfaceVersion,
    },
    operation,
    parameters,
    context: {
      applicationId: context.applicationId,
      applicationVersion: context.applicationVersion,
      id: context.id,
      sessionId: context.sessionId,
      protocolVersion: (context.protocolVersion || 0).toString(),
    },
  };

  const dispatch = async () => {
    aggregateLoad.lastRequest = new Date().getTime();

    const response = await session.handleRpc(info);

    aggregateLoad.lastResponse = new Date().getTime();

    if (typeof (response) === "object" && response.hasOwnProperty("iTwinRpcCoreResponse") && response.hasOwnProperty("managedStatus")) {
      const status: RpcManagedStatus = response;

      if (status.managedStatus === "pending") {
        return handlePending(request, status, dispatch);
      } else if (status.managedStatus === "notFound") {
        return handleNotFound(request, status, dispatch);
      } else if (status.managedStatus === "noContent") {
        return handleNoContent();
      }
    } else {
      return response;
    }
  };

  return dispatch();
}

async function handlePending(request: InterceptedRequest, status: RpcManagedStatus, dispatch: () => Promise<any>) {
  request._status = RpcRequestStatus.Pending;
  request._extendedStatus = (status.responseValue as { message: string }).message;
  RpcRequest.events.raiseEvent(RpcRequestEvent.PendingUpdateReceived, request);

  const delay = request.operation.policy.retryInterval(request.client.configuration);

  await BeDuration.wait(delay);
  return dispatch();
}

async function handleNotFound(request: InterceptedRequest, status: RpcManagedStatus, dispatch: () => Promise<any>) {
  return new Promise((resolve, reject) => {
    let resubmitted = false;

    RpcRequest.notFoundHandlers.raiseEvent(request, status.responseValue as RpcNotFoundResponse, async () => {
      if (resubmitted) {
        throw new IModelError(BentleyStatus.ERROR, `Already resubmitted using this handler.`);
      }

      resubmitted = true;

      try {
        const response = await dispatch();
        resolve(response);
      } catch (err) {
        reject(err);
      }
    }, reject);
  });
}

async function handleNoContent() {
  throw new NoContentError();
}
