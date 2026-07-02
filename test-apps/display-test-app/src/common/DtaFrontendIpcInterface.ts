/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Channel used by the backend to invoke methods implemented on the frontend, demonstrating the
 * backend-to-frontend Ipc invoke support added to [IpcHost]($backend) and [IpcApp]($frontend)
 * (see [[DtaFrontendIpcInterface]]).
 * @see DtaIpcInterface.ts for the (much more common) opposite direction, where the frontend calls the backend.
 */
export const dtaFrontendChannel = "display-test-app/dta-frontend";

/** Information that only the frontend can compute, returned by [[DtaFrontendIpcInterface.getFrontendInfo]]. */
export interface DtaFrontendInfoResult {
  /** The width, in pixels, of the browser/Electron renderer window. */
  windowInnerWidth: number;
  /** The height, in pixels, of the browser/Electron renderer window. */
  windowInnerHeight: number;
  /** The Id of the currently selected viewport, if any. */
  selectedViewportId?: number;
}

/**
 * An Ipc interface implemented by the frontend and invoked by the backend via [IpcHost.makeIpcProxy]($backend).
 * The backend asks the frontend for information (like window dimensions) that only the frontend knows.
 */
export interface DtaFrontendIpcInterface {
  /** Returns information about the frontend that the backend cannot otherwise obtain. */
  getFrontendInfo: () => Promise<DtaFrontendInfoResult>;
}
