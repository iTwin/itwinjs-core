/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHubGlobalEvents */

import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";
import { request, Response, RequestOptions } from "./../Request";
import { AccessToken } from "../Token";
import { Logger } from "@bentley/bentleyjs-core";
import { EventBaseHandler, IModelHubBaseEvent, BaseEventSAS, ListenerSubscription, EventListener, GetEventOperationToRequestType } from "./EventsBase";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck } from "./Errors";

const loggingCategory = "imodeljs-clients.imodelhub";

/** Global Event Type string literals */
export type GlobalEventType =
  /** Sent when iModel is archived */
  "SoftiModelDeleteEvent" |
  /** Sent when archived iModel is deleted */
  "HardiModelDeleteEvent" |
  /** Sent when new iModel is created */
  "iModelCreatedEvent" |
  /** Sent when a ChangeSet push has started */
  "ChangeSetCreatedEvent" |
  /** Sent when a new Named Version is created */
  "NamedVersionCreatedEvent";

/** Base type for all iModelHub global events */
export abstract class IModelHubGlobalEvent extends IModelHubBaseEvent {
  public iModelId?: string;
  public projectId?: string;

  /**
   * Construct this global event from object instance.
   * @param obj Object instance.
   */
  public fromJson(obj: any) {
    super.fromJson(obj);
    this.iModelId = obj.iModelId;
    this.projectId = obj.ProjectId;
  }
}

/** Sent when iModel is archived */
export class SoftiModelDeleteEvent extends IModelHubGlobalEvent {
}

/** Sent when archived iModel is deleted */
export class HardiModelDeleteEvent extends IModelHubGlobalEvent {
}

/** Sent when new iModel is created */
export class IModelCreatedEvent extends IModelHubGlobalEvent {
}

/** Sent when a ChangeSet push has started */
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

/** Sent when a new Named Version is created */
export class NamedVersionCreatedEvent extends IModelHubGlobalEvent {
  public versionId?: string;
  public versionName?: string;
  public changeSetId?: string;

  /**
   * Construct this event from object instance.
   * @param obj Object instance.
   */
  public fromJson(obj: any) {
    super.fromJson(obj);
    this.versionId = obj.VersionId;
    this.versionName = obj.VersionName;
    this.changeSetId = obj.ChangeSetId;
  }
}

type GlobalEventConstructor = (new (handler?: IModelBaseHandler, sasToken?: string) => IModelHubGlobalEvent);
/** Get constructor from GlobalEventType name. */
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
 * Parse @see IModelHubGlobalEvent from response object.
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

/** GlobalEventSubscription */
@ECJsonTypeMap.classToJson("wsg", "GlobalScope.GlobalEventSubscription", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class GlobalEventSubscription extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.EventTypes")
  public eventTypes?: GlobalEventType[];

  @ECJsonTypeMap.propertyToJson("wsg", "properties.SubscriptionId")
  public subscriptionId?: string;
}

/** GlobalEventSAS */
@ECJsonTypeMap.classToJson("wsg", "GlobalScope.GlobalEventSAS", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class GlobalEventSAS extends BaseEventSAS {
}

/**
 * Handler for all methods related to @see GlobalEventSubscription instances.
 */
export class GlobalEventSubscriptionHandler {
  private _handler: IModelBaseHandler;

  /**
   * Constructor for GlobalEventSubscriptionHandler. Should use @see GlobalEventHandler instead of directly constructing this.
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /**
   * Gets relative url for GlobalEventSubscription requests.
   * @param instanceId Id of the subscription.
   */
  private getRelativeUrl(instanceId?: string) {
    return `/Repositories/Global--Global/GlobalScope/GlobalEventSubscription/${instanceId || ""}`;
  }

  /**
   * Creates global event subscription.
   * @param token Delegation token of the authorized Service Account.
   * @param subscriptionId Id of the global event subscription.
   * @param globalEvents Array of GlobalEventTypes to subscribe to.
   * @return Created GlobalEventSubscription instance.
   * @throws [[IModelHubError]] with [IModelHubStatus.EventSubscriptionAlreadyExists]($bentley)
   * if [[GlobalEventSubscription]] already exists with the specified subscriptionId.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async create(token: AccessToken, subscriptionId: string, globalEvents: GlobalEventType[]) {
    Logger.logInfo(loggingCategory, `Creating global event subscription with instance id: ${subscriptionId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("subscriptionId", subscriptionId);

    let subscription = new GlobalEventSubscription();
    subscription.eventTypes = globalEvents;
    subscription.subscriptionId = subscriptionId;

    subscription = await this._handler.postInstance<GlobalEventSubscription>(GlobalEventSubscription, token, this.getRelativeUrl(), subscription);

    Logger.logTrace(loggingCategory, `Created global event subscription with instance id: ${subscriptionId}`);

    return subscription;
  }

  /**
   * Updates global event subscription.
   * @param token Delegation token of the authorized Service Account.
   * @param subscription Updated global events subscription.
   * @return Updated GlobalEventSubscription instance.
   * @throws [[IModelHubError]] with [IModelHubStatus.EventSubscriptionDoesNotExist]($bentley)
   * if [[GlobalEventSubscription]] does not exist with the specified subscription.wsgId.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async update(token: AccessToken, subscription: GlobalEventSubscription): Promise<GlobalEventSubscription> {
    Logger.logInfo(loggingCategory, `Updating global event subscription with instance id: ${subscription.wsgId} and subscription id: ${subscription.subscriptionId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.defined("subscription", subscription);
    ArgumentCheck.defined("subscription.wsgId", subscription.wsgId);

    const updatedSubscription = await this._handler.postInstance<GlobalEventSubscription>(GlobalEventSubscription, token, this.getRelativeUrl(subscription.wsgId), subscription);

    Logger.logTrace(loggingCategory, `Updated global event subscription with instance id: ${subscription.wsgId} and subscription id: ${subscription.subscriptionId}`);

    return updatedSubscription;
  }

  /**
   * Deletes global event subscription.
   * @param token Delegation token of the authorized Service Account.
   * @param subscriptionId Id of the global event subscription instance.
   * @returns Resolves if the GlobalEventSubscription has been successfully deleted.
   * @throws [[IModelHubError]] with [IModelHubStatus.EventSubscriptionDoesNotExist]($bentley)
   * if [[GlobalEventSubscription]] does not exist with the specified subscription.wsgId.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async delete(token: AccessToken, subscriptionId: string): Promise<void> {
    Logger.logInfo(loggingCategory, `Deleting global event subscription with instance id: ${subscriptionId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.defined("subscriptionId", subscriptionId);

    await this._handler.delete(token, this.getRelativeUrl(subscriptionId));

    Logger.logTrace(loggingCategory, `Deleted global event subscription with instance id: ${subscriptionId}`);
  }
}

export enum GetEventOperationType {
  /** Event will get removed from queue. */
  Destructive = 0,
  /** Event does not get removed from queue. And can be removed via method @see IModelHubBaseEvent.delete */
  Peek,
}

/**
 * Handler for all methods related to iModel Hub global events.
 */
export class GlobalEventHandler extends EventBaseHandler {
  private _subscriptionHandler: GlobalEventSubscriptionHandler | undefined;

  /**
   * Constructor for GlobalEventHandler. Should use @see IModelClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    super();
    this._handler = handler;
  }

  /**
   * Get a handler for @see GlobalEventSubscription related methods.
   */
  public Subscriptions(): GlobalEventSubscriptionHandler {
    if (!this._subscriptionHandler) {
      this._subscriptionHandler = new GlobalEventSubscriptionHandler(this._handler);
    }

    return this._subscriptionHandler;
  }

  /**
   * Gets relative url for GlobalEventSAS requests.
   */
  private getGlobalEventSASRelativeUrl(): string {
    return `/Repositories/Global--Global/GlobalScope/GlobalEventSAS/`;
  }

  /**
   * Gets global event SAS Token.
   * @param token Delegation token of the authorized Service Account.
   * @return SAS Token to connect to the topic.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async getSASToken(token: AccessToken): Promise<GlobalEventSAS> {
    Logger.logInfo(loggingCategory, `Getting global event SAS token`);
    ArgumentCheck.defined("token", token);

    const globalEventSAS = await this._handler.postInstance<GlobalEventSAS>(GlobalEventSAS, token, this.getGlobalEventSASRelativeUrl(), new GlobalEventSAS());

    Logger.logTrace(loggingCategory, `Got global event SAS token`);

    return globalEventSAS;
  }

  /**
   * Gets absolute url for global event requests.
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
   * Gets global event from Service Bus Topic.
   * @param sasToken Service Bus SAS Token.
   * @param baseAddress Base address of Service Bus topic.
   * @param subscriptionId Id of the subscription instance to the topic.
   * @param timeout Optional timeout duration in seconds for request, when using long polling.
   * @return Global Event if it exists, undefined otherwise.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley)
   * or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the arguments is undefined
   * or has an invalid value.
   * @throws [[ResponseError]] if request has failed.
   */
  public async getEvent(sasToken: string, baseAddress: string, subscriptionId: string, timeout?: number, getOperation: GetEventOperationType = GetEventOperationType.Destructive): Promise<IModelHubGlobalEvent | undefined> {
    Logger.logInfo(loggingCategory, `Getting global event from subscription with instance id: ${subscriptionId}`);
    ArgumentCheck.defined("sasToken", sasToken);
    ArgumentCheck.defined("baseAddress", baseAddress);
    ArgumentCheck.defined("subscriptionId", subscriptionId);

    let options: RequestOptions;
    if (getOperation === GetEventOperationType.Destructive)
      options = this.getEventRequestOptions(GetEventOperationToRequestType.GetDestructive, sasToken, timeout);
    else if (getOperation === GetEventOperationType.Peek)
      options = this.getEventRequestOptions(GetEventOperationToRequestType.GetPeek, sasToken, timeout);
    else // Unknown operation type.
      return undefined;

    const result = await request(this.getGlobalEventUrl(baseAddress, subscriptionId, timeout), options);

    if (result.status === 204) {
      Logger.logTrace(loggingCategory, `No events found on subscription ${subscriptionId}`);
      return undefined;
    }

    const event = ParseGlobalEvent(result, this._handler, sasToken);
    Logger.logTrace(loggingCategory, `Got Global Event from subscription with instance id: ${subscriptionId}`);

    return Promise.resolve(event);
  }

  /**
   * Creates a listener for long polling events from a subscription.
   * @param authenticationCallback Callback used to get AccessToken. Only the first registered callback for this subscription will be used.
   * @param subscriptionId Id of subscription.
   * @param listener Callback that is called when an event is received.
   * @returns Function that deletes the listener.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley)
   * or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the arguments is undefined
   * or has an invalid value.
   */
  public createListener(authenticationCallback: () => Promise<AccessToken>, subscriptionId: string, listener: (event: IModelHubGlobalEvent) => void): () => void {
    ArgumentCheck.defined("subscriptionId", subscriptionId);
    const subscription = new ListenerSubscription();
    subscription.authenticationCallback = authenticationCallback;
    subscription.getEvent = (sasToken: string, baseAddress: string, id: string, timeout?: number) =>
      this.getEvent(sasToken, baseAddress, id, timeout);
    subscription.getSASToken = (token: AccessToken) => this.getSASToken(token);
    subscription.id = subscriptionId;
    return EventListener.create(subscription, listener);
  }
}
