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
import { MeshExport, MeshExports } from "../../FrontendTiles";
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

describe("obtainIModelTilesetUrl", () => {
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
        const url = await obtainIModelTilesetUrl({
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
