/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHubEvents */

import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { request, Response } from "./../Request";
import { CodeState } from "./Codes";
import { AccessToken } from "../Token";
import { Logger, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { EventBaseHandler, BaseEventSAS, IModelHubBaseEvent, EventListener, ListenerSubscription, GetEventOperationToRequestType } from "./EventsBase";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck } from "./Errors";

const loggingCategory = "imodeljs-clients.imodelhub";

/** Type of [[IModelHubEvent]]. Event type is used to define which events you wish to receive from your [[EventSubscription]]. See [[EventSubscriptionHandler.create]] and [[EventSubscriptionHandler.update]]. */
export type EventType =
  /** Sent when one or more [[Lock]]s are updated. See [[LockEvent]]. */
  "LockEvent" |
  /** Sent when all [[Lock]]s for a [[Briefcase]] are deleted. See [[AllLocksDeletedEvent]]. */
  "AllLocksDeletedEvent" |
  /** Sent when a [[ChangeSet]] is successfully pushed. See [[ChangeSetPostPushEvent]]. */
  "ChangeSetPostPushEvent" |
  /** Sent when a [[ChangeSet]] push has started. See [[ChangeSetPrePushEvent]]. */
  "ChangeSetPrePushEvent" |
  /** Sent when one or more [Code]($common)s are updated. See [[CodeEvent]]. */
  "CodeEvent" |
  /** Sent when all [Code]($common)s for a [[Briefcase]] are deleted. See [[AllCodesDeletedEvent]]. */
  "AllCodesDeletedEvent" |
  /** Sent when a [[Briefcase]] is deleted. See [[BriefcaseDeletedEvent]]. */
  "BriefcaseDeletedEvent" |
  /** Sent when a seed file is replaced. See [[SeedFileReplacedEvent]]. */
  "SeedFileReplacedEvent" |
  /** Sent when iModel is locked or unlocked. See [[iModelLockEvent]]. */
  "iModelLockEvent" |
  /** Sent when iModel is deleted. See [[iModelDeletedEvent]]. */
  "iModelDeletedEvent" |
  /** Sent when a new named [[Version]] is created. See [[VersionEvent]]. */
  "VersionEvent";

/** Base type for all iModelHub events. */
export abstract class IModelHubEvent extends IModelHubBaseEvent {
}

/** Base type for iModelHub events that have BriefcaseId. */
export abstract class BriefcaseEvent extends IModelHubEvent {
  /** Id of the [[Briefcase]] involved in this event. */
  public briefcaseId?: number;

  /**
   * Construct this event from object instance.
   * @hidden
   * @param obj Object instance.
   */
  public fromJson(obj: any) {
    super.fromJson(obj);
    this.briefcaseId = obj.BriefcaseId;
  }
}

/**
 * Sent when one or more [[Lock]]s are updated. Lock updates can be very frequent, so it's recommended to not to subscribe to LockEvents, if it's not necessary.
 */
export class LockEvent extends BriefcaseEvent {
  /** [[LockType]] of the updated Locks. */
  public lockType?: string;
  /** [[LockLevel]] of the updated Locks. */
  public lockLevel?: string;
  /** Id's of the updated Locks. */
  public objectIds?: string[];
  /** Id of the [[ChangeSet]] Locks were released with. */
  public releasedWithChangeSet?: string;

  /**
   * Construct this event from object instance.
   * @hidden
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

/** Sent when all [[Lock]]s for a [[Briefcase]] are deleted. Can occur when calling [[LockHandler.deleteAll]] or [[BriefcaseHandler.delete]]. */
export class AllLocksDeletedEvent extends BriefcaseEvent {
}

/** Sent when a [[ChangeSet]] is successfully pushed. See [[ChangeSetHandler.create]]. It's sent when a new [[ChangeSet]] is successfully pushed to an iModel. See [[ChangeSetPrePushEvent]] for the event indicating the start of a ChangeSet push.  */
export class ChangeSetPostPushEvent extends BriefcaseEvent {
  /** Id of the ChangeSet that was pushed. */
  public changeSetId?: string;
  /** Index of the ChangeSet that was pushed. */
  public changeSetIndex?: number;

  /**
   * Construct this event from object instance.
   * @hidden
   * @param obj Object instance.
   */
  public fromJson(obj: any) {
    super.fromJson(obj);
    this.changeSetId = obj.ChangeSetId;
    this.changeSetIndex = obj.ChangeSetIndex;
  }
}

/**
 * Sent when a [[ChangeSet]] push has started. See [[ChangeSetHandler.create]]. ChangeSetPrePushEvent indicates that iModelHub allowed one of the [[Briefcase]]s to push a ChangeSet and all other push attempts will fail, until this push times out or succeeds. See [[ChangeSetPostPushEvent]] for an event indicating a successful push.
 */
export class ChangeSetPrePushEvent extends IModelHubEvent {
}

/**
 * Sent when one or more [Code]($common)s are updated. See [[CodeHandler.update]]. Code updates can be very frequent, so it's recommended to not to subscribe to CodeEvents, if it's not necessary.
 */
export class CodeEvent extends BriefcaseEvent {
  /** Id of the [CodeSpec]($common) for the updated Codes. */
  public codeSpecId?: string;
  /** Scope of the updated Codes. */
  public codeScope?: string;
  /** Array of the updated Code values. */
  public values?: string[];
  /** State Codes were updated to. */
  public state?: CodeState = CodeState.Reserved;

  /**
   * Construct this event from object instance.
   * @hidden
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

/**
 * Sent when all [Code]($common)s for a [[Briefcase]] are deleted. Can occur when calling [[CodeHandler.deleteAll]] or [[BriefcaseHandler.delete]].
 */
export class AllCodesDeletedEvent extends BriefcaseEvent {
}

/**
 * Sent when a [[Briefcase]] is deleted. See [[BriefcaseHandler.delete]].
 */
export class BriefcaseDeletedEvent extends BriefcaseEvent {
}

/**
 * Sent when a seed file is replaced. Seed file replacement is deprecated and this event should no longer occur.
 */
export class SeedFileReplacedEvent extends IModelHubEvent {
  /** Id of the new file. */
  public fileId?: string;

  /**
   * Construct this event from object instance.
   * @hidden
   * @param obj Object instance.
   */
  public fromJson(obj: any) {
    super.fromJson(obj);
    this.fileId = obj.FileId;
  }
}

/**
 * Sent when iModel is locked or unlocked. When iModel is locked, no other requests can be sent to it.
 */
export class IModelLockEvent extends IModelHubEvent {
  /** True if iModel is now locked, false if it's unlocked. */
  public locked?: boolean;

  /**
   * Construct this event from object instance.
   * @hidden
   * @param obj Object instance.
   */
  public fromJson(obj: any) {
    super.fromJson(obj);
    this.locked = obj.Locked;
  }
}

/**
 * Sent when iModel is deleted. See [[IModelHandler.delete]]. [[EventSubscription]] will be deleted 5 minutes after iModel is deleted, removing all events from subscription queues, making it possible for this event to be missed if not retrieved immediately.
 */
export class IModelDeletedEvent extends IModelHubEvent {
}

/**
 * Sent when a new named [[Version]] is created. See [[VersionHandler.create]].
 */
export class VersionEvent extends IModelHubEvent {
  /** Id of the created Version. */
  public versionId?: string;
  /** Name of the created Version. */
  public versionName?: string;
  /** Id of the [[ChangeSet]] that this Version was created for.  */
  public changeSetId?: string;

  /**
   * Construct this event from object instance.
   * @hidden
   * @param obj Object instance.
   */
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
 * Parse [[IModelHubEvent]] from response object.
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

/**
 * Subscription to receive [[IModelHubEvent]]s. Each subscription has a separate queue for events that it hasn't read yet. Subscriptions are deleted, if they are inactive for an hour. Use wsgId of this instance for the methods that require subscriptionId. See [[EventSubscriptionHandler]].
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.EventSubscription", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class EventSubscription extends WsgInstance {
  /** Types of the [[IModelHubEvent]]s that this subscription listens to. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.EventTypes")
  public eventTypes?: EventType[];
}

/**
 * Shared access signature token for getting [[IModelHubEvent]]s. It's used to authenticate for [[EventHandler.getEvent]]. To receive an instance call [[EventHandler.getSASToken]].
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.EventSAS", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class EventSAS extends BaseEventSAS {
}

/**
 * Handler for managing [[EventSubscription]]s. Use [[EventHandler.Subscriptions]] to get an instance of this class.
 */
export class EventSubscriptionHandler {
  private _handler: IModelBaseHandler;

  /**
   * Constructor for EventSubscriptionHandler.
   * @hidden
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /**
   * Get relative url for EventSubscription requests.
   * @hidden
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param instanceId Id of the subscription.
   */
  private getRelativeUrl(imodelId: string, instanceId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/EventSubscription/${instanceId || ""}`;
  }

  /**
   * Create an [[EventSubscription]].
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param events Array of EventTypes to subscribe to.
   * @return Created EventSubscription instance.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async create(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, events: EventType[]) {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Creating event subscription on iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.nonEmptyArray("events", events);

    let subscription = new EventSubscription();
    subscription.eventTypes = events;

    subscription = await this._handler.postInstance<EventSubscription>(alctx, EventSubscription, token, this.getRelativeUrl(imodelId), subscription);
    alctx.enter();
    Logger.logTrace(loggingCategory, `Created event subscription on iModel ${imodelId}`);

    return subscription;
  }

  /**
   * Update an [[EventSubscription]]. Can change the [[EventType]]s specified in the subscription. Must be a valid subscription that was previously created with [[EventSubscriptionHandler.create]] that hasn't expired.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param subscription Updated EventSubscription.
   * @return EventSubscription instance from iModelHub after update.
   * @throws [[IModelHubError]] with [IModelHubStatus.EventSubscriptionDoesNotExist]($bentley) if [[EventSubscription]] does not exist with the specified subscription.wsgId.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async update(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, subscription: EventSubscription): Promise<EventSubscription> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Updating event subscription on iModel ${subscription.wsgId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.defined("subscription", subscription);
    ArgumentCheck.validGuid("subscription.wsgId", subscription.wsgId);

    const updatedSubscription = await this._handler.postInstance<EventSubscription>(alctx, EventSubscription, token, this.getRelativeUrl(imodelId, subscription.wsgId), subscription);
    alctx.enter();

    Logger.logTrace(loggingCategory, `Updated event subscription on iModel ${subscription.wsgId}`);

    return updatedSubscription;
  }

  /**
   * Delete an [[EventSubscription]].
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param eventSubscriptionId Id of the EventSubscription.
   * @returns Resolves if the EventSubscription has been successfully deleted.
   * @throws [[IModelHubError]] with [IModelHubStatus.EventSubscriptionDoesNotExist]($bentley) if EventSubscription does not exist with the specified subscription.wsgId.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async delete(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, eventSubscriptionId: string): Promise<void> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Deleting event subscription ${eventSubscriptionId} from iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.validGuid("eventSubscriptionId", eventSubscriptionId);

    await this._handler.delete(alctx, token, this.getRelativeUrl(imodelId, eventSubscriptionId));
    alctx.enter();
    Logger.logTrace(loggingCategory, `Deleted event subscription ${eventSubscriptionId} from iModel ${imodelId}`);
  }
}

/**
 * Handler for receiving [[IModelHubEvent]]s. Use [[IModelClient.Events]] to get an instance of this class.
 */
export class EventHandler extends EventBaseHandler {
  private _subscriptionHandler: EventSubscriptionHandler | undefined;

  /**
   * Constructor for EventHandler.
   * @hidden
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    super();
    this._handler = handler;
  }

  /**
   * Get a handler for managing [[EventSubscription]]s.
   */
  public Subscriptions(): EventSubscriptionHandler {
    if (!this._subscriptionHandler) {
      this._subscriptionHandler = new EventSubscriptionHandler(this._handler);
    }

    return this._subscriptionHandler;
  }

  /**
   * Get relative url for EventSAS requests.
   * @hidden
   * @param imodelId Id of the iModel. See [[HubIModel]].
   */
  private getEventSASRelativeUrl(imodelId: string): string {
    return `/Repositories/iModel--${imodelId}/iModelScope/EventSAS/`;
  }

  /**
   * Get event SAS Token. Used to authenticate for [[EventHandler.getEvent]].
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @return SAS Token to connect to the topic.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async getSASToken(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string): Promise<EventSAS> {
    Logger.logInfo(loggingCategory, `Getting event SAS token from iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    const eventSAS = await this._handler.postInstance<EventSAS>(alctx, EventSAS, token, this.getEventSASRelativeUrl(imodelId), new EventSAS());
    alctx.enter();
    Logger.logTrace(loggingCategory, `Got event SAS token from iModel ${imodelId}`);

    return eventSAS;
  }

  /**
   * Get absolute url for event requests.
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
   * Get [[IModelHubEvent]] from the [[EventSubscription]]. You can use long polling timeout, to have requests return when events are available (or request times out), rather than returning immediately when no events are found.
   * @param sasToken SAS Token used to authenticate. See [[EventSAS.sasToken]].
   * @param baseAddress Address for the events. See [[EventSAS.baseAddress]].
   * @param subscriptionId Id of the subscription to the topic. See [[EventSubscription]].
   * @param timeout Optional timeout duration in seconds for request, when using long polling.
   * @return IModelHubEvent if it exists, undefined otherwise.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the arguments is undefined or has an invalid value.
   * @throws [[ResponseError]] if request has failed.
   */
  public async getEvent(alctx: ActivityLoggingContext, sasToken: string, baseAddress: string, subscriptionId: string, timeout?: number): Promise<IModelHubEvent | undefined> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Getting event from subscription ${subscriptionId}`);
    ArgumentCheck.defined("sasToken", sasToken);
    ArgumentCheck.defined("baseAddress", baseAddress);
    ArgumentCheck.validGuid("subscriptionId", subscriptionId);

    const options = this.getEventRequestOptions(GetEventOperationToRequestType.GetDestructive, sasToken, timeout);

    const result = await request(alctx, this.getEventUrl(baseAddress, subscriptionId, timeout), options);
    alctx.enter();
    if (result.status === 204) {
      Logger.logTrace(loggingCategory, `No events found on subscription ${subscriptionId}`);
      return undefined;
    }

    const event = ParseEvent(result);
    Logger.logTrace(loggingCategory, `Got event from subscription ${subscriptionId}`);

    return Promise.resolve(event);
  }

  /**
   * Create a listener for long polling events from an [[EventSubscription]]. When event is received from the subscription, every registered listener callback is called. This continuously waits for events until all created listeners for that subscriptionId are deleted. [[EventSAS]] token expirations are handled automatically, [[AccessToken]] expiration is handled by calling authenticationCallback to get a new token.
   * @param authenticationCallback Callback used to get AccessToken. Only the first registered authenticationCallback for this subscriptionId will be used.
   * @param subscriptionId Id of EventSubscription.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param listener Callback that is called when an [[IModelHubEvent]] is received.
   * @returns Function that deletes the created listener.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the arguments is undefined or has an invalid value.
   */
  public createListener(alctx: ActivityLoggingContext, authenticationCallback: () => Promise<AccessToken>, subscriptionId: string, imodelId: string, listener: (event: IModelHubEvent) => void): () => void {
    alctx.enter();
    ArgumentCheck.defined("authenticationCallback", authenticationCallback);
    ArgumentCheck.validGuid("subscriptionId", subscriptionId);
    ArgumentCheck.validGuid("imodelId", imodelId);

    const subscription = new ListenerSubscription();
    subscription.authenticationCallback = authenticationCallback;
    subscription.getEvent = (sasToken: string, baseAddress: string, id: string, timeout?: number) =>
      this.getEvent(alctx, sasToken, baseAddress, id, timeout);
    subscription.getSASToken = (token: AccessToken) => this.getSASToken(alctx, token, imodelId);
    subscription.id = subscriptionId;
    return EventListener.create(subscription, listener);
  }
}
