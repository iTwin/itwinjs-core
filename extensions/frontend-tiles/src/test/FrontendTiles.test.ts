/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect, use } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as sinon from "sinon";
import { Range3d } from "@itwin/core-geometry";
import { Cartographic, EcefLocation } from "@itwin/core-common";
import { BlankConnection, IModelApp } from "@itwin/core-frontend";
import { MeshExport, MeshExports, obtainMeshExportTilesetUrl, queryMeshExports, QueryMeshExportsArgs } from "../FrontendTiles";

use(chaiAsPromised);

class TestConnection extends BlankConnection {
  private readonly _id: string | undefined;

  public constructor(props: { id?: string, changesetId?: string }) {
    super({
      rootSubject: { name: "test-subject" },
      projectExtents: new Range3d(0, 0, 0, 1, 1, 1),
      ecefLocation: EcefLocation.createFromCartographicOrigin(Cartographic.fromDegrees({longitude: -75, latitude: 40, height: 0 })),
      key: "test-key",
      iTwinId: "test-itwin",
      iModelId: props.id,
      changeset: props.changesetId ? { id: props.changesetId } : undefined,
    });

    this._id = props.id;
  }

  // BlankConnection overrides to unconditionally return `undefined` and overrides return type to only permit `undefined`.
  public override get iModelId(): any { return this._id; }
}

async function mockFetch(mock: typeof window.fetch, fn: () => Promise<void>): Promise<void> {
  sinon.stub(window, "fetch").callsFake(mock);
  try {
    await fn();
  } finally {
    sinon.restore();
  }
}

function makeResponse(jsonMethod: () => Promise<MeshExports | never>): Response {
  return {
    json: async () => jsonMethod(),
  } as Response;
}

async function expectExports(expectedIds: string[], args: QueryMeshExportsArgs): Promise<void> {
  let idIndex = 0;
  for await (const exp of queryMeshExports(args))
    expect(exp.id).to.equal(expectedIds[idIndex++]);

  expect(idIndex).to.equal(expectedIds.length);
}

interface ExportProps {
  id: string;
  status?: string; // defaults to "Complete"
  href?: string;
  changesetId?: string;
}

function makeExport(props: ExportProps): MeshExport {
  return {
    id: props.id,
    displayName: props.id,
    status: props.status ?? "Complete",
    request: {
      iModelId: "",
      changesetId: props.changesetId ?? "",
      exportType: "IMODEL",
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

interface ExportsProps {
  exports: ExportProps[];
  next?: string;
}

function makeExports(props: ExportsProps): MeshExports {
  return {
    exports: props.exports.map((x) => makeExport(x)),
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    _links: {
      next: props.next ? { href: props.next } : undefined,
    },
  };
}

async function makeExportsResponse(props: ExportsProps): Promise<Response> {
  return makeResponse(async () => Promise.resolve(makeExports(props)));
}

const accessToken = "this-is-a-fake-access-token";

describe("queryMeshExports", () => {
  const iModelId = "imdl";

  it("returns no results upon error", async () => {
    await mockFetch(
      () => { throw new Error("fetch threw"); },
      async () => expectExports([], { accessToken, iModelId }),
    );
    await mockFetch(
      async () => Promise.resolve(makeResponse(
        () => { throw new Error("json threw"); }),
      ),
      async () => expectExports([], { accessToken, iModelId }),
    );
  });

  it("produces one set of results", async () => {
    await mockFetch(
      async () => makeExportsResponse({ exports: [{ id: "a" }, { id: "b" }, { id: "c" }] }),
      async () => expectExports(["a", "b", "c"], { accessToken, iModelId }),
    );
  });

  it("iterates over multiple sets of results", async () => {
    let fetchedFirst = false;
    await mockFetch(
      async () => {
        if (!fetchedFirst) {
          fetchedFirst = true;
          return makeExportsResponse({ exports: [{ id: "a" }, { id: "b" }], next: "next.org" });
        } else {
          return makeExportsResponse({ exports: [{ id: "c" }, { id: "d" }] });
        }
      },
      async () => expectExports(["a", "b", "c", "d"], { accessToken, iModelId }),
    );

  });

  it("includes only completed exports unless otherwise specified", async () => {
    await mockFetch(
      async () => makeExportsResponse({ exports: [ { id: "a", status: "Complete" }, { id: "b", status: "Feeling Blessed" } ] }),
      async () => {
        await expectExports(["a"], { iModelId, accessToken });
        await expectExports(["a", "b"], { iModelId, accessToken, includeIncomplete: true }),
        await expectExports(["a"], { iModelId, accessToken, includeIncomplete: false });
      },
    );
  });
});

describe("obtainMeshExportTilesetUrl", () => {
  before(async () => IModelApp.startup());
  after(async () => IModelApp.shutdown());

  async function fetchExports(resource: RequestInfo | URL): Promise<Response> {
    expect(typeof resource).to.equal("string");
    const url = resource as string;

    let exports: ExportProps[] = [
      { id: "a", href: "http://tiles.com/a", changesetId: "aaa" },
      { id: "b", href: "http://tiles.com/b", changesetId: "bbb" },
      { id: "c", href: "http://tiles.com/c", changesetId: "ccc" },
    ];

    const result = url.match(/changesetId=([^\&]+)/);
    if (result) {
      const changesetId = result[1];
      exports = exports.filter((x) => x.changesetId === changesetId);
    }

    return makeExportsResponse({ exports });
  }

  interface ObtainUrlArgs {
    id?: string;
    changesetId?: string;
    exact?: boolean;
  }

  async function expectUrl(expected: string | undefined, args: ObtainUrlArgs): Promise<void> {
    const iModel = new TestConnection(args);
    await mockFetch(
      async (resource) => fetchExports(resource),
      async () => {
        const url = await obtainMeshExportTilesetUrl({
          iModel,
          accessToken,
          requireExactChangeset: args.exact,
        });

        expect(url?.toString()).to.equal(expected);
      },
    );
  }

  it("returns undefined if the iModel has no iModelId", async () => {
    await expectUrl(undefined, { });
    await expectUrl(undefined, { id: "" });
  });

  it("selects the first export matching the changeset Id", async () => {
    await expectUrl("http://tiles.com/a/tileset.json", { id: "imdl", changesetId: "aaa" });
    await expectUrl("http://tiles.com/b/tileset.json", { id: "imdl", changesetId: "bbb" });
    await expectUrl("http://tiles.com/c/tileset.json", { id: "imdl", changesetId: "ccc" });
  });

  it("selects the first export if no export matches the changeset Id", async () => {
    await expectUrl("http://tiles.com/a/tileset.json", { id: "imdl", changesetId: "bbbbbb" });
    await expectUrl("http://tiles.com/a/tileset.json", { id: "imdl", changesetId: "bbbbbb", exact: false });
  });

  it("returns undefined if no export matches the changeset Id and caller requires an exact changeset match", async () => {
    await expectUrl(undefined, { id: "imdl", changesetId: "bbbbbb", exact: true });
  });
});
