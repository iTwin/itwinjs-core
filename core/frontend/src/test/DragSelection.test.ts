import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BentleyStatus } from "@itwin/core-bentley";
import { EmptyLocalization, GeometryClass } from "@itwin/core-common";
import { ClipPlane, ClipPlaneContainment, ClipPrimitive, ClipVector, ConvexClipPlaneSet, Range3d, Vector3d } from "@itwin/core-geometry";
import { IModelApp } from "../IModelApp";
import { IModelDisplayReference } from "../IModelDisplayReference";
import { getAreaOrVolumeSelectionCandidates } from "../internal/DragSelection";
import { Pixel } from "../render/Pixel";
import { ElementSetTool } from "../tools/ElementSetTool";
import { SelectionMethod } from "../tools/SelectTool";
import { ToolSettings } from "../tools/ToolSettings";
import { ReadPixelsArgs, ScreenViewport } from "../Viewport";
import { ViewRect } from "../common/ViewRect";
import { createBlankConnection } from "./createBlankConnection";
import { openBlankViewport } from "./openBlankViewport";

describe("Drag selection", () => {
  let vp: ScreenViewport;
  let originalVolumeSelection: boolean;
  let originalAllowExternalIModels: boolean;

  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());
  beforeEach(() => {
    originalVolumeSelection = ToolSettings.enableVolumeSelection;
    originalAllowExternalIModels = IModelApp.locateManager.options.allowExternalIModels;
    ToolSettings.enableVolumeSelection = false;
    IModelApp.locateManager.options.allowExternalIModels = false;
    vp = openBlankViewport();
    vi.spyOn(vp, "cssPixelsToDevicePixels").mockImplementation((value) => value);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vp[Symbol.dispose]();
    ToolSettings.enableVolumeSelection = originalVolumeSelection;
    IModelApp.locateManager.options.allowExternalIModels = originalAllowExternalIModels;
  });

  function pixel(ref: IModelDisplayReference, id = "0x1"): Pixel.Data {
    return new Pixel.Data({ feature: { iModelRef: ref, elementId: id, modelId: "0x2", subCategoryId: "0x3", geometryClass: GeometryClass.Primary } });
  }

  function pixels(getPixel: (x: number, y: number) => Pixel.Data): void {
    vi.spyOn(vp, "readPixels").mockImplementation((args: ViewRect | ReadPixelsArgs, _selector?: Pixel.Selector, receiver?: Pixel.Receiver) => {
      const receive = args instanceof ViewRect ? receiver : args.receiver;
      receive?.({ getPixel });
    });
  }

  const origin = { x: 0, y: 0 };
  const corner = { x: 10, y: 10 };

  it("gates linked pixels and keeps box outlines separate for matching IDs", async () => {
    const linked = Object.create(vp.primaryIModelRef) as IModelDisplayReference;
    pixels((x, y) => x === 5 && y === 5 ? pixel(vp.primaryIModelRef) : x === 0 && y === 0 ? pixel(linked) : new Pixel.Data());

    const primaryOnly = await getAreaOrVolumeSelectionCandidates(vp, origin, corner, SelectionMethod.Box, false, false);
    expect([...primaryOnly.get(vp.primaryIModelRef) ?? []]).toEqual(["0x1"]);
    expect(primaryOnly.has(linked)).toBe(false);
    const primaryOverlaps = await getAreaOrVolumeSelectionCandidates(vp, origin, corner, SelectionMethod.Box, true, false);
    expect(primaryOverlaps.has(linked)).toBe(false);

    const all = await getAreaOrVolumeSelectionCandidates(vp, origin, corner, SelectionMethod.Box, false, true);
    expect([...all.get(vp.primaryIModelRef) ?? []]).toEqual(["0x1"]);
    expect(all.has(linked)).toBe(false);
    const overlaps = await getAreaOrVolumeSelectionCandidates(vp, origin, corner, SelectionMethod.Box, true, true);
    expect([...overlaps.get(linked) ?? []]).toEqual(["0x1"]);
  });

  it("ElementSetTool ignores linked pixels even when they use the primary iModel", async () => {
    const linked = Object.create(vp.primaryIModelRef) as IModelDisplayReference;
    IModelApp.locateManager.options.allowExternalIModels = true;
    pixels((x, y) => x === 5 && y === 5 ? pixel(linked) : new Pixel.Data());
    const filter = vi.fn(() => true);
    expect(await ElementSetTool.getAreaOrVolumeSelectionCandidates(vp, origin, corner, SelectionMethod.Box, true, filter)).toEqual(new Set());
    expect(filter).not.toHaveBeenCalled();

    pixels((x, y) => x === 5 && y === 5 ? pixel(vp.primaryIModelRef) : new Pixel.Data());
    filter.mockReturnValue(false);
    expect(await ElementSetTool.getAreaOrVolumeSelectionCandidates(vp, origin, corner, SelectionMethod.Box, true, filter)).toEqual(new Set());
    expect(filter).toHaveBeenCalledWith({ id: "0x1", iModelRef: vp.primaryIModelRef });
    filter.mockReturnValue(true);
    expect(await ElementSetTool.getAreaOrVolumeSelectionCandidates(vp, origin, corner, SelectionMethod.Box, true, filter)).toEqual(new Set(["0x1"]));
  });

  function volumeQuery(ref: IModelDisplayReference) {
    vi.spyOn(ref.iModel, "createQueryReader").mockReturnValue({
      async *[Symbol.asyncIterator]() {
        const idColumn = "ECInstanceId";
        for (const id of ["0x1", "0x4", "0x5"])
          yield { [idColumn]: id, category: "0x3" };
      },
    } as unknown as ReturnType<typeof ref.iModel.createQueryReader>);
    return vi.spyOn(ref.iModel, "getGeometryContainment").mockResolvedValue({
      status: BentleyStatus.SUCCESS,
      candidatesContainment: [ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyInside],
    });
  }

  function enableVolume(): void {
    ToolSettings.enableVolumeSelection = true;
    vi.spyOn(vp, "computeViewRange").mockReturnValue(Range3d.createXYZXYZ(-100, -100, -100, 100, 100, 100));
  }

  it("gates linked volume queries with the supplied option", async () => {
    enableVolume();
    const linkedIModel = createBlankConnection();
    try {
      const refs = vp.iModelRefs;
      expect(refs.isSpatial).toBe(true);
      if (!refs.isSpatial)
        return;
      const linked = refs.link({ iModel: linkedIModel });
      const primaryQuery = volumeQuery(vp.primaryIModelRef);
      const linkedQuery = volumeQuery(linked);
      await getAreaOrVolumeSelectionCandidates(vp, origin, corner, SelectionMethod.Box, true, false);
      expect(primaryQuery).toHaveBeenCalledOnce();
      expect(linkedQuery).not.toHaveBeenCalled();
      const result = await getAreaOrVolumeSelectionCandidates(vp, origin, corner, SelectionMethod.Box, true, true);
      expect(linkedQuery).toHaveBeenCalledOnce();
      expect(result.get(linked)).toEqual(new Set(["0x1", "0x4", "0x5"]));
      IModelApp.locateManager.options.allowExternalIModels = true;
      expect(await ElementSetTool.getAreaOrVolumeSelectionCandidates(vp, origin, corner, SelectionMethod.Box, true)).toEqual(new Set(["0x1", "0x4", "0x5"]));
      refs.unlink(linked);
    } finally {
      linkedIModel.closeSync();
    }
  });

  it("maps view-clip containment to the filtered second-pass candidates", async () => {
    enableVolume();
    const query = volumeQuery(vp.primaryIModelRef);
    const candidates: string[][] = [];
    query.mockImplementation(async (request) => {
      candidates.push([...request.candidates]);
      return {
        status: BentleyStatus.SUCCESS,
        candidatesContainment: candidates.length === 1
          ? [ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.StronglyInside, ClipPlaneContainment.StronglyInside]
          : [ClipPlaneContainment.StronglyOutside, ClipPlaneContainment.StronglyInside],
      };
    });
    vp.viewFlags = vp.viewFlags.with("clipVolume", true);
    const planes = ConvexClipPlaneSet.createEmpty();
    planes.addPlaneToConvexSet(ClipPlane.createNormalAndDistance(Vector3d.unitX(), -100));
    vi.spyOn(vp.view, "getViewClip").mockReturnValue(ClipVector.createCapture([ClipPrimitive.createCapture(planes)]));
    expect(await ElementSetTool.getAreaOrVolumeSelectionCandidates(vp, origin, corner, SelectionMethod.Box, true)).toEqual(new Set(["0x5"]));
    expect(candidates).toEqual([["0x1", "0x4", "0x5"], ["0x4", "0x5"]]);
  });

  it("merges transient pixels into volume results using sets", async () => {
    enableVolume();
    volumeQuery(vp.primaryIModelRef);
    const transient = vp.iModel.transientIds.getNext();
    pixels((x, y) => x === 5 && y === 5 ? pixel(vp.primaryIModelRef, transient) : new Pixel.Data());
    const result = await getAreaOrVolumeSelectionCandidates(vp, origin, corner, SelectionMethod.Box, true, false, undefined, true);
    expect(result.get(vp.primaryIModelRef)).toEqual(new Set(["0x1", "0x4", "0x5", transient]));
  });
});