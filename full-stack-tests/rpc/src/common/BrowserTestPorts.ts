/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { backendPortFor } from "@itwin/vitest-browser-bridge/ports";

/** Port of the mock mobile backend for a page served on `frontendPort`; one more hop past the RPC backend. */
export function mobileBackendPortFor(frontendPort: number): number {
  return backendPortFor(backendPortFor(frontendPort));
}
