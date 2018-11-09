/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  TreeDataProviderRaw, TreeDataProviderPromise, TreeDataProviderMethod, ITreeDataProvider,
  isTreeDataProviderRaw, isTreeDataProviderInterface, isTreeDataProviderMethod, isTreeDataProviderPromise,
} from "../../tree/TreeDataProvider";

describe("TreeDataProvider", () => {

  const emptyRawProvider: TreeDataProviderRaw = [];
  const emptyPromiseProvider: TreeDataProviderPromise = Promise.resolve(emptyRawProvider);
  const emptyMethodProvider: TreeDataProviderMethod = () => emptyPromiseProvider;
  const emptyInterfaceProvider: ITreeDataProvider = {
    getNodesCount: () => Promise.resolve(0),
    getNodes: emptyMethodProvider,
  };

  describe("isTreeDataProviderRaw", () => {

    it("returns expected results", () => {
      expect(isTreeDataProviderRaw(emptyRawProvider)).to.be.true;
      expect(isTreeDataProviderRaw(emptyPromiseProvider)).to.be.false;
      expect(isTreeDataProviderRaw(emptyMethodProvider)).to.be.false;
      expect(isTreeDataProviderRaw(emptyInterfaceProvider)).to.be.false;
    });

  });

  describe("isTreeDataProviderPromise", () => {

    it("returns expected results", () => {
      expect(isTreeDataProviderPromise(emptyRawProvider)).to.be.false;
      expect(isTreeDataProviderPromise(emptyPromiseProvider)).to.be.true;
      expect(isTreeDataProviderPromise(emptyMethodProvider)).to.be.false;
      expect(isTreeDataProviderPromise(emptyInterfaceProvider)).to.be.false;
    });

  });

  describe("isTreeDataProviderMethod", () => {

    it("returns expected results", () => {
      expect(isTreeDataProviderMethod(emptyRawProvider)).to.be.false;
      expect(isTreeDataProviderMethod(emptyPromiseProvider)).to.be.false;
      expect(isTreeDataProviderMethod(emptyMethodProvider)).to.be.true;
      expect(isTreeDataProviderMethod(emptyInterfaceProvider)).to.be.false;
    });

  });

  describe("isTreeDataProviderInterface", () => {

    it("returns expected results", () => {
      expect(isTreeDataProviderInterface(emptyRawProvider)).to.be.false;
      expect(isTreeDataProviderInterface(emptyPromiseProvider)).to.be.false;
      expect(isTreeDataProviderInterface(emptyMethodProvider)).to.be.false;
      expect(isTreeDataProviderInterface(emptyInterfaceProvider)).to.be.true;
    });

  });

});
