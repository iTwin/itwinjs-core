/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Errors
 */

import { AuthStatus, BentleyError, BentleyStatus, ChangeSetStatus, GeoServiceStatus, HttpStatus, IModelHubStatus, IModelStatus, RepositoryStatus, RpcInterfaceStatus } from "./BentleyError";

/* eslint-disable @typescript-eslint/no-shadow */

/** @alpha */
export type ErrorCategoryHandler = (error: BentleyError) => ErrorCategory | undefined;

/** A group of related errors for aggregate reporting purposes.
 * @alpha
 */
export abstract class ErrorCategory {
  public static handlers: Set<ErrorCategoryHandler> = new Set();

  public static for(error: BentleyError): ErrorCategory {
    for (const handler of this.handlers) {
      const category = handler(error);
      if (category) {
        return category;
      }
    }

    return lookupCategory(error);
  }

  public abstract name: string;
  public abstract code: number;
}

namespace HTTP {
  export enum Successful {
    OK = 200,
  }

  export enum ClientError {
    BadRequest = 400,
    Unauthorized = 401,
    Forbidden = 403,
    NotFound = 404,
    MethodNotAllowed = 405,
    NotAcceptable = 406,
    Conflict = 409,
    Gone = 410,
    PreconditionFailed = 412,
    ExpectationFailed = 417,
    MisdirectedRequest = 421,
    UnprocessableEntity = 422,
    Locked = 423,
    FailedDependency = 424,
    UpgradeRequired = 426,
    PreconditionRequired = 428
  }

  export enum ServerError {
    InternalServerError = 500,
    NotImplemented = 501,
  }
}

class Success extends ErrorCategory { public name = "Success"; public code = HTTP.Successful.OK; }

class BadRequest extends ErrorCategory { public name = "BadRequest"; public code = HTTP.ClientError.BadRequest; }
class Forbidden extends ErrorCategory { public name = "Forbidden"; public code = HTTP.ClientError.Forbidden; }
class Conflict extends ErrorCategory { public name = "Conflict"; public code = HTTP.ClientError.Conflict; }
class PreconditionFailed extends ErrorCategory { public name = "PreconditionFailed"; public code = HTTP.ClientError.PreconditionFailed; }
class UnprocessableEntity extends ErrorCategory { public name = "UnprocessableEntity"; public code = HTTP.ClientError.UnprocessableEntity; }

class Failed extends ErrorCategory { public name = "Failed"; public code = HTTP.ServerError.InternalServerError; }
class Unknown extends ErrorCategory { public name = "Unknown"; public code = HTTP.ServerError.NotImplemented; }

function lookupCategory(error: BentleyError) {
  switch (error.errorNumber) {
    case IModelStatus.AlreadyLoaded:
    case IModelStatus.AlreadyOpen:
      return new UnprocessableEntity();

    case IModelStatus.BadArg:
    case IModelStatus.BadElement:
    case IModelStatus.BadModel:
    case IModelStatus.BadRequest:
    case IModelStatus.BadSchema:
      return new BadRequest();

    case IModelStatus.CannotUndo:
      return new Conflict();

    case IModelStatus.CodeNotReserved:
      return new PreconditionFailed();

    case IModelStatus.DeletionProhibited:
      return new Forbidden();

    case BentleyStatus.SUCCESS:
    case IModelStatus.Success:
    case RpcInterfaceStatus.Success:
    case ChangeSetStatus.Success:
    case RepositoryStatus.Success:
    case HttpStatus.Success:
    case IModelHubStatus.Success:
    case AuthStatus.Success:
    case GeoServiceStatus.Success:
      return new Success();

    case BentleyStatus.ERROR:
      return new Failed();

    default:
      return new Unknown();
  }
}
