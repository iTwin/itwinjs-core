/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { InstanceKey, RelatedClassInfo, RelationshipPath } from "../EC";
import { Id64 } from "@bentley/bentleyjs-core";
import { createRandomECClassInfo } from "./_helpers/random";

describe("InstanceKey", () => {

  describe("compare", () => {

    it("returns less than 0 when `lhs.className` < `rhs.className`", () => {
      const lhs = { className: "a", id: Id64.invalid };
      const rhs = { className: "b", id: Id64.invalid };
      expect(InstanceKey.compare(lhs, rhs)).to.be.lt(0);
    });

    it("returns less than 0 when `lhs.className` = `rhs.className` and `lhs.id` < `rhs.id`", () => {
      const lhs = { className: "a", id: "0x1" };
      const rhs = { className: "a", id: "0x2" };
      expect(InstanceKey.compare(lhs, rhs)).to.be.lt(0);
    });

    it("returns 0 when `lhs.className` = `rhs.className` and `lhs.id` = `rhs.id`", () => {
      const lhs = { className: "a", id: "0x1" };
      const rhs = { className: "a", id: "0x1" };
      expect(InstanceKey.compare(lhs, rhs)).to.eq(0);
    });

    it("returns more than 0 when `lhs.className` > `rhs.className`", () => {
      const lhs = { className: "b", id: Id64.invalid };
      const rhs = { className: "1", id: Id64.invalid };
      expect(InstanceKey.compare(lhs, rhs)).to.be.gt(0);
    });

    it("returns more than 0 when `lhs.className` = `rhs.className` and `lhs.id` > `rhs.id`", () => {
      const lhs = { className: "a", id: "0x2" };
      const rhs = { className: "a", id: "0x1" };
      expect(InstanceKey.compare(lhs, rhs)).to.be.gt(0);
    });

  });

});

describe("RelationshipPath", () => {

  describe("reverse", () => {

    it("reverses single-step path", () => {
      const src = createRandomECClassInfo();
      const tgt = createRandomECClassInfo();
      const rel = { ...createRandomECClassInfo(), name: "src-to-tgt" };
      const path: RelationshipPath = [{
        sourceClassInfo: src,
        relationshipInfo: rel,
        isForwardRelationship: true,
        targetClassInfo: tgt,
        isPolymorphicRelationship: true,
      }];
      const expected: RelationshipPath = [{
        sourceClassInfo: tgt,
        relationshipInfo: rel,
        isForwardRelationship: false,
        targetClassInfo: src,
        isPolymorphicRelationship: true,
      }];
      const reversed = RelationshipPath.reverse(path);
      expect(reversed).to.deep.eq(expected);
    });

    it("reverses multi-step path", () => {
      const src = createRandomECClassInfo();
      const mid = createRandomECClassInfo();
      const tgt = createRandomECClassInfo();
      const rel1 = { ...createRandomECClassInfo(), name: "src-to-mid" };
      const rel2 = { ...createRandomECClassInfo(), name: "tgt-to-mid" };
      const path: RelationshipPath = [{
        sourceClassInfo: src,
        relationshipInfo: rel1,
        isForwardRelationship: true,
        targetClassInfo: mid,
        isPolymorphicRelationship: true,
      }, {
        sourceClassInfo: mid,
        relationshipInfo: rel2,
        isForwardRelationship: false,
        targetClassInfo: tgt,
        isPolymorphicRelationship: true,
      }];
      const expected: RelationshipPath = [{
        sourceClassInfo: tgt,
        relationshipInfo: rel2,
        isForwardRelationship: true,
        targetClassInfo: mid,
        isPolymorphicRelationship: true,
      }, {
        sourceClassInfo: mid,
        relationshipInfo: rel1,
        isForwardRelationship: false,
        targetClassInfo: src,
        isPolymorphicRelationship: true,
      }];
      const reversed = RelationshipPath.reverse(path);
      expect(reversed).to.deep.eq(expected);
    });

  });

});
