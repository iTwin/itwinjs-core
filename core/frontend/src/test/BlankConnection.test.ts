/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp } from "../IModelApp.js";
import { IModelConnection } from "../IModelConnection.js";
import { createBlankConnection } from "./createBlankConnection.js";

describe("BlankConnection", async () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  it("preserves name", async () => {
    const name = "my-blank-connection";
    const imodel = createBlankConnection(name);
    try {
      expect(imodel.name).toEqual(name);
    } finally {
      await imodel.close();
    }
  });

  it("raises `onOpen` event when a new `BlankConnection` is created", async () => {
    const spy = vi.fn();
    IModelConnection.onOpen.addListener(spy);
    const connection = createBlankConnection();
    try {
      expect(spy).toHaveBeenCalled();
    } finally {
      await connection.close();
    }
  });
});
