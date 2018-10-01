/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelHubGlobalEvents */

import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { request, Response, RequestOptions } from "./../Request";
import { AccessToken } from "../Token";
import { Logger, ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";
import { EventBaseHandler, IModelHubBaseEvent, BaseEventSAS, ListenerSubscription, EventListener, GetEventOperationToRequestType } from "./EventsBase";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck } from "./Errors";

const loggingCategory = "imodeljs-clients.imodelhub";

/**
 * Type of [[IModelHubGlobalEvent]]. Global Event type is used to define which events you wish to receive from your [[GlobalEventSubscription]]. See [[GlobalEventSubscriptionHandler.create]] and [[GlobalEventSubscriptionHandler.update]].
 */
export type GlobalEventType =
  /** Sent when an iModel is put into the archive. See [[SoftiModelDeleteEvent]]. */
  "SoftiModelDeleteEvent" |
  /** Sent when an archived iModel is completely deleted from the storage. See [[HardiModelDeleteEvent]]. */
  "HardiModelDeleteEvent" |
  /** Sent when an iModel is created. See [[IModelCreatedEvent]]. */
  "iModelCreatedEvent" |
  /** Sent when a [[ChangeSet]] is pushed. See [[ChangeSetCreatedEvent]]. */
  "ChangeSetCreatedEvent" |
  /** Sent when a named [[Version]] is created. See [[NamedVersionCreatedEvent]]. */
  "NamedVersionCreatedEvent";

/**
 * Base type for all iModelHub global events.
 */
export abstract class IModelHubGlobalEvent extends IModelHubBaseEvent {
  /** Id of the iModel that caused this event. */
  public iModelId?: Guid;
  /** Id of the [[Project]] that this iModel belongs to. */
  public projectId?: string;

  /**
   * Construct this global event from object instance.
   * @hidden
   * @param obj Object instance.
   */
  public fromJson(obj: any) {
    super.fromJson(obj);
    this.iModelId = new Guid(obj.iModelId);
    this.projectId = obj.ProjectId;
  }
}

/**
 * Sent when an iModel is put into the archive. See [[IModelHandler.delete]].
 */
export class SoftiModelDeleteEvent extends IModelHubGlobalEvent {
}

/**
 * Sent when an archived iModel is completely deleted from the storage. Sent after some time passes after [[IModelHandler.delete]] and iModel is no longer kept in the archive. iModel is kept at least 30 days in the archive.
 */
export class HardiModelDeleteEvent extends IModelHubGlobalEvent {
}

/**
 * Sent when an iModel is created. See [[IModelHandler.create]].
 */
export class IModelCreatedEvent extends IModelHubGlobalEvent {
}

/**
 * Sent when a [[ChangeSet]] is pushed. See [[ChangeSetHandler.create]]. Sent together with [[ChangeSetPostPushEvent]].
 */
export class ChangeSetCreatedEvent extends IModelHubGlobalEvent {
  public changeSetId?: string;
  public changeSetIndex?: string;
  public briefcaseId?: number;

  /**
   * Construct this event from object instance.
   * @param obj Object instance.
   */
  public fromJson(obj: any) {
    super.fromJson(obj);
    this.changeSetId = obj.ChangeSetId;
    this.changeSetIndex = obj.ChangeSetIndex;
    this.briefcaseId = obj.BriefcaseId;
  }
}

/**
 * Sent when a named [[Version]] is created. See [[VersionHandler.create]].
 */
export class NamedVersionCreatedEvent extends IModelHubGlobalEvent {
  public versionId?: Guid;
  public versionName?: string;
  public changeSetId?: string;

  /**
   * Construct this event from object instance.
   * @param obj Object instance.
   */
  public fromJson(obj: any) {
    super.fromJson(obj);
    this.versionId = new Guid(obj.VersionId);
    this.versionName = obj.VersionName;
    this.changeSetId = obj.ChangeSetId;
  }
}

type GlobalEventConstructor = (new (handler?: IModelBaseHandler, sasToken?: string) => IModelHubGlobalEvent);
/**
 * Get constructor from GlobalEventType name.
 * @hidden
 */
function ConstructorFromEventType(type: GlobalEventType): GlobalEventConstructor {
  switch (type) {
    case "SoftiModelDeleteEvent":
      return SoftiModelDeleteEvent;
    case "HardiModelDeleteEvent":
      return HardiModelDeleteEvent;
    case "iModelCreatedEvent":
      return IModelCreatedEvent;
    case "ChangeSetCreatedEvent":
      return ChangeSetCreatedEvent;
    case "NamedVersionCreatedEvent":
      return NamedVersionCreatedEvent;
  }
}

/**
 * Parse [[IModelHubGlobalEvent]] from response object.
 * @hidden
 * @param response Response object to parse.
 * @returns Appropriate global event object.
 */
export function ParseGlobalEvent(response: Response, handler?: IModelBaseHandler, sasToken?: string): IModelHubGlobalEvent {
  const constructor: GlobalEventConstructor = ConstructorFromEventType(response.header["content-type"]);
  const globalEvent = new constructor(handler, sasToken);
  globalEvent.fromJson({ ...response.header, ...response.body });
  return globalEvent;
}

/**
 * Subscription to receive [[IModelHubGlobalEvent]]s. Each subscription has a separate queue for events that it hasn't read yet. Global event subscriptions do not expire and must be deleted by the user. Use wsgId of this instance for the methods that require subscriptionId. See [[GlobalEventSubscriptionHandler]].
 */
@ECJsonTypeMap.classToJson("wsg", "GlobalScope.GlobalEventSubscription", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class GlobalEventSubscription extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.EventTypes")
  public eventTypes?: GlobalEventType[];

  @ECJsonTypeMap.propertyToJson("wsg", "properties.SubscriptionId")
  public subscriptionId?: string;
}

/**
 * Shared access signature token for getting [[IModelHubGlobalEvent]]s. It's used to authenticate for [[GlobalEventHandler.getEvent]]. To receive an instance call [[GlobalEventHandler.getSASToken]].
 */
@ECJsonTypeMap.classToJson("wsg", "GlobalScope.GlobalEventSAS", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class GlobalEventSAS extends BaseEventSAS {
}

/**
 * Handler for managing [[GlobalEventSubscription]]s.
 *
 * Use [[GlobalEventHandler.Subscriptions]] to get an instance of this class.
 */
export class GlobalEventSubscriptionHandler {
  private _handler: IModelBaseHandler;

  /**
   * Constructor for GlobalEventSubscriptionHandler.
   * @hidden
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /**
   * Get relative url for GlobalEventSubscription requests.
   * @hidden
   * @param instanceId Id of the subscription.
   */
  private getRelativeUrl(instanceId?: string) {
    return `/Repositories/Global--Global/GlobalScope/GlobalEventSubscription/${instanceId || ""}`;
  }

  /**
   * Create a [[GlobalEventSubscription]]. You can use this to get or update the existing subscription instance, if you only have the original subscriptionId.
   * @param token Delegation token of the authorized Service Account.
   * @param subscriptionId Guid to be used by global event subscription. It will be a part of the resulting subscription id.
   * @param globalEvents Array of GlobalEventTypes to subscribe to.
   * @return Created GlobalEventSubscription instance.
   * @throws [[IModelHubError]] with [IModelHubStatus.EventSubscriptionAlreadyExists]($bentley) if [[GlobalEventSubscription]] already exists with the specified subscriptionId.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async create(alctx: ActivityLoggingContext, token: AccessToken, subscriptionId: string, globalEvents: GlobalEventType[]) {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Creating global event subscription with instance id: ${subscriptionId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("subscriptionId", subscriptionId);

    let subscription = new GlobalEventSubscription();
    subscription.eventTypes = globalEvents;
    subscription.subscriptionId = subscriptionId;

    subscription = await this._handler.postInstance<GlobalEventSubscription>(alctx, GlobalEventSubscription, token, this.getRelativeUrl(), subscription);
    alctx.enter();
    Logger.logTrace(loggingCategory, `Created global event subscription with instance id: ${subscriptionId}`);

    return subscription;
  }

  /**
   * Update a [[GlobalEventSubscription]]. Can change the [[GlobalEventType]]s specified in the subscription. Must be a valid subscription that was previously created with [[GlobalEventSubscriptionHandler.create]].
   * @param token Delegation token of the authorized Service Account.
   * @param subscription Updated GlobalEventSubscription.
   * @return GlobalEventSubscription instance from iModelHub after update.
   * @throws [[IModelHubError]] with [IModelHubStatus.EventSubscriptionDoesNotExist]($bentley) if [[GlobalEventSubscription]] does not exist with the specified subscription.wsgId.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async update(alctx: ActivityLoggingContext, token: AccessToken, subscription: GlobalEventSubscription): Promise<GlobalEventSubscription> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Updating global event subscription with instance id: ${subscription.wsgId} and subscription id: ${subscription.subscriptionId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.defined("subscription", subscription);
    ArgumentCheck.validGuid("subscription.wsgId", subscription.wsgId);

    const updatedSubscription = await this._handler.postInstance<GlobalEventSubscription>(alctx, GlobalEventSubscription, token, this.getRelativeUrl(subscription.wsgId), subscription);
    alctx.enter();
    Logger.logTrace(loggingCategory, `Updated global event subscription with instance id: ${subscription.wsgId} and subscription id: ${subscription.subscriptionId}`);

    return updatedSubscription;
  }

  /**
   * Delete a [[GlobalEventSubscription]].
   * @param token Delegation token of the authorized Service Account.
   * @param subscriptionInstanceId WSG Id of the GlobalEventSubscription.
   * @returns Resolves if the GlobalEventSubscription has been successfully deleted.
   * @throws [[IModelHubError]] with [IModelHubStatus.EventSubscriptionDoesNotExist]($bentley) if GlobalEventSubscription does not exist with the specified subscription.wsgId.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async delete(alctx: ActivityLoggingContext, token: AccessToken, subscriptionInstanceId: string): Promise<void> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Deleting global event subscription with instance id: ${subscriptionInstanceId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("subscriptionInstanceId", subscriptionInstanceId);

    await this._handler.delete(alctx, token, this.getRelativeUrl(subscriptionInstanceId));
    alctx.enter();
    Logger.logTrace(loggingCategory, `Deleted global event subscription with instance id: ${subscriptionInstanceId}`);
  }
}

/** Type of [[GlobalEventHandler.getEvent]] operations. */
export enum GetEventOperationType {
  /** Event will be immediately removed from queue. */
  Destructive = 0,
  /** Event will be locked instead of removed. It has to be later removed via [[IModelHubBaseEvent.delete]]. */
  Peek,
}

/**
 * Handler for receiving [[IModelHubGlobalEvent]]s.
 *
 * Use [[IModelClient.GlobalEvents]] to get an instance of this class.
 */
export class GlobalEventHandler extends EventBaseHandler {
  private _subscriptionHandler: GlobalEventSubscriptionHandler | undefined;

  /**
   * Constructor for GlobalEventHandler.
   * @hidden
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    super();
    this._handler = handler;
  }

  /**
   * Get a handler for managing [[GlobalEventSubscription]]s.
   */
  public Subscriptions(): GlobalEventSubscriptionHandler {
    if (!this._subscriptionHandler) {
      this._subscriptionHandler = new GlobalEventSubscriptionHandler(this._handler);
    }

    return this._subscriptionHandler;
  }

  /**
   * Get relative url for GlobalEventSAS requests.
   * @hidden
   */
  private getGlobalEventSASRelativeUrl(): string {
    return `/Repositories/Global--Global/GlobalScope/GlobalEventSAS/`;
  }

  /**
   * Get global event SAS Token. Used to authenticate for [[GlobalEventHandler.getEvent]].
   * @param token Delegation token of the authorized Service Account.
   * @return SAS Token to connect to the topic.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async getSASToken(alctx: ActivityLoggingContext, token: AccessToken): Promise<GlobalEventSAS> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Getting global event SAS token`);
    ArgumentCheck.defined("token", token);

    const globalEventSAS = await this._handler.postInstance<GlobalEventSAS>(alctx, GlobalEventSAS, token, this.getGlobalEventSASRelativeUrl(), new GlobalEventSAS());
    alctx.enter();
    Logger.logTrace(loggingCategory, `Got global event SAS token`);

    return globalEventSAS;
  }

  /**
   * Get absolute url for global event requests.
   * @param baseAddress Base address for the serviceBus.
   * @param subscriptionId Id of the subscription instance.
   * @param timeout Optional timeout for long polling.
   */
  private getGlobalEventUrl(baseAddress: string, subscriptionId: string, timeout?: number): string {
    let url: string = `${baseAddress}/Subscriptions/${subscriptionId}/messages/head`;

    if (timeout) {
      url = url + `?timeout=${timeout}`;
    }

    return url;
  }

  /**
   * Get an [[IModelHubGlobalEvent]] from the [[GlobalEventSubscription]]. You can use long polling timeout, to have requests return when events are available (or request times out), rather than returning immediately when no events are found.
   * @param sasToken SAS Token used to authenticate. See [[GlobalEventSAS.sasToken]].
   * @param baseAddress Address for the events. See [[GlobalEventSAS.baseAddress]].
   * @param subscriptionInstanceId Id of the subscription to the topic. See [[GlobalEventSubscription]].
   * @param timeout Optional timeout duration in seconds for request, when using long polling.
   * @return IModelHubGlobalEvent if it exists, undefined otherwise.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the arguments is undefined or has an invalid value.
   * @throws [[ResponseError]] if request has failed.
   */
  public async getEvent(alctx: ActivityLoggingContext, sasToken: string, baseAddress: string, subscriptionInstanceId: string, timeout?: number, getOperation: GetEventOperationType = GetEventOperationType.Destructive): Promise<IModelHubGlobalEvent | undefined> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Getting global event from subscription with instance id: ${subscriptionInstanceId}`);
    ArgumentCheck.defined("sasToken", sasToken);
    ArgumentCheck.defined("baseAddress", baseAddress);
    ArgumentCheck.defined("subscriptionInstanceId", subscriptionInstanceId);

    let options: RequestOptions;
    if (getOperation === GetEventOperationType.Destructive)
      options = this.getEventRequestOptions(GetEventOperationToRequestType.GetDestructive, sasToken, timeout);
    else if (getOperation === GetEventOperationType.Peek)
      options = this.getEventRequestOptions(GetEventOperationToRequestType.GetPeek, sasToken, timeout);
    else // Unknown operation type.
      return undefined;

    const result = await request(alctx, this.getGlobalEventUrl(baseAddress, subscriptionInstanceId, timeout), options);
    alctx.enter();
    if (result.status === 204) {
      Logger.logTrace(loggingCategory, `No events found on subscription ${subscriptionInstanceId}`);
      return undefined;
    }

    const event = ParseGlobalEvent(result, this._handler, sasToken);
    Logger.logTrace(loggingCategory, `Got Global Event from subscription with instance id: ${subscriptionInstanceId}`);

    return Promise.resolve(event);
  }

  /**
   * Create a listener for long polling events from a [[GlobalEventSubscription]]. When event is received from the subscription, every registered listener callback is called. This continuously waits for events until all created listeners for that subscriptionInstanceId are deleted. [[GlobalEventSAS]] token expirations are handled automatically, [[AccessToken]] expiration is handled by calling authenticationCallback to get a new token.
   * @param authenticationCallback Callback used to get AccessToken. Only the first registered authenticationCallback for this subscriptionId will be used.
   * @param subscriptionInstanceId Id of GlobalEventSubscription.
   * @param listener Callback that is called when an [[IModelHubGlobalEvent]] is received.
   * @returns Function that deletes the created listener.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the arguments is undefined or has an invalid value.
   */
  public createListener(alctx: ActivityLoggingContext, authenticationCallback: () => Promise<AccessToken>, subscriptionInstanceId: string, listener: (event: IModelHubGlobalEvent) => void): () => void {
    alctx.enter();
    ArgumentCheck.defined("subscriptionInstanceId", subscriptionInstanceId);
    const subscription = new ListenerSubscription();
    subscription.authenticationCallback = authenticationCallback;
    subscription.getEvent = (sasToken: string, baseAddress: string, id: string, timeout?: number) =>
      this.getEvent(alctx, sasToken, baseAddress, id, timeout);
    subscription.getSASToken = (token: AccessToken) => this.getSASToken(alctx, token);
    subscription.id = subscriptionInstanceId;
    return EventListener.create(subscription, listener);
  }
}
