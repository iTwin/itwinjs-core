/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import "@helpers/Snapshots";
import { createRandomDescriptorJson, createRandomDescriptor } from "@helpers/random/Content";
import { Descriptor, Field } from "@src/content";
import { DescriptorJSON } from "@src/content/Descriptor";

describe("Descriptor", () => {

  describe("fromJSON", () => {

    let testDescriptorJSON!: DescriptorJSON;
    beforeEach(() => {
      testDescriptorJSON = createRandomDescriptorJson();
    });

    it("creates valid Descriptor from valid JSON", () => {
      const item = Descriptor.fromJSON(testDescriptorJSON);
      expect(item).to.matchSnapshot();
    });

    it("creates valid Descriptor from valid serialized JSON", () => {
      const item = Descriptor.fromJSON(JSON.stringify(testDescriptorJSON));
      expect(item).to.matchSnapshot();
    });

    it("returns undefined for undefined JSON", () => {
      const item = Descriptor.fromJSON(undefined);
      expect(item).to.be.undefined;
    });

  });

  describe("createDescriptorOverrides", () => {

    it("creates a valid object with default parameters", () => {
      const descriptor = createRandomDescriptor();
      expect(descriptor.createDescriptorOverrides()).to.matchSnapshot();
    });

    it("creates a valid object with sorting field", () => {
      const descriptor = createRandomDescriptor();
      descriptor.sortingField = descriptor.fields[0];
      expect(descriptor.createDescriptorOverrides()).to.matchSnapshot();
    });

  });

  describe("resetParentship", () => {

    it("calls resetParentship for each field", () => {
      const fieldMock = moq.Mock.ofType<Field>();
      fieldMock.setup((x) => x.resetParentship()).verifiable();
      const descriptor = createRandomDescriptor();
      descriptor.fields.push(fieldMock.object);
      descriptor.resetParentship();
      fieldMock.verifyAll();
    });

  });

  describe("rebuildParentship", () => {

    it("calls rebuildParentship for each field", () => {
      const fieldMock = moq.Mock.ofType<Field>();
      fieldMock.setup((x) => x.rebuildParentship()).verifiable();
      const descriptor = createRandomDescriptor();
      descriptor.fields.push(fieldMock.object);
      descriptor.rebuildParentship();
      fieldMock.verifyAll();
    });

  });

});
