/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect, use } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as sinon from "sinon";
import { Range3d } from "@itwin/core-geometry";
import { Cartographic, EcefLocation } from "@itwin/core-common";
import { BlankConnection } from "@itwin/core-frontend";
import { MeshExport, MeshExports, queryMeshExports, QueryMeshExportsArgs } from "../FrontendTiles";

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
    json: () => jsonMethod(),
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
}

function makeExport(props: ExportProps): MeshExport {
  return {
    id: props.id,
    displayName: props.id,
    status: props.status ?? "Complete",
    request: {
      iModelId: "",
      changesetId: "",
      exportType: "IMODEL",
      geometryOptions: { },
      viewDefinitionFilter: { },
    },
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
    _links: {
      next: props.next ? { href: props.next } : undefined,
    },
  };
}

async function makeExportsResponse(props: ExportsProps): Promise<Response> {
  return makeResponse(() => Promise.resolve(makeExports(props)));
}

describe("queryMeshExports", () => {
  const accessToken = "acctkn";
  const iModelId = "imdl";

  it("returns no results upon error", async () => {
    await mockFetch(() => { throw new Error("fetch threw"); }, () => expectExports([], { accessToken, iModelId }));
    await mockFetch(() => Promise.resolve(makeResponse(() => { throw new Error("json threw"); })), () => expectExports([], { accessToken, iModelId }));
  });

  it("produces one set of results", async () => {
    await mockFetch(
      () => makeExportsResponse({ exports: [{ id: "a" }, { id: "b" }, { id: "c" }] }),
      () => expectExports(["a", "b", "c"], { accessToken, iModelId })
    );
  });

  it("iterates over multiple sets of results", async () => {
    let fetchedFirst = false;
    await mockFetch(
      () => {
        if (!fetchedFirst) {
          fetchedFirst = true;
          return makeExportsResponse({ exports: [{ id: "a" }, { id: "b" }], next: "next.org" });
        } else {
          return makeExportsResponse({ exports: [{ id: "c" }, { id: "d" }] });
        }
      },
      () => expectExports(["a", "b", "c", "d"], { accessToken, iModelId })
    );

  });

  it("includes only completed exports unless otherwise specified", async () => {
    await mockFetch(
      () => makeExportsResponse({ exports: [ { id: "a", status: "Complete" }, { id: "b", status: "Feeling Blessed" } ] }),
      async () => {
        await expectExports(["a"], { iModelId, accessToken });
        await expectExports(["a", "b"], { iModelId, accessToken, includeIncomplete: true }),
        await expectExports(["a"], { iModelId, accessToken, includeIncomplete: false });
      }
    );
  });
});
