/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BridgeJobExecutionStatus } from "./BridgeJobExecutionStatus";

export interface BridgeFrameworkExecutorInterface {
  setTimeOut(mintues: number): void;
  executeBridgeJob(): void;
  killBridgeJob(): void;
  jobCurrentStatus: BridgeJobExecutionStatus;
}
