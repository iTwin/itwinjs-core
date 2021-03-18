/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ConfigMapper } from "../ConfigMapper";
import {
  WrapperStartedEvent,
  IJobEventProperties,
  WrapperCompletedEvent,
  BridgeCompletedEvent,
  BridgeStartedEvent,
  BridgeStatusUpdatedEvent,
} from "./events";

export class EventBuilder {
  public static buildWrapperStartedEvent(configMapper: ConfigMapper) {
    return new WrapperStartedEvent({
      ...EventBuilder.getCommonEventProperties(configMapper),
    });
  }

  public static buildWrapperCompletedEvent(configMapper: ConfigMapper, exitCode: number, details?: string) {
    return new WrapperCompletedEvent({
      ...EventBuilder.getCommonEventProperties(configMapper),
      exitCode: exitCode,
      details: details,
    });
  }

  public static buildBridgeStartedEvent(configMapper: ConfigMapper) {
    return new BridgeStartedEvent({
      ...EventBuilder.getCommonEventProperties(configMapper),
    });
  }

  public static buildBridgeStatusUpdatedEvent(configMapper: ConfigMapper, status: string, message: string) {
    return new BridgeStatusUpdatedEvent({
      ...EventBuilder.getCommonEventProperties(configMapper),
      status: status,
      message: message,
    });
  }

  public static buildBridgeCompletedEvent(configMapper: ConfigMapper, exitCode: number, details?: string) {
    return new BridgeCompletedEvent({
      ...EventBuilder.getCommonEventProperties(configMapper),
      exitCode: exitCode,
      details: details,
    });
  }

  private static getCommonEventProperties(configMapper: ConfigMapper): IJobEventProperties {
    return {
      inputFileId: configMapper.documentGuid!,
      syncDefinitionId: configMapper.imodelJobDefId!,
      jobId: configMapper.azureJobId!,
      taskId: configMapper.azureTaskId!,
      runId: configMapper.syncRunId!,
    };
  }
}
