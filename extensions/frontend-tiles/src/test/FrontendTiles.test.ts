/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect, use } from "chai";
import { chaiAsPromised } from "chai-as-promised";
import * as sinon from "sinon";
import { Range3d } from "@itwin/core-geometry";
import { Cartographic, EcefLocation } from "@itwin/core-common";
import { BlankConnection } from "@itwin/core-frontend";
import { MeshExport, MeshExports, queryMeshExports, obtainMeshExportTilesetUrl } from "../FrontendTiles";

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

describe("queryMeshExports", () => {
  it("returns no results upon error", async () => {

  });

  it("produces one set of results", async () => {
  });

  it("iterates over multiple sets of results", async () => {
  });

  it("includes only completed exports unless otherwise specified", async () => {
  });
});

describe("test", () => {
  it("tests", async () => {
    let fetched = false;
    await mockFetch(async () => { fetched = true; return { } as any; }, async () => {
      await fetch("sldfkjs");
      expect(fetched).to.be.true;
      expect("laksjle").to.equal("qowieqoweq");
    });
  });
});
