/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { SectionType } from "@itwin/core-common";
import { DrawingViewState, IModelConnection, SheetViewState, SpatialViewState } from "@itwin/core-frontend";
import { ClipMaskXYZRangePlanes, ClipShape, ClipVector, Range3d, Transform } from "@itwin/core-geometry";
import { SectionDrawingLocationState, SectionDrawingLocationStateData } from "../SectionDrawingLocationState";

// Constructor only stores the IModelConnection, never calls it - a stub is fine.
const fakeIModel = {} as IModelConnection;

const validClipJSON = JSON.stringify(ClipVector.createCapture([ClipShape.createBlock(Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1), ClipMaskXYZRangePlanes.All)]).toJSON());

function makeProps(overrides: Partial<SectionDrawingLocationStateData> = {}): SectionDrawingLocationStateData {
  return {
    sectionType: SectionType.Section,
    drawingToSpatialTransform: JSON.stringify({}),
    spatialViewId: "0x1",
    sectionLocationId: "0x2",
    sectionLocationModelId: "0x3",
    sectionViewId: "0x4",
    categoryId: "0x5",
    userLabel: "test",
    ...overrides,
  };
}

describe("SectionDrawingLocationState constructor", () => {
  it("maps basic scalar fields onto the instance", () => {
    const props = makeProps({
      sectionType: SectionType.Plan,
      sectionLocationId: "0x10",
      sectionLocationModelId: "0x11",
      sectionViewId: "0x12",
      categoryId: "0x13",
      spatialViewId: "0x14",
      userLabel: "my section",
    });

    const state = new SectionDrawingLocationState(props, fakeIModel);
    expect(state.iModel).to.equal(fakeIModel);
    expect(state.id).to.equal("0x10");
    expect(state.model).to.equal("0x11");
    expect(state.drawingViewId).to.equal("0x12");
    expect(state.category).to.equal("0x13");
    expect(state.spatialViewId).to.equal("0x14");
    expect(state.userLabel).to.equal("my section");
    expect(state.sectionType).to.equal(SectionType.Plan);
  });

  it("reconstructs origin and bbox when all components are present", () => {
    const props = makeProps({
      origin: { x: 1, y: 2, z: 3 },
      bboxLow: { x: -1, y: -2, z: -3 },
      bboxHigh: { x: 4, y: 5, z: 6 },
    });

    const state = new SectionDrawingLocationState(props, fakeIModel);
    expect(state.placement.origin.x).to.equal(1);
    expect(state.placement.origin.y).to.equal(2);
    expect(state.placement.origin.z).to.equal(3);
    expect(state.placement.bbox.low.x).to.equal(-1);
    expect(state.placement.bbox.low.y).to.equal(-2);
    expect(state.placement.bbox.low.z).to.equal(-3);
    expect(state.placement.bbox.high.x).to.equal(4);
    expect(state.placement.bbox.high.y).to.equal(5);
    expect(state.placement.bbox.high.z).to.equal(6);
  });

  it("produces a null-range bbox and zero origin when origin/bbox are entirely absent", () => {
    const props = makeProps();

    const state = new SectionDrawingLocationState(props, fakeIModel);
    expect(state.placement.origin.x).to.equal(0);
    expect(state.placement.origin.y).to.equal(0);
    expect(state.placement.origin.z).to.equal(0);
    expect(state.placement.bbox.isNull).to.be.true;
  });

  it("produces a null-range bbox when only one of bboxLow/bboxHigh is present", () => {
    const props = makeProps({
      origin: { x: 1, y: 1, z: 1 },
      bboxLow: { x: -1, y: -1, z: -1 },
    });

    const state = new SectionDrawingLocationState(props, fakeIModel);
    expect(state.placement.bbox.isNull).to.be.true;
  });

  it("captures yaw/pitch/roll into the placement's angles", () => {
    const props = makeProps({ yaw: 10, pitch: 20, roll: 30 });
    const state = new SectionDrawingLocationState(props, fakeIModel);
    expect(state.placement.angles.yaw.degrees).to.equal(10);
    expect(state.placement.angles.pitch.degrees).to.equal(20);
    expect(state.placement.angles.roll.degrees).to.equal(30);
  });

  it("parses drawingToSpatialTransform", () => {
    const props = makeProps({ drawingToSpatialTransform: JSON.stringify(Transform.createTranslationXYZ(1, 2, 3).toJSON()) });
    const state = new SectionDrawingLocationState(props, fakeIModel);
    expect(state.drawingToSpatialTransform.origin.x).to.equal(1);
    expect(state.drawingToSpatialTransform.origin.y).to.equal(2);
    expect(state.drawingToSpatialTransform.origin.z).to.equal(3);
  });

  it("parses a valid clip", () => {
    const props = makeProps({ clipJSON: validClipJSON });
    const state = new SectionDrawingLocationState(props, fakeIModel);
    expect(state.clip.isValid).to.be.true;
  });

  it("falls back to an empty clip when clipJSON is malformed", () => {
    const props = makeProps({ clipJSON: "not valid json" });
    const state = new SectionDrawingLocationState(props, fakeIModel);
    expect(state.clip.isValid).to.be.false;
  });

  it("falls back to an empty clip when clipJSON is absent", () => {
    const props = makeProps();
    const state = new SectionDrawingLocationState(props, fakeIModel);
    expect(state.clip.isValid).to.be.false;
  });

  it("populates viewAttachment when viewAttachmentId and sheetToSpatialTransform are both present", () => {
    const props = makeProps({
      viewAttachmentId: "0x20",
      sheetToSpatialTransform: JSON.stringify(Transform.createTranslationXYZ(5, 6, 7).toJSON()),
      sheetClip: validClipJSON,
      sheetViewId: "0x21",
    });

    const state = new SectionDrawingLocationState(props, fakeIModel);
    const attachment = state.viewAttachment;
    expect(attachment).to.not.be.undefined;
    expect(attachment?.id).to.equal("0x20");
    expect(attachment?.viewId).to.equal("0x21");
    expect(attachment?.transformToSpatial.origin.x).to.equal(5);
    expect(attachment?.clip?.isValid).to.be.true;
  });

  it("omits viewAttachment when viewAttachmentId is missing", () => {
    const props = makeProps({ sheetToSpatialTransform: JSON.stringify({}) });
    const state = new SectionDrawingLocationState(props, fakeIModel);
    expect(state.viewAttachment).to.be.undefined;
  });

  it("omits viewAttachment when sheetToSpatialTransform is missing", () => {
    const props = makeProps({ viewAttachmentId: "0x20" });
    const state = new SectionDrawingLocationState(props, fakeIModel);
    expect(state.viewAttachment).to.be.undefined;
  });
});

describe("SectionDrawingLocationState.tryLoadDrawingView/tryLoadSpatialView/tryLoadSheetView", () => {
  function makeState(overrides: Partial<SectionDrawingLocationStateData> = {}, iModel?: IModelConnection): SectionDrawingLocationState {
    return new SectionDrawingLocationState(makeProps(overrides), iModel ?? fakeIModel);
  }

  function iModelResolvingViewTo(view: unknown): IModelConnection {
    return { views: { load: async () => view } } as unknown as IModelConnection;
  }

  function iModelRejecting(): IModelConnection {
    return { views: { load: async () => { throw new Error("no such view"); } } } as unknown as IModelConnection;
  }

  it("tryLoadDrawingView returns the view when it is a DrawingViewState", async () => {
    const drawingView = Object.create(DrawingViewState.prototype);
    const state = makeState({}, iModelResolvingViewTo(drawingView));
    expect(await state.tryLoadDrawingView()).to.equal(drawingView);
  });

  it("tryLoadDrawingView returns undefined when the loaded view is the wrong type", async () => {
    const state = makeState({}, iModelResolvingViewTo(Object.create(SpatialViewState.prototype)));
    expect(await state.tryLoadDrawingView()).to.be.undefined;
  });

  it("tryLoadDrawingView returns undefined when loading throws", async () => {
    const state = makeState({}, iModelRejecting());
    expect(await state.tryLoadDrawingView()).to.be.undefined;
  });

  it("tryLoadSpatialView returns the view when it is a SpatialViewState", async () => {
    const spatialView = Object.create(SpatialViewState.prototype);
    const state = makeState({}, iModelResolvingViewTo(spatialView));
    expect(await state.tryLoadSpatialView()).to.equal(spatialView);
  });

  it("tryLoadSpatialView returns undefined when loading throws", async () => {
    const state = makeState({}, iModelRejecting());
    expect(await state.tryLoadSpatialView()).to.be.undefined;
  });

  it("tryLoadSheetView returns undefined when there is no viewAttachment", async () => {
    const state = makeState({}, iModelResolvingViewTo(Object.create(SheetViewState.prototype)));
    expect(state.viewAttachment).to.be.undefined;
    expect(await state.tryLoadSheetView()).to.be.undefined;
  });

  it("tryLoadSheetView returns undefined when the viewAttachment has no viewId", async () => {
    const state = makeState({ viewAttachmentId: "0x20", sheetToSpatialTransform: JSON.stringify({}) }, iModelResolvingViewTo(Object.create(SheetViewState.prototype)));
    expect(state.viewAttachment?.viewId).to.be.undefined;
    expect(await state.tryLoadSheetView()).to.be.undefined;
  });

  it("tryLoadSheetView returns the view when it is a SheetViewState", async () => {
    const sheetView = Object.create(SheetViewState.prototype);
    const state = makeState(
      { viewAttachmentId: "0x20", sheetToSpatialTransform: JSON.stringify({}), sheetViewId: "0x21" },
      iModelResolvingViewTo(sheetView),
    );
    expect(await state.tryLoadSheetView()).to.equal(sheetView);
  });
});

describe("SectionDrawingLocationState.queryAll", () => {
  function iModelWithRows(rows: object[]): IModelConnection {
    async function* reader() {
      for (const row of rows)
        yield { toRow: () => row };
    }

    return { createQueryReader: () => reader() } as unknown as IModelConnection;
  }

  it("returns an empty array when the query yields no rows", async () => {
    const states = await SectionDrawingLocationState.queryAll(iModelWithRows([]));
    expect(states).to.deep.equal([]);
  });

  it("constructs one SectionDrawingLocationState per row, decomposing scalar origin/bbox columns", async () => {
    const rawRow = {
      ...makeProps(),
      originX: 1, originY: 2, originZ: 3,
      bboxLowX: -1, bboxLowY: -2, bboxLowZ: -3,
      bboxHighX: 4, bboxHighY: 5, bboxHighZ: 6,
    };

    const states = await SectionDrawingLocationState.queryAll(iModelWithRows([rawRow]));
    expect(states.length).to.equal(1);
    expect(states[0].placement.origin.x).to.equal(1);
    expect(states[0].placement.bbox.low.x).to.equal(-1);
    expect(states[0].placement.bbox.high.x).to.equal(4);
  });

  it("swallows exceptions from the query and returns an empty array", async () => {
    const iModel = { createQueryReader: () => { throw new Error("SectionDrawingLocation does not exist"); } } as unknown as IModelConnection;
    const states = await SectionDrawingLocationState.queryAll(iModel);
    expect(states).to.deep.equal([]);
  });
});
