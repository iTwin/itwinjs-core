/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, it, expect, beforeEach } from "vitest";
import { registerBackendCallback, getCallbacksRegisteredOnBackend, executeRegisteredCallback, clearCallbacks } from "../callbackRegistry";

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

  it("mirrors to global._CertaRegisteredCallbacks", () => {
    registerBackendCallback("test", () => "value");
    expect((global as any)._CertaRegisteredCallbacks.test).toBeDefined();
  });
});
