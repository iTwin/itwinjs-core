/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it } from "vitest";
import { clearCallbacks, executeRegisteredCallback, getCallbacksRegisteredOnBackend, registerBackendCallback } from "../callbackRegistry.js";

describe("callbackRegistry", () => {
  beforeEach(() => {
    clearCallbacks();
  });

  it("registers and executes a callback", () => {
    registerBackendCallback("echo", (msg: string) => msg);
    const result = executeRegisteredCallback("echo", ["hello"]);
    expect(result).toBe("hello");
  });

  it("registers multiple callbacks", () => {
    registerBackendCallback("add", (a: number, b: number) => a + b);
    registerBackendCallback("multiply", (a: number, b: number) => a * b);
    const callbacks = getCallbacksRegisteredOnBackend();
    expect(Object.keys(callbacks)).toHaveLength(2);
  });

  it("throws for unknown callback", () => {
    expect(() => executeRegisteredCallback("nonexistent", [])).toThrow('Unknown certa backend callback "nonexistent"');
  });

  it("handles async callbacks", async () => {
    registerBackendCallback("asyncEcho", async (msg: string) => msg);
    const result = await executeRegisteredCallback("asyncEcho", ["async hello"]);
    expect(result).toBe("async hello");
  });

  it("handles callback that throws", () => {
    registerBackendCallback("fail", () => { throw new Error("intentional"); });
    expect(() => executeRegisteredCallback("fail", [])).toThrow("intentional");
  });

  it("stores callbacks in the shared symbol-keyed global registry", () => {
    registerBackendCallback("test", () => "value");
    const callbacks = (globalThis as any)[Symbol.for("@itwin/vitest-certa-bridge/callbacks")];
    expect(callbacks.test).toBeDefined();
  });

  it("rejects invalid callback registration", () => {
    expect(() => registerBackendCallback("", () => undefined)).toThrow("non-empty string");
    expect(() => registerBackendCallback("notAFunction", undefined as any)).toThrow("must be a function");
  });

  it("does not execute inherited object properties as callbacks", () => {
    expect(() => executeRegisteredCallback("toString", [])).toThrow('Unknown certa backend callback "toString"');
  });
});
