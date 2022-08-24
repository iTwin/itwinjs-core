/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export enum ElectronHostTest {
  StartupWithoutOptions = "startupWithoutOptions",
  RegisterIpcHandlers = "registerIpcHandlers",
  OpenMainWindow = "openMainWindow",
}

export enum TestResult {
  Success = 0,
  Failure = 1,
  InvalidArguments = 2,
}
