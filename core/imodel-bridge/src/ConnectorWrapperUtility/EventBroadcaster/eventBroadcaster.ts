/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ConfigMapper } from "../ConfigMapper";
import { SendableMessageInfo, ServiceBusClient } from "@azure/service-bus";
import { Azure, createServiceBusService } from "azure-sb";
import { IJobEvent } from "./events";

export class EventBroadcaster {
  private static isInitialized = false;
  private static _sbConnectionString: string;
  private static _sbTopicName: string;
  private static _configMapper: ConfigMapper;

  public static async tryInitialize(configMapper: ConfigMapper): Promise<void> {
    try {
      return await EventBroadcaster.initialize(configMapper);
    } catch (e) {
      console.log(`Error when initializing EventBroadcaster: ${e}.`);
      return;
    }
  }

  public static async initialize(configMapper: ConfigMapper): Promise<void> {
    console.log(`Initializing EventBroadcaster`);
    EventBroadcaster._configMapper = configMapper;
    const sbConnectionString = configMapper.serviceBusConnectionString;
    const topicName = configMapper.serviceBusEventBroadcastTopic;

    if (!sbConnectionString) {
      const message = "EventBroadcast SB connection not found";
      console.log(message);
      throw new Error(message);
    }

    if (!topicName) {
      const message = "EventBroadcast SB topic name not found";
      console.log(message);
      throw new Error(message);
    }

    EventBroadcaster._sbConnectionString = sbConnectionString;
    EventBroadcaster._sbTopicName = topicName;

    await EventBroadcaster.createTopicIfNotExists(EventBroadcaster._sbConnectionString, EventBroadcaster._sbTopicName);

    EventBroadcaster.isInitialized = true;
    console.log(`Initialized EventBroadcaster successfully`);
  }

  public static async tryBroadcastEventIfInitialized(event: IJobEvent): Promise<void> {
    if (!EventBroadcaster.isInitialized) {
      console.log(`Not broadcasting an event - not initialized. Event: ${event.serviceBusLabel}.`);
      return;
    }

    return await EventBroadcaster.tryBroadcastEvent(event);
  }

  public static async tryBroadcastEvent(event: IJobEvent): Promise<void> {
    console.log(`EventBroadcaster broadcasting a JobEvent - ${event.serviceBusLabel}`);
    try {
      const client = ServiceBusClient.createFromConnectionString(EventBroadcaster._sbConnectionString);

      const topicClient = client.createTopicClient(EventBroadcaster._sbTopicName);

      const message: SendableMessageInfo = {
        label: event.serviceBusLabel,
        body: event.properties,
      };
      const sender = topicClient.createSender();
      try {
        await sender.send(message);
        console.log(`EventBroadcaster event sent successfully - ${event.serviceBusLabel}`);
      } finally {
        await sender.close();
        await topicClient.close();
        await client.close();
      }
    } catch (e) {
      console.log(`Error when trying to broadcast an event: ${e}`);
      // Eat the exception
    }
  }

  private static async createTopicIfNotExists(connectionString: string, topicName: string): Promise<Azure.ServiceBus.Response> {
    // The @azure/service-bus package should soon have the ServiceBusManagementClient which will allow us to
    // get rid of the "azure-sb" npm package which is currently used only for creating a topic if it doesn't exist.
    const service = createServiceBusService(connectionString);

    console.log(`EventBroadcaster creating SB topic ${topicName}.`);
    return new Promise((resolve, reject) => {
      service.createTopicIfNotExists(topicName, (error, result, response) => {
        if (!error && result) {
          console.log(`Created SB topic ${topicName} successfully.`);
          resolve(response);
          return;
        }

        if (!error && !result) {
          console.log(`SB topic ${topicName} already exists.`);
          resolve(response);
          return;
        }

        if (error) {
          reject(error);
          return;
        }
      });
    });
  }
}
