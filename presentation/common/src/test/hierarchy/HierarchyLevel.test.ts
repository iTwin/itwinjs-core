/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { HierarchyLevel } from "../../presentation-common/hierarchy/HierarchyLevel";
import { Node } from "../../presentation-common/hierarchy/Node";
import { createTestNode } from "../_helpers/Hierarchy";

describe("HierarchyLevel", () => {

  describe("fromJSON", () => {

    it("creates valid HierarchyLevel from JSON", () => {
      const hl = HierarchyLevel.fromJSON({
        nodes: [Node.toJSON(createTestNode())],
        supportsFiltering: true,
      });
      expect(hl).to.matchSnapshot();
    });

  });

});
