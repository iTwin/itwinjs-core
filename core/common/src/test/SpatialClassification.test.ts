/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SpatialClassifiers } from "../SpatialClassification";

/*
describe("SpatialClassifiers", () => {
  it("should construct from JSON", () => {
    expect(new SpatialClassifiers({}).length).to.equal(0);

    const classifierJson: SpatialClassifierProps[] = [{
      modelId: "0x123",
      expand: 456,
      flags: new SpatialClassifierFlags().toJSON(),
      name: "MyClassifier",
      isActive: true,
    }];

    const classifiers = new SpatialClassifiers({ classifiers: classifierJson });
    expect(classifiers.length).to.equal(1);
    expect(classifiers.active).not.to.be.undefined;
    expect(classifiers.active).to.equal(classifierJson[0]);
  });

  it("should set active classifier", () => {
    const json = [
      {
        modelId: "0x123",
        expand: 456,
        flags: new SpatialClassifierFlags().toJSON(),
        name: "123",
        isActive: true,
      },
      {
        modelId: "0x456",
        expand: 123,
        flags: new SpatialClassifierFlags().toJSON(),
        name: "456",
        isActive: true,
      },
    ];

    const sc = new SpatialClassifiers({ classifiers: json });
    const prevActive = sc.active as SpatialClassificationProps.Properties;
    expect(prevActive).not.to.be.undefined;
    expect(prevActive.isActive).to.be.true;

    // Two classifiers in json set as active - first one wins
    expect(prevActive).to.equal(json[0]);
    expect(json[0].isActive).to.be.true;
    expect(json[1].isActive).to.be.false;

    sc.active = undefined;
    expect(prevActive.isActive).to.be.false;
    expect(sc.active).to.be.undefined;

    // Try to set active using instance not present in list
    const clone = JSON.parse(JSON.stringify(json[0]));
    sc.active = clone;
    expect(sc.active).to.equal(json[0]);
    expect(json[0].isActive).to.be.true;
  });

  it("should add a new classifier", () => {
    const json = [{
      modelId: "0x123",
      expand: 456,
      flags: new SpatialClassifierFlags().toJSON(),
      name: "MyClassifier",
      isActive: false,
    }];

    const sc = new SpatialClassifiers({ classifiers: json });
    expect(sc.length).to.equal(1);
    expect(sc.active).to.be.undefined;

    const newJson = {
      modelId: "0x456",
      expand: 123,
      flags: new SpatialClassifierFlags().toJSON(),
      name: "NewClassifier",
      isActive: true,
    };

    // push() makes a copy
    const newClassifier = sc.push(newJson) as SpatialClassificationProps.Properties;
    expect(newClassifier).not.to.be.undefined;
    expect(newClassifier).not.to.equal(newJson);
    expect(SpatialClassificationProps.equalClassifiers(newClassifier, newJson)).to.be.true;

    expect(sc.length).to.equal(2);
    expect(sc.active).to.be.undefined;
    expect(newClassifier.isActive).to.be.false;

    sc.active = newJson;
    expect(sc.active).not.to.be.undefined;
    expect(sc.active).to.equal(newClassifier);
    expect(newClassifier.isActive).to.be.true;

    sc.active = undefined;
    newJson.modelId = "0x789";
    sc.active = newJson;
    expect(sc.active).to.be.undefined;
  });

  it("should not add duplicate classifier", () => {
    const json: SpatialClassificationProps.Properties = {
      modelId: "0x123",
      expand: 456,
      flags: new SpatialClassifierFlags().toJSON(),
      name: "MyClassifier",
      isActive: true,
    };

    const sc = new SpatialClassifiers({});
    expect(sc.push(json)).not.to.be.undefined;

    const clone = JSON.parse(JSON.stringify(json));
    expect(sc.push(clone)).to.be.undefined;
  });
});
*/
