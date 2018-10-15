/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ECJsonTypeMap, ECInstance, WsgInstance, ChangeState } from "../index";
import nock = require("nock");
import { TestConfig } from "./TestConfig";
import { KnownRegions } from "../Client";
import { Config } from "../Config";

export enum RequestType {
  Get,
  Post,
  Delete,
  Put,
}

export enum ScopeType {
  iModel,
  Project,
  Global,
}

export class ResponseBuilder {

  /**
   * Generates response for GET request.
   * @param classObject Class object from which response will be generated.
   * @param count How many times to repeat the same instance in a response.
   * @returns Created response in JSON.
   */
  public static generateGetResponse<T extends ECInstance>(classObject: T, count = 1): object {
    let response: string;
    let responseEnd: string = "";
    response = '{"instances":[';
    responseEnd = "]}";

    if (count > 0) {
      response += this.convertToJson(classObject, count);
    }
    response += responseEnd;
    return JSON.parse(response);
  }

  /**
   * Generates response for GET request.
   * @param classObjects Class objects from which response will be generated.
   * @returns Created response in JSON.
   */
  public static generateGetArrayResponse<T extends ECInstance>(classObjects: T[]): object {
    let response: string;
    let responseEnd: string = "";
    response = '{"instances":[';
    responseEnd = "]}";

    let i = 0;
    for (const obj of classObjects) {
      if (i++ > 0) {
        response += ",";
      }
      response += this.convertToJson(obj, 1);
    }
    response += responseEnd;
    return JSON.parse(response);
  }

  /**
   * Returns change type from state.
   * @param state Change state.
   */
  private static getChangeFromState(state?: ChangeState): string {
    switch (state) {
      case "modified":
        return "Modified";
      case "deleted":
        return "Deleted";
      case "new":
      default:
        return "Created";
    }
  }

  /**
   * Generates response for POST request.
   * @param classObject Class object from which response will be generated.
   * @returns Created response in JSON.
   */
  public static generatePostResponse<T extends WsgInstance>(classObject: T): object {
    const change: string = this.getChangeFromState(classObject.changeState);
    const response = `{"changedInstance":{"change":"${change}","instanceAfterChange":${this.convertToJson(classObject, 1)}}}`;
    return JSON.parse(response);
  }

  /**
   * Generates Changeset response for POST request.
   * @param classObjects Class objects from which response will be generated.
   * @returns Created response in JSON.
   */
  public static generateChangesetResponse<T extends WsgInstance>(classObjects: T[]): object {
    let response: string = '{"changedInstances":[';

    let i = 0;
    for (const obj of classObjects) {
      if (i++ > 0) {
        response += ",";
      }
      const change: string = this.getChangeFromState(obj.changeState);
      response += `{"change":"${change}","instanceAfterChange":${this.convertToJson(obj, 1)}}`;
    }

    response += "]}";
    return JSON.parse(response);
  }

  /**
   * Generates error response.
   * @param id Error id.
   * @param message Error message.
   * @param description Error description.
   * @param otherProperties Additional error properties.
   * @returns Created error in JSON.
   */
  public static generateError(id?: string, message?: string, description?: string, otherProperties?: Map<string, any>): object {
    let error = "{";

    error += `"errorId": "${id || "null"}",`;
    error += `"errorMessage": "${message || "null"}",`;
    error += `"errorDescription": "${description || "null"}"`;
    if (otherProperties !== undefined) {
      otherProperties.forEach((value: any, key: string) => {
        error += ",";
        error += `"${key}":${value}`;
      });
    }
    error += "}";

    return JSON.parse(error);
  }

  /**
   * Generates body for POST request.
   * @param classObject Class object from which body will be generated.
   * @returns Created POST body in JSON.
   */
  public static generatePostBody<T extends ECInstance>(classObject: T): object {
    return JSON.parse(`{"instance":${this.convertToJson(classObject, 1)}}`);
  }

  /**
   * Generates Changeset body for POST request.
   * @param classObjects Class objects from which body will be generated.
   * @param requestOptions Extended options for request.
   * @returns Created POST body in JSON.
   */
  public static generateChangesetBody<T extends ECInstance>(classObjects: T[], requestOptions?: object): object {
    let body: string = '{"instances":[';
    let i = 0;
    for (const obj of classObjects) {
      if (i++ > 0) {
        body += ",";
      }
      body += this.convertToJson(obj, 1);
    }

    body += "]";
    if (requestOptions) {
      body += `,"requestOptions":${JSON.stringify(requestOptions)}`;
    }
    body += "}";
    return JSON.parse(body);
  }

  /**
   * Converts ECInstance class objects to JSON.
   * @param classObjects Class objects from which body will be generated.
   * @returns Converted object in JSON.
   */
  private static convertToJson<T extends ECInstance>(classObject: T, count: number): string {
    let converted: string = "";
    const objectToJson = ECJsonTypeMap.toJson<T>("wsg", classObject);

    converted += JSON.stringify(objectToJson);

    for (let i = 1; i < count; i++) {
      converted += ",";
      converted += JSON.stringify(objectToJson);
    }

    return converted;
  }

  /**
   * Mocks response to a request.
   * @param requestType Specifies request type.
   * @param requestPath Specifies request path.
   * @param requestResponse Specifies request response.
   * @param times How many times to repeat the same response.
   * @param postBody Specifies POST body for POST request.
   * @param headers Specifies response headers.
   * @param responseCode Specifies response code.
   */
  public static mockResponse(url: string, requestType: RequestType, requestPath: string, requestResponse?: object | (() => object),
    times = 1, postBody?: object, headers?: any, responseCode = 200, delay = 0): void {
    const response: any = requestResponse || "";
    switch (requestType) {
      case RequestType.Get:
        nock(url)
          .get(requestPath)
          .times(times)
          .delayConnection(delay)
          .reply(responseCode, response);
        break;
      case RequestType.Post:
        nock(url)
          .post(requestPath, postBody)
          .delayConnection(delay)
          .reply(responseCode, response, headers);
        break;
      case RequestType.Delete:
        nock(url)
          .delete(requestPath)
          .times(times)
          .delayConnection(delay)
          .reply(responseCode, response, headers);
        break;
      case RequestType.Put:
        nock(url)
          .put(requestPath)
          .delayConnection(delay)
          .reply(responseCode, response);
        break;
    }
  }

  /**
   * Mocks file response to a request.
   * @param host Host name of the request.
   * @param requestPath Request path.
   * @param file Path to the file that will be sent as a response.
   * @param times How many times to repeat the same response.
   */
  public static mockFileResponse(host: string, requestPath: string, file: string, times = 1): void {
    nock(host)
      .get(requestPath)
      .times(times)
      .replyWithFile(200, file);
  }

  /**
   * Generates given type object with given properties.
   * @param type Type of the object.
   * @param values Object properties.
   * @returns Created object.
   */
  public static generateObject<T extends ECInstance>(type: new () => T, values?: Map<string, any>): T {
    const generatedObject = new type();

    if (values !== undefined) {
      values.forEach((value: any, key: string) => {
        generatedObject[key] = value;
      });
    }

    return generatedObject;
  }

  /**
   * Clears all mocked objects.
   */
  public static clearMocks(): void {
    nock.cleanAll();
  }
}

export class UrlDiscoveryMock {
  public static mockGetUrl(searchKey: string, env: KnownRegions, returnedUrl: string) {
    if (!TestConfig.enableMocks)
      return;
    ResponseBuilder.mockResponse(Config.App.get("imjs_buddi_url"), RequestType.Get,
      `/GetUrl/?url=${searchKey}&region=${env}`, { result: { url: returnedUrl } });
  }
}
