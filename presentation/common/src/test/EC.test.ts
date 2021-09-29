/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import { InstanceKey, RelationshipPath } from "../presentation-common";
import {
  ClassInfo, RelatedClassInfo, RelatedClassInfoJSON, RelatedClassInfoWithOptionalRelationship, RelatedClassInfoWithOptionalRelationshipJSON,
  StrippedRelatedClassInfo,
} from "../presentation-common/EC";
import { createTestECClassInfo, createTestRelatedClassInfo, createTestRelatedClassInfoWithOptionalRelationship } from "./_helpers/EC";
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

describe("RelatedClassInfo", () => {

  describe("to/from JSON", () => {

    it("passes roundtrip", () => {
      const src = createTestRelatedClassInfo();
      const json = RelatedClassInfo.toJSON(src);
      const res = RelatedClassInfo.fromJSON(json);
      expect(res).to.deep.eq(src);
    });

    it("handles optional attributes", () => {
      const json: RelatedClassInfoJSON = {
        sourceClassInfo: ClassInfo.toJSON(createTestECClassInfo()),
        relationshipInfo: ClassInfo.toJSON(createTestECClassInfo()),
        isForwardRelationship: true,
        targetClassInfo: ClassInfo.toJSON(createTestECClassInfo()),
      };
      const res = RelatedClassInfo.fromJSON(json);
      expect(res.isPolymorphicRelationship).to.be.false;
      expect(res.isPolymorphicTargetClass).to.be.false;
    });

  });

  describe("to/from compressed JSON", () => {

    it("passes roundtrip", () => {
      const src = createTestRelatedClassInfo();
      const classesMap = {};
      const json = RelatedClassInfo.toCompressedJSON(src, classesMap);
      const res = RelatedClassInfo.fromCompressedJSON(json, classesMap);
      expect(res).to.deep.eq(src);
    });

    it("handles optional attributes", () => {
      const sourceClassInfo = createTestECClassInfo();
      const relationshipInfo = createTestECClassInfo();
      const targetClassInfo = createTestECClassInfo();
      const classInfos = {
        [sourceClassInfo.id]: { name: sourceClassInfo.name, label: sourceClassInfo.label },
        [relationshipInfo.id]: { name: relationshipInfo.name, label: relationshipInfo.label },
        [targetClassInfo.id]: { name: targetClassInfo.name, label: targetClassInfo.label },
      };
      const json: RelatedClassInfoJSON<Id64String> = {
        sourceClassInfo: sourceClassInfo.id,
        relationshipInfo: relationshipInfo.id,
        isForwardRelationship: true,
        targetClassInfo: targetClassInfo.id,
      };
      const res = RelatedClassInfo.fromCompressedJSON(json, classInfos);
      expect(res.isPolymorphicRelationship).to.be.false;
      expect(res.isPolymorphicTargetClass).to.be.false;
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

describe("RelatedClassInfoWithOptionalRelationship", () => {

  describe("to/from compressed JSON", () => {

    it("passes roundtrip", () => {
      const src = createTestRelatedClassInfoWithOptionalRelationship({
        isForwardRelationship: true,
        isPolymorphicRelationship: true,
        relationshipInfo: createTestECClassInfo({ id: "0x123", name: "relationship:class", label: "Relationship" }),
      });
      const classesMap = {};
      const json = RelatedClassInfoWithOptionalRelationship.toCompressedJSON(src, classesMap);
      const res = RelatedClassInfoWithOptionalRelationship.fromCompressedJSON(json, classesMap);
      expect(res).to.deep.eq(src);
    });

    it("handles optional attributes when serializing", () => {
      const sourceClassInfo = createTestECClassInfo();
      const targetClassInfo = createTestECClassInfo();
      const classInfos = {};
      const src: RelatedClassInfoWithOptionalRelationship = {
        sourceClassInfo,
        targetClassInfo,
        isPolymorphicTargetClass: true,
      };
      const json = RelatedClassInfoWithOptionalRelationship.toCompressedJSON(src, classInfos);
      expect(classInfos).to.deep.eq({
        [sourceClassInfo.id]: { name: sourceClassInfo.name, label: sourceClassInfo.label },
        [targetClassInfo.id]: { name: targetClassInfo.name, label: targetClassInfo.label },
      });
      expect(json.relationshipInfo).to.be.undefined;
      expect(json.isForwardRelationship).to.be.undefined;
      expect(json.isPolymorphicRelationship).to.be.undefined;
    });

    it("handles optional attributes when deserializing", () => {
      const sourceClassInfo = createTestECClassInfo();
      const targetClassInfo = createTestECClassInfo();
      const classInfos = {
        [sourceClassInfo.id]: { name: sourceClassInfo.name, label: sourceClassInfo.label },
        [targetClassInfo.id]: { name: targetClassInfo.name, label: targetClassInfo.label },
      };
      const json: RelatedClassInfoWithOptionalRelationshipJSON<Id64String> = {
        sourceClassInfo: sourceClassInfo.id,
        targetClassInfo: targetClassInfo.id,
      };
      const res = RelatedClassInfoWithOptionalRelationship.fromCompressedJSON(json, classInfos);
      expect(res.isPolymorphicTargetClass).to.be.false;
      expect(res.relationshipInfo).to.be.undefined;
      expect(res.isForwardRelationship).to.be.undefined;
      expect(res.isPolymorphicRelationship).to.be.undefined;
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
