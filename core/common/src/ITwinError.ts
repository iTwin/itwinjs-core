import { LoggingMetaData } from "@itwin/core-bentley";

interface InUseLock {
  objectId: string;
  state: string;
  briefcaseIds: number[];
}

export interface ITwinError {
  namespace: string;   // Localization namespace
  errorKey: string; // unique key for error, within namespace
  message: string; // explanation of what went wrong.
  stack?: string;
  metadata?: LoggingMetaData;
}

interface LockError extends ITwinError {
  namespace: "IModelAccess";
  errorKey: "InUseLocks";
  inUseLocks: InUseLock[];
}

interface OtherError extends ITwinError {
  namespace: "TestNamespace2";
  errorKey: "OtherError";
  description: string;
}

export namespace ITwinError {
  export function isITwinError(error: unknown): error is ITwinError {
    return error !== undefined && error !== null && typeof error === "object" && "namespace" in error && "errorKey" in error && "message" in error;
  }
  export function isLockError(error: unknown): error is LockError {
    return isITwinError(error) && error.namespace === "IModelAccess" && error.errorKey === "InUseLocks";
  }

  export function throwLockError(inUseLocks: InUseLock[], message?: string, metadata?: LoggingMetaData): never {
    const lockError: LockError = {
      namespace: "IModelAccess",
      errorKey: "InUseLocks",
      message: message ?? "This iModel is in use",
      stack: new Error().stack,
      metadata,
      inUseLocks,
    };
    throw lockError;
  }
};

try {
  ITwinError.throwLockError([{objectId: "0x1", state: "Shared", briefcaseIds: [1,2,3]}]);
} catch (err) {
  if (ITwinError.isLockError(err)) {
    console.log(err.inUseLocks);
  }
}
