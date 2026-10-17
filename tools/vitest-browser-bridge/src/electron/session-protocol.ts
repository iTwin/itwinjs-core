/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

export const SESSION_CONFIGURATION_ENV = "VITEST_BROWSER_BRIDGE_SESSION";

export interface ProviderSessionConfiguration {
  readonly url: string;
  readonly sessionId: string;
  readonly cacheDir: string;
  readonly backendInitModule?: string;
  readonly preloadModule?: string;
  readonly headless: boolean;
}

export interface SessionReadyMessage {
  readonly type: "ready";
  readonly sessionId: string;
}

export interface SessionFailureMessage {
  readonly type: "failure";
  readonly sessionId: string;
  readonly message: string;
}

export interface SessionShutdownMessage {
  readonly type: "shutdown";
}

export type ProviderSessionMessage = SessionReadyMessage | SessionFailureMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRequiredString(configuration: Record<string, unknown>, name: string): string {
  const value = configuration[name];
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`Invalid provider session ${name}.`);
  return value;
}

/** Parse the provider-owned child-process configuration.
 * @internal
 */
export function parseProviderSessionConfiguration(serialized: string | undefined): ProviderSessionConfiguration {
  if (serialized === undefined)
    throw new Error(`Missing ${SESSION_CONFIGURATION_ENV}.`);

  const configuration: unknown = JSON.parse(serialized);
  if (!isRecord(configuration))
    throw new Error("Invalid provider session configuration.");
  if (typeof configuration.headless !== "boolean")
    throw new Error("Invalid provider session headless flag.");
  if (configuration.backendInitModule !== undefined && typeof configuration.backendInitModule !== "string")
    throw new Error("Invalid provider session backend init module.");
  if (configuration.preloadModule !== undefined && typeof configuration.preloadModule !== "string")
    throw new Error("Invalid provider session preload module.");

  return {
    url: readRequiredString(configuration, "url"),
    sessionId: readRequiredString(configuration, "sessionId"),
    cacheDir: readRequiredString(configuration, "cacheDir"),
    headless: configuration.headless,
    ...(configuration.backendInitModule === undefined ? {} : { backendInitModule: configuration.backendInitModule }),
    ...(configuration.preloadModule === undefined ? {} : { preloadModule: configuration.preloadModule }),
  };
}

export function isProviderSessionMessage(message: unknown): message is ProviderSessionMessage {
  return isRecord(message)
    && (message.type === "ready" || message.type === "failure")
    && typeof message.sessionId === "string"
    && (message.type !== "failure" || typeof message.message === "string");
}

export function isSessionShutdownMessage(message: unknown): message is SessionShutdownMessage {
  return isRecord(message) && message.type === "shutdown";
}
