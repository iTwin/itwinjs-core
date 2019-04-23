/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
declare const window: any;
declare const global: any;

const isFrontend = (typeof (window) !== "undefined");
export type CertaBackendCallback = (...args: any[]) => void | null | undefined | number | string | boolean;

/** @internal */
export function getCallbacksRegisteredOnBackend(): { [name: string]: CertaBackendCallback } {
  if (isFrontend)
    throw new Error("This should only be called on the backend!");

  global._CertaRegisteredCallbacks = global._CertaRegisteredCallbacks || {};
  return global._CertaRegisteredCallbacks;
}

/** @internal */
export function executeRegisteredCallback(name: string, args: any[]): any {
  const registeredCallbacks = getCallbacksRegisteredOnBackend();
  if (!(name in registeredCallbacks))
    throw new Error(`Unknown certa backend callback "${name}"`);

  return registeredCallbacks[name](...args);
}

export function registerBackendCallback(name: string, cb: CertaBackendCallback): void {
  if (isFrontend)
    throw new Error("This should only be called on the backend!");

  global._CertaRegisteredCallbacks = global._CertaRegisteredCallbacks || {};
  global._CertaRegisteredCallbacks[name] = cb;
}

export async function executeBackendCallback(name: string, ...args: any[]): Promise<any> {
  if (!isFrontend)
    return executeRegisteredCallback(name, args);

  return window._CertaSendToBackend(name, args);
}
