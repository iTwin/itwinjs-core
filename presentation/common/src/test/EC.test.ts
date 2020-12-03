/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64 } from "@bentley/bentleyjs-core";
import { InstanceKey, RelationshipPath } from "../presentation-common";
import { RelatedClassInfo, StrippedRelatedClassInfo } from "../presentation-common/EC";
import { createRandomECClassInfo, createRandomRelatedClassInfo } from "./_helpers/random";

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

describe("RelatedClassInfo", () => {

  describe("to/from JSON", () => {

    it("passes roundtrip", () => {
      const src = createRandomRelatedClassInfo();
      const json = RelatedClassInfo.toJSON(src);
      const res = RelatedClassInfo.fromJSON(json);
      expect(res).to.deep.eq(src);
    });

  });

  describe("equals", () => {

    it("returns `true` when `RelatedClassInfo` equals to another `RelatedClassInfo`", () => {
      const lhs: RelatedClassInfo = {
        isForwardRelationship: true,
        isPolymorphicRelationship: true,
        relationshipInfo: createRandomECClassInfo(),
        sourceClassInfo: createRandomECClassInfo(),
        targetClassInfo: createRandomECClassInfo(),
        isPolymorphicTargetClass: true,
      };
      const rhs = { ...lhs };
      expect(RelatedClassInfo.equals(lhs, rhs)).to.be.true;
    });

    it("returns `false` when `RelatedClassInfo` doesn't equal to another `RelatedClassInfo`", () => {
      const lhs: RelatedClassInfo = {
        isForwardRelationship: true,
        isPolymorphicRelationship: true,
        relationshipInfo: createRandomECClassInfo(),
        sourceClassInfo: createRandomECClassInfo(),
        targetClassInfo: createRandomECClassInfo(),
        isPolymorphicTargetClass: true,
      };
      const rhs = { ...lhs, sourceClassInfo: { ...lhs.sourceClassInfo, name: "different" } };
      expect(RelatedClassInfo.equals(lhs, rhs)).to.be.false;
    });

    it("returns `true` when `RelatedClassInfo` equals to `StrippedRelatedClassInfo`", () => {
      const lhs: RelatedClassInfo = {
        isForwardRelationship: true,
        isPolymorphicRelationship: true,
        relationshipInfo: createRandomECClassInfo(),
        sourceClassInfo: createRandomECClassInfo(),
        targetClassInfo: createRandomECClassInfo(),
        isPolymorphicTargetClass: true,
      };
      const rhs: StrippedRelatedClassInfo = {
        isForwardRelationship: lhs.isForwardRelationship,
        relationshipName: lhs.relationshipInfo.name,
        sourceClassName: lhs.sourceClassInfo.name,
        targetClassName: lhs.targetClassInfo.name,
      };
      expect(RelatedClassInfo.equals(lhs, rhs)).to.be.true;
    });

    it("returns `false` when `RelatedClassInfo` doesn't equal to `StrippedRelatedClassInfo`", () => {
      const lhs: RelatedClassInfo = {
        isForwardRelationship: true,
        isPolymorphicRelationship: true,
        relationshipInfo: createRandomECClassInfo(),
        sourceClassInfo: createRandomECClassInfo(),
        targetClassInfo: createRandomECClassInfo(),
        isPolymorphicTargetClass: true,
      };
      const rhs: StrippedRelatedClassInfo = {
        isForwardRelationship: lhs.isForwardRelationship,
        relationshipName: lhs.relationshipInfo.name,
        sourceClassName: lhs.sourceClassInfo.name,
        targetClassName: "different",
      };
      expect(RelatedClassInfo.equals(lhs, rhs)).to.be.false;
    });

  });

  describe("strip", () => {

    it("correctly creates `StrippedRelatedClassInfo` from given `RelatedClassInfo`", () => {
      const source: RelatedClassInfo = {
        isForwardRelationship: true,
        isPolymorphicRelationship: true,
        relationshipInfo: createRandomECClassInfo(),
        sourceClassInfo: createRandomECClassInfo(),
        targetClassInfo: createRandomECClassInfo(),
        isPolymorphicTargetClass: true,
      };
      expect(RelatedClassInfo.strip(source)).to.deep.eq({
        isForwardRelationship: source.isForwardRelationship,
        relationshipName: source.relationshipInfo.name,
        sourceClassName: source.sourceClassInfo.name,
        targetClassName: source.targetClassInfo.name,
      });
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
        isPolymorphicTargetClass: true,
      }];
      const expected: RelationshipPath = [{
        sourceClassInfo: tgt,
        relationshipInfo: rel,
        isForwardRelationship: false,
        targetClassInfo: src,
        isPolymorphicRelationship: true,
        isPolymorphicTargetClass: true,
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
        isPolymorphicTargetClass: true,
      }, {
        sourceClassInfo: mid,
        relationshipInfo: rel2,
        isForwardRelationship: false,
        targetClassInfo: tgt,
        isPolymorphicRelationship: true,
        isPolymorphicTargetClass: true,
      }];
      const expected: RelationshipPath = [{
        sourceClassInfo: tgt,
        relationshipInfo: rel2,
        isForwardRelationship: true,
        targetClassInfo: mid,
        isPolymorphicRelationship: true,
        isPolymorphicTargetClass: true,
      }, {
        sourceClassInfo: mid,
        relationshipInfo: rel1,
        isForwardRelationship: false,
        targetClassInfo: src,
        isPolymorphicRelationship: true,
        isPolymorphicTargetClass: true,
      }];
      const reversed = RelationshipPath.reverse(path);
      expect(reversed).to.deep.eq(expected);
    });

  });

  describe("equals", () => {

    it("returns `true` when paths are equal", () => {
      const lhs: RelationshipPath = [{
        isForwardRelationship: true,
        isPolymorphicRelationship: true,
        relationshipInfo: createRandomECClassInfo(),
        sourceClassInfo: createRandomECClassInfo(),
        targetClassInfo: createRandomECClassInfo(),
        isPolymorphicTargetClass: true,
      }];
      const rhs = [{ ...lhs[0] }];
      expect(RelationshipPath.equals(lhs, rhs)).to.be.true;
    });

    it("returns `false` when lengths are different", () => {
      const lhs: RelationshipPath = [{
        isForwardRelationship: true,
        isPolymorphicRelationship: true,
        relationshipInfo: createRandomECClassInfo(),
        sourceClassInfo: createRandomECClassInfo(),
        targetClassInfo: createRandomECClassInfo(),
        isPolymorphicTargetClass: true,
      }];
      const rhs = [
        ...lhs,
        {
          isForwardRelationship: true,
          isPolymorphicRelationship: true,
          relationshipInfo: createRandomECClassInfo(),
          sourceClassInfo: createRandomECClassInfo(),
          targetClassInfo: createRandomECClassInfo(),
          isPolymorphicTargetClass: true,
        },
      ];
      expect(RelationshipPath.equals(lhs, rhs)).to.be.false;
    });

    it("returns `false` when path components are different", () => {
      const lhs: RelationshipPath = [{
        isForwardRelationship: true,
        isPolymorphicRelationship: true,
        relationshipInfo: createRandomECClassInfo(),
        sourceClassInfo: createRandomECClassInfo(),
        targetClassInfo: createRandomECClassInfo(),
        isPolymorphicTargetClass: true,
      }];
      const rhs = [{
        ...lhs[0],
        relationshipInfo: {
          ...lhs[0].relationshipInfo,
          name: "different",
        },
      }];
      expect(RelationshipPath.equals(lhs, rhs)).to.be.false;
    });

  });

  describe("strip", () => {

    it("correctly creates `StrippedRelationshipPath` from given `RelationshipPath`", () => {
      const source: RelationshipPath = [{
        isForwardRelationship: true,
        isPolymorphicRelationship: true,
        relationshipInfo: createRandomECClassInfo(),
        sourceClassInfo: createRandomECClassInfo(),
        targetClassInfo: createRandomECClassInfo(),
        isPolymorphicTargetClass: true,
      }];
      expect(RelationshipPath.strip(source)).to.deep.eq(source.map((s) => ({
        isForwardRelationship: s.isForwardRelationship,
        relationshipName: s.relationshipInfo.name,
        sourceClassName: s.sourceClassInfo.name,
        targetClassName: s.targetClassInfo.name,
      })));
    });

  });

});
