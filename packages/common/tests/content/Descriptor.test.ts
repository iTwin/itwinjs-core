/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import "@helpers/Snapshots";
import { createRandomDescriptorJson, createRandomDescriptor } from "@helpers/random";
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

  describe("getFieldByName", () => {

    it("returns undefined when there are no fields", () => {
      const descriptor = createRandomDescriptor();
      descriptor.fields = [];
      expect(descriptor.getFieldByName("test")).to.be.undefined;
    });

    it("returns undefined when field is not found", () => {
      const descriptor = createRandomDescriptor();
      const name = descriptor.fields.map((f) => f.name).join();
      expect(descriptor.getFieldByName(name)).to.be.undefined;
    });

    it("returns a field", () => {
      const descriptor = createRandomDescriptor();
      const field = descriptor.fields[0];
      expect(descriptor.getFieldByName(field.name)).to.eq(field);
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

  describe("createStrippedDescriptor", () => {

    it("creates a descriptor copy with empty fields and selectClasses member arrays", () => {
      // create original and verify it's valid for testing
      const descriptor = createRandomDescriptor();
      expect(descriptor.fields.length).to.be.above(0);
      expect(descriptor.selectClasses.length).to.be.above(0);

      // create a stripped descriptor and verify it's a different object
      // and doesn't contain stripped data
      const stripped = descriptor.createStrippedDescriptor();
      expect(stripped).to.not.eq(descriptor);
      expect(stripped.fields.length).to.eq(0);
      expect(stripped.selectClasses.length).to.eq(0);

      // verify original wasn't changed
      expect(descriptor.fields.length).to.be.above(0);
      expect(descriptor.selectClasses.length).to.be.above(0);
    });

  });

});
