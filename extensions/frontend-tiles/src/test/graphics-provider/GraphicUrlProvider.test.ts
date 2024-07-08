/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect, use } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as sinon from "sinon";
import { IModelApp } from "@itwin/core-frontend";
import { getGraphicRepresentationUrl } from "../../graphics-provider/url-providers/GraphicUrlProvider";

use(chaiAsPromised);

interface TestJsonResponse {
  id: string;
  displayName: string;
  status: string;
  request: {
    iModelId: string;
    changesetId: string;
    exportType: string;
    geometryOptions: any;
    viewDefinitionFilter: any;
  };

  /* eslint-disable-next-line @typescript-eslint/naming-convention */
  _links: {
    mesh: {
      href: string;
    };
  };
}

interface TestJsonResponses{
  exports: TestJsonResponse[];

  /* eslint-disable-next-line @typescript-eslint/naming-convention */
  _links: {
    next?: {
      href: string;
    };
  };
}

async function mockFetch(mock: typeof window.fetch, fn: () => Promise<void>): Promise<void> {
  sinon.stub(window, "fetch").callsFake(mock);
  try {
    await fn();
  } finally {
    sinon.restore();
  }
}

function makeResponse(jsonMethod: () => Promise<TestJsonResponses>): Response {
  return {
    json: async () => jsonMethod(),
  } as Response;
}

interface SourceProps {
  id: string;
  status?: string; // defaults to "Complete"
  href?: string;
  changesetId?: string;
}

function makeSource(props: SourceProps): TestJsonResponse {
  return {
    id: props.id,
    displayName: props.id,
    status: props.status ?? "Complete",
    request: {
      iModelId: "",
      changesetId: props.changesetId ?? "",
      exportType: "srcType",
      geometryOptions: { },
      viewDefinitionFilter: { },
    },
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    _links: {
      mesh: {
        href: props.href ?? "mesh.edu",
      },
    },
  };
}

interface SourcesProps {
  exports: SourceProps[];
  next?: string;
}

function makeSources(props: SourcesProps): TestJsonResponses {
  return {
    exports: props.exports.map((x) => makeSource(x)),
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    _links: {
      next: props.next ? { href: props.next } : undefined,
    },
  };
}

async function makeSourcesResponse(props: SourcesProps): Promise<Response> {
  return makeResponse(async () => Promise.resolve(makeSources(props)));
}

// This test is similar to the one for obtainGraphicRepresentationUrl in GraphicsProvider/GraphicRepresentationProvider.test.ts
// but exists to test the new @alpha APIs in the graphics-provider directory.
describe("getGraphicRepresentationUrl", () => {
  before(async () => IModelApp.startup());
  after(async () => IModelApp.shutdown());

  async function fetchSources(resource: RequestInfo | URL): Promise<Response> {
    expect(typeof resource).to.equal("string");
    const url = resource as string;

    let exports: SourceProps[] = [
      { id: "a", href: "http://tiles.com/a", changesetId: "aaa" },
      { id: "b", href: "http://tiles.com/b", changesetId: "bbb" },
      { id: "c", href: "http://tiles.com/c", changesetId: "ccc" },
    ];

    const result = url.match(/changesetId=([^\&]+)/);
    if (result) {
      const changesetId = result[1];
      exports = exports.filter((x) => x.changesetId === changesetId);
    }

    return makeSourcesResponse({ exports });
  }

  interface ObtainUrlArgs {
    versionId?: string;
    exact?: boolean;
  }

  async function expectUrl(expected: string | undefined, args: ObtainUrlArgs): Promise<void> {
    await mockFetch(
      async (resource) => fetchSources(resource),
      async () => {
        const url = await getGraphicRepresentationUrl({
          accessToken: "this-is-a-fake-access-token",
          dataSource: {
            iTwinId: "iTwinId",
            id: "srcId",
            changeId: args.versionId,
            type: "srcType",
          },
          format: "IMDL",
          requireExactVersion: args.exact,
        });

        expect(url?.toString()).to.equal(expected);
      },
    );
  }

  it("selects the first Data Source matching the source version Id", async () => {
    await expectUrl("http://tiles.com/a/tileset.json", { versionId: "aaa" });
    await expectUrl("http://tiles.com/b/tileset.json", { versionId: "bbb" });
    await expectUrl("http://tiles.com/c/tileset.json", { versionId: "ccc" });
  });

  it("selects the first Graphcis Data Source if no Data Source matches the source version Id", async () => {
    await expectUrl("http://tiles.com/a/tileset.json", { versionId: "bbbbbb" });
    await expectUrl("http://tiles.com/a/tileset.json", { versionId: "bbbbbb", exact: false });
  });

  it("returns undefined if no Data Source matches the source version Id and caller requires an exact version match", async () => {
    await expectUrl(undefined, { versionId: "bbbbbb", exact: true });
  });
});
