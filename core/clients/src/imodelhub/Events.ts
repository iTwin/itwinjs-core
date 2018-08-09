/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHubEvents */

import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { request, Response } from "./../Request";
import { CodeState } from "./Codes";
import { AccessToken } from "../Token";
import { Logger } from "@bentley/bentleyjs-core";
import { EventBaseHandler, BaseEventSAS, IModelHubBaseEvent, EventListener, ListenerSubscription, GetEventOperationToRequestType } from "./EventsBase";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck } from "./Errors";

const loggingCategory = "imodeljs-clients.imodelhub";

/** Event Type string literals */
export type EventType =
  /** Sent when a Lock is acquired */
  "LockEvent" |
  /** Sent when all Locks for a Briefcase are deleted */
  "AllLocksDeletedEvent" |
  /** Sent when a ChangeSet is successfully pushed */
  "ChangeSetPostPushEvent" |
  /** Sent when a ChangeSet push has started */
  "ChangeSetPrePushEvent" |
  /** Sent when a Code is reserved */
  "CodeEvent" |
  /** Sent when all Codes for a Briefcase are deleted */
  "AllCodesDeletedEvent" |
  /** Sent when a Briefcase is deleted */
  "BriefcaseDeletedEvent" |
  /** Sent when a Seed File is deleted */
  "SeedFileReplacedEvent" |
  /** Sent when iModel is locked */
  "iModelLockEvent" |
  /** Sent when iModel is deleted */
  "iModelDeletedEvent" |
  /** Sent when a new Named Version is created */
  "VersionEvent";

/** Base type for all iModelHub events */
export abstract class IModelHubEvent extends IModelHubBaseEvent {
}

/** Base type for iModelHub events that have BriefcaseId */
export abstract class BriefcaseEvent extends IModelHubEvent {
  public briefcaseId?: number;

  /**
   * Construct this event from object instance.
   * @param obj Object instance.
   */
  public fromJson(obj: any) {
    super.fromJson(obj);
    this.briefcaseId = obj.BriefcaseId;
  }
}

/** Sent when a Lock is acquired */
export class LockEvent extends BriefcaseEvent {
  public lockType?: string;
  public lockLevel?: string;
  public objectIds?: string[];
  public releasedWithChangeSet?: string;

  /**
   * Construct this event from object instance.
   * @param obj Object instance.
   */
  public fromJson(obj: any) {
    super.fromJson(obj);
    this.lockType = obj.LockType;
    this.lockLevel = obj.LockLevel;
    this.objectIds = obj.ObjectIds;
    this.releasedWithChangeSet = obj.ReleasedWithChangeSet;
  }
}

/** Sent when all Locks for a Briefcase are deleted */
export class AllLocksDeletedEvent extends BriefcaseEvent {
}

/** Sent when a ChangeSet is successfully pushed */
export class ChangeSetPostPushEvent extends BriefcaseEvent {
  public changeSetId?: string;
  public changeSetIndex?: number;

  /**
   * Construct this event from object instance.
   * @param obj Object instance.
   */
  public fromJson(obj: any) {
    super.fromJson(obj);
    this.changeSetId = obj.ChangeSetId;
    this.changeSetIndex = obj.ChangeSetIndex;
  }
}

/** Sent when a ChangeSet push has started */
export class ChangeSetPrePushEvent extends IModelHubEvent {
}

/** Sent when a Code is reserved */
export class CodeEvent extends BriefcaseEvent {
  public codeSpecId?: string;
  public codeScope?: string;
  public values?: string[];
  public state?: CodeState = CodeState.Reserved;

  /**
   * Construct this event from object instance.
   * @param obj Object instance.
   */
  public fromJson(obj: any) {
    super.fromJson(obj);
    this.codeSpecId = obj.CodeSpecId;
    this.codeScope = obj.CodeScope;
    this.values = obj.Values;
    this.state = obj.State;
  }
}

/** Sent when all Codes for a Briefcase are deleted */
export class AllCodesDeletedEvent extends BriefcaseEvent {
}

/** Sent when a Briefcase is deleted */
export class BriefcaseDeletedEvent extends BriefcaseEvent {
}

/** Sent when a Seed File is deleted */
export class SeedFileReplacedEvent extends IModelHubEvent {
  public fileId?: string;
  public fromJson(obj: any) {
    super.fromJson(obj);
    this.fileId = obj.FileId;
  }
}

/** Sent when iModel is locked */
export class IModelLockEvent extends IModelHubEvent {
  public locked?: boolean;
  public fromJson(obj: any) {
    super.fromJson(obj);
    this.locked = obj.Locked;
  }
}

/** Sent when iModel is deleted */
export class IModelDeletedEvent extends IModelHubEvent {
}

/** Sent when a new Named Version is created */
export class VersionEvent extends IModelHubEvent {
  public versionId?: string;
  public versionName?: string;
  public changeSetId?: string;
  public fromJson(obj: any) {
    super.fromJson(obj);
    this.versionId = obj.VersionId;
    this.versionName = obj.VersionName;
    this.changeSetId = obj.ChangeSetId;
  }
}

type EventConstructor = (new () => IModelHubEvent);
/** Get constructor from EventType name. */
function ConstructorFromEventType(type: EventType): EventConstructor {
  switch (type) {
    case "LockEvent":
      return LockEvent;
    case "AllLocksDeletedEvent":
      return AllLocksDeletedEvent;
    case "ChangeSetPostPushEvent":
      return ChangeSetPostPushEvent;
    case "ChangeSetPrePushEvent":
      return ChangeSetPrePushEvent;
    case "CodeEvent":
      return CodeEvent;
    case "AllCodesDeletedEvent":
      return AllCodesDeletedEvent;
    case "BriefcaseDeletedEvent":
      return BriefcaseDeletedEvent;
    case "SeedFileReplacedEvent":
      return SeedFileReplacedEvent;
    case "iModelLockEvent":
      return IModelLockEvent;
    case "iModelDeletedEvent":
      return IModelDeletedEvent;
    case "VersionEvent":
      return VersionEvent;
  }
}

/**
 * Parse @see IModelHubEvent from response object.
 * @hidden
 * @param response Response object to parse.
 * @returns Appropriate event object.
 */
export function ParseEvent(response: Response) {
  const constructor: EventConstructor = ConstructorFromEventType(response.header["content-type"]);
  const event = new constructor();
  event.fromJson(response.body);
  return event;
}

/** EventSubscription */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.EventSubscription", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class EventSubscription extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.EventTypes")
  public eventTypes?: EventType[];
}

/** EventSAS */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.EventSAS", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class EventSAS extends BaseEventSAS {
}

/**
 * Handler for all methods related to @see EventSubscription instances.
 */
export class EventSubscriptionHandler {
  private _handler: IModelBaseHandler;

  /**
   * Constructor for EventSubscriptionHandler. Should use @see EventHandler instead of directly constructing this.
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /**
   * Gets relative url for EventSubscription requests.
   * @param imodelId Id of the iModel.
   * @param instanceId Id of the subscription.
   */
  private getRelativeUrl(imodelId: string, instanceId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/EventSubscription/${instanceId || ""}`;
  }

  /**
   * Creates event subscription.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param events Array of EventTypes to subscribe to.
   * @return Created EventSubscription instance.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async create(token: AccessToken, imodelId: string, events: EventType[]) {
    Logger.logInfo(loggingCategory, `Creating event subscription on iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.nonEmptyArray("events", events);

    let subscription = new EventSubscription();
    subscription.eventTypes = events;

    subscription = await this._handler.postInstance<EventSubscription>(EventSubscription, token, this.getRelativeUrl(imodelId), subscription);

    Logger.logTrace(loggingCategory, `Created event subscription on iModel ${imodelId}`);

    return subscription;
  }

  /**
   * Updates event subscription.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param subscription Updated events subscription.
   * @return Updated EventSubscription instance.
   * @throws [[IModelHubError]] with [IModelHubStatus.EventSubscriptionDoesNotExist]($bentley)
   * if [[EventSubscription]] does not exist with the specified subscription.wsgId.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async update(token: AccessToken, imodelId: string, subscription: EventSubscription): Promise<EventSubscription> {
    Logger.logInfo(loggingCategory, `Updating event subscription on iModel ${subscription.wsgId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.defined("subscription", subscription);
    ArgumentCheck.validGuid("subscription.wsgId", subscription.wsgId);

    const updatedSubscription = await this._handler.postInstance<EventSubscription>(EventSubscription, token, this.getRelativeUrl(imodelId, subscription.wsgId), subscription);

    Logger.logTrace(loggingCategory, `Updated event subscription on iModel ${subscription.wsgId}`);

    return updatedSubscription;
  }

  /**
   * Deletes event subscription.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param eventSubscriptionId Id of the event subscription.
   * @returns Resolves if the EventSubscription has been successfully deleted.
   * @throws [[IModelHubError]] with [IModelHubStatus.EventSubscriptionDoesNotExist]($bentley)
   * if [[EventSubscription]] does not exist with the specified subscription.wsgId.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async delete(token: AccessToken, imodelId: string, eventSubscriptionId: string): Promise<void> {
    Logger.logInfo(loggingCategory, `Deleting event subscription ${eventSubscriptionId} from iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.validGuid("eventSubscriptionId", eventSubscriptionId);

    await this._handler.delete(token, this.getRelativeUrl(imodelId, eventSubscriptionId));

    Logger.logTrace(loggingCategory, `Deleted event subscription ${eventSubscriptionId} from iModel ${imodelId}`);
  }
}

/**
 * Handler for all methods related to iModel Hub events.
 */
export class EventHandler extends EventBaseHandler {
  private _subscriptionHandler: EventSubscriptionHandler | undefined;

  /**
   * Constructor for EventHandler. Should use @see IModelClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    super();
    this._handler = handler;
  }

  /**
   * Get a handler for @see EventSubscription related methods.
   */
  public Subscriptions(): EventSubscriptionHandler {
    if (!this._subscriptionHandler) {
      this._subscriptionHandler = new EventSubscriptionHandler(this._handler);
    }

    return this._subscriptionHandler;
  }

  /**
   * Gets relative url for EventSAS requests.
   * @param imodelId Id of the iModel.
   */
  private getEventSASRelativeUrl(imodelId: string): string {
    return `/Repositories/iModel--${imodelId}/iModelScope/EventSAS/`;
  }

  /**
   * Gets event SAS Token.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @return SAS Token to connect to the topic.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async getSASToken(token: AccessToken, imodelId: string): Promise<EventSAS> {
    Logger.logInfo(loggingCategory, `Getting event SAS token from iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    const eventSAS = await this._handler.postInstance<EventSAS>(EventSAS, token, this.getEventSASRelativeUrl(imodelId), new EventSAS());

    Logger.logTrace(loggingCategory, `Got event SAS token from iModel ${imodelId}`);

    return eventSAS;
  }

  /**
   * Gets absolute url for event requests.
   * @param baseAddress Base address for the serviceBus.
   * @param subscriptionId Id of the subscription.
   * @param timeout Optional timeout for long polling.
   */
  private getEventUrl(baseAddress: string, subscriptionId: string, timeout?: number): string {
    let url: string = `${baseAddress}/Subscriptions/${subscriptionId}/messages/head`;

    if (timeout) {
      url = url + `?timeout=${timeout}`;
    }

    return url;
  }

  /**
   * Gets event from Service Bus Topic.
   * @param sasToken Service Bus SAS Token.
   * @param baseAddress Base address of Service Bus topic.
   * @param subscriptionId Id of the subscription to the topic.
   * @param timeout Optional timeout duration in seconds for request, when using long polling.
   * @return Event if it exists, undefined otherwise.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the arguments is undefined or has an invalid value.
   * @throws [[ResponseError]] if request has failed.
   */
  public async getEvent(sasToken: string, baseAddress: string, subscriptionId: string, timeout?: number): Promise<IModelHubEvent | undefined> {
    Logger.logInfo(loggingCategory, `Getting event from subscription ${subscriptionId}`);
    ArgumentCheck.defined("sasToken", sasToken);
    ArgumentCheck.defined("baseAddress", baseAddress);
    ArgumentCheck.validGuid("subscriptionId", subscriptionId);

    const options = this.getEventRequestOptions(GetEventOperationToRequestType.GetDestructive, sasToken, timeout);

    const result = await request(this.getEventUrl(baseAddress, subscriptionId, timeout), options);

    if (result.status === 204) {
      Logger.logTrace(loggingCategory, `No events found on subscription ${subscriptionId}`);
      return undefined;
    }

    const event = ParseEvent(result);
    Logger.logTrace(loggingCategory, `Got event from subscription ${subscriptionId}`);

    return Promise.resolve(event);
  }

  /**
   * Creates a listener for long polling events from a subscription.
   * @param authenticationCallback Callback used to get AccessToken. Only the first registered callback for this subscription will be used.
   * @param subscriptionId Id of subscription.
   * @param imodelId Id of the iModel.
   * @param listener Callback that is called when an event is received.
   * @returns Function that deletes the listener.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the arguments is undefined or has an invalid value.
   */
  public createListener(authenticationCallback: () => Promise<AccessToken>, subscriptionId: string, imodelId: string, listener: (event: IModelHubEvent) => void): () => void {
    ArgumentCheck.defined("authenticationCallback", authenticationCallback);
    ArgumentCheck.validGuid("subscriptionId", subscriptionId);
    ArgumentCheck.validGuid("imodelId", imodelId);

    const subscription = new ListenerSubscription();
    subscription.authenticationCallback = authenticationCallback;
    subscription.getEvent = (sasToken: string, baseAddress: string, id: string, timeout?: number) =>
      this.getEvent(sasToken, baseAddress, id, timeout);
    subscription.getSASToken = (token: AccessToken) => this.getSASToken(token, imodelId);
    subscription.id = subscriptionId;
    return EventListener.create(subscription, listener);
  }
}
