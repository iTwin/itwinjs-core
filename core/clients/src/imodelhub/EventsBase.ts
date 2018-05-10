/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { RequestOptions } from "../Request";
import { Config } from "../Config";
import { DefaultRequestOptionsProvider } from "../Client";
import { ECJsonTypeMap, WsgInstance } from "../ECJsonTypeMap";
import { BeEvent } from "@bentley/bentleyjs-core";
import { AccessToken } from "../Token";

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

  /**
   * Construct this event from object instance.
   * @param obj Object instance.
   */
  public fromJson(obj: any) {
    this.eventTopic = obj.EventTopic;
    this.fromEventSubscriptionId = obj.FromEventSubscriptionId;
    this.toEventSubscriptionId = obj.ToEventSubscriptionId;
  }
}

export abstract class EventBaseHandler {
  /** Gets service bus parser depending on the environment. */
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
            if (res.statusCode === 200) {
              cb(null, parse(res.text));
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
   * Gets event from Service Bus Topic.
   * @param sasToken Service Bus SAS Token.
   * @return Event if it exists.
   */
  protected getEventRequestOptions(sasToken: string): RequestOptions {
    const options: RequestOptions = {
      method: "DELETE",
      headers: { authorization: sasToken },
    };

    new DefaultRequestOptionsProvider().assignOptions(options);

    this.setServiceBusOptions(options);

    return options;
  }
}

export class ListenerSubscription {
  public listeners: BeEvent<(event: IModelHubBaseEvent) => void>;
  public authenticationCallback: () => Promise<AccessToken>;
  public getEvent: (token: string, baseAddress: string, subscriptionId: string, timeout?: number) => Promise<IModelHubBaseEvent>;
  public getSASToken: (token: AccessToken) => Promise<BaseEventSAS>;
  public id: string;
}

export class EventListener {
  private static subscriptions: Map<string, ListenerSubscription>;

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
          subscription.listeners.raiseEvent(event);
        } catch (err) {
          if (err.status === 204) {
          } else if (err.status === 401) {
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
