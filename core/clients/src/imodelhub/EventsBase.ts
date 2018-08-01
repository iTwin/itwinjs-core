/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHubEvents */

import { request, RequestOptions } from "../Request";
import { Config } from "../Config";
import { DefaultRequestOptionsProvider } from "../Client";
import { ECJsonTypeMap, WsgInstance } from "../ECJsonTypeMap";
import { BeEvent } from "@bentley/bentleyjs-core";
import { AccessToken } from "../Token";
import { IModelBaseHandler } from "./BaseHandler";

export abstract class BaseEventSAS extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.BaseAddress")
  public baseAddress?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.EventServiceSASToken")
  public sasToken?: string;
}

/** Base type for all iModelHub global events */
export abstract class IModelHubBaseEvent {
  public eventTopic?: string;
  public fromEventSubscriptionId?: string;
  public toEventSubscriptionId?: string;
  protected _handler?: IModelBaseHandler;
  protected _sasToken?: string;
  protected _lockUrl?: string;

  constructor(handler?: IModelBaseHandler, sasToken?: string) {
    this._handler = handler;
    this._sasToken = sasToken;
  }

  /**
   * Construct this event from object instance.
   * @param obj Object instance.
   */
  public fromJson(obj: any) {
    this.eventTopic = obj.EventTopic;
    this.fromEventSubscriptionId = obj.FromEventSubscriptionId;
    this.toEventSubscriptionId = obj.ToEventSubscriptionId;
    this._lockUrl = obj.location;
  }

  /**
   * Removes single event from queue.
   * @returns true if operation succeeded.
   */
  public async delete(): Promise<boolean> {
    if (this._handler && this._lockUrl && this._sasToken) {
      const options = getEventBaseOperationRequestOptions(this._handler, ModifyEventOperationToRequestType.Delete, this._sasToken);
      const result = await request(this._lockUrl, options);

      if (result.status === 200)
        return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }
}

export enum ModifyEventOperationToRequestType {
  /** Deleted event from queue */
  Delete = "DELETE",
}

export enum GetEventOperationToRequestType {
  /** Gets event request options, destructive get. */
  GetDestructive = "DELETE",
  /** Gets event request options, non destructive get. */
  GetPeek = "POST",
}

/**
 * Gets base request options for event operations.
 * @param method Method for request.
 * @param sasToken Service Bus SAS Token.
 * @param requestTimeout Timeout for the request.
 * @return Event if it exists.
 */
export function getEventBaseOperationRequestOptions(handler: IModelBaseHandler, method: string, sasToken: string, requestTimeout?: number): RequestOptions {
  const options: RequestOptions = {
    method,
    headers: { authorization: sasToken },
    agent: handler.getAgent(),
  };

  // Request timeout is in seconds, wait 50% more than the expected timeout from server
  if (requestTimeout)
    options.timeout = requestTimeout * 1500;

  new DefaultRequestOptionsProvider().assignOptions(options);

  return options;
}

export abstract class EventBaseHandler {
  protected _handler: IModelBaseHandler; /** @hidden */
  /**
   * Gets service bus parser depending on the environment.
   * @hidden
   */
  protected setServiceBusOptions(options: RequestOptions) {
    const parse: (str: string) => any = (message: string) => {
      if (!message)
        return undefined;
      return JSON.parse(message.substring(message.indexOf("{"), message.lastIndexOf("}") + 1));
    };

    if (Config.isBrowser()) {
      options.parser = (_: any, message: any) => parse(message);
    } else {
      options.buffer = true;
      options.parser = (res: any, cb: any) => {
        res.on("data", (chunk: any) => { res.text += chunk; });
        res.on("end", () => {
          try {
            if (res.statusCode === 200 || res.statusCode === 201) {
              cb(null, parse(res.text));
            } else if (res.statusCode === 204) {
              cb(null, "");
            } else {
              cb(res, null);
            }
          } catch (err) {
            cb(err, null);
          }
        });
      };
    }
  }

  /**
   * Gets event request options, gets event from queue.
   * @param sasToken Service Bus SAS Token.
   * @param requestTimeout Timeout for the request.
   * @return Event if it exists.
   * @hidden
   */
  protected getEventRequestOptions(operation: GetEventOperationToRequestType, sasToken: string, requestTimeout?: number): RequestOptions {
    const options = getEventBaseOperationRequestOptions(this._handler, operation, sasToken, requestTimeout);

    this.setServiceBusOptions(options);

    return options;
  }
}

export class ListenerSubscription {
  public listeners: BeEvent<(event: IModelHubBaseEvent) => void>;
  public authenticationCallback: () => Promise<AccessToken>;
  public getEvent: (token: string, baseAddress: string, subscriptionId: string, timeout?: number) => Promise<IModelHubBaseEvent | undefined>;
  public getSASToken: (token: AccessToken) => Promise<BaseEventSAS>;
  public id: string;
}

/** @hidden */
export class EventListener {
  private static subscriptions: Map<string, ListenerSubscription>;

  /** @hidden */
  public static create(subscription: ListenerSubscription, listener: (event: IModelHubBaseEvent) => void): () => void {
    if (!this.subscriptions) {
      this.subscriptions = new Map<string, ListenerSubscription>();
    }
    let existingSubscription = this.subscriptions.get(subscription.id);
    let deleteListener: () => void;
    if (!existingSubscription) {
      existingSubscription = subscription;
      existingSubscription.listeners = new BeEvent<(event: IModelHubBaseEvent) => void>();
      deleteListener = subscription.listeners.addListener(listener);
      this.getEvents(subscription);
    } else {
      deleteListener = subscription.listeners.addListener(listener);
    }

    this.subscriptions.set(subscription.id, existingSubscription);
    const subscriptionId = subscription.id;
    return () => {
      deleteListener();
      const sub = this.subscriptions.get(subscriptionId);
      if (sub) {
        if (sub.listeners && sub.listeners.numberOfListeners === 0)
          this.subscriptions.delete(subscription.id);
      }
    };
  }

  private static async getEvents(subscription: ListenerSubscription) {
    let accessToken = await subscription.authenticationCallback();
    let eventSAS: BaseEventSAS | undefined;
    mainLoop:
    while (subscription.listeners.numberOfListeners > 0) {
      try {
        eventSAS = (await subscription.getSASToken(accessToken));
      } catch (err) {
        if (err.status === 401) {
          try {
            accessToken = await subscription.authenticationCallback();
          } catch {
            break;
          }
        } else {
          break;
        }
      }

      while (subscription.listeners.numberOfListeners > 0) {
        try {
          const event = await subscription.getEvent(eventSAS!.sasToken!, eventSAS!.baseAddress!, subscription.id, 60);
          if (event)
            subscription.listeners.raiseEvent(event);
        } catch (err) {
          if (err.status === 401) {
            break;
          } else {
            break mainLoop;
          }
        }
      }
    }
    this.subscriptions.delete(subscription.id);
  }
}
