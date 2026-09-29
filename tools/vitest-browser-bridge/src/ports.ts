/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Where a Vitest browser test page and its test backend listen. Each package's Vitest config owns
// its page port; the package's global setup passes the port Vitest resolved to the backend through
// `frontendPortEnvVar`, and every backend port is derived from it here. This module runs in Node
// and in the browser, so it must not import Node APIs.

/** Loopback host for the Vitest page and the test backends. */
export const loopbackHost = "127.0.0.1";

/** Environment variable that carries the resolved page port to the backend process. */
export const frontendPortEnvVar = "VITEST_FRONTEND_PORT";

const backendPortOffset = 2000;

/** Port of the test backend for a page served on `frontendPort`. */
export function backendPortFor(frontendPort: number): number {
  return frontendPort + backendPortOffset;
}

/** Origin of the test backend for the page at `location`. */
export function backendOriginFor(location: { readonly protocol: string, readonly hostname: string, readonly port: string }): string {
  return `${location.protocol}//${location.hostname}:${backendPortFor(parseFrontendPort(location.port, "The Vitest page port"))}`;
}

/** Parse a page port, failing loudly instead of falling back to a default. */
export function parseFrontendPort(value: string | number | undefined, source: string): number {
  const port = Number(value);
  if (value === undefined || value === "" || !Number.isInteger(port) || port <= 0 || port > 65535)
    throw new Error(`${source} must be a TCP port, got "${String(value)}".`);
  return port;
}
