/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export interface IJobEventProperties {
  jobId: string;
  taskId: string;
  syncDefinitionId: string;
  runId: string;
  inputFileId: string;
}

export interface IBridgeStatusUpdatedEventProperties extends IJobEventProperties {
  status: string; // TODO: enum/etc.
  message: string;
}

export interface IBridgeCompletedEventProperties extends IJobEventProperties {
  exitCode: number;
  details?: string;
}

export interface IWrapperCompletedEventProperties extends IJobEventProperties {
  exitCode: number;
  details?: string;
}

export interface IJobEvent {
  serviceBusLabel: string;
  properties: IJobEventProperties;
}

export enum JobEventServiceBusLabels {
  WrapperStarted = "BridgeWrapper_Start",
  WrapperCompleted = "BridgeWrapper_Complete",
  BridgeStarted = "Bridge_Start",
  BridgeStatusUpdated = "Bridge_Update",
  BridgeCompleted = "Bridge_Complete",
}

export class BridgeStartedEvent implements IJobEvent {
  serviceBusLabel: string = JobEventServiceBusLabels.BridgeStarted;
  constructor(readonly properties: IJobEventProperties) {}
}

export class BridgeStatusUpdatedEvent implements IJobEvent {
  serviceBusLabel: string = JobEventServiceBusLabels.BridgeStatusUpdated;
  constructor(readonly properties: IBridgeStatusUpdatedEventProperties) {}
}

export class BridgeCompletedEvent implements IJobEvent {
  serviceBusLabel: string = JobEventServiceBusLabels.BridgeCompleted;
  constructor(readonly properties: IBridgeCompletedEventProperties) {}
}

export class WrapperStartedEvent implements IJobEvent {
  serviceBusLabel: string = JobEventServiceBusLabels.WrapperStarted;
  constructor(readonly properties: IJobEventProperties) {}
}

export class WrapperCompletedEvent implements IJobEvent {
  serviceBusLabel: string = JobEventServiceBusLabels.WrapperCompleted;
  constructor(readonly properties: IWrapperCompletedEventProperties) {}
}
