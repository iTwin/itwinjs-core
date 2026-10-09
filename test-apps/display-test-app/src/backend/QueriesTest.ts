/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MobileHost } from "@itwin/core-mobile/lib/cjs/MobileBackend";

const testCaseTimeoutMs = 10_000;
const duplicateReplyGraceMs = 500;
const concurrentQueryCount = 20;

export function setupTestQueryHandler(): void {
  const defaultHandler = MobileHost.nativeQueryHandler;
  MobileHost.nativeQueryHandler = async (name, message) => {
    switch (name) {
      case "test.syncResolve":
        return message;
      case "test.asyncResolve":
        await delay(20);
        return message;
      case "test.reject":
        await delay(20);
        throw new Error("expected backend rejection");
      case "test.unregistered":
        return defaultHandler(name, message);
      case "test.echoDelayed":
        await delay((JSON.parse(message) as { delayMs: number }).delayMs);
        return message;
      case "test.runQueriesFromBackendTest":
        const result = await runQueriesFromBackendTest();
        return JSON.stringify(result);
      default:
        throw new Error(`Unknown bridge test query: ${name}`);
    }
  };
}

interface NativeReply {
  response?: string;
  error?: string;
}

async function runQueriesFromBackendTest(): Promise<{ cases: string[], failures: string[] }> {
  const cases: string[] = []
  const failures: string[] = [];

  async function runCase(name: string, body: () => Promise<void>, timeoutMs = testCaseTimeoutMs): Promise<void> {
    cases.push(name);
    try {
      await withTimeout(body(), timeoutMs, name);
    } catch (err) {
      failures.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function queryNative(name: string, message: string): Promise<NativeReply> {
    return new Promise<NativeReply>((resolve) => {
      let calls = 0;
      MobileHost.device.sendQueryToNative(name, message, (response?: string, error?: string) => {
        if (++calls > 1) {
          failures.push(`${name}: reply callback invoked ${calls} times`);
          return;
        }
        resolve({ response, error });
      });
    });
  }

  await runCase("syncResolve", async () => {
    const response = await queryNative("test.syncResolve", "hello");
    assertResponseResultEquals(response, "hello")
  });

  await runCase("asyncResolve", async () => {
    const response = await queryNative("test.asyncResolve", "delayed hello");
    assertResponseResultEquals(response, "delayed hello")
  });

  await runCase("reject", async () => {
    const response = await queryNative("test.reject", "");
    assertResponseErrorEquals(response, "expected native rejection")
  });

  await runCase("throw", async () => {
    const response = await queryNative("test.throw", "");
    assertResponseErrorEquals(response, "expected native throw")
  });

  await runCase("duplicateReply", async () => {
    const response = await queryNative("test.duplicateReply", "");
    assertResponseResultEquals(response, "first")
  });

  await runCase("concurrentReply", async () => {
    const reply = await queryNative("test.concurrentReply", "");
    assertTrue(reply.error === undefined, `unexpected error "${reply.error}"`);
    assertTrue(reply.response === "a" || reply.response === "b", `unexpected response "${reply.response}"`);
  });

  await runCase("concurrentQueries", async () => {
    const messages = Array.from({ length: concurrentQueryCount }, (_, id) => JSON.stringify({ id, delayMs: (concurrentQueryCount - id) * 20 }));
    const replies = await Promise.all(messages.map(async (message) => queryNative("test.echoDelayed", message)));
    replies.forEach((reply, i) => assertResponseResultEquals(reply, messages[i]));
  });

  // Gives potential late duplicate replies time to reach JS.
  await delay(duplicateReplyGraceMs);

  return { cases, failures };
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function assertResponseResultEquals(reply: NativeReply, expected: string): void {
  assertTrue(reply.error === undefined, `expected response "${expected}" but got error "${reply.error}"`);
  assertTrue(reply.response === expected, `expected response "${expected}" but got "${reply.response}"`);
}

function assertResponseErrorEquals(reply: NativeReply, expected: string): void {
  assertTrue(reply.response === undefined, `expected error "${expected}" but got response "${reply.response}"`);
  assertTrue(reply.error === expected, `expected error "${expected}" but got "${reply.error}"`);
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition)
    throw new Error(message);
}
