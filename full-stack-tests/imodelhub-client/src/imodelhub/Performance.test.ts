/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GuidString, Id64, Logger } from "@bentley/bentleyjs-core";
import { Briefcase, CodeQuery, CodeState, HubCode, IModelClient, Lock, LockLevel, LockQuery, LockType } from "@bentley/imodelhub-client";
import { AccessToken, AuthenticationError, AuthorizedClientRequestContext, ResponseError } from "@bentley/itwin-client";
import * as utils from "./TestUtils";
import { TestConfig } from "../TestConfig";

describe.skip("iModelHub Performance tests", () => {
  let contextId: string;
  let imodelId: GuidString;
  let briefcase1: Briefcase;
  let briefcase2: Briefcase;
  let imodelHubClient: IModelClient;
  let requestContext: AuthorizedClientRequestContext;

  async function setup(recreate = false) {
    const accessToken: AccessToken = await utils.login();
    requestContext = new AuthorizedClientRequestContext(accessToken);

    contextId = await utils.getProjectId(requestContext);
    await utils.createIModel(requestContext, utils.sharedimodelName, contextId, true, recreate);
    imodelId = await utils.getIModelId(requestContext, utils.sharedimodelName, contextId);
    imodelHubClient = utils.getDefaultClient();
    const briefcases = await utils.getBriefcases(requestContext, imodelId, 2);
    briefcase1 = briefcases[0];
    briefcase2 = briefcases[1];
  }

  before(async () => {
    await setup(true);
  });

  after(async () => {
    if (TestConfig.enableIModelBank) {
      await utils.deleteIModelByName(requestContext, contextId, utils.sharedimodelName);
    }
  });

  async function reserveCodes(statingCount: number, count: number, perRequest: number, briefcase: Briefcase, codeScope: string) {
    if (count < 1)
      return;

    let j = statingCount;
    Logger.logTrace("performance", `Creating codes from ${statingCount}`);
    const codes = Array(count).fill(0).map(() => {
      const code = new HubCode();
      code.briefcaseId = briefcase.briefcaseId;
      code.changeState = "new";
      code.codeScope = codeScope;
      code.codeSpecId = Id64.fromString("0XA");
      code.state = CodeState.Reserved;
      code.value = `${j++}`;
      return code;
    });
    await imodelHubClient.codes.update(requestContext, imodelId, codes, { codesPerRequest: perRequest });
  }

  it.skip("Reserve codes", async () => {
    const sizes: number[] = [10000, 20000, 30000, 40000, 50000, 100000, 125000, 150000, 175000, 200000];
    const runCount = 20;
    const scope = "ReserveCodes";
    let startingCount = 0;
    for (const size of sizes) {
      Logger.logTrace("performance", `Test Case ${size} Started`);
      for (let run = 0; run < runCount; ++run) {
        let startTime = Date.now();
        Logger.logTrace("performance", `Test ${run} Started`);
        try {
          startingCount += size;
          await reserveCodes(startingCount, size, size, briefcase1, scope);
        } catch (err) {
          if ((err instanceof ResponseError && err.status === 401) || err instanceof AuthenticationError) {
            const accessToken = await utils.login();
            requestContext = new AuthorizedClientRequestContext(accessToken);
            startTime = Date.now();
            startingCount += size;
            await reserveCodes(startingCount, size, size, briefcase1, scope);
          }
        }
        Logger.logTrace("performance", `Test ${run} End ${Date.now() - startTime}`);
      }
    }
  });

  async function ensureCodesCount(count: number, briefcase: Briefcase, codeScope: string, query = new CodeQuery()) {
    try {
      const currentCount = (await imodelHubClient.codes.get(requestContext, imodelId, query)).length;
      await reserveCodes(currentCount, count - currentCount, 50000, briefcase, codeScope);
    } catch (err) {
      if ((err instanceof ResponseError && err.status === 401) || err instanceof AuthenticationError) {
        const accessToken = await utils.login();
        requestContext = new AuthorizedClientRequestContext(accessToken);
        await ensureCodesCount(count, briefcase, codeScope, query);
      }
    }
  }

  it.skip("Retrieve codes", async () => {
    await setup(true);
    const sizes: number[] = [10000, 100000, 1000000, 2000000, 3000000, 4000000, 5000000, 6000000, 7000000, 8000000];
    const runCount = 25;
    for (const size of sizes) {
      Logger.logTrace("performance", `Test Case ${size} Started`);
      await ensureCodesCount(size, briefcase1, "RetrieveCodes");
      for (let run = 0; run < runCount; ++run) {
        let startTime = Date.now();
        Logger.logTrace("performance", `Test ${run} Started`);
        try {
          await imodelHubClient.codes.get(requestContext, imodelId);
        } catch (err) {
          if ((err instanceof ResponseError && err.status === 401) || err instanceof AuthenticationError) {
            const accessToken = await utils.login();
            requestContext = new AuthorizedClientRequestContext(accessToken);
            startTime = Date.now();
            await imodelHubClient.codes.get(requestContext, imodelId, new CodeQuery());
          }
        }
        Logger.logTrace("performance", `Test ${run} End ${Date.now() - startTime}`);
      }
    }
  });

  it.skip("Retrieve partial codes", async () => {
    const sizes: number[] = [10000, 100000, 1000000, 2000000, 3000000, 4000000, 5000000, 6000000, 7000000, 8000000];
    const runCount = 25;
    const query = new CodeQuery().byBriefcaseId(briefcase2.briefcaseId!);
    for (const size of sizes) {
      Logger.logTrace("performance", `Test Case ${size} Started`);
      await ensureCodesCount(size, briefcase2, "RetrievePartialCodes", query);
      for (let run = 0; run < runCount; ++run) {
        let startTime = Date.now();
        Logger.logTrace("performance", `Test ${run} Started`);
        try {
          await imodelHubClient.codes.get(requestContext, imodelId, query);
        } catch (err) {
          if ((err instanceof ResponseError && err.status === 401) || err instanceof AuthenticationError) {
            const accessToken = await utils.login();
            requestContext = new AuthorizedClientRequestContext(accessToken);
            startTime = Date.now();
            await imodelHubClient.codes.get(requestContext, imodelId, query);
          }
        }
        Logger.logTrace("performance", `Test ${run} End ${Date.now() - startTime}`);
      }
    }
  });

  it.skip("Retrieve codes by ids", async () => {
    await setup(true);
    const sizes: number[] = [3000, 4000, 5000, 6000, 7000, 8000];
    const runCount = 25;
    await ensureCodesCount(10000, briefcase1, "RetrieveCodesByIds");
    const codes = await imodelHubClient.codes.get(requestContext, imodelId);
    for (const size of sizes) {
      Logger.logTrace("performance", `Test Case ${size} Started`);
      for (let run = 0; run < runCount; ++run) {
        let startTime = Date.now();
        const query = new CodeQuery().byCodes(codes.slice(0, size));
        Logger.logTrace("performance", `Test ${run} Started`);
        try {
          await imodelHubClient.codes.get(requestContext, imodelId, query);
        } catch (err) {
          if ((err instanceof ResponseError && err.status === 401) || err instanceof AuthenticationError) {
            const accessToken = await utils.login();
            requestContext = new AuthorizedClientRequestContext(accessToken);
            startTime = Date.now();
            await imodelHubClient.codes.get(requestContext, imodelId, query);
          }
        }
        Logger.logTrace("performance", `Test ${run} End ${Date.now() - startTime}`);
      }
    }
  });

  async function acquireLocks(statingCount: number, count: number, perRequest: number, briefcase: Briefcase) {
    if (count < 1)
      return;

    let j = statingCount;
    Logger.logTrace("performance", `Creating locks from ${statingCount}`);
    const locks = Array(count).fill(0).map(() => {
      const lock = new Lock();
      lock.briefcaseId = briefcase.briefcaseId!;
      lock.lockLevel = LockLevel.Shared;
      lock.lockType = LockType.Element;
      lock.objectId = Id64.fromString(j.toString());
      j++;
      return lock;
    });
    await imodelHubClient.locks.update(requestContext, imodelId, locks, { locksPerRequest: perRequest });
  }

  it.skip("Acquire locks", async () => {
    await setup(true);
    const sizes: number[] = [10000, 20000, 30000, 40000, 50000, 70000, 80000, 90000, 100000];
    const runCount = 25;
    let startingCount = (await imodelHubClient.locks.get(requestContext, imodelId)).length;
    for (const size of sizes) {
      Logger.logTrace("performance", `Test Case ${size} Started`);
      for (let run = 0; run < runCount; ++run) {
        let startTime = Date.now();
        Logger.logTrace("performance", `Test ${run} Started`);
        try {
          await acquireLocks(startingCount, size, size, briefcase1);
        } catch (err) {
          if ((err instanceof ResponseError && err.status === 401) || err instanceof AuthenticationError) {
            const accessToken = await utils.login();
            requestContext = new AuthorizedClientRequestContext(accessToken);
            startTime = Date.now();
            await acquireLocks(startingCount, size, size, briefcase1);
          }
        }
        Logger.logTrace("performance", `Test ${run} End ${Date.now() - startTime}`);
        startingCount += size;
      }
    }
  });

  async function ensureLocksCount(startingCount: number, count: number, briefcase: Briefcase, query = new LockQuery()) {
    try {
      const currentCount = (await imodelHubClient.locks.get(requestContext, imodelId, query)).length;
      await acquireLocks(startingCount + currentCount, count - currentCount, 1000, briefcase);
    } catch (err) {
      if ((err instanceof ResponseError && err.status === 401) || err instanceof AuthenticationError) {
        const accessToken = await utils.login();
        requestContext = new AuthorizedClientRequestContext(accessToken);
        await ensureLocksCount(startingCount, count, briefcase, query);
      }
    }
  }

  it("Query locks", async () => {
    await setup(true);
    const sizes: number[] = [10000, 100000, 1000000, 1500000, 2000000, 3000000, 4000000, 5000000, 6000000, 7000000, 8000000, 9000000];
    const runCount = 25;
    for (const size of sizes) {
      Logger.logTrace("performance", `Test Case ${size} Started`);
      await ensureLocksCount(0, size, briefcase1);
      for (let run = 0; run < runCount; ++run) {
        let startTime = Date.now();
        Logger.logTrace("performance", `Test ${run} Started`);
        try {
          await imodelHubClient.locks.get(requestContext, imodelId);
        } catch (err) {
          if ((err instanceof ResponseError && err.status === 401) || err instanceof AuthenticationError) {
            const accessToken = await utils.login();
            requestContext = new AuthorizedClientRequestContext(accessToken);
            startTime = Date.now();
            await imodelHubClient.locks.get(requestContext, imodelId);
          }
        }
        Logger.logTrace("performance", `Test ${run} End ${Date.now() - startTime}`);
      }
    }
  });

  it.skip("Query partial locks", async () => {
    const sizes: number[] = [10000, 100000, 1000000, 1500000, 2000000, 3000000, 4000000, 5000000, 6000000, 7000000, 8000000];
    const runCount = 25;
    const query = new LockQuery().byBriefcaseId(briefcase2.briefcaseId!);
    for (const size of sizes) {
      Logger.logTrace("performance", `Test Case ${size} Started`);
      await ensureLocksCount(10000000, size, briefcase2, query);
      for (let run = 0; run < runCount; ++run) {
        let startTime = Date.now();
        Logger.logTrace("performance", `Test ${run} Started`);
        try {
          await imodelHubClient.locks.get(requestContext, imodelId, query);
        } catch (err) {
          if ((err instanceof ResponseError && err.status === 401) || err instanceof AuthenticationError) {
            const accessToken = await utils.login();
            requestContext = new AuthorizedClientRequestContext(accessToken);

            startTime = Date.now();
            await imodelHubClient.locks.get(requestContext, imodelId, query);
          }
        }
        Logger.logTrace("performance", `Test ${run} End ${Date.now() - startTime}`);
      }
    }
  });

  it.skip("Retrieve locks by ids", async () => {
    await setup(true);
    const sizes: number[] = [10000, 20000, 50000, 100000, 150000, 200000, 300000, 350000];
    const runCount = 25;
    const briefcaseQuery = new LockQuery().byBriefcaseId(briefcase1.briefcaseId!);
    await ensureLocksCount(0, 1000000, briefcase1, briefcaseQuery);
    const locks = await imodelHubClient.locks.get(requestContext, imodelId, briefcaseQuery);
    for (const size of sizes) {
      Logger.logTrace("performance", `Test Case ${size} Started`);
      for (let run = 0; run < runCount; ++run) {
        let startTime = Date.now();
        const query = new LockQuery().byLocks(locks.slice(0, size));
        Logger.logTrace("performance", `Test ${run} Started`);
        try {
          await imodelHubClient.locks.get(requestContext, imodelId, query);
        } catch (err) {
          if ((err instanceof ResponseError && err.status === 401) || err instanceof AuthenticationError) {
            const accessToken: AccessToken = await utils.login();
            requestContext = new AuthorizedClientRequestContext(accessToken);
            startTime = Date.now();
            await imodelHubClient.locks.get(requestContext, imodelId, query);
          }
        }
        Logger.logTrace("performance", `Test ${run} End ${Date.now() - startTime}`);
      }
    }
  });
});
