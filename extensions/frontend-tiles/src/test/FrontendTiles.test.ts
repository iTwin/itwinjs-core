/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Range3d } from "@itwin/core-geometry";
import { Cartographic, EcefLocation } from "@itwin/core-common";
import { BlankConnection } from "@itwin/core-frontend";

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

describe("test", () => {
  async function withFetch(mockFetch: typeof window.fetch, fn: () => Promise<void>): Promise<void> {
    const windowFetch = window.fetch;
    window.fetch = mockFetch;
    try {
      fn();
    } finally {
      window.fetch = windowFetch;
    }
  }

  it("tests", async () => {
    let fetched = false;
    await withFetch(async () => { fetched = true; return { } as any; }, async () => { await fetch("sldfkjs"); });
    expect(fetched).to.be.true;
  });
});
