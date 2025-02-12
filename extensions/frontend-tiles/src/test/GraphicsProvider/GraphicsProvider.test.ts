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
import { MeshExport, MeshExports, queryMeshExports } from "../../FrontendTiles";
import { obtainIModelTilesetUrl } from "../../GraphicsProvider/GraphicsProvider";

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

function makeResponse(jsonMethod: () => Promise<MeshExports>): Response {
  return {
    json: async () => jsonMethod(),
  } as Response;
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

async function fetchExports(resource: RequestInfo | URL, exportProps: ExportProps[]): Promise<Response> {
  expect(typeof resource).to.equal("string");
  const url = resource as string;

  const result = url.match(/changesetId=([^\&]+)/);
  if (result) {
    const changesetId = result[1];
    exportProps = exportProps.filter((x) => x.changesetId === changesetId);
  }

  return makeExportsResponse({ exports: exportProps });
}

interface ObtainUrlArgs {
  id?: string;
  changesetId?: string;
  exact?: boolean;
}

describe("obtainIModelTilesetUrl", () => {
  before(async () => IModelApp.startup());
  after(async () => IModelApp.shutdown());

  const exportProps: ExportProps[] = [
    { id: "a", href: "http://tiles.com/a", changesetId: "aaa" },
    { id: "b", href: "http://tiles.com/b", changesetId: "bbb" },
    { id: "c", href: "http://tiles.com/c", changesetId: "ccc" },
  ];

  async function expectUrl(expected: string | undefined, args: ObtainUrlArgs): Promise<void> {
    const iModel = new TestConnection(args);
    await mockFetch(
      async (resource) => fetchExports(resource, exportProps),
      async () => {
        const url = await obtainIModelTilesetUrl({
          iTwinId: iModel.iTwinId,
          iModelId: iModel.iModelId,
          changesetId: iModel.changeset?.id,
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

describe("queryMeshExports", () => {
  before(async () => IModelApp.startup());
  after(async () => IModelApp.shutdown());
  const args: ObtainUrlArgs = { id: "imdl", changesetId: "aaa" };

  const exportProps: ExportProps[] = [
    { id: "1", href: "http://tiles.com/a1", changesetId: "aaa", status: "Complete" },
    { id: "2", href: "http://tiles.com/a2", changesetId: "aaa", status: "Invalid" },
    { id: "3", href: "http://tiles.com/a3", changesetId: "aaa", status: "InProgress" },
  ];

  it("queryMeshExports doesn't return incomplete exports if includeIncomplete flag is false", async () => {
    const iModel = new TestConnection(args);
    await mockFetch(
      async (resource) => fetchExports(resource, exportProps),
      async () => {
        const queryArgs = {
          iTwinId: "test",
          iModelId: iModel.iModelId,
          changesetId: iModel.changeset?.id,
          accessToken,
        };

        const exports: MeshExport[] = [];
        for await (const data of queryMeshExports(queryArgs)) {
          exports.push(data);
        }

        expect(exports.length).to.equal(1);
        expect(exports[0].status).to.equal("Complete");
      },
    );
  });

  it("queryMeshExports returns incomplete exports if includeIncomplete flag is true", async () => {
    const iModel = new TestConnection(args);
    await mockFetch(
      async (resource) => fetchExports(resource, exportProps),
      async () => {
        const queryArgs = {
          iTwinId: "test",
          iModelId: iModel.iModelId,
          changesetId: iModel.changeset?.id,
          accessToken,
          includeIncomplete: true,
        };

        const exports: MeshExport[] = [];
        for await (const data of queryMeshExports(queryArgs)) {
          exports.push(data);
        }

        expect(exports.length).to.equal(3);
        expect(exports[0].status).to.equal("Complete");
        expect(exports[1].status).to.equal("Invalid");
        expect(exports[2].status).to.equal("InProgress");
      },
    );
  });
});
