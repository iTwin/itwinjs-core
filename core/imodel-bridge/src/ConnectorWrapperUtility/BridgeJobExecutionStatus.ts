/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export enum BridgeJobExecutionStatus {
  NotStarted = 0,
  InProgress,
  Succeeded,
  Failed,
  Canceled,
  Timeout,
}

export enum BridgeExitStatusCode {
  ProcessNotFound = -7000,
  ForceClose = -7001,
  Failed = -7002,
  AuthenticationFailed = -7003,
}
