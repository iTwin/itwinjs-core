/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { WsgClient, WsgRequestOptions } from "../WsgClient";
import { AuthorizedClientRequestContext, ChunkedQueryContext, ECJsonTypeMap, HttpRequestOptions, RequestQueryOptions, WsgInstance } from "../itwin-client";
import * as requestModule from "../Request";
import { AccessToken } from "../Token";
import { expect } from "chai";
import { ClientRequestContext } from "@bentley/bentleyjs-core";

const mockServerUrl = "http://mockserver.com";

export class TestWsgClient extends WsgClient {
  public constructor(apiVersion: string) {
    super(apiVersion);
  }

  protected getRelyingPartyUrl(): string {
    return "";
  }

  protected getUrlSearchKey(): string {
    return "";
  }

  public async getUrl(): Promise<string> {
    return Promise.resolve(mockServerUrl);
  }

  public async delete(requestContext: AuthorizedClientRequestContext, relativeUrlPath: string, httpRequestOptions?: HttpRequestOptions): Promise<void> {
    return super.delete(requestContext, relativeUrlPath, httpRequestOptions);
  }

  public async deleteInstance<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, relativeUrlPath: string, instance?: T, requestOptions?: WsgRequestOptions, httpRequestOptions?: HttpRequestOptions): Promise<void> {
    return super.deleteInstance(requestContext, relativeUrlPath, instance, requestOptions, httpRequestOptions);
  }

  public async postInstance<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, typedConstructor: new () => T, relativeUrlPath: string, instance: T, requestOptions?: WsgRequestOptions, httpRequestOptions?: HttpRequestOptions): Promise<T> {
    return super.postInstance(requestContext, typedConstructor, relativeUrlPath, instance, requestOptions, httpRequestOptions);
  }

  public async postInstances<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, typedConstructor: new () => T, relativeUrlPath: string, instances: T[], requestOptions?: WsgRequestOptions, httpRequestOptions?: HttpRequestOptions): Promise<T[]> {
    return super.postInstances(requestContext, typedConstructor, relativeUrlPath, instances, requestOptions, httpRequestOptions);
  }

  public async getInstancesChunk<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, url: string, chunkedQueryContext: ChunkedQueryContext | undefined, typedConstructor: new () => T, queryOptions?: RequestQueryOptions, httpRequestOptions?: HttpRequestOptions): Promise<T[]> {
    return super.getInstancesChunk(requestContext, url, chunkedQueryContext, typedConstructor, queryOptions, httpRequestOptions);
  }

  public async postQuery<T extends WsgInstance>(requestContext: AuthorizedClientRequestContext, typedConstructor: new () => T, relativeUrlPath: string, queryOptions: RequestQueryOptions, httpRequestOptions?: HttpRequestOptions): Promise<T[]> {
    return super.postQuery(requestContext, typedConstructor, relativeUrlPath, queryOptions, httpRequestOptions);
  }
}

@ECJsonTypeMap.classToJson("wsg", "TestClass", { classKeyPropertyName: "className" })
export class TestClass extends WsgInstance {
}

describe("WsgClient", async () => {
  let testWsgClient: TestWsgClient;

  before(() => {
    testWsgClient = new TestWsgClient("");
  });

  describe("HttpRequestOptions setting", () => {
    let originalRequestFunc: any;
    let savedRequestOptions: requestModule.RequestOptions | undefined;

    const instance = new TestClass();
    const typedConstructor = Object.getPrototypeOf(instance).constructor;
    const requestContext = new AuthorizedClientRequestContext(new AccessToken());

    const responseInstance = {
      instanceAfterChange: {
        instanceId: "TestWsgInstanceId",
        schemaName: "TestSchema",
        className: "TestClass",
      },
    };

    const testCases: { testCaseName: string, responseBody?: any, testFunc: (options: HttpRequestOptions) => Promise<any> }[] =
      [
        {
          testCaseName: "WsgClient.delete",
          testFunc: async (options: HttpRequestOptions) => testWsgClient.delete(requestContext, "", options),
        },
        {
          testCaseName: "WsgClient.deleteInstance",
          testFunc: async (options: HttpRequestOptions) => testWsgClient.deleteInstance(requestContext, "", typedConstructor, undefined, options),
        },
        {
          testCaseName: "WsgClient.postInstance",
          responseBody: { changedInstance: { ...responseInstance } },
          testFunc: async (options: HttpRequestOptions) => testWsgClient.postInstance(requestContext, typedConstructor, "", instance, undefined, options),
        },
        {
          testCaseName: "WsgClient.postInstances",
          responseBody: { changedInstances: [{ ...responseInstance }] },
          testFunc: async (options: HttpRequestOptions) => testWsgClient.postInstances(requestContext, typedConstructor, "", [instance], undefined, options),
        },
        {
          testCaseName: "WsgClient.getInstancesChunk",
          responseBody: { instances: [{ ...responseInstance }] },
          testFunc: async (options: HttpRequestOptions) => testWsgClient.getInstancesChunk(requestContext, mockServerUrl, undefined, typedConstructor, undefined, options),
        },
        {
          testCaseName: "WsgClient.postQuery",
          responseBody: { instances: [{ ...responseInstance }] },
          testFunc: async (options: HttpRequestOptions) => testWsgClient.postQuery(requestContext, typedConstructor, "", {}, options),
        },
      ];

    before(() => {
      originalRequestFunc = requestModule.request;
    });

    after(() => {
      (requestModule.request as any) = originalRequestFunc;
    });

    afterEach(() => {
      savedRequestOptions = undefined;
    });

    describe("Should not pass timeout to request if user does not explicitly set it", () => {
      testCases.forEach((testCase) => {
        it(testCase.testCaseName, async () => {
          const userDefinedRequestOptions: HttpRequestOptions = {};
          mockRequestFunction(testCase.responseBody);
          await testCase.testFunc(userDefinedRequestOptions);
          expect(savedRequestOptions!.timeout).to.be.undefined;
        });
      });
    });

    describe("Should pass timeout to request if user does explicitly set it", () => {
      testCases.forEach((testCase) => {
        it(testCase.testCaseName, async () => {
          const userDefinedRequestOptions: HttpRequestOptions = { timeout: { response: 10, deadline: 10 } };
          mockRequestFunction(testCase.responseBody);
          await testCase.testFunc(userDefinedRequestOptions);
          expect(savedRequestOptions!.timeout!.response).to.be.equal(userDefinedRequestOptions.timeout!.response);
          expect(savedRequestOptions!.timeout!.deadline).to.be.equal(userDefinedRequestOptions.timeout!.deadline);
        });
      });
    });

    describe("Should set only the deadline if only the deadline is specified", () => {
      testCases.forEach((testCase) => {
        it(testCase.testCaseName, async () => {
          const userDefinedRequestOptions: HttpRequestOptions = { timeout: { deadline: 10 } };
          mockRequestFunction(testCase.responseBody);
          await testCase.testFunc(userDefinedRequestOptions);
          expect(savedRequestOptions!.timeout!.response).to.be.undefined;
          expect(savedRequestOptions!.timeout!.deadline).to.be.equal(userDefinedRequestOptions.timeout!.deadline);
        });
      });
    });

    describe("Should automatically set deadline if response timeout is specified", () => {
      testCases.forEach((testCase) => {
        it(testCase.testCaseName, async () => {
          const userDefinedRequestOptions: HttpRequestOptions = { timeout: { response: 10 } };
          mockRequestFunction(testCase.responseBody);
          await testCase.testFunc(userDefinedRequestOptions);
          expect(savedRequestOptions!.timeout!.response).to.be.equal(userDefinedRequestOptions.timeout!.response);
          const expectedCalculatedDeadline =
            userDefinedRequestOptions.timeout!.response! +
            requestModule.RequestGlobalOptions.timeout.deadline! -
            requestModule.RequestGlobalOptions.timeout.response!;
          expect(savedRequestOptions!.timeout!.deadline).to.be.equal(expectedCalculatedDeadline);
        });
      });
    });

    const mockRequestFunction = (response: any | undefined) => {
      (requestModule.request as any) = async (_requestContext: ClientRequestContext, _url: string, options: requestModule.RequestOptions) => {
        savedRequestOptions = options;
        return Promise.resolve(response ? { body: { ...response } } : {});
      };
    };
  });
});
