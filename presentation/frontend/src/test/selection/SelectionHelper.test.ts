/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */

import { expect } from "chai";
import { createTestECInstanceKey, createTestECInstancesNodeKey, createTestNodeKey } from "@itwin/presentation-common/test-utils";
import { SelectionHelper } from "../../presentation-frontend.js";

describe("SelectionHelper", () => {
  describe("getKeysForSelection", () => {
    it("returns all ECInstance keys when ECInstances node key is provided", () => {
      const nodeKey = createTestECInstancesNodeKey();
      const selectionKeys = SelectionHelper.getKeysForSelection([nodeKey]);
      expect(selectionKeys.length).to.eq(nodeKey.instanceKeys.length);
      expect(selectionKeys).to.deep.eq(nodeKey.instanceKeys);
    });

    it("returns node key when non-ECInstance node key is provided", () => {
      const nodeKey = createTestNodeKey();
      const selectionKeys = SelectionHelper.getKeysForSelection([nodeKey]);
      expect(selectionKeys.length).to.eq(1);
      expect(selectionKeys[0]).to.deep.eq(nodeKey);
    });

    it("returns key when ECInstance key is provided", () => {
      const key = createTestECInstanceKey();
      const selectionKeys = SelectionHelper.getKeysForSelection([key]);
      expect(selectionKeys.length).to.eq(1);
      expect(selectionKeys[0]).to.deep.eq(key);
    });
  });
});
