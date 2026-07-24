/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import {
  BisCodeSpec, ColorDef, DisplayStyleProps, DisplayStyleSettings, DisplayStyleSettingsProps, IModel, MapImageryProps,
  RenderMode, SpatialViewDefinitionProps, ViewDefinitionProps, ViewFlagProps, ViewFlags,
} from "@itwin/core-common";
import { EditTxn, withEditTxn } from "../../EditTxn";
import { DictionaryModel, DisplayStyle3d, DisplayStyleCreationOptions, IModelDb, SnapshotDb, ViewDefinition } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { TestUtils } from "../TestUtils";
import { createIModelFromSeed } from "./IModelTestFixtures";

// spell-checker: disable

describe("iModel views", () => {
  let compatibilityReadonly: SnapshotDb;
  const mutableIModels: SnapshotDb[] = [];

  before(async () => {
    await TestUtils.startBackend();
    IModelTestUtils.registerTestBimSchema();

    const compatibilityWritable = createIModelFromSeed("views-CompatibilityTestSeed.bim", "CompatibilityTestSeed.bim");
    const compatibilityPath = compatibilityWritable.pathName;
    compatibilityWritable.close();
    compatibilityReadonly = SnapshotDb.openFile(compatibilityPath);
  });

  after(async () => {
    if (compatibilityReadonly !== undefined && compatibilityReadonly.isOpen)
      compatibilityReadonly.close();
    for (const imodel of mutableIModels.splice(0)) {
      if (imodel.isOpen)
        imodel.close();
    }
  });

  afterEach(() => {
    for (const imodel of mutableIModels.splice(0)) {
      if (imodel.isOpen)
        imodel.close();
    }
  });

  const trackMutableIModel = (imodel: SnapshotDb): SnapshotDb => {
    mutableIModels.push(imodel);
    return imodel;
  };

  it("should insert a DisplayStyle", () => {
    const imodel2 = trackMutableIModel(createIModelFromSeed("views-insert-display-style.bim", "CompatibilityTestSeed.bim"));
    const model = imodel2.models.getModel<DictionaryModel>(IModel.dictionaryId);
    expect(model).not.to.be.undefined;

    const settings: DisplayStyleSettingsProps = {
      backgroundColor: ColorDef.blue.toJSON(),
      viewflags: ViewFlags.fromJSON({
        renderMode: RenderMode.SolidFill,
      }),
    };

    const props: DisplayStyleProps = {
      classFullName: DisplayStyle3d.classFullName,
      model: IModel.dictionaryId,
      code: { spec: BisCodeSpec.displayStyle, scope: IModel.dictionaryId, value: "test style" },
      isPrivate: false,
      jsonProperties: {
        styles: settings,
      },
    };

    const txn = new EditTxn(imodel2, "insert and update DisplayStyle");
    txn.start();
    const styleId = txn.insertElement(props);
    let style = imodel2.elements.getElement<DisplayStyle3d>(styleId);
    expect(style instanceof DisplayStyle3d).to.be.true;
    expect(style.code.spec).equal(imodel2.codeSpecs.getByName(BisCodeSpec.displayStyle).id);

    expect(style.settings.viewFlags.renderMode).to.equal(RenderMode.SolidFill);
    expect(style.settings.backgroundColor.equals(ColorDef.blue)).to.be.true;

    const newFlags = style.settings.viewFlags.copy({ renderMode: RenderMode.SmoothShade });
    style.settings.viewFlags = newFlags;
    style.settings.backgroundColor = ColorDef.red;
    style.settings.monochromeColor = ColorDef.green;
    expect(style.jsonProperties.styles.viewflags.renderMode).to.equal(RenderMode.SmoothShade);

    txn.updateElement(style.toJSON());
    txn.end();
    style = imodel2.elements.getElement<DisplayStyle3d>(styleId);
    expect(style instanceof DisplayStyle3d).to.be.true;

    expect(style.settings.viewFlags.renderMode).to.equal(RenderMode.SmoothShade);
    expect(style.settings.backgroundColor.equals(ColorDef.red)).to.be.true;
    expect(style.settings.monochromeColor.equals(ColorDef.green)).to.be.true;
  });

  it("should create display styles", () => {
    const imodel2 = trackMutableIModel(createIModelFromSeed("views-create-display-styles.bim", "CompatibilityTestSeed.bim"));
    const defaultViewFlags = new ViewFlags().toJSON();
    const defaultMapImagery = new DisplayStyleSettings({}).toJSON().mapImagery;

    const viewFlags = new ViewFlags({ patterns: false, visibleEdges: true });
    const viewflags: ViewFlagProps = { noWhiteOnWhiteReversal: true, shadows: true, noTransp: true };

    const mapImagery: MapImageryProps = {
      backgroundBase: ColorDef.red.tbgr,
      backgroundLayers: [{
        name: "x",
        url: "y",
        transparency: 0.5,
        formatId: "WMS",
        visible: true,
      }],
    };

    const props: DisplayStyleSettingsProps = {
      mapImagery,
      excludedElements: ["0x123", "0xfed"],
      timePoint: 42,
      backgroundColor: ColorDef.green.tbgr,
    };

    type TestCase = [DisplayStyleCreationOptions | undefined, ViewFlagProps, boolean];
    const testCases: TestCase[] = [
      [undefined, defaultViewFlags, false],
      [{ viewFlags }, viewFlags.toJSON(), false],
      [{ viewflags }, viewflags, false],
      [{ viewflags, viewFlags }, viewFlags.toJSON(), false],
      [props, defaultViewFlags, false],
      [{ ...props, viewflags }, viewflags, false],
      [{ backgroundColor: ColorDef.blue }, defaultViewFlags, false],
      [{ backgroundColor: ColorDef.from(1, 2, 3, 4) }, defaultViewFlags, false],
      [{ backgroundColor: ColorDef.blue.tbgr }, defaultViewFlags, false],
      [{ backgroundColor: ColorDef.from(1, 2, 3, 4).tbgr }, defaultViewFlags, false],
    ];

    let suffix = 123;
    withEditTxn(imodel2, (txn) => {
      for (const test of testCases) {
        const expected = test[0] ?? {};
        const styleId = DisplayStyle3d.insert(txn, IModel.dictionaryId, `TestStyle${suffix++}`, expected);
        const style = imodel2.elements.getElement<DisplayStyle3d>(styleId).toJSON();
        expect(style.jsonProperties.styles).not.to.be.undefined;

        expect(style.jsonProperties).not.to.be.undefined;
        expect(style.jsonProperties.styles).not.to.be.undefined;
        const actual = style.jsonProperties.styles!;

        expect(actual.viewflags).not.to.be.undefined;
        const expectedVf = ViewFlags.fromJSON(test[1]);
        const actualVf = ViewFlags.fromJSON(actual.viewflags);
        expect(actualVf.toJSON()).to.deep.equal(expectedVf.toJSON());

        const expectedBGColor = expected.backgroundColor instanceof ColorDef ? expected.backgroundColor.toJSON() : expected.backgroundColor;
        expect(actual.backgroundColor).to.equal(expectedBGColor);

        // DisplayStyleSettings constructor always initializes json.mapImagery.
        expect(actual.mapImagery).to.deep.equal(expected.mapImagery ?? defaultMapImagery);
        expect(actual.excludedElements).to.deep.equal(expected.excludedElements);
        expect(actual.timePoint).to.deep.equal(expected.timePoint);
      }
    });
  });

  it("should be able to query for ViewDefinitionProps", () => {
    const imodel2 = compatibilityReadonly;
    const viewDefinitionProps: ViewDefinitionProps[] = imodel2.views.queryViewDefinitionProps(); // query for all ViewDefinitions
    assert.isAtLeast(viewDefinitionProps.length, 3);
    assert.isTrue(viewDefinitionProps[0].classFullName.includes("ViewDefinition"));
    assert.isFalse(viewDefinitionProps[1].isPrivate);

    const spatialViewDefinitionProps = imodel2.views.queryViewDefinitionProps("BisCore.SpatialViewDefinition") as SpatialViewDefinitionProps[]; // limit query to SpatialViewDefinitions
    assert.isAtLeast(spatialViewDefinitionProps.length, 3);
    assert.exists(spatialViewDefinitionProps[2].modelSelector?.id);
  });

  it("should iterate ViewDefinitions", () => {
    const imodel2 = compatibilityReadonly;
    // imodel2 contains 3 SpatialViewDefinitions and no other views.
    let numViews = 0;
    let result = imodel2.views.iterateViews(IModelDb.Views.defaultQueryParams, (_view: ViewDefinition) => {
      ++numViews;
      return true;
    });

    expect(result).to.be.true;
    expect(numViews).to.equal(3);

    // Query specifically for spatial views
    numViews = 0;
    result = imodel2.views.iterateViews({ from: "BisCore.SpatialViewDefinition" }, (view: ViewDefinition) => {
      if (view.isSpatialView())
        ++numViews;

      return view.isSpatialView();
    });
    expect(result).to.be.true;
    expect(numViews).to.equal(3);

    // Query specifically for 2d views
    numViews = 0;
    result = imodel2.views.iterateViews({ from: "BisCore.ViewDefinition2d" }, (_view: ViewDefinition) => {
      ++numViews;
      return true;
    });

    expect(result).to.be.true;
    expect(numViews).to.equal(0);

    // Terminate iteration on first view
    numViews = 0;
    result = imodel2.views.iterateViews(IModelDb.Views.defaultQueryParams, (_view: ViewDefinition) => {
      ++numViews;
      return false;
    });

    expect(result).to.be.false;
    expect(numViews).to.equal(1);
  });

  it("read view thumbnail", () => {
    const imodel5 = trackMutableIModel(createIModelFromSeed("views-mirukuru-thumbnail.bim", "mirukuru.ibim"));
    const viewId = "0x24";
    const thumbnail = imodel5.views.getThumbnail(viewId);
    assert.exists(thumbnail);
    if (!thumbnail)
      return;
    assert.equal(thumbnail.format, "jpeg");
    assert.equal(thumbnail.height, 768);
    assert.equal(thumbnail.width, 768);
    assert.equal(thumbnail.image.length, 18062);

    thumbnail.width = 100;
    thumbnail.height = 200;
    thumbnail.format = "png";
    thumbnail.image = new Uint8Array(200);
    thumbnail.image.fill(12);
    const stat = imodel5.views.saveThumbnail(viewId, thumbnail);
    assert.equal(stat, 0, "save thumbnail");

    const thumbnail2 = imodel5.views.getThumbnail(viewId);
    assert.exists(thumbnail2);
    if (!thumbnail2)
      return;
    assert.equal(thumbnail2.format, "png");
    assert.equal(thumbnail2.height, 200);
    assert.equal(thumbnail2.width, 100);
    assert.equal(thumbnail2.image.length, 200);
    assert.equal(thumbnail2.image[0], 12);
  });
});
