/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import { InstanceKey, RelationshipPath } from "../presentation-common.js";
import {
  RelatedClassInfo,
  RelatedClassInfoWithOptionalRelationship,
  RelatedClassInfoWithOptionalRelationshipJSON,
  StrippedRelatedClassInfo,
} from "../presentation-common/EC.js";
import { createTestECClassInfo, createTestRelatedClassInfo, createTestRelatedClassInfoWithOptionalRelationship } from "./_helpers/EC.js";

describe("InstanceKey", () => {
  describe("compare", () => {
    it("returns less than 0 when lhs schema name < rhs schema name", () => {
      const lhs = { className: "a.x", id: Id64.invalid };
      const rhs = { className: "b.x", id: Id64.invalid };
      expect(InstanceKey.compare(lhs, rhs)).to.be.lt(0);
    });

    it("returns less than 0 when lhs class name < rhs class name", () => {
      const lhs = { className: "x.a", id: Id64.invalid };
      const rhs = { className: "x.b", id: Id64.invalid };
      expect(InstanceKey.compare(lhs, rhs)).to.be.lt(0);
    });

    it("returns less than 0 when lhs id < rhs id", () => {
      const lhs = { className: "x.y", id: "0x1" };
      const rhs = { className: "x.y", id: "0x2" };
      expect(InstanceKey.compare(lhs, rhs)).to.be.lt(0);
    });

    it("returns more than 0 when lhs schema name < rhs schema name", () => {
      const lhs = { className: "b.x", id: Id64.invalid };
      const rhs = { className: "a.x", id: Id64.invalid };
      expect(InstanceKey.compare(lhs, rhs)).to.be.gt(0);
    });

    it("returns more than 0 when lhs class name < rhs class name", () => {
      const lhs = { className: "x.b", id: Id64.invalid };
      const rhs = { className: "x.a", id: Id64.invalid };
      expect(InstanceKey.compare(lhs, rhs)).to.be.gt(0);
    });

    it("returns more than 0 when lhs id < rhs id", () => {
      const lhs = { className: "x.y", id: "0x2" };
      const rhs = { className: "x.y", id: "0x1" };
      expect(InstanceKey.compare(lhs, rhs)).to.be.gt(0);
    });

    it("returns 0 when everything's equal", () => {
      const lhs = { className: "a.b", id: "0x1" };
      const rhs = { className: "a.b", id: "0x1" };
      expect(InstanceKey.compare(lhs, rhs)).to.eq(0);
    });

    it("ignores letter casing", () => {
      const lhs = { className: "a.B", id: "0xaBC" };
      const rhs = { className: "A.b", id: "0xAbc" };
      expect(InstanceKey.compare(lhs, rhs)).to.eq(0);
    });

    it("ignores different full class name formats", () => {
      const lhs = { className: "a.b", id: Id64.invalid };
      const rhs = { className: "a:b", id: Id64.invalid };
      expect(InstanceKey.compare(lhs, rhs)).to.eq(0);
    });
  });
});

describe("RelatedClassInfo", () => {
  describe("to/from compressed JSON", () => {
    it("passes roundtrip", () => {
      const src = createTestRelatedClassInfo();
      const classesMap = {};
      const json = RelatedClassInfo.toCompressedJSON(src, classesMap);
      const res = RelatedClassInfo.fromCompressedJSON(json, classesMap);
      expect(res).to.deep.eq(src);
    });
  });

  describe("equals", () => {
    it("returns `true` when `RelatedClassInfo` equals to another `RelatedClassInfo`", () => {
      const lhs: RelatedClassInfo = {
        isForwardRelationship: true,
        isPolymorphicRelationship: true,
        relationshipInfo: createTestECClassInfo(),
        sourceClassInfo: createTestECClassInfo(),
        targetClassInfo: createTestECClassInfo(),
        isPolymorphicTargetClass: true,
      };
      const rhs = { ...lhs };
      expect(RelatedClassInfo.equals(lhs, rhs)).to.be.true;
    });

    it("returns `false` when `RelatedClassInfo` doesn't equal to another `RelatedClassInfo`", () => {
      const lhs: RelatedClassInfo = {
        isForwardRelationship: true,
        isPolymorphicRelationship: true,
        relationshipInfo: createTestECClassInfo(),
        sourceClassInfo: createTestECClassInfo(),
        targetClassInfo: createTestECClassInfo(),
        isPolymorphicTargetClass: true,
      };
      const rhs = { ...lhs, sourceClassInfo: { ...lhs.sourceClassInfo, name: "different" } };
      expect(RelatedClassInfo.equals(lhs, rhs)).to.be.false;
    });

    it("returns `true` when `RelatedClassInfo` equals to `StrippedRelatedClassInfo`", () => {
      const lhs: RelatedClassInfo = {
        isForwardRelationship: true,
        isPolymorphicRelationship: true,
        relationshipInfo: createTestECClassInfo(),
        sourceClassInfo: createTestECClassInfo(),
        targetClassInfo: createTestECClassInfo(),
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
        relationshipInfo: createTestECClassInfo(),
        sourceClassInfo: createTestECClassInfo(),
        targetClassInfo: createTestECClassInfo(),
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
        relationshipInfo: createTestECClassInfo(),
        sourceClassInfo: createTestECClassInfo(),
        targetClassInfo: createTestECClassInfo(),
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
      };
      const json = RelatedClassInfoWithOptionalRelationship.toCompressedJSON(src, classInfos);
      expect(classInfos).to.deep.eq({
        [sourceClassInfo.id]: { name: sourceClassInfo.name, label: sourceClassInfo.label },
        [targetClassInfo.id]: { name: targetClassInfo.name, label: targetClassInfo.label },
      });
      expect(json.relationshipInfo).to.be.undefined;
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
      expect(res.relationshipInfo).to.be.undefined;
    });
  });
});

describe("RelationshipPath", () => {
  describe("reverse", () => {
    it("reverses single-step path", () => {
      const src = createTestECClassInfo();
      const tgt = createTestECClassInfo();
      const rel = { ...createTestECClassInfo(), name: "src-to-tgt" };
      const path: RelationshipPath = [
        {
          sourceClassInfo: src,
          relationshipInfo: rel,
          isForwardRelationship: true,
          targetClassInfo: tgt,
          isPolymorphicRelationship: true,
          isPolymorphicTargetClass: true,
        },
      ];
      const expected: RelationshipPath = [
        {
          sourceClassInfo: tgt,
          relationshipInfo: rel,
          isForwardRelationship: false,
          targetClassInfo: src,
          isPolymorphicRelationship: true,
          isPolymorphicTargetClass: true,
        },
      ];
      const reversed = RelationshipPath.reverse(path);
      expect(reversed).to.deep.eq(expected);
    });

    it("reverses multi-step path", () => {
      const src = createTestECClassInfo();
      const mid = createTestECClassInfo();
      const tgt = createTestECClassInfo();
      const rel1 = { ...createTestECClassInfo(), name: "src-to-mid" };
      const rel2 = { ...createTestECClassInfo(), name: "tgt-to-mid" };
      const path: RelationshipPath = [
        {
          sourceClassInfo: src,
          relationshipInfo: rel1,
          isForwardRelationship: true,
          targetClassInfo: mid,
          isPolymorphicRelationship: true,
          isPolymorphicTargetClass: true,
        },
        {
          sourceClassInfo: mid,
          relationshipInfo: rel2,
          isForwardRelationship: false,
          targetClassInfo: tgt,
          isPolymorphicRelationship: true,
          isPolymorphicTargetClass: true,
        },
      ];
      const expected: RelationshipPath = [
        {
          sourceClassInfo: tgt,
          relationshipInfo: rel2,
          isForwardRelationship: true,
          targetClassInfo: mid,
          isPolymorphicRelationship: true,
          isPolymorphicTargetClass: true,
        },
        {
          sourceClassInfo: mid,
          relationshipInfo: rel1,
          isForwardRelationship: false,
          targetClassInfo: src,
          isPolymorphicRelationship: true,
          isPolymorphicTargetClass: true,
        },
      ];
      const reversed = RelationshipPath.reverse(path);
      expect(reversed).to.deep.eq(expected);
    });
  });

  describe("equals", () => {
    it("returns `true` when paths are equal", () => {
      const lhs: RelationshipPath = [
        {
          isForwardRelationship: true,
          isPolymorphicRelationship: true,
          relationshipInfo: createTestECClassInfo(),
          sourceClassInfo: createTestECClassInfo(),
          targetClassInfo: createTestECClassInfo(),
          isPolymorphicTargetClass: true,
        },
      ];
      const rhs = [{ ...lhs[0] }];
      expect(RelationshipPath.equals(lhs, rhs)).to.be.true;
    });

    it("returns `false` when lengths are different", () => {
      const lhs: RelationshipPath = [
        {
          isForwardRelationship: true,
          isPolymorphicRelationship: true,
          relationshipInfo: createTestECClassInfo(),
          sourceClassInfo: createTestECClassInfo(),
          targetClassInfo: createTestECClassInfo(),
          isPolymorphicTargetClass: true,
        },
      ];
      const rhs = [
        ...lhs,
        {
          isForwardRelationship: true,
          isPolymorphicRelationship: true,
          relationshipInfo: createTestECClassInfo(),
          sourceClassInfo: createTestECClassInfo(),
          targetClassInfo: createTestECClassInfo(),
          isPolymorphicTargetClass: true,
        },
      ];
      expect(RelationshipPath.equals(lhs, rhs)).to.be.false;
    });

    it("returns `false` when path components are different", () => {
      const lhs: RelationshipPath = [
        {
          isForwardRelationship: true,
          isPolymorphicRelationship: true,
          relationshipInfo: createTestECClassInfo(),
          sourceClassInfo: createTestECClassInfo(),
          targetClassInfo: createTestECClassInfo(),
          isPolymorphicTargetClass: true,
        },
      ];
      const rhs = [
        {
          ...lhs[0],
          relationshipInfo: {
            ...lhs[0].relationshipInfo,
            name: "different",
          },
        },
      ];
      expect(RelationshipPath.equals(lhs, rhs)).to.be.false;
    });
  });

  describe("strip", () => {
    it("correctly creates `StrippedRelationshipPath` from given `RelationshipPath`", () => {
      const source: RelationshipPath = [
        {
          isForwardRelationship: true,
          isPolymorphicRelationship: true,
          relationshipInfo: createTestECClassInfo(),
          sourceClassInfo: createTestECClassInfo(),
          targetClassInfo: createTestECClassInfo(),
          isPolymorphicTargetClass: true,
        },
      ];
      expect(RelationshipPath.strip(source)).to.deep.eq(
        source.map((s) => ({
          isForwardRelationship: s.isForwardRelationship,
          relationshipName: s.relationshipInfo.name,
          sourceClassName: s.sourceClassInfo.name,
          targetClassName: s.targetClassInfo.name,
        })),
      );
    });
  });
});
