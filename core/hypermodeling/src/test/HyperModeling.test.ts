/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { SectionType } from "@itwin/core-common";
import { IModelApp, ParseAndRunResult } from "@itwin/core-frontend";
import { HyperModeling } from "../HyperModeling";
import { HyperModelingConfig, SectionGraphicsConfig, SectionMarkerConfig } from "../HyperModelingConfig";
import { SectionMarkerHandler } from "../SectionMarkerHandler";

// NB: Most of the package functionality requires an IModelConnection => a backend, so is tested in core-full-stack-tests.
describe("Package initialization", () => {
  before(async () => {
    await IModelApp.startup();
  });

  after(async () => {
    expect(HyperModeling.resources).to.not.be.undefined;
    await IModelApp.shutdown();
    expect(HyperModeling.resources).to.be.undefined;
  });

  it("throws if not initialized", () => {
    expect(() => HyperModeling.namespace).to.throw("You must call HyperModeling.initialize before using the hypermodeling package");
    expect(() => HyperModeling.getMarkerData(SectionType.Section)).to.throw(); // omit message - may differ due to assert() in debug builds
  });

  it("loads marker images", async () => {
    await HyperModeling.initialize();
    for (const type of [SectionType.Section, SectionType.Plan, SectionType.Elevation, SectionType.Detail])
      expect(HyperModeling.getMarkerData(type).image).not.to.be.undefined;
  });

  it("registers tools", async () => {
    await HyperModeling.initialize();
    const tool = IModelApp.tools.find("HyperModeling.Marker.Config");
    expect(tool).not.to.be.undefined;
  });
});

describe("Package configuration", () => {
  before(async () => {
    await IModelApp.startup();
    await HyperModeling.initialize();
  });

  after(async () => {
    expect(HyperModeling.resources).to.not.be.undefined;
    await IModelApp.shutdown();
    expect(HyperModeling.resources).to.be.undefined;
  });

  function expectMarkerConfig(actual: SectionMarkerConfig, expected: SectionMarkerConfig): void {
    expect(true === actual.ignoreModelSelector).to.equal(true === expected.ignoreModelSelector);
    expect(true === actual.ignoreCategorySelector).to.equal(true === expected.ignoreCategorySelector);
    if (undefined === expected.hiddenSectionTypes)
      expect(undefined === actual.hiddenSectionTypes || 0 === actual.hiddenSectionTypes.length).to.be.true;
    else
      expect(actual.hiddenSectionTypes).to.deep.equal(expected.hiddenSectionTypes);
  }

  function expectGraphicsConfig(actual: SectionGraphicsConfig, expected: SectionGraphicsConfig): void {
    expect(true === actual.ignoreClip).to.equal(true === expected.ignoreClip);
    expect(true === actual.debugClipVolumes).to.equal(true === expected.debugClipVolumes);
    expect(true === actual.hideSectionGraphics).to.equal(true === expected.hideSectionGraphics);
    expect(true === actual.hideSheetAnnotations).to.equal(true === expected.hideSheetAnnotations);
  }

  function expectConfig(config: HyperModelingConfig | undefined): void {
    expectMarkerConfig(HyperModeling.markerConfig, config?.markers ?? {});
    expectGraphicsConfig(HyperModeling.graphicsConfig, config?.graphics ?? {});

    if (undefined !== config?.markerHandler)
      expect(HyperModeling.markerHandler).to.equal(config.markerHandler);
    else
      expect(HyperModeling.markerHandler).not.to.be.undefined;
  }

  it("replaces configuration", () => {
    const test = (config?: HyperModelingConfig) => {
      HyperModeling.replaceConfiguration(config ? { ...config } : undefined);
      expectConfig(config);
    };

    test({ markerHandler: new SectionMarkerHandler() });
    test({ markers: { ignoreModelSelector: true, ignoreCategorySelector: undefined, hiddenSectionTypes: [SectionType.Elevation, SectionType.Plan] } });
    test({ graphics: { ignoreClip: true, debugClipVolumes: false, hideSectionGraphics: undefined, hideSheetAnnotations: true } });
  });

  it("updates configuration", () => {
    const test = (config: HyperModelingConfig, expected: HyperModelingConfig) => {
      HyperModeling.updateConfiguration({ ...config });
      expectConfig(expected);
      HyperModeling.updateConfiguration({});
      expectConfig(expected);
    };

    HyperModeling.replaceConfiguration(undefined);
    test({}, {});

    const handler = new SectionMarkerHandler();
    test(
      { markerHandler: handler },
      { markerHandler: handler });

    test(
      { markers: { ignoreModelSelector: true, hiddenSectionTypes: [SectionType.Elevation] } },
      { markerHandler: handler, markers: { ignoreModelSelector: true, hiddenSectionTypes: [SectionType.Elevation] } });

    test(
      { markers: { ignoreModelSelector: false, ignoreCategorySelector: true, hiddenSectionTypes: [] } },
      { markerHandler: handler, markers: { ignoreModelSelector: false, ignoreCategorySelector: true, hiddenSectionTypes: [] } });

    test(
      { graphics: { ignoreClip: true, debugClipVolumes: false } },
      { markerHandler: handler, markers: { ignoreModelSelector: false, ignoreCategorySelector: true, hiddenSectionTypes: [] }, graphics: { ignoreClip: true, debugClipVolumes: false } });

    test(
      { markerHandler: undefined, markers: {}, graphics: undefined },
      { markerHandler: handler, markers: { ignoreModelSelector: false, ignoreCategorySelector: true, hiddenSectionTypes: [] }, graphics: { ignoreClip: true, debugClipVolumes: false } });

    // Reset for subsequent tests...
    HyperModeling.replaceConfiguration(undefined);
  });

  it("updates marker configuration via key-in", async () => {
    await HyperModeling.initialize();

    const test = async (keyin: string, config: SectionMarkerConfig) => {
      expect(await IModelApp.tools.parseAndRun(keyin)).to.equal(ParseAndRunResult.Success);
      expectMarkerConfig(HyperModeling.markerConfig, config);
    };

    await test("hypermodeling marker default config model=0", { ignoreModelSelector: true });
    await test("hypermodeling marker default config cat=0", { ignoreModelSelector: true, ignoreCategorySelector: true });
    await test("hypermodeling marker default config m=1 c=1", { ignoreModelSelector: false, ignoreCategorySelector: false });
    await test("hypermodeling marker default config", {});
    await test("hypermodeling marker default config hidden=pe", { hiddenSectionTypes: [SectionType.Plan, SectionType.Elevation] });
    await test("hypermodeling marker default config h=@#$abcsxyz123", { hiddenSectionTypes: [SectionType.Section] });
    await test("hypermodeling marker default config", {});

    // Reset for subsequent tests...
    HyperModeling.replaceConfiguration(undefined);
  });

  it("updates graphics configuration via key-in", async () => {
    const test = async (keyin: string, config: SectionGraphicsConfig) => {
      expect(await IModelApp.tools.parseAndRun(keyin)).to.equal(ParseAndRunResult.Success);
      expectGraphicsConfig(HyperModeling.graphicsConfig, config);
    };

    await test("hypermodeling graphics config drawing=0", { hideSectionGraphics: true });
    await test("hypermodeling graphics config sh=0", { hideSheetAnnotations: true, hideSectionGraphics: true });
    await test("hypermodeling graphics config d=1 s=1", {});
    await test("hypermodeling graphics config clip=0", { ignoreClip: true });
    await test("hypermodeling graphics config boundaries=1", { ignoreClip: true, debugClipVolumes: true });
    await test("hypermodeling graphics config c=1 b=0", {});
    await test("hypermodeling graphics config", {});

    // Reset for subsequent tests...
    HyperModeling.replaceConfiguration(undefined);
  });
});
