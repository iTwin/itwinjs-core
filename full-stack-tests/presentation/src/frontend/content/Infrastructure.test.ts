/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { assert, BeDuration, BeTimePoint } from "@itwin/core-bentley";
import { Content, Item, KeySet, PageOptions } from "@itwin/presentation-common";
import { Presentation as PresentationBackend, PresentationManager } from "@itwin/presentation-backend";
import { Presentation as PresentationFrontend } from "@itwin/presentation-frontend";
import { initialize } from "../../IntegrationTests";
import { collect } from "../../Utils";
import { createContentTestSuite } from "./Utils";
import { createTestContentDescriptor, createTestContentItem, ResolvablePromise } from "@itwin/presentation-common/lib/cjs/test";

createContentTestSuite({ skipInitialize: true })("Error handling", ({ getDefaultSuiteIModel }) => {
  const frontendTimeout = 50;

  before(async () => {
    await initialize({
      presentationBackendProps: {
        // this defaults to 0, which means "no timeouts" - reinitialize with non-zero
        requestTimeout: 1,
      },
      presentationFrontendProps: {
        presentation: { requestTimeout: frontendTimeout },
      },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it("waits for frontend timeout when request exceeds the backend timeout time", async () => {
    // set up `getContentDescriptor` call to never resolve
    const resolvablePromise = new ResolvablePromise<string | undefined>();
    using _disposePendingPromise = {
      [Symbol.dispose]: () => void resolvablePromise.resolve(""),
    };
    sinon.stub(PresentationBackend, "getManager").returns({
      getDetail: () => ({
        getContentDescriptor: async () => resolvablePromise,
      }),
    } as unknown as PresentationManager);

    const start = BeTimePoint.now();
    await expect(
      PresentationFrontend.presentation.getContentDescriptor({
        imodel: await getDefaultSuiteIModel(),
        rulesetOrId: "",
        keys: new KeySet(),
        displayType: "Grid",
      }),
    ).to.eventually.be.rejectedWith(Error, "Processing the request took longer than the configured limit of 50 ms");
    expect(BeTimePoint.now().milliseconds).to.be.greaterThanOrEqual(start.plus(BeDuration.fromMilliseconds(frontendTimeout)).milliseconds);
  });

  it("throws a timeout error when iterator request exceeds the backend timeout time", async () => {
    // set up a content iterator response, where the first page resolves, but the second one doesn't
    const resolvableItemsPromise = new ResolvablePromise<Item[]>();
    using _disposePendingPromise = {
      [Symbol.dispose]: () => void resolvableItemsPromise.resolve([]),
    };
    sinon.stub(PresentationBackend, "getManager").returns({
      getContentSetSize: async () => 2,
      getDetail: () => ({
        getContent: async ({ paging }: { paging?: PageOptions }) =>
          new Content(
            createTestContentDescriptor({ fields: [] }),
            (paging?.start ?? 0) === 0 ? [createTestContentItem({ values: {}, displayValues: {} })] : await resolvableItemsPromise,
          ),
      }),
    } as unknown as PresentationManager);

    const result = await PresentationFrontend.presentation.getContentIterator({
      imodel: await getDefaultSuiteIModel(),
      rulesetOrId: "",
      keys: new KeySet(),
      descriptor: {},
      batchSize: 1,
      maxParallelRequests: 100,
    });
    assert(!!result);
    await expect(collect(result.items)).to.eventually.be.rejectedWith(Error, "Processing the request took longer than the configured limit of 50 ms");
  });
});
