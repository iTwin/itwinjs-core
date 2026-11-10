/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BeEvent, CompressedId64Set, Id64String, UnexpectedErrors } from "@itwin/core-bentley";
import { ClipVector, Point2d, Point3d, Range3d, StringifiedClipVector, Transform } from "@itwin/core-geometry";
import {
  AnalysisStyle, Cartographic, ClipStyle, Code, ColorDef, ContourDisplay, ContourGroup, EmptyLocalization, Feature, FeatureAppearance, FrustumPlanes, GeometryClass, HiddenLine, ImageBuffer, ImageBufferFormat, ImageMapLayerSettings, ModelClipGroup, ModelClipGroups, PlanProjectionSettings, RealityModelDisplaySettings, SubCategoryAppearance, SubCategoryOverride,
} from "@itwin/core-common";
import { ViewRect } from "../common/ViewRect";
import { _getModelClip } from "../common/internal/Symbols";
import { OffScreenViewport, ReadImageToCanvasOptions, ReadPixelsArgs, ScreenViewport, Viewport } from "../Viewport";
import { FeatureOverrideProvider } from "../FeatureOverrideProvider";
import { EmphasizeElements } from "../EmphasizeElements";
import { IModelDisplayReference } from "../IModelDisplayReference";
import { CategorySelectorState } from "../CategorySelectorState";
import { DisplayStyle2dState } from "../DisplayStyleState";
import { DrawingViewState } from "../DrawingViewState";
import { SpatialViewState } from "../SpatialViewState";
import { IModelApp } from "../IModelApp";
import type { IModelConnection } from "../IModelConnection";
import { openBlankViewport, readUniqueFeatures, readUniquePixelData, testBlankViewport, testBlankViewportAsync } from "./openBlankViewport";
import { createBlankConnection } from "./createBlankConnection";
import { DecorateContext, SceneContext } from "../ViewContext";
import { Pixel } from "../render/Pixel";
import { GraphicType } from "../common/render/GraphicType";
import { GraphicBranch } from "../render/GraphicBranch";
import { Branch } from "../internal/render/webgl/Graphic";
import { Target } from "../internal/render/webgl/Target";
import { RenderGraphic } from "../render/RenderGraphic";
import { Decorator } from "../ViewManager";
import { CanvasDecoration, DecorationsCache } from "../core-frontend";
import { PerModelCategoryVisibility } from "../PerModelCategoryVisibility";
import { createClassifierTileTreeReference, createMaskTreeReference, createRealityTileTreeReference, DisclosedTileTreeSet, GraphicsCollectorDrawArgs, RealityModelSource, TileGraphicType, TileTree, TileTreeReference } from "../tile/internal";
import { RealityDataSource } from "../RealityDataSource";
import type { GeometricModelState } from "../ModelState";
import type { SpatialClassifiersState } from "../SpatialClassifiersState";
import { computeSectionCutForIModelCoords } from "../internal/tile/PrimaryTileTree";
import { computeIModelRefDisplayTransform } from "../internal/IModelDisplayReferenceImpl";
import { EntityChanges, TxnEntityChanges } from "../TxnEntityChanges";

describe("Viewport", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  describe("constructor", () => {
    it("invokes initialize method", () => {
      class ScreenVp extends ScreenViewport {
        public initialized = false;
        protected override initialize() { this.initialized = true; }

        public static createVp(view: SpatialViewState): ScreenVp {
          const parentDiv = document.createElement("div");
          parentDiv.setAttribute("height", "100px");
          parentDiv.setAttribute("width", "100px");
          parentDiv.style.height = parentDiv.style.width = "100px";
          document.body.appendChild(parentDiv);
          return this.create(parentDiv, view) as ScreenVp;
        }
      }

      class OffScreenVp extends OffScreenViewport {
        public initialized = false;
        protected override initialize() { this.initialized = true; }

        public static createVp(view: SpatialViewState): OffScreenVp {
          return this.create({ view, viewRect: new ViewRect(0, 0, 100, 100) }) as OffScreenVp;
        }
      }

      function test(ctor: (typeof ScreenVp | typeof OffScreenVp)): void {
        const iModel = createBlankConnection();
        const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
        using vp = ctor.createVp(view);
        expect(vp.initialized).toBe(true);
      }

      test(ScreenVp);
      test(OffScreenVp);
    });
  });

  describe("flashedId", () => {
    type ChangedEvent = [string | undefined, string | undefined];

    function expectFlashedId(viewport: ScreenViewport, expectedId: string | undefined, expectedEvent: ChangedEvent | undefined, func: () => void): void {
      let event: ChangedEvent | undefined;
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const removeListener = viewport.onFlashedIdChanged.addListener((vp, arg) => {
        expect(vp).to.equal(viewport);
        expect(event).to.be.undefined;
        event = [arg.previous, arg.current];
      });

      func();
      removeListener();

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      expect(viewport.flashedId).toEqual(expectedId);
      expect(event).toEqual(expectedEvent);
    }

    it("dispatches events when flashed Id changes", () => {
      testBlankViewport((viewport) => {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        expectFlashedId(viewport, "0x123", [undefined, "0x123"], () => viewport.flashedId = "0x123");
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        expectFlashedId(viewport, "0x456", ["0x123", "0x456"], () => viewport.flashedId = "0x456");
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        expectFlashedId(viewport, "0x456", undefined, () => viewport.flashedId = "0x456");
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        expectFlashedId(viewport, undefined, ["0x456", undefined], () => viewport.flashedId = undefined);
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        expectFlashedId(viewport, undefined, undefined, () => viewport.flashedId = undefined);
      });
    });

    it("treats invalid Id as undefined", () => {
      testBlankViewport((viewport) => {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        viewport.flashedId = "0x123";
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        expectFlashedId(viewport, undefined, ["0x123", undefined], () => viewport.flashedId = "0");
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        viewport.flashedId = "0x123";
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        expectFlashedId(viewport, undefined, ["0x123", undefined], () => viewport.flashedId = undefined);
      });
    });

    it("rejects malformed Ids", () => {
      testBlankViewport((viewport) => {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        expectFlashedId(viewport, undefined, undefined, () => viewport.flashedId = "not an id");
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        viewport.flashedId = "0x123";
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        expectFlashedId(viewport, "0x123", undefined, () => viewport.flashedId = "not an id");
      });
    });

    it("prohibits assignment from within event callback", () => {
      testBlankViewport((viewport) => {
        const oldHandler = UnexpectedErrors.setHandler(UnexpectedErrors.reThrowImmediate);
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        viewport.onFlashedIdChanged.addOnce(() => viewport.flashedId = "0x12345");
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        expect(() => (viewport.flashedId = "0x12345")).toThrow("Cannot assign to Viewport.flashedElement from within an onFlashedElementChanged event callback.");
        UnexpectedErrors.setHandler(oldHandler);
      });
    });
  });

  describe("analysis style changed events", () => {
    it("registers and unregisters for multiple events", () => {
      testBlankViewport((viewport) => {
        const baseStyleListeners = viewport.view.onDisplayStyleChanged.numberOfListeners;
        function expectListeners(expected: boolean): void {
          const expectedNum = expected ? 1 : 0;
          expect(viewport.onChangeView.numberOfListeners).toEqual(expectedNum);

          // The viewport registers its own listener for each of these.
          expect(viewport.displayStyle.settings.onAnalysisStyleChanged.numberOfListeners).toEqual(expectedNum + 1);
          expect(viewport.view.onDisplayStyleChanged.numberOfListeners).toEqual(baseStyleListeners + expectedNum);
        }

        expectListeners(false);
        const removeListener = viewport.addOnAnalysisStyleChangedListener(() => undefined);
        expectListeners(true);
        removeListener();
        expectListeners(false);
      });
    });

    it("emits events when analysis style changes", () => {
      testBlankViewport((viewport) => {
        type EventPayload = AnalysisStyle | "undefined" | "none";
        function expectChangedEvent(expectedPayload: EventPayload, func: () => void): void {
          let payload: EventPayload = "none";
          const removeListener = viewport.addOnAnalysisStyleChangedListener((style) => {
            expect(payload).toEqual("none");
            payload = style ?? "undefined";
          });

          func();
          removeListener();
          expect(payload).toEqual(expectedPayload);
        }

        const a = AnalysisStyle.fromJSON({ normalChannelName: "a" });

        expectChangedEvent(a, () => viewport.displayStyle.settings.analysisStyle = a);
        expectChangedEvent("none", () => viewport.displayStyle.settings.analysisStyle = a);

        const b = AnalysisStyle.fromJSON({ normalChannelName: "b" });
        expectChangedEvent(b, () => {
          viewport.displayStyle.settings.analysisStyle = b;
        });

        const c = AnalysisStyle.fromJSON({ normalChannelName: "c" });
        expectChangedEvent(c, () => {
          const view = viewport.view.clone();
          expect(view.displayStyle).not.toEqual(viewport.view.displayStyle);
          view.displayStyle.settings.analysisStyle = c;
          viewport.changeView(view);
        });

        expectChangedEvent("undefined", () => viewport.displayStyle.settings.analysisStyle = undefined);
        expectChangedEvent("none", () => (viewport.displayStyle.settings.analysisStyle = undefined));

        // Replacing the display style wholesale notifies with the replacement's analysis style...
        const oldStyle = viewport.displayStyle;
        const d = AnalysisStyle.fromJSON({ normalChannelName: "d" });
        expectChangedEvent(d, () => {
          const newStyle = oldStyle.clone();
          newStyle.settings.analysisStyle = d;
          viewport.displayStyle = newStyle;
        });

        // ...subsequent changes to the replacement style are reported...
        const e = AnalysisStyle.fromJSON({ normalChannelName: "e" });
        expectChangedEvent(e, () => viewport.displayStyle.settings.analysisStyle = e);

        // ...and changes to the replaced (old) style are not.
        expectChangedEvent("none", () => oldStyle.settings.analysisStyle = AnalysisStyle.fromJSON({ normalChannelName: "f" }));
      });
    });
  });

  describe("display style and category selector forwarding", () => {
    it("Viewport.displayStyle setter assigns the view's display style", () => {
      testBlankViewport((viewport) => {
        const style = viewport.view.displayStyle.clone();
        expect(style).not.toBe(viewport.view.displayStyle);
        viewport.displayStyle = style;
        expect(viewport.view.displayStyle).toBe(style);
        expect(viewport.displayStyle).toBe(style);
      });
    });

    it("ViewState.setDisplayStyle and setCategorySelector forward to the property setters", () => {
      testBlankViewport((viewport) => {
        const view = viewport.view;

        const style = view.displayStyle.clone();
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- verifies compatibility of deprecated forwarding method
        view.setDisplayStyle(style);
        expect(view.displayStyle).toBe(style);

        const categories = view.categorySelector.clone();
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- verifies compatibility of deprecated forwarding method
        view.setCategorySelector(categories);
        expect(view.categorySelector).toBe(categories);
      });
    });
  });

  describe("symbology override cache invalidation", () => {
    it("invalidates cached overrides when a txn invalidates cached subcategory information", async () => {
      using viewport = openBlankViewport();
      const ref = viewport.iModelRefs.primary;

      const categoryId = "0x20";
      let subCategoryIds = ["0x21"];
      const iModel = viewport.iModel as any;
      // BlankConnection.isClosed is always true, which would cancel the cache's load requests.
      Object.defineProperty(iModel, "isClosed", { get: () => false });
      iModel.querySubCategories = async (compressedCategoryIds: string) => {
        const rows = [];
        for (const parentId of CompressedId64Set.iterable(compressedCategoryIds))
          if (parentId === categoryId)
            for (const id of subCategoryIds)
              rows.push({ parentId, id, appearance: {} });

        return rows;
      };

      // Pretend to be a briefcase so that the subcategory cache processes txn changes.
      const onElementsChanged = new BeEvent<(changes: TxnEntityChanges) => void>();
      iModel.isBriefcaseConnection = () => true;
      iModel.txns = { onElementsChanged };
      viewport.iModel.subcategories.attachToBriefcase(viewport.iModel);

      const waitFor = async (condition: () => boolean) => {
        for (let i = 0; i < 100 && !condition(); i++)
          await new Promise((resolve) => setTimeout(resolve, 1));

        expect(condition()).toBe(true);
      };

      ref.viewedCategories.add(categoryId);
      await waitFor(() => undefined !== viewport.iModel.subcategories.getSubCategories(categoryId));
      await waitFor(() => ref.getSymbologyOverrides().isSubCategoryIdVisible("0x21"));

      const warmed = ref.getSymbologyOverrides();
      expect(warmed.isSubCategoryIdVisible("0x22")).toBe(false);

      // Simulate a txn inserting a new subcategory - the cache reloads and the ref's overrides must be rebuilt.
      subCategoryIds = ["0x21", "0x22"];
      const insertedIds = CompressedId64Set.compressIds(["0x22"]);
      onElementsChanged.raiseEvent(new EntityChanges({
        inserted: insertedIds,
        insertedMeta: [0],
        deletedMeta: [],
        updatedMeta: [],
        meta: [{ name: "BisCore:SubCategory", bases: [] }],
      }));

      await waitFor(() => ref.getSymbologyOverrides() !== warmed);
      expect(ref.getSymbologyOverrides().isSubCategoryIdVisible("0x21")).toBe(true);
      expect(ref.getSymbologyOverrides().isSubCategoryIdVisible("0x22")).toBe(true);
    });

    it("redraws when plan projection and reality model display settings maps are mutated", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const linkedRef = refs.link({ iModel: linkedIModel });
        const primary = refs.primary;
        const anyVp = viewport as any;
        const render = () => {
          viewport.renderFrame();
          expect(anyVp._sceneValid).toBe(true);
          expect(anyVp._renderPlanValid).toBe(true);
        };

        // Primary: the maps delegate to the display style; mutations must invalidate the render plan...
        render();
        primary.planProjectionSettings.set("0x11", PlanProjectionSettings.fromJSON({ elevation: 10 })!);
        expect(anyVp._renderPlanValid).toBe(false);

        // ...and rebuild the cached symbology overrides (transparency is baked in).
        render();
        let warmed = primary.getSymbologyOverrides();
        primary.planProjectionSettings.set("0x11", PlanProjectionSettings.fromJSON({ transparency: 0.5 })!);
        expect(primary.getSymbologyOverrides()).not.toBe(warmed);
        expect(anyVp._renderPlanValid).toBe(false);

        render();
        warmed = primary.getSymbologyOverrides();
        primary.planProjectionSettings.delete("0x11");
        expect(primary.getSymbologyOverrides()).not.toBe(warmed);
        expect(anyVp._renderPlanValid).toBe(false);

        render();
        primary.realityModelDisplaySettings.set("0x12", RealityModelDisplaySettings.fromJSON({ overrideColorRatio: 0.5 }));
        expect(anyVp._renderPlanValid).toBe(false);

        // Linked references own their maps; mutations must invalidate the scene.
        render();
        linkedRef.planProjectionSettings.set("0x13", PlanProjectionSettings.fromJSON({ elevation: 5 })!);
        expect(anyVp._sceneValid).toBe(false);

        render();
        linkedRef.realityModelDisplaySettings.set("0x14", RealityModelDisplaySettings.fromJSON({ overrideColorRatio: 0.5 }));
        expect(anyVp._sceneValid).toBe(false);

        render();
        linkedRef.realityModelDisplaySettings.delete("0x14");
        expect(anyVp._sceneValid).toBe(false);

        refs.unlink(linkedRef);
      } finally {
        await linkedIModel.close();
      }
    });

    it("invalidates cached overrides when visibility and appearance inputs change on primary and linked references", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const linkedRef = refs.link({ iModel: linkedIModel });

        for (const ref of [refs.primary, linkedRef]) {
          const expectInvalidation = (mutate: () => void) => {
            const warmed = ref.getSymbologyOverrides();
            expect(ref.getSymbologyOverrides()).toBe(warmed);
            mutate();
            expect(ref.getSymbologyOverrides()).not.toBe(warmed);
          };

          expectInvalidation(() => ref.neverDrawnElements.add("0x123"));
          expectInvalidation(() => ref.neverDrawnElements.clear());
          expectInvalidation(() => ref.alwaysDrawnElements.add("0x456"));
          expectInvalidation(() => { ref.isAlwaysDrawnExclusive = true; });
          expect(ref.getSymbologyOverrides().isAlwaysDrawnExclusive).toBe(true);
          expectInvalidation(() => { ref.isAlwaysDrawnExclusive = false; });
          expect(ref.getSymbologyOverrides().isAlwaysDrawnExclusive).toBe(false);
          expectInvalidation(() => ref.subCategoryOverrides.set("0x789", SubCategoryOverride.fromJSON({ invisible: true })));
          expectInvalidation(() => ref.modelAppearanceOverrides.set("0xabc", FeatureAppearance.fromJSON({ transparency: 0.5 })));
        }

        // A linked reference's appearance maps must invalidate its own cache, not the primary's.
        const primaryWarmed = refs.primary.getSymbologyOverrides();
        const linkedWarmed = linkedRef.getSymbologyOverrides();
        linkedRef.subCategoryOverrides.set("0xdef", SubCategoryOverride.fromJSON({ invisible: true }));
        expect(linkedRef.getSymbologyOverrides()).not.toBe(linkedWarmed);
        expect(refs.primary.getSymbologyOverrides()).toBe(primaryWarmed);

        refs.unlink(linkedRef);
      } finally {
        await linkedIModel.close();
      }
    });

    it("invalidates cached overrides when active view flags change", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const linkedRef = refs.link({ iModel: linkedIModel });
        const primary = refs.primary;
        const style = viewport.view.displayStyle;

        // A view flag change on the display style must invalidate both references' caches - both inherit the view's flags.
        let primaryWarmed = primary.getSymbologyOverrides();
        let linkedWarmed = linkedRef.getSymbologyOverrides();
        const dimensions = !style.viewFlags.dimensions;
        style.viewFlags = style.viewFlags.with("dimensions", dimensions);
        expect(primary.getSymbologyOverrides()).not.toBe(primaryWarmed);
        expect(primary.getSymbologyOverrides().isClassVisible(GeometryClass.Dimension)).toBe(dimensions);
        expect(linkedRef.getSymbologyOverrides()).not.toBe(linkedWarmed);
        expect(linkedRef.getSymbologyOverrides().isClassVisible(GeometryClass.Dimension)).toBe(dimensions);

        // A linked reference's view flag overrides must invalidate only its own cache.
        primaryWarmed = primary.getSymbologyOverrides();
        linkedWarmed = linkedRef.getSymbologyOverrides();
        linkedRef.overrides.viewFlags = { dimensions: !dimensions };
        expect(primary.getSymbologyOverrides()).toBe(primaryWarmed);
        expect(linkedRef.getSymbologyOverrides()).not.toBe(linkedWarmed);
        expect(linkedRef.getSymbologyOverrides().isClassVisible(GeometryClass.Dimension)).toBe(!dimensions);

        // The primary reference's view flag overrides must invalidate its cache.
        primaryWarmed = primary.getSymbologyOverrides();
        primary.overrides.viewFlags = { dimensions: !dimensions };
        expect(primary.getSymbologyOverrides()).not.toBe(primaryWarmed);
        expect(primary.getSymbologyOverrides().isClassVisible(GeometryClass.Dimension)).toBe(!dimensions);

        refs.unlink(linkedRef);
      } finally {
        await linkedIModel.close();
      }
    });

    it("invalidates cached overrides when plan projection settings change", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const settings = viewport.view.displayStyle.settings;
        if (!settings.is3d())
          throw new Error("Expected a 3d display style");

        const linkedRef = refs.link({ iModel: linkedIModel });
        const primary = refs.primary;

        // The primary reference's plan projection settings live on the display style.
        let primaryWarmed = primary.getSymbologyOverrides();
        let linkedWarmed = linkedRef.getSymbologyOverrides();
        settings.setPlanProjectionSettings("0x1c", PlanProjectionSettings.fromJSON({ transparency: 0.5 }));
        expect(primary.getSymbologyOverrides()).not.toBe(primaryWarmed);
        expect(linkedRef.getSymbologyOverrides()).toBe(linkedWarmed);

        primaryWarmed = primary.getSymbologyOverrides();
        settings.setPlanProjectionSettings("0x1c", undefined);
        expect(primary.getSymbologyOverrides()).not.toBe(primaryWarmed);

        // A linked reference owns its plan projection settings and must invalidate only its own cache.
        primaryWarmed = primary.getSymbologyOverrides();
        linkedWarmed = linkedRef.getSymbologyOverrides();
        linkedRef.planProjectionSettings.set("0x2a", PlanProjectionSettings.fromJSON({ transparency: 0.25 })!);
        expect(linkedRef.getSymbologyOverrides()).not.toBe(linkedWarmed);
        expect(primary.getSymbologyOverrides()).toBe(primaryWarmed);

        refs.unlink(linkedRef);
      } finally {
        await linkedIModel.close();
      }
    });
  });

  describe("replacement of display style and selectors", () => {
    it("responds to mutations of a replacement display style", () => {
      testBlankViewport((viewport) => {
        const view = viewport.view;
        const ref = viewport.iModelRefs.primary;
        const oldStyle = view.displayStyle;
        const newStyle = oldStyle.clone();
        viewport.displayStyle = newStyle;
        expect(view.displayStyle).toBe(newStyle);

        // Mutations of the replacement style must invalidate the primary reference's cached overrides.
        let warmed = ref.getSymbologyOverrides();
        newStyle.settings.subCategoryOverrides.set("0x123", SubCategoryOverride.fromJSON({ invisible: true }));
        expect(ref.getSymbologyOverrides()).not.toBe(warmed);

        // View flag changes on the replacement style must be reflected in the reference's active view flags.
        const vf = newStyle.viewFlags.with("dimensions", !newStyle.viewFlags.dimensions);
        newStyle.viewFlags = vf;
        expect(ref.activeViewFlags.dimensions).toBe(vf.dimensions);

        // Mutations of the replaced (old) style must have no effect.
        warmed = ref.getSymbologyOverrides();
        oldStyle.settings.subCategoryOverrides.set("0x456", SubCategoryOverride.fromJSON({ invisible: true }));
        expect(ref.getSymbologyOverrides()).toBe(warmed);
      });
    });

    it("responds to mutations of a replacement category selector", () => {
      testBlankViewport((viewport) => {
        const view = viewport.view;
        const ref = viewport.iModelRefs.primary;
        const oldSelector = view.categorySelector;
        const newSelector = oldSelector.clone();
        view.categorySelector = newSelector;

        const warmed = ref.getSymbologyOverrides();
        newSelector.categories.add("0x999");
        expect(ref.viewedCategories.has("0x999")).toBe(true);
        expect(ref.getSymbologyOverrides()).not.toBe(warmed);
        expect((viewport as any)._changeFlags.viewedCategories).toBe(true);

        // Mutations of the replaced (old) selector must have no effect.
        const warmed2 = ref.getSymbologyOverrides();
        oldSelector.categories.add("0xaaa");
        expect(ref.viewedCategories.has("0xaaa")).toBe(false);
        expect(ref.getSymbologyOverrides()).toBe(warmed2);
      });
    });

    it("responds to mutations of a replacement model selector", () => {
      testBlankViewport((viewport) => {
        const view = viewport.view;
        if (!view.isSpatialView())
          throw new Error("Expected a spatial view");

        const newSelector = view.modelSelector.clone();
        view.modelSelector = newSelector;
        (viewport as any)._changeFlags.clear();

        newSelector.models.add("0x77");
        expect(view.iModelRefs.primary.viewedModels.has("0x77")).toBe(true);
        expect((viewport as any)._changeFlags.viewedModels).toBe(true);
      });
    });

    it("rebinds at attach after replacement while detached", () => {
      testBlankViewport((viewport) => {
        const view2 = viewport.view.clone();
        const replacement = view2.displayStyle.clone();
        view2.displayStyle = replacement; // detached - raises no events
        const newSelector = view2.categorySelector.clone();
        view2.categorySelector = newSelector;

        viewport.changeView(view2);
        const ref = viewport.iModelRefs.primary;

        let warmed = ref.getSymbologyOverrides();
        replacement.settings.subCategoryOverrides.set("0x123", SubCategoryOverride.fromJSON({ invisible: true }));
        expect(ref.getSymbologyOverrides()).not.toBe(warmed);

        warmed = ref.getSymbologyOverrides();
        newSelector.categories.add("0x999");
        expect(ref.viewedCategories.has("0x999")).toBe(true);
        expect(ref.getSymbologyOverrides()).not.toBe(warmed);
      });
    });

    it("rebinds a linked reference's style listeners when the display style is replaced", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const linkedRef = refs.link({ iModel: linkedIModel });

        const oldStyle = viewport.view.displayStyle;
        const newStyle = oldStyle.clone();
        viewport.displayStyle = newStyle;

        // View flag changes on the replacement style must invalidate the linked reference's cache and update its active flags.
        let warmed = linkedRef.getSymbologyOverrides();
        const vf = newStyle.viewFlags.with("dimensions", !newStyle.viewFlags.dimensions);
        newStyle.viewFlags = vf;
        expect(linkedRef.activeViewFlags.dimensions).toBe(vf.dimensions);
        expect(linkedRef.getSymbologyOverrides()).not.toBe(warmed);

        // Mutations of the replaced (old) style must have no effect.
        warmed = linkedRef.getSymbologyOverrides();
        oldStyle.viewFlags = oldStyle.viewFlags.with("dimensions", !vf.dimensions);
        expect(linkedRef.getSymbologyOverrides()).toBe(warmed);
        expect(linkedRef.activeViewFlags.dimensions).toBe(vf.dimensions);

        refs.unlink(linkedRef);
      } finally {
        await linkedIModel.close();
      }
    });

    it("rebinds a linked reference at attach after the style is replaced while detached", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const view = viewport.view;
        const refs = view.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const linkedRef = refs.link({ iModel: linkedIModel });

        // Detach the view by switching to a clone, then replace its display style - no events are raised while detached.
        viewport.changeView(view.clone());
        const replacement = view.displayStyle.clone();
        view.displayStyle = replacement;

        // Reattach - the linked reference must rebind to the replacement style.
        viewport.changeView(view);

        const warmed = linkedRef.getSymbologyOverrides();
        const vf = replacement.viewFlags.with("dimensions", !replacement.viewFlags.dimensions);
        replacement.viewFlags = vf;
        expect(linkedRef.activeViewFlags.dimensions).toBe(vf.dimensions);
        expect(linkedRef.getSymbologyOverrides()).not.toBe(warmed);

        refs.unlink(linkedRef);
      } finally {
        await linkedIModel.close();
      }
    });

    it("keeps raising onTimePointChanged after the display style is replaced", () => {
      testBlankViewport((viewport) => {
        const refs = viewport.iModelRefs;
        let raised = 0;
        const removeListener = refs.onTimePointChanged.addListener(() => raised++);

        viewport.displayStyle.settings.timePoint = 100;
        expect(raised).toBe(1);

        // Replacing the style with a different time point must raise the event...
        const oldStyle = viewport.displayStyle;
        const newStyle = oldStyle.clone();
        newStyle.settings.timePoint = 200;
        viewport.displayStyle = newStyle;
        expect(raised).toBe(2);

        // ...changes on the replacement style must keep raising it...
        newStyle.settings.timePoint = 300;
        expect(raised).toBe(3);

        // ...and changes on the replaced (old) style must not.
        oldStyle.settings.timePoint = 400;
        expect(raised).toBe(3);

        // Replacing with a style sharing the current time point raises no event.
        const sameTimeStyle = newStyle.clone();
        sameTimeStyle.settings.timePoint = 300;
        viewport.displayStyle = sameTimeStyle;
        expect(raised).toBe(3);

        sameTimeStyle.settings.timePoint = 500;
        expect(raised).toBe(4);

        removeListener();
      });
    });

    it("exposes the replacement style's settings from active getters while replacement notifications are raised", () => {
      const linkedIModel = createBlankConnection();
      try {
        testBlankViewport((viewport) => {
          const refs = viewport.iModelRefs;
          if (!refs.isSpatial)
            throw new Error("Expected a spatial viewport");

          const linked = refs.link({ iModel: linkedIModel });
          const primary = refs.primary;
          if (!primary.isSpatial())
            throw new Error("Expected a spatial primary reference");

          const newStyle = viewport.displayStyle.clone();
          const newSettings = newStyle.settings;
          if (!newSettings.is3d())
            throw new Error("Expected 3d display style settings");

          newSettings.hiddenLineSettings = HiddenLine.Settings.fromJSON({ transThreshold: 0.5 });
          newSettings.contours = ContourDisplay.fromJSON({ displayContours: true });
          newSettings.clipStyle = ClipStyle.fromJSON({ produceCutGeometry: true });

          // The replacement notifications are raised before the view's displayStyle property is reassigned - the active
          // getters must nonetheless expose the replacement style's state to listeners.
          const seen = new Map<string, unknown>();
          const removals = [
            primary.onActiveHiddenLineSettingsChanged.addListener(() => seen.set("primary.hline", primary.activeHiddenLineSettings)),
            primary.onActiveContoursChanged.addListener(() => seen.set("primary.contours", primary.activeContours)),
            primary.onActiveClipStyleChanged.addListener(() => seen.set("primary.clip", primary.activeClipStyle)),
            linked.onActiveHiddenLineSettingsChanged.addListener(() => seen.set("linked.hline", linked.activeHiddenLineSettings)),
            linked.onActiveContoursChanged.addListener(() => seen.set("linked.contours", linked.activeContours)),
            linked.onActiveClipStyleChanged.addListener(() => seen.set("linked.clip", linked.activeClipStyle)),
          ];

          viewport.displayStyle = newStyle;

          expect(seen.get("primary.hline")).toBe(newSettings.hiddenLineSettings);
          expect(seen.get("primary.contours")).toBe(newSettings.contours);
          expect(seen.get("primary.clip")).toBe(newSettings.clipStyle);
          expect(seen.get("linked.hline")).toBe(newSettings.hiddenLineSettings);
          expect(seen.get("linked.contours")).toBe(newSettings.contours);
          expect(seen.get("linked.clip")).toBe(newSettings.clipStyle);

          for (const removeListener of removals)
            removeListener();

          refs.unlink(linked);
        });
      } finally {
        linkedIModel.closeSync();
      }
    });

    it("rebinds onTimePointChanged at attach after the style is replaced while detached", () => {
      testBlankViewport((viewport) => {
        const view = viewport.view;
        const refs = view.iModelRefs;
        let raised = 0;
        const removeListener = refs.onTimePointChanged.addListener(() => raised++);

        // Detach the view by switching to a clone, then replace its display style - no events are raised while detached.
        viewport.changeView(view.clone());
        const replacement = view.displayStyle.clone();
        replacement.settings.timePoint = 100;
        view.displayStyle = replacement;

        // Reattach - the refs collection must detect the replacement and raise for the differing time point.
        viewport.changeView(view);
        expect(raised).toBe(1);

        replacement.settings.timePoint = 200;
        expect(raised).toBe(2);

        removeListener();
      });
    });
  });

  describe("linked iModel tile tree lifecycle", () => {
    async function createLoadedTreeRef(iModel: IModelConnection): Promise<TileTreeReference> {
      const builder = IModelApp.renderSystem.createGraphic({ type: GraphicType.Scene, computeChordTolerance: () => 0 });
      builder.addPointString([new Point3d(0, 0, 0)]);
      const ref = TileTreeReference.createFromRenderGraphic({
        iModel,
        graphic: builder.finish(),
        modelId: iModel.transientIds.getNext(),
      });
      await ref.treeOwner.loadTree();
      expect(ref.treeOwner.tileTree).toBeDefined();
      return ref;
    }

    /** The linked ref's tile trees come from SpatialTileTreeReferences, which produces none for a blank connection -
     * shadow the instance getter with a real loaded tree so disclosure has something observable to disclose.
     */
    function setTileTreeRefs(ref: object, treeRefs: TileTreeReference[]): void {
      Object.defineProperty(ref, "tileTreeRefs", { get: () => treeRefs, configurable: true });
    }

    it("discloses linked tile trees", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const linkedRef = refs.link({ iModel: linkedIModel });
        const treeRef = await createLoadedTreeRef(linkedIModel);
        setTileTreeRefs(linkedRef, [treeRef]);

        const disclosed = new DisclosedTileTreeSet();
        viewport.discloseTileTrees(disclosed);
        expect(disclosed.has(treeRef.treeOwner.tileTree!)).toBe(true);

        refs.unlink(linkedRef);

        // After unlink, the tree is no longer disclosed.
        const disclosedAfter = new DisclosedTileTreeSet();
        viewport.discloseTileTrees(disclosedAfter);
        expect(disclosedAfter.size).toBe(0);
      } finally {
        await linkedIModel.close();
      }
    });

    it("exposes the view's iModels as the viewport's TileUser.iModels", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        expect([...viewport.iModels]).toEqual([viewport.iModel]);

        const linkedRef = refs.link({ iModel: linkedIModel });
        expect([...viewport.iModels]).toEqual([viewport.iModel, linkedIModel]);

        refs.unlink(linkedRef);
        expect([...viewport.iModels]).toEqual([viewport.iModel]);
      } finally {
        await linkedIModel.close();
      }
    });

    it("disposes a linked iModel's unused tile trees on unlink", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const linkedRef = refs.link({ iModel: linkedIModel });
        const treeRef = await createLoadedTreeRef(linkedIModel);
        setTileTreeRefs(linkedRef, [treeRef]);

        refs.unlink(linkedRef);

        // Nothing discloses the tree any longer - unlink must have reclaimed it immediately.
        expect(treeRef.treeOwner.tileTree).toBeUndefined();
      } finally {
        await linkedIModel.close();
      }
    });

    it("preserves trees still in use by another view linking the same iModel", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        using otherViewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        const otherRefs = otherViewport.iModelRefs;
        if (!refs.isSpatial || !otherRefs.isSpatial)
          throw new Error("Expected spatial viewports");

        const treeRef = await createLoadedTreeRef(linkedIModel);

        const linkedRef = refs.link({ iModel: linkedIModel });
        setTileTreeRefs(linkedRef, [treeRef]);

        // A second view links the same iModel and uses the same tree.
        const otherLinkedRef = otherRefs.link({ iModel: linkedIModel });
        setTileTreeRefs(otherLinkedRef, [treeRef]);

        refs.unlink(linkedRef);

        // The other view still discloses the tree - it must survive.
        expect(treeRef.treeOwner.tileTree).toBeDefined();

        otherRefs.unlink(otherLinkedRef);
        expect(treeRef.treeOwner.tileTree).toBeUndefined();
      } finally {
        await linkedIModel.close();
      }
    });
  });

  describe("linked placement for reality model tree references", () => {
    it("composes the linked placement into reality model, classifier, and mask tree reference transforms", async () => {
      const linkedIModel = createBlankConnection("linked-reality", Cartographic.fromDegrees({ longitude: -75.6869, latitude: 40.0657, height: 100 }));
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const linkedRef = refs.link({ iModel: linkedIModel });
        const toParent = linkedRef.linearTransformToParent;
        expect(toParent.isIdentity).toBe(false);

        const stubTree = { iModelTransform: Transform.createTranslationXYZ(1, 2, 3) } as unknown as TileTree;
        const expectPlacement = (ref: TileTreeReference, placed: boolean) => {
          const actual = (ref as any).computeTransform(stubTree) as Transform;
          const expected = placed ? toParent.multiplyTransformTransform(stubTree.iModelTransform) : stubTree.iModelTransform;
          expect(actual.isAlmostEqual(expected)).toBe(true);
        };

        const makeRealityRef = (source: RealityModelSource) => createRealityTileTreeReference({
          rdSourceKey: RealityDataSource.createKeyFromUrl("https://tiles.test/tileset.json"),
          iModel: linkedIModel,
          source,
          modelId: "0x123",
          getDisplaySettings: () => RealityModelDisplaySettings.defaults,
        });

        // A linked persistent reality model is placed, and uses the linked reference's symbology overrides.
        const linkedReality = makeRealityRef(linkedRef);
        expectPlacement(linkedReality, true);
        expect((linkedReality as any).getSymbologyOverrides(stubTree)).toBe(linkedRef.getSymbologyOverrides());

        // The primary reference's placement is the identity; it uses the primary's overrides.
        const primaryReality = makeRealityRef(refs.primary);
        expectPlacement(primaryReality, false);
        expect((primaryReality as any).getSymbologyOverrides(stubTree)).toBe(refs.primary.getSymbologyOverrides());

        // A context reality model (owned by the display style) is not placed and inherits the viewport's overrides.
        const contextReality = makeRealityRef(viewport.view.displayStyle);
        expectPlacement(contextReality, false);
        expect((contextReality as any).getSymbologyOverrides(stubTree)).toBeUndefined();

        // Classifier and mask tree references for linked models are placed too.
        const classifiers = { active: undefined, activeClassifier: undefined } as unknown as SpatialClassifiersState;
        expectPlacement(createClassifierTileTreeReference(classifiers, linkedReality, linkedIModel, linkedRef), true);
        expectPlacement(createClassifierTileTreeReference(classifiers, primaryReality, viewport.iModel, refs.primary), false);

        const stubModel = { id: "0x456", is3d: true, iModel: linkedIModel, asGeometricModel3d: undefined } as unknown as GeometricModelState;
        expectPlacement(createMaskTreeReference(linkedRef, stubModel), true);
        expectPlacement(createMaskTreeReference(refs.primary, stubModel), false);

        refs.unlink(linkedRef);
      } finally {
        await linkedIModel.close();
      }
    });
  });

  describe("linked scene merge", () => {
    it("propagates the children-still-loading flag from linked contexts", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const linkedRef = refs.link({ iModel: linkedIModel });

        // A tree reference whose children are still loading, without any explicit missing-tile requests -
        // e.g., reality tiles report this state via markChildrenLoading.
        const loadingRef = { addToScene: (sceneContext: SceneContext) => sceneContext.markChildrenLoading() } as unknown as TileTreeReference;
        Object.defineProperty(linkedRef, "tileTreeRefs", { get: () => [loadingRef], configurable: true });

        const context = new SceneContext(viewport);
        viewport.view.createScene(context);

        expect(context.missingTiles.size).toBe(0);
        expect(context.hasMissingTiles).toBe(true);

        refs.unlink(linkedRef);
      } finally {
        await linkedIModel.close();
      }
    });
  });

  describe("linked plan projection display transform", () => {
    it("includes the plan projection elevation in the pick/snap display transform", async () => {
      // A linked connection geolocated elsewhere, so its transform into the view is not the identity.
      const linkedIModel = createBlankConnection("linked-plan-projection", Cartographic.fromDegrees({ longitude: -75.6869, latitude: 40.0657, height: 100 }));
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const linkedRef = refs.link({ iModel: linkedIModel });
        const toParent = linkedRef.linearTransformToParent;
        expect(toParent.isIdentity).toBe(false);

        const modelId = "0x1c";

        // No elevation, no model display transform - no display transform.
        expect(computeIModelRefDisplayTransform(linkedRef, modelId)).toBeUndefined();

        // The elevation applies in the linked iModel's own coordinate space, before its placement into the view.
        linkedRef.planProjectionSettings.set(modelId, PlanProjectionSettings.fromJSON({ elevation: 10 })!);
        const actual = computeIModelRefDisplayTransform(linkedRef, modelId);
        expect(actual).toBeDefined();
        const expected = toParent.multiplyTransformTransform(Transform.createTranslationXYZ(0, 0, 10)).multiplyTransformTransform(toParent.inverse()!);
        expect(actual!.isAlmostEqual(expected)).toBe(true);

        // Other models are unaffected.
        expect(computeIModelRefDisplayTransform(linkedRef, "0x1d")).toBeUndefined();

        refs.unlink(linkedRef);
      } finally {
        await linkedIModel.close();
      }
    });
  });

  describe("section-cut clip for linked iModels", () => {
    it("transforms the tile-request clip into the linked iModel's coordinate space", async () => {
      // A linked connection geolocated elsewhere, so its transform into the view is not the identity.
      const linkedIModel = createBlankConnection("linked-elsewhere", Cartographic.fromDegrees({ longitude: -75.6869, latitude: 40.0657, height: 100 }));
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const linkedRef = refs.link({ iModel: linkedIModel });
        const toParent = linkedRef.linearTransformToParent;
        expect(toParent.isIdentity).toBe(false);

        // A clip around the origin, with cut geometry enabled.
        const clip = ClipVector.createEmpty();
        expect(clip.appendShape([Point3d.create(-5, -5, 0), Point3d.create(5, -5, 0), Point3d.create(5, 5, 0), Point3d.create(-5, 5, 0)])).toBe(true);
        viewport.view.setViewClip(clip);
        viewport.displayStyle.settings.clipStyle = ClipStyle.fromJSON({ produceCutGeometry: true });

        const viewCut = StringifiedClipVector.fromClipVector(clip)!;

        // The primary reference's tile-request clip is the view clip, untransformed.
        const primaryCut = computeSectionCutForIModelCoords(viewCut, refs.primary);
        expect(primaryCut).toBe(viewCut);

        // The linked reference's tile-request clip is expressed in the linked iModel's own coordinate space.
        const linkedCut = computeSectionCutForIModelCoords(viewCut, linkedRef);
        expect(linkedCut).toBeDefined();
        expect(linkedCut!.clipString).not.toBe(viewCut.clipString);

        // A world point inside the view clip maps to a linked-space point inside the linked cut clip, and vice versa.
        const worldInside = Point3d.create(0, 0, 0);
        const worldOutside = Point3d.create(100, 100, 0);
        expect(clip.pointInside(worldInside)).toBe(true);
        expect(clip.pointInside(worldOutside)).toBe(false);

        const fromParent = toParent.inverse()!;
        expect(linkedCut!.pointInside(fromParent.multiplyPoint3d(worldInside))).toBe(true);
        expect(linkedCut!.pointInside(fromParent.multiplyPoint3d(worldOutside))).toBe(false);

        // The view's own clip must not have been mutated - it remains correct for frontend tile culling.
        expect(viewport.view.getViewClip()).toBe(clip);
        expect(StringifiedClipVector.fromClipVector(clip)!.clipString).toBe(viewCut.clipString);

        refs.unlink(linkedRef);
      } finally {
        await linkedIModel.close();
      }
    });
  });

  describe("changeView display state migration", () => {
    it("carries never/always drawn, exclusivity, and per-model category visibility to the new view's primary reference", () => {
      testBlankViewport((viewport) => {
        const ref = viewport.iModelRefs.primary;
        ref.neverDrawnElements.add("0x1");
        ref.alwaysDrawnElements.add("0x2");
        ref.isAlwaysDrawnExclusive = true;
        ref.perModelCategoryVisibility.setOverride("0x10", "0x20", PerModelCategoryVisibility.Override.Show);
        ref.perModelCategoryVisibility.setOverride("0x11", "0x21", PerModelCategoryVisibility.Override.Hide);

        viewport.changeView(viewport.view.clone());
        const newRef = viewport.iModelRefs.primary;
        expect(newRef).not.toBe(ref);

        expect(newRef.neverDrawnElements.has("0x1")).toBe(true);
        expect(newRef.alwaysDrawnElements.has("0x2")).toBe(true);
        expect(newRef.isAlwaysDrawnExclusive).toBe(true);
        expect(newRef.perModelCategoryVisibility.getOverride("0x10", "0x20")).toBe(PerModelCategoryVisibility.Override.Show);
        expect(newRef.perModelCategoryVisibility.getOverride("0x11", "0x21")).toBe(PerModelCategoryVisibility.Override.Hide);

        // The migrated state must be baked into the new reference's symbology overrides.
        const ovrs = newRef.getSymbologyOverrides();
        expect(ovrs.isAlwaysDrawnExclusive).toBe(true);
        expect(ovrs.neverDrawn.hasId("0x1")).toBe(true);
        expect(ovrs.alwaysDrawn.hasId("0x2")).toBe(true);
      });
    });

    it("replaces stale display state on the incoming view's primary reference", () => {
      testBlankViewport((viewport) => {
        const newView = viewport.view.clone();
        const staleRef = newView.iModelRefs.primary;
        staleRef.neverDrawnElements.add("0xdead");
        staleRef.isAlwaysDrawnExclusive = true;
        staleRef.perModelCategoryVisibility.setOverride("0x10", "0x20", PerModelCategoryVisibility.Override.Hide);

        viewport.changeView(newView);
        const newRef = viewport.iModelRefs.primary;
        expect(newRef.neverDrawnElements.size).toBe(0);
        expect(newRef.isAlwaysDrawnExclusive).toBe(false);
        expect(newRef.perModelCategoryVisibility.getOverride("0x10", "0x20")).toBe(PerModelCategoryVisibility.Override.None);
      });
    });

    it("updates the render target's primary iModel reference when applying a view state", () => {
      testBlankViewport((viewport) => {
        const target = viewport.target as Target;
        expect(target.currentBranch.iModelRef).toBe(viewport.iModelRefs.primary);
        expect(target.decorationsState.iModelRef).toBe(viewport.iModelRefs.primary);

        // applyViewState replaces the ViewState without a full Target.reset - the target must still track the new
        // view's primary reference for decorations and pick exclusions.
        const newView = viewport.view.clone();
        viewport.applyViewState(newView);

        const primary = newView.iModelRefs.primary;
        expect(viewport.iModelRefs.primary).toBe(primary);
        expect(target.currentBranch.iModelRef).toBe(primary);
        expect(target.decorationsState.iModelRef).toBe(primary);
      });
    });
  });

  describe("deprecated always/never-drawn setters", () => {
    it("accept the viewport's own sets without emptying them", () => {
      testBlankViewport((viewport) => {
        /* eslint-disable @typescript-eslint/no-deprecated -- verifies compatibility of deprecated methods */
        viewport.setNeverDrawn(new Set(["0x1"]));
        expect(viewport.neverDrawn.has("0x1")).toBe(true);

        viewport.neverDrawn.add("0x2");
        viewport.setNeverDrawn(viewport.neverDrawn);
        expect(viewport.neverDrawn.size).toBe(2);
        expect(viewport.neverDrawn.has("0x1")).toBe(true);
        expect(viewport.neverDrawn.has("0x2")).toBe(true);

        viewport.setAlwaysDrawn(new Set(["0x3"]));
        expect(viewport.isAlwaysDrawnExclusive).toBe(false);

        viewport.setAlwaysDrawn(viewport.alwaysDrawn, true);
        expect(viewport.alwaysDrawn.size).toBe(1);
        expect(viewport.alwaysDrawn.has("0x3")).toBe(true);
        expect(viewport.isAlwaysDrawnExclusive).toBe(true);

        // A distinct set still replaces the contents.
        viewport.setAlwaysDrawn(new Set(["0x4"]), false);
        expect(viewport.alwaysDrawn.size).toBe(1);
        expect(viewport.alwaysDrawn.has("0x4")).toBe(true);
        expect(viewport.isAlwaysDrawnExclusive).toBe(false);
        /* eslint-enable @typescript-eslint/no-deprecated */
      });
    });
  });

  describe("GraphicsCollectorDrawArgs", () => {
    it("collects branches carrying the tree's iModel reference", async () => {
      await testBlankViewportAsync(async (vp) => {
        const makeGraphic = () => {
          const builder = IModelApp.renderSystem.createGraphic({ type: GraphicType.Scene, computeChordTolerance: () => 0 });
          builder.addPointString([new Point3d(0, 0, 0)]);
          return builder.finish();
        };

        const ref = TileTreeReference.createFromRenderGraphic({
          iModel: vp.iModel,
          graphic: makeGraphic(),
          modelId: vp.iModel.transientIds.getNext(),
        });
        await ref.treeOwner.loadTree();

        const context = new SceneContext(vp);
        const collected: RenderGraphic[] = [];
        const args = GraphicsCollectorDrawArgs.create(
          context,
          { addGraphic: (graphic: RenderGraphic) => collected.push(graphic) },
          ref,
          FrustumPlanes.fromFrustum(vp.getFrustum()),
          vp.viewingSpace.worldToViewMap,
        );
        expect(args).toBeDefined();

        const branch = new GraphicBranch(true);
        branch.add(makeGraphic());
        args!.drawGraphicsWithType(TileGraphicType.BackgroundMap, branch);

        // The collected branch must carry an iModel reference - consumers such as BackgroundMapDrape draw it on a fresh
        // branch stack whose root state has none, and batches require a defined reference.
        expect(collected.length).toBe(1);
        expect(collected[0]).toBeInstanceOf(Branch);
        const collectedBranch = collected[0] as Branch;
        expect(collectedBranch.iModelRef).toBeDefined();
        expect(collectedBranch.iModelRef!.iModel).toBe(vp.iModel);
      });
    });
  });

  describe("EmphasizeElements change notifications", () => {
    it("raises feature override events when provider state changes", () => {
      testBlankViewport((viewport) => {
        const emph = EmphasizeElements.getOrCreate(viewport);
        viewport.renderFrame(); // flush the change flags produced by registering the provider

        let overridesChanged = 0;
        let providerChanged = 0;
        const removals = [
          viewport.onFeatureOverridesChanged.addListener(() => overridesChanged++),
          viewport.onFeatureOverrideProviderChanged.addListener(() => providerChanged++),
        ];

        expect(emph.overrideElements("0x1", viewport, ColorDef.red)).toBe(true);
        viewport.renderFrame();
        expect(overridesChanged).toBe(1);
        expect(providerChanged).toBe(1);

        expect(emph.clearOverriddenElements(viewport)).toBe(true);
        viewport.renderFrame();
        expect(overridesChanged).toBe(2);
        expect(providerChanged).toBe(2);

        // A no-op mutation raises no events.
        expect(emph.clearOverriddenElements(viewport)).toBe(false);
        viewport.renderFrame();
        expect(overridesChanged).toBe(2);
        expect(providerChanged).toBe(2);

        expect(emph.emphasizeElements("0x2", viewport)).toBe(true);
        viewport.renderFrame();
        expect(overridesChanged).toBe(3);
        expect(providerChanged).toBe(3);

        expect(emph.clearEmphasizedElements(viewport)).toBe(true);
        viewport.renderFrame();
        expect(overridesChanged).toBe(4);
        expect(providerChanged).toBe(4);

        for (const removal of removals)
          removal();

        EmphasizeElements.clear(viewport);
      });
    });
  });

  describe("linked reference model clip groups", () => {
    function createClip(offset: number): ClipVector {
      const clip = ClipVector.createEmpty();
      expect(clip.appendShape([Point3d.create(offset + 1, 1, 0), Point3d.create(offset + 2, 1, 0), Point3d.create(offset + 2, 2, 0)])).toBe(true);
      return clip;
    }

    it("rebuilds cached clip volumes when model clip groups are assigned, reordered, or cleared", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        // Linked without clips - no model is clipped.
        const ref = refs.link({ iModel: linkedIModel });
        expect(ref[_getModelClip]("0x1")).toBeUndefined();

        // Assigning groups after linking takes effect.
        const clipA = createClip(0);
        const clipB = createClip(10);
        ref.modelClipGroups = new ModelClipGroups([ModelClipGroup.create(clipA, ["0x1"]), ModelClipGroup.create(clipB, ["0x2"])]);
        expect(ref[_getModelClip]("0x1")?.clipVector).toBe(clipA);
        expect(ref[_getModelClip]("0x2")?.clipVector).toBe(clipB);
        expect(ref[_getModelClip]("0x3")).toBeUndefined();

        // Replacing with reordered groups applies each clip to the correct group.
        ref.modelClipGroups = new ModelClipGroups([ModelClipGroup.create(clipB, ["0x2"]), ModelClipGroup.create(clipA, ["0x1"])]);
        expect(ref[_getModelClip]("0x1")?.clipVector).toBe(clipA);
        expect(ref[_getModelClip]("0x2")?.clipVector).toBe(clipB);

        // Clearing the groups removes all clips.
        ref.modelClipGroups = new ModelClipGroups();
        expect(ref[_getModelClip]("0x1")).toBeUndefined();
        expect(ref[_getModelClip]("0x2")).toBeUndefined();

        refs.unlink(ref);
      } finally {
        await linkedIModel.close();
      }
    });
  });

  describe("linked volume classifier", () => {
    it("preserves a linked reference's volume classifier when merging scenes, preferring the primary's", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const view = viewport.view;
        if (!view.isSpatialView())
          throw new Error("Expected a spatial view");

        const linkedRef = refs.link({ iModel: linkedIModel });

        // Both references classify a model with the same Id - model Ids are only unique within a single iModel.
        const modelId = "0x123";
        const linkedClassifier = { name: "linked" } as any;
        const linkedTreeRefs = vi.spyOn(linkedRef, "tileTreeRefs", "get").mockReturnValue([
          { addToScene: (ctx: SceneContext) => ctx.setVolumeClassifier(linkedClassifier, modelId) } as any,
        ]);

        try {
          // With no primary classifier, the linked classifier survives the scene merge along with its originating reference.
          let context = new SceneContext(viewport);
          view.createScene(context);
          expect(context.scene.volumeClassifier?.classifier).toBe(linkedClassifier);
          expect(context.scene.volumeClassifier?.modelId).toBe(modelId);
          expect(context.scene.volumeClassifier?.iModelRef).toBe(linkedRef);

          // A primary classifier takes precedence and remains associated with the primary reference.
          const primaryClassifier = { name: "primary" } as any;
          const primaryTreeRefs = vi.spyOn(view, "getTileTreeRefs").mockReturnValue([
            { addToScene: (ctx: SceneContext) => ctx.setVolumeClassifier(primaryClassifier, modelId) } as any,
          ]);

          try {
            context = new SceneContext(viewport);
            view.createScene(context);
            expect(context.scene.volumeClassifier?.classifier).toBe(primaryClassifier);
            expect(context.scene.volumeClassifier?.modelId).toBe(modelId);
            expect(context.scene.volumeClassifier?.iModelRef).toBe(refs.primary);
          } finally {
            primaryTreeRefs.mockRestore();
          }
        } finally {
          linkedTreeRefs.mockRestore();
        }

        refs.unlink(linkedRef);
      } finally {
        await linkedIModel.close();
      }
    });
  });

  describe("unlinking", () => {
    it("disposes each unlinked reference's subscriptions regardless of unlink order", async () => {
      for (const reverse of [false, true]) {
        const iModelA = createBlankConnection();
        const iModelB = createBlankConnection();
        try {
          using viewport = openBlankViewport();
          const refs = viewport.iModelRefs;
          if (!refs.isSpatial)
            throw new Error("Expected a spatial viewport");

          const refA = refs.link({ iModel: iModelA });
          const refB = refs.link({ iModel: iModelB });

          const counts = new Map<IModelDisplayReference, number>();
          for (const ref of [refA, refB]) {
            counts.set(ref, 0);
            ref.onSymbologyOverridesInvalidated.addListener(() => counts.set(ref, counts.get(ref)! + 1));
          }

          const [first, second] = reverse ? [refB, refA] : [refA, refB];
          refs.unlink(first);
          refs.unlink(second);

          // A disposed reference no longer reacts to inherited default-appearance changes; an undisposed one would.
          refs.defaultFeatureAppearance = FeatureAppearance.fromJSON({ transparency: 0.5 });
          expect(counts.get(refA)).toBe(0);
          expect(counts.get(refB)).toBe(0);
        } finally {
          await iModelA.close();
          await iModelB.close();
        }
      }
    });

    it("returns the viewport's listener bookkeeping to its pre-link baseline after repeated link/unlink", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const detachFromView = (viewport as any)._detachFromView as unknown[];
        const detachFromIModelRefs = (viewport as any)._detachFromIModelRefs as Map<unknown, unknown[]>;
        const baselineDetach = detachFromView.length;
        const baselineRefs = detachFromIModelRefs.size;

        for (let i = 0; i < 3; i++) {
          const ref = refs.link({ iModel: linkedIModel });
          expect(detachFromIModelRefs.size).toBe(baselineRefs + 1);
          refs.unlink(ref);
          expect(detachFromIModelRefs.size).toBe(baselineRefs);
          expect(detachFromView.length).toBe(baselineDetach);
        }
      } finally {
        await linkedIModel.close();
      }
    });
  });

  describe("texture drapes", () => {
    it("registers and resolves drapes using reference-qualified keys for primary and linked models with matching Ids", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const linkedRef = refs.link({ iModel: linkedIModel });
        const primaryContext = new SceneContext(viewport);
        const linkedContext = new SceneContext({ viewport, iModelRef: linkedRef });

        const modelId = "0x5";
        const drapedTreeRef = { treeOwner: { tileTree: { modelId } } } as any;
        const primaryDrape = { name: "primary" } as any;
        const linkedDrape = { name: "linked" } as any;

        const getDrape = vi.spyOn(viewport.target, "getTextureDrape");
        try {
          // Registration in each context, followed by the bare-model-Id lookup performed by TileDrawArgs.
          getDrape.mockReturnValue(primaryDrape);
          expect(primaryContext.addBackgroundDrapedModel(drapedTreeRef, undefined)).toBe(primaryDrape);
          expect(primaryContext.getTextureDrapeForModel(modelId)).toBe(primaryDrape);

          getDrape.mockReturnValue(linkedDrape);
          expect(linkedContext.addBackgroundDrapedModel(drapedTreeRef, undefined)).toBe(linkedDrape);
          expect(linkedContext.getTextureDrapeForModel(modelId)).toBe(linkedDrape);

          // After the scene merge performed by SpatialViewState.createScene, the matching model Ids must not collide -
          // each context still resolves its own reference's drape.
          for (const [key, drape] of linkedContext.textureDrapes)
            primaryContext.textureDrapes.set(key, drape);

          expect(primaryContext.textureDrapes.size).toBe(2);
          expect(primaryContext.getTextureDrapeForModel(modelId)).toBe(primaryDrape);
          expect(linkedContext.getTextureDrapeForModel(modelId)).toBe(linkedDrape);

          // Re-registration finds the already-registered drape without consulting the target again.
          getDrape.mockClear();
          expect(primaryContext.addBackgroundDrapedModel(drapedTreeRef, undefined)).toBe(primaryDrape);
          expect(getDrape).not.toHaveBeenCalled();
        } finally {
          getDrape.mockRestore();
        }

        refs.unlink(linkedRef);
      } finally {
        await linkedIModel.close();
      }
    });
  });

  describe("getPixelDataWorldPoint", () => {
    it("inverts the display transform of the pixel's owning reference", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const linkedRef = refs.link({ iModel: linkedIModel });

        class Transformer {
          public constructor(private readonly _transform: Transform) { }
          public getModelDisplayTransform() { return { transform: this._transform }; }
        }

        // Distinct display transforms for the same model Id on the primary view and the linked reference.
        const modelId = "0x456";
        viewport.view.modelDisplayTransformProvider = new Transformer(Transform.createTranslationXYZ(-5, 0, 0));
        linkedRef.modelDisplayTransformProvider = new Transformer(Transform.createTranslationXYZ(10, 0, 0));

        const makeBuffer = (iModelRef: IModelDisplayReference) => ({
          getPixel: () => ({
            distanceFraction: 0.5,
            modelId,
            feature: { elementId: "0x123", subCategoryId: "0x1", geometryClass: 0, modelId, iModelRef },
            viewAttachmentId: undefined,
            inSectionDrawingAttachment: false,
          }),
        }) as any;

        const raw = viewport.getPixelDataWorldPoint({ pixels: makeBuffer(linkedRef), x: 1, y: 1, preserveModelDisplayTransforms: true });
        const linkedPt = viewport.getPixelDataWorldPoint({ pixels: makeBuffer(linkedRef), x: 1, y: 1 });
        const primaryPt = viewport.getPixelDataWorldPoint({ pixels: makeBuffer(refs.primary), x: 1, y: 1 });
        expect(raw).toBeDefined();
        expect(linkedPt).toBeDefined();
        expect(primaryPt).toBeDefined();

        // Inverting the linked translation (10, 0, 0) subtracts 10; inverting the primary's (-5, 0, 0) adds 5.
        expect(linkedPt!.x).toBeCloseTo(raw!.x - 10, 8);
        expect(primaryPt!.x).toBeCloseTo(raw!.x + 5, 8);
        expect(linkedPt!.y).toBeCloseTo(raw!.y, 8);
        expect(linkedPt!.z).toBeCloseTo(raw!.z, 8);

        refs.unlink(linkedRef);
      } finally {
        await linkedIModel.close();
      }
    });
  });

  describe("FeatureOverrideProvider", () => {
    function hasProxy(ref: IModelDisplayReference, provider: FeatureOverrideProvider): boolean {
      return [...ref.featureOverrideProviders].some((overrider) => "proxiedProvider" in overrider && overrider.proxiedProvider === provider);
    }

    it("moves the proxy across primary references for the same iModel connection", () => {
      using viewport = openBlankViewport();
      const provider: FeatureOverrideProvider = { addFeatureOverrides: () => undefined };
      const previousRef = viewport.primaryIModelRef;
      const nextView = SpatialViewState.createBlank(viewport.iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      const nextRef = nextView.iModelRefs.primary;

      expect(nextRef).not.toBe(previousRef);
      expect(viewport.addFeatureOverrideProvider(provider)).toBe(true);
      expect(hasProxy(previousRef, provider)).toBe(true);

      viewport.applyViewState(nextView);

      expect(hasProxy(previousRef, provider)).toBe(false);
      expect(hasProxy(nextRef, provider)).toBe(true);
      expect([...viewport.featureOverrideProviders]).toContain(provider);
      expect(viewport.dropFeatureOverrideProvider(provider)).toBe(true);
      expect(hasProxy(nextRef, provider)).toBe(false);
    });

    it("drops providers when the primary iModel connection changes", async () => {
      const viewport = openBlankViewport();
      const originalIModel = viewport.iModel;
      const otherIModel = createBlankConnection();
      const provider: FeatureOverrideProvider = { addFeatureOverrides: () => undefined };
      const previousRef = viewport.primaryIModelRef;
      const nextView = SpatialViewState.createBlank(otherIModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      const nextRef = nextView.iModelRefs.primary;

      try {
        viewport.addFeatureOverrideProvider(provider);
        viewport.changeView(nextView);

        expect(hasProxy(previousRef, provider)).toBe(false);
        expect(hasProxy(nextRef, provider)).toBe(false);
        expect([...viewport.featureOverrideProviders]).not.toContain(provider);
        expect(viewport.dropFeatureOverrideProvider(provider)).toBe(false);
      } finally {
        viewport[Symbol.dispose]();
        await otherIModel.close();
        await originalIModel.close();
      }
    });

    it("removes proxies when the viewport is disposed", () => {
      using viewport = openBlankViewport();
      const provider: FeatureOverrideProvider = { addFeatureOverrides: () => undefined };
      const ref = viewport.primaryIModelRef;

      viewport.addFeatureOverrideProvider(provider);
      expect(hasProxy(ref, provider)).toBe(true);

      viewport[Symbol.dispose]();

      expect(hasProxy(ref, provider)).toBe(false);
      expect([...viewport.featureOverrideProviders]).toHaveLength(0);
    });
  });

  describe("default feature appearance", () => {
    it("is inherited by primary and linked references and can be overridden per reference", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const ref = refs.primary;
        const linkedRef = refs.link({ iModel: linkedIModel });
        const inherited = FeatureAppearance.fromJSON({ transparency: 0.25 });
        const updated = FeatureAppearance.fromJSON({ transparency: 0.75 });
        const local = FeatureAppearance.fromJSON({ transparency: 0.5 });
        let collectionChanged = 0;
        let referenceChanged = 0;
        refs.onDefaultFeatureAppearanceChanged.addListener(() => collectionChanged++);
        ref.overrides.onDefaultFeatureAppearanceChanged.addListener(() => referenceChanged++);

        expect(ref.getSymbologyOverrides().defaultOverrides).toBe(FeatureAppearance.defaults);
        refs.defaultFeatureAppearance = inherited;
        expect(collectionChanged).toBe(1);
        expect(ref.getSymbologyOverrides().defaultOverrides).toBe(inherited);
        expect(linkedRef.getSymbologyOverrides().defaultOverrides).toBe(inherited);

        ref.overrides.defaultFeatureAppearance = local;
        expect(ref.getSymbologyOverrides().defaultOverrides).toBe(local);
        expect(referenceChanged).toBe(1);
        ref.overrides.defaultFeatureAppearance = local;
        expect(referenceChanged).toBe(1);

        refs.defaultFeatureAppearance = updated;
        expect(collectionChanged).toBe(2);
        expect(ref.getSymbologyOverrides().defaultOverrides).toBe(local);
        expect(linkedRef.getSymbologyOverrides().defaultOverrides).toBe(updated);

        ref.overrides.defaultFeatureAppearance = undefined;
        expect(referenceChanged).toBe(2);
        expect(ref.getSymbologyOverrides().defaultOverrides).toBe(updated);

        refs.unlink(linkedRef);
      } finally {
        await linkedIModel.close();
      }
    });

    it("initializes linked-reference overrides and resumes inheritance when cleared", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const inherited = FeatureAppearance.fromJSON({ transparency: 0.25 });
        const local = FeatureAppearance.fromJSON({ transparency: 0.5 });
        const updated = FeatureAppearance.fromJSON({ transparency: 0.75 });
        refs.defaultFeatureAppearance = inherited;
        const linkedRef = refs.link({ iModel: linkedIModel, overrides: { defaultFeatureAppearance: local } });

        expect(linkedRef.getSymbologyOverrides().defaultOverrides).toBe(local);
        refs.defaultFeatureAppearance = updated;
        expect(linkedRef.getSymbologyOverrides().defaultOverrides).toBe(local);

        linkedRef.overrides.defaultFeatureAppearance = undefined;
        expect(linkedRef.getSymbologyOverrides().defaultOverrides).toBe(updated);

        refs.unlink(linkedRef);
      } finally {
        await linkedIModel.close();
      }
    });

    it("allows feature override providers to replace the default appearance", () => {
      testBlankViewport((viewport) => {
        const ref = viewport.iModelRefs.primary;
        const inherited = FeatureAppearance.fromJSON({ transparency: 0.25 });
        const provided = FeatureAppearance.fromJSON({ transparency: 0.5 });
        viewport.iModelRefs.defaultFeatureAppearance = inherited;

        ref.featureOverrideProviders.add({
          addFeatureOverrides: (overrides) => overrides.setDefaultOverrides(provided),
        });

        expect(ref.getSymbologyOverrides().defaultOverrides).toBe(provided);
      });
    });
  });

  describe("IModelDisplayReference overrides", () => {
    it("applies category, subcategory, model, and per-model visibility changes through the reference", () => {
      testBlankViewport((viewport) => {
        const ref = viewport.iModelRefs.primary;
        const categoryId = "0x1";
        const subCategoryId = "0x2";
        const modelId = "0x3";
        ref.iModel.subcategories.add(categoryId, subCategoryId, new SubCategoryAppearance({ invisible: true }), true);

        ref.changeCategoryDisplay({ categories: [categoryId], display: true, enableAllSubCategories: true });
        expect(ref.viewedCategories.has(categoryId)).toBe(true);
        expect(ref.isSubCategoryVisible(subCategoryId)).toBe(true);
        expect(ref.getSubCategoryAppearance(subCategoryId).invisible).toBe(false);

        ref.changeSubCategoryDisplay(subCategoryId, false);
        expect(ref.isSubCategoryVisible(subCategoryId)).toBe(false);
        expect(ref.subCategoryOverrides.get(subCategoryId)?.invisible).toBe(true);

        const modelAppearance = FeatureAppearance.fromJSON({ transparency: 0.5 });
        ref.modelAppearanceOverrides.set(modelId, modelAppearance);
        expect(ref.modelAppearanceOverrides.get(modelId)).toBe(modelAppearance);

        ref.perModelCategoryVisibility.setOverride(modelId, categoryId, PerModelCategoryVisibility.Override.Hide);
        expect(ref.perModelCategoryVisibility.getOverride(modelId, categoryId)).toBe(PerModelCategoryVisibility.Override.Hide);

        ref.changeCategoryDisplay({ categories: [categoryId], display: false });
        expect(ref.viewedCategories.has(categoryId)).toBe(false);
      });
    });

    it("reads a one-shot categories iterable exactly once", () => {
      testBlankViewport((viewport) => {
        const ref = viewport.iModelRefs.primary;
        const categoryId = "0x1";
        const subCategoryId = "0x2";
        ref.iModel.subcategories.add(categoryId, subCategoryId, new SubCategoryAppearance({ invisible: true }), true);

        function* categories() { yield categoryId; }
        ref.changeCategoryDisplay({ categories: categories(), display: true, enableAllSubCategories: true });

        expect(ref.viewedCategories.has(categoryId)).toBe(true);
        // enableAllSubCategories depends on a second read of the input - a generator would be exhausted by then.
        expect(ref.isSubCategoryVisible(subCategoryId)).toBe(true);
      });
    });
  });

  describe("SpatialIModelDisplayReference viewed models", () => {
    it("adds and loads models through the reference", async () => {
      await testBlankViewportAsync(async (viewport) => {
        const ref = viewport.iModelRefs.primary;
        if (!ref.isSpatial())
          throw new Error("Expected a spatial viewport");

        const modelId = "0x123";
        const loadModels = vi.spyOn(ref.iModel.models, "load").mockResolvedValue();
        try {
          await ref.addAndLoadViewedModels([modelId]);
          expect(ref.viewedModels.has(modelId)).toBe(true);
          expect(loadModels).toHaveBeenCalled();
        } finally {
          loadModels.mockRestore();
        }
      });
    });

    it("reads a one-shot modelIds iterable exactly once", async () => {
      await testBlankViewportAsync(async (viewport) => {
        const ref = viewport.iModelRefs.primary;
        if (!ref.isSpatial())
          throw new Error("Expected a spatial viewport");

        const modelId = "0x123";
        // Mock load so the viewedModels auto-load listener does not reach the real filterLoaded;
        // the only direct filterLoaded call is then the one made by addAndLoadViewedModels itself.
        const loadModels = vi.spyOn(ref.iModel.models, "load").mockResolvedValue();
        const filterLoaded = vi.spyOn(ref.iModel.models, "filterLoaded");
        try {
          function* modelIds() { yield modelId; }
          await ref.addAndLoadViewedModels(modelIds());

          expect(ref.viewedModels.has(modelId)).toBe(true);
          // The load set is built from a second read of the input - a generator would be exhausted by then.
          expect(filterLoaded).toHaveBeenCalledTimes(1);
          const requested = new Set(filterLoaded.mock.calls[0][0] as Iterable<string>);
          expect(requested.has(modelId)).toBe(true);
        } finally {
          filterLoaded.mockRestore();
          loadModels.mockRestore();
        }
      });
    });

    it("reports loading incomplete while linked model metadata is being loaded", async () => {
      const linkedIModel = createBlankConnection();
      try {
        using viewport = openBlankViewport();
        const refs = viewport.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        // Hold the linked iModel's model-metadata loading unresolved.
        let resolveLoad!: () => void;
        const loadModels = vi.spyOn(linkedIModel.models, "load").mockReturnValue(new Promise<void>((resolve) => resolveLoad = resolve));

        const linkedRef = refs.link({ iModel: linkedIModel, viewedModels: ["0x123"] });
        expect(loadModels).toHaveBeenCalled();

        // Before the ModelStates are loaded the reference has no tile-tree references, but it must not report completion -
        // waitForSceneCompletion would otherwise resolve before the linked content can produce any graphics.
        expect(linkedRef.isLoadingComplete).toBe(false);
        expect(viewport.view.areAllTileTreesLoaded).toBe(false);

        resolveLoad();
        await vi.waitFor(() => expect(linkedRef.isLoadingComplete).toBe(true));
        expect(viewport.view.areAllTileTreesLoaded).toBe(true);

        refs.unlink(linkedRef);
        loadModels.mockRestore();
      } finally {
        await linkedIModel.close();
      }
    });
  });

  describe("IModelDisplayReference2d", () => {
    it("exposes its viewed model", () => {
      const iModel = createBlankConnection();
      try {
        const modelProps = { model: "0x1", code: Code.createEmpty().toJSON() };
        const categorySelector = new CategorySelectorState({ ...modelProps, id: "0x2", classFullName: CategorySelectorState.classFullName, categories: [] }, iModel);
        const displayStyle = new DisplayStyle2dState({ ...modelProps, id: "0x3", classFullName: DisplayStyle2dState.classFullName }, iModel);
        const viewedModelId = "0x4";
        const view = new DrawingViewState({
          ...modelProps,
          id: "0x5",
          classFullName: DrawingViewState.classFullName,
          baseModelId: viewedModelId,
          categorySelectorId: categorySelector.id,
          displayStyleId: displayStyle.id,
          origin: { x: 0, y: 0 },
          delta: { x: 1, y: 1 },
          angle: 0,
        }, iModel, categorySelector, displayStyle, Range3d.createNull());

        expect(view.iModelRefs.primary.is2d()).toBe(true);
        expect(view.iModelRefs.primary.viewedModel).toBe(viewedModelId);
      } finally {
        iModel.closeSync();
      }
    });
  });

  describe("background map", () => {
    let viewport: ScreenViewport;
    function expectBackgroundMap(expected: boolean) {
      expect(viewport.viewFlags.backgroundMap).toEqual(expected);
    }

    function expectTerrain(expected: boolean) {
      expect(viewport.backgroundMap).toBeDefined(); // this is *never* undefined despite type annotation...
      expect(viewport.backgroundMap!.settings.applyTerrain).toEqual(expected);
    }

    beforeEach(() => {
      viewport = openBlankViewport();
      expectBackgroundMap(false);
      expectTerrain(false);

      viewport.viewFlags = viewport.viewFlags.with("backgroundMap", true);
      expectBackgroundMap(true);
      expectTerrain(false);
    });

    afterEach(() => {
      viewport[Symbol.dispose]();
    });

    it("updates when display style is assigned to", () => {
      viewport.viewFlags = viewport.viewFlags.with("backgroundMap", false);
      expectBackgroundMap(false);
      expectTerrain(false);

      const style = viewport.displayStyle;
      style.viewFlags = style.viewFlags.with("backgroundMap", true);
      style.settings.applyOverrides({ backgroundMap: { applyTerrain: true } });
      expectBackgroundMap(true);
      expectTerrain(true);

      style.settings.applyOverrides({ backgroundMap: { applyTerrain: false } });
      expectBackgroundMap(true);
      expectTerrain(false);
    });

    it("updates when settings are modified", () => {
      const style = viewport.displayStyle;
      style.viewFlags = style.viewFlags.with("backgroundMap", false);
      expectBackgroundMap(false);
      expectTerrain(false);

      style.viewFlags = style.viewFlags.with("backgroundMap", true);
      style.settings.applyOverrides({ backgroundMap: { applyTerrain: true } });
      expectBackgroundMap(true);
      expectTerrain(true);

      style.settings.applyOverrides({ backgroundMap: { applyTerrain: false } });
      expectBackgroundMap(true);
      expectTerrain(false);
    });
  });

  describe("read images", () => {
    interface TestCase {
      width: number;
      height?: number;
      image: ColorDef[];
      bgColor?: ColorDef;
    }

    class PointDecorator {
      public constructor(public readonly image: ColorDef[], public readonly width: number, public readonly height: number) {
        IModelApp.viewManager.addDecorator(this);
      }

      public decorate(context: DecorateContext): void {
        const builder = context.createGraphicBuilder(GraphicType.ViewOverlay);
        for (let x = 0; x < this.width; x++) {
          for (let y = 0; y < this.height; y++) {
            const color = this.image[x + y * this.width];
            builder.setSymbology(color, color, 1);
            builder.addPointString2d([new Point2d(x + 0.5, y + 0.5)], 0);
          }
        }

        context.addDecorationFromBuilder(builder);
      }
    }

    function test(testCase: TestCase, func: (viewport: ScreenViewport) => void): void {
      const decHeight = testCase.image.length / testCase.width;
      const rectHeight = testCase.height ?? decHeight;
      expect(rectHeight).toEqual(Math.floor(rectHeight));
      expect(decHeight).toEqual(Math.floor(decHeight));

      testBlankViewport({
        width: testCase.width,
        height: rectHeight,
        position: "absolute",
        test: (viewport) => {
          expect(viewport.viewRect.width).toEqual(testCase.width);
          expect(viewport.viewRect.height).toEqual(rectHeight);

          if (testCase.bgColor)
            viewport.displayStyle.backgroundColor = testCase.bgColor;

          const decorator = new PointDecorator(testCase.image, testCase.width, decHeight);
          try {
            viewport.renderFrame();
            func(viewport);
          } finally {
            IModelApp.viewManager.dropDecorator(decorator);
          }
        },
      });
    }

    function expectColors(image: ImageBuffer, expectedColors: ColorDef[]): void {
      expect(image.width * image.height).toEqual(expectedColors.length);
      expect(image.format).toEqual(ImageBufferFormat.Rgba);

      const expected = expectedColors.map((x) => x.tbgr.toString(16));
      const actual: string[] = [];
      for (let i = 0; i < expected.length; i++) {
        const offset = i * 4;
        actual.push(ColorDef.from(image.data[offset], image.data[offset + 1], image.data[offset + 2], 0xff - image.data[offset + 3]).tbgr.toString(16));
      }

      expect(actual).toEqual(expected);
    }

    const rgbw2: TestCase = {
      width: 2,
      image: [
        ColorDef.red, ColorDef.green,
        ColorDef.blue, ColorDef.white,
      ],
    };

    const purple = ColorDef.from(255, 0, 255);
    const cyan = ColorDef.from(0, 255, 255);
    const yellow = ColorDef.from(255, 255, 0);
    const grey = ColorDef.from(127, 127, 127);
    const transpBlack = ColorDef.black.withTransparency(0xff);
    const halfRed = ColorDef.from(0x80, 0, 0);

    const rgbwp1: TestCase = {
      width: 1,
      image: [ColorDef.red, ColorDef.green, ColorDef.blue, ColorDef.white, purple],
    };

    const rTransp50pct: TestCase = {
      width: 1,
      height: 2,
      image: [ColorDef.red.withTransparency(0x7f)],
      bgColor: transpBlack,
    };

    const rTransp100pct: TestCase = {
      ...rTransp50pct,
      image: [ColorDef.red.withTransparency(0xff)],
    };

    const square3: TestCase = {
      width: 3,
      image: [
        ColorDef.red, ColorDef.green, ColorDef.blue,
        ColorDef.white, ColorDef.black, grey,
        cyan, purple, yellow,
      ],
    };

    describe("readImageBuffer", () => {
      it("reads image right-side up by default", () => {
        test(rgbw2, (viewport) => {
          const image = viewport.readImageBuffer()!;
          expect(image).toBeDefined();
          expectColors(image, rgbw2.image);
        });
      });

      it("produces upside-down image if specified", () => {
        test(rgbw2, (viewport) => {
          const image = viewport.readImageBuffer({ upsideDown: true })!;
          expect(image).toBeDefined();
          expectColors(image, [ColorDef.blue, ColorDef.white, ColorDef.red, ColorDef.green]);
        });
      });

      it("does not invert view rect", () => {
        test(rgbwp1, (viewport) => {
          const image = viewport.readImageBuffer({ rect: new ViewRect(0, 1, 1, 3) })!;
          expect(image).toBeDefined();
          expectColors(image, [ColorDef.green, ColorDef.blue]);
        });
      });

      it("captures specified region", () => {
        test(square3, (viewport) => {
          const capture = (left: number, top: number, width: number, height: number, expected: ColorDef[]) => {
            const rect = new ViewRect(left, top, left + width, top + height);
            const image = viewport.readImageBuffer({ rect })!;
            expect(image).toBeDefined();
            expectColors(image, expected);
          };

          capture(0, 0, 3, 3, square3.image);
          capture(0, 0, 2, 2, [ColorDef.red, ColorDef.green, ColorDef.white, ColorDef.black]);
          capture(1, 1, 2, 2, [ColorDef.black, grey, purple, yellow]);
          capture(2, 0, 1, 3, [ColorDef.blue, grey, yellow]);
          capture(0, 2, 3, 1, [cyan, purple, yellow]);
          capture(1, 2, 1, 1, [purple]);
        });
      });

      it("rejects invalid capture rects", () => {
        test(rgbw2, (viewport) => {
          const expectNoImage = (left: number, top: number, right: number, bottom: number) => {
            expect(viewport.readImageBuffer({ rect: new ViewRect(left, top, right, bottom) })).toBeUndefined();
          };

          expectNoImage(0, 0, -1, -1);
          expectNoImage(0, 0, 100, 1);
          expectNoImage(0, 0, 1, 100);
          expectNoImage(100, 100, 1, 1);
          expectNoImage(1, 1, 1, 1);
        });
      });

      it("resizes", () => {
        test({ ...rgbw2, bgColor: grey }, (viewport) => {
          const resize = (w: number, h: number, expectedBarPixels?: { top?: number, bottom?: number, left?: number, right?: number }, expectedColors?: ColorDef[]) => {
            const image = viewport.readImageBuffer({ size: { x: w, y: h } })!;
            expect(image).toBeDefined();
            expect(image.width).toEqual(w);
            expect(image.height).toEqual(h);

            if (expectedColors)
              expectColors(image, expectedColors);

            const top = expectedBarPixels?.top ?? 0;
            const left = expectedBarPixels?.left ?? 0;
            const right = w - (expectedBarPixels?.right ?? 0);
            const bottom = h - (expectedBarPixels?.bottom ?? 0);

            for (let x = 0; x < w; x++) {
              for (let y = 0; y < h; y++) {
                const i = 4 * (x + y * w);
                const color = ColorDef.from(image.data[i], image.data[i + 1], image.data[i + 2], 0xff - image.data[i + 3]);
                expect(color.equals(grey)).toEqual(x < left || y < top || x >= right || y >= bottom);
              }
            }
          };

          resize(4, 4);
          resize(1, 1);
          resize(4, 2, { left: 1, right: 1 }, [
            grey, ColorDef.red, ColorDef.green, grey,
            grey, ColorDef.blue, ColorDef.white, grey,
          ]);
          resize(2, 4, { top: 1, bottom: 1 }, [
            grey, grey,
            ColorDef.red, ColorDef.green,
            ColorDef.blue, ColorDef.white,
            grey, grey,
          ]);
          resize(8, 4, { left: 2, right: 2 });
          resize(4, 8, { top: 2, bottom: 2 });
          resize(3, 2, { left: 1 });
          resize(2, 5, { top: 1, bottom: 2 }, [
            grey, grey,
            ColorDef.red, ColorDef.green,
            ColorDef.blue, ColorDef.white,
            grey, grey,
            grey, grey,
          ]);
        });
      });

      it("rejects invalid sizes", () => {
        test(rgbw2, (viewport) => {
          const expectNoImage = (width: number, height: number) => {
            expect(viewport.readImageBuffer({ size: { x: width, y: height } })).toBeUndefined();
          };

          expectNoImage(0, 1);
          expectNoImage(1, 0);
          expectNoImage(-1, 1);
          expectNoImage(1, -1);
        });
      });

      it("discards alpha by default", () => {
        test({ ...rTransp50pct, bgColor: undefined }, (viewport) => {
          const image = viewport.readImageBuffer()!;
          expect(image).toBeDefined();
          expectColors(image, [halfRed, ColorDef.black]);
        });

        test({ ...rTransp100pct, bgColor: undefined }, (viewport) => {
          const image = viewport.readImageBuffer()!;
          expect(image).toBeDefined();
          expectColors(image, [ColorDef.black, ColorDef.black]);
        });
      });

      it("preserves background alpha if background color is fully transparent", () => {
        test(rTransp50pct, (viewport) => {
          const image = viewport.readImageBuffer()!;
          expect(image).toBeDefined();
          expectColors(image, [halfRed, transpBlack]);
        });
      });

      it("doesn't preserve background alpha when resizing (canvas limitation)", () => {
        // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData#data_loss_due_to_browser_optimization
        test(rTransp50pct, (viewport) => {
          const image = viewport.readImageBuffer({ size: { x: 2, y: 4 } })!;
          expect(image).toBeDefined();
          for (let i = 3; i < 2 * 4 * 4; i += 4)
            expect(image.data[i]).toEqual(0xff);
        });
      });

      it("produces undefined if image is entirely transparent background pixels", () => {
        test(rTransp100pct, (viewport) => {
          expect(viewport.readImageBuffer()).toBeUndefined();
        });
      });
    });
  });

  describe("readPixels", () => {
    const activeDecorators: Decorator[] = [];
    function addDecorator(dec: Decorator) {
      IModelApp.viewManager.addDecorator(dec);
      activeDecorators.push(dec);
    }

    afterEach(() => {
      for (const dec of activeDecorators) {
        IModelApp.viewManager.dropDecorator(dec);
      }

      activeDecorators.length = 0;
    });

    it("returns undefined if viewport is disposed", () => {
      testBlankViewport((vp) => {
        vp.readPixels(vp.viewRect, Pixel.Selector.All, (pixels) => expect(pixels).toBeDefined());

        // BlankViewport.dispose also closes the iModel and removes the viewport's div from the DOM.
        // We don't want that until the test completes.
        const dispose = vp[Symbol.dispose];
        vp[Symbol.dispose] = ScreenViewport.prototype[Symbol.dispose];
        vp[Symbol.dispose]();

        vp.readPixels(vp.viewRect, Pixel.Selector.All, (pixels) => expect(pixels).toBeUndefined());

        vp[Symbol.dispose] = dispose;
      });
    });

    it("returns undefined if specified area is invalid", () => {
      testBlankViewport((vp) => {
        vp.readPixels(new ViewRect(10, 0, 50, 0), Pixel.Selector.All, (pixels) => expect(pixels).toBeUndefined());
        vp.readPixels(new ViewRect(0, 10, 0, 50), Pixel.Selector.All, (pixels) => expect(pixels).toBeUndefined());
      });
    });

    it("can filter out specified elements", () => {
      class SquareDecorator {
        private readonly _graphic: RenderGraphic;

        public constructor(z: number, id: string, vp: Viewport) {
          const pts = [
            new Point3d(-10, -10, z), new Point3d(10, -10, z), new Point3d(10, 10, z), new Point3d(-10, 10, z), new Point3d(-10, -10, z),
          ];
          vp.viewToWorldArray(pts);

          const builder = IModelApp.renderSystem.createGraphic({
            type: GraphicType.WorldDecoration,
            pickable: { id },
            computeChordTolerance: () => 0,
          });
          builder.addShape(pts);

          this._graphic = IModelApp.renderSystem.createGraphicOwner(builder.finish());
        }

        public decorate(context: DecorateContext): void {
          context.addDecoration(GraphicType.WorldDecoration, this._graphic);
        }
      }

      testBlankViewport((vp) => {
        addDecorator(new SquareDecorator(0, "0xa", vp));
        addDecorator(new SquareDecorator(-10, "0xb", vp));

        vp.renderFrame();

        let features = readUniqueFeatures(vp, undefined, undefined, undefined);
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xa"))).to.be.true;

        features = readUniqueFeatures(vp, undefined, undefined, ["0xa"]);
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xb"))).to.be.true;

        features = readUniqueFeatures(vp, undefined, undefined, undefined);
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xa"))).to.be.true;

        features = readUniqueFeatures(vp, undefined, undefined, ["0xb"]);
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xa"))).to.be.true;

        features = readUniqueFeatures(vp, undefined, undefined, ["0xa", "0xb"]);
        expect(features.length).to.equal(0);
      });
    });

    it("attributes graphics to the iModel supplied via the deprecated GraphicBranchOptions.iModel", () => {
      const otherIModel = createBlankConnection();
      try {
        testBlankViewport((vp) => {
          const pts = [
            new Point3d(-10, -10, 0), new Point3d(10, -10, 0), new Point3d(10, 10, 0), new Point3d(-10, 10, 0), new Point3d(-10, -10, 0),
          ];
          vp.viewToWorldArray(pts);

          const builder = IModelApp.renderSystem.createGraphic({
            type: GraphicType.WorldDecoration,
            pickable: { id: "0xa" },
            computeChordTolerance: () => 0,
          });
          builder.addShape(pts);

          const branch = new GraphicBranch(true);
          branch.add(builder.finish());
          const transformFromIModel = Transform.createTranslationXYZ(1, 2, 3);
          const graphic = IModelApp.renderSystem.createGraphicBranch(branch, Transform.identity, { iModel: otherIModel, transformFromIModel });
          const owner = IModelApp.renderSystem.createGraphicOwner(graphic);

          addDecorator({ decorate: (context) => context.addDecoration(GraphicType.WorldDecoration, owner) });
          vp.renderFrame();

          const readFeature = () => {
            let pixelFeature: Pixel.Data["feature"];
            vp.readPixels({
              selector: Pixel.Selector.Feature,
              receiver: (pixels) => {
                if (pixels) {
                  const coordinate = vp.cssPixelsToDevicePixels(1);
                  pixelFeature = pixels.getPixel(coordinate, coordinate).feature;
                }
              },
            });
            return pixelFeature;
          };

          const feature = readFeature();
          expect(feature).toBeDefined();
          expect(feature!.elementId).toBe("0xa");
          expect(feature!.iModelRef.iModel).toBe(otherIModel);
          expect(feature!.iModelRef).not.toBe(vp.iModelRefs.primary);
          expect(feature!.iModelRef.linearTransformToParent).toBe(transformFromIModel);

          // Attribution must be stable across frames.
          vp.invalidateScene();
          vp.renderFrame();
          expect(readFeature()!.iModelRef).toBe(feature!.iModelRef);
        });
      } finally {
        otherIModel.closeSync();
      }
    });

    it("inherits the deprecated iModel when a child branch supplies only transformFromIModel", () => {
      const otherIModel = createBlankConnection();
      try {
        testBlankViewport((vp) => {
          const pts = [
            new Point3d(-10, -10, 0), new Point3d(10, -10, 0), new Point3d(10, 10, 0), new Point3d(-10, 10, 0), new Point3d(-10, -10, 0),
          ];
          vp.viewToWorldArray(pts);

          const builder = IModelApp.renderSystem.createGraphic({
            type: GraphicType.WorldDecoration,
            pickable: { id: "0xa" },
            computeChordTolerance: () => 0,
          });
          builder.addShape(pts);

          // The deprecated options were inherited independently: the parent branch supplies the iModel, and the
          // child branch supplies only the transform used to adjust snap points.
          const inner = new GraphicBranch(true);
          inner.add(builder.finish());
          const transformFromIModel = Transform.createTranslationXYZ(1, 2, 3);
          const innerGraphic = IModelApp.renderSystem.createGraphicBranch(inner, Transform.identity, { transformFromIModel });

          const outer = new GraphicBranch(true);
          outer.add(innerGraphic);
          const outerGraphic = IModelApp.renderSystem.createGraphicBranch(outer, Transform.identity, { iModel: otherIModel });
          const owner = IModelApp.renderSystem.createGraphicOwner(outerGraphic);

          addDecorator({ decorate: (context) => context.addDecoration(GraphicType.WorldDecoration, owner) });
          vp.renderFrame();

          let feature: Pixel.Data["feature"];
          vp.readPixels({
            selector: Pixel.Selector.Feature,
            receiver: (pixels) => {
              if (pixels) {
                const coordinate = vp.cssPixelsToDevicePixels(1);
                feature = pixels.getPixel(coordinate, coordinate).feature;
              }
            },
          });

          expect(feature).toBeDefined();
          expect(feature!.elementId).toBe("0xa");
          expect(feature!.iModelRef.iModel).toBe(otherIModel);
          expect(feature!.iModelRef.linearTransformToParent).toBe(transformFromIModel);
        });
      } finally {
        otherIModel.closeSync();
      }
    });

    it("attributes tiles from a TiledGraphicsProvider's foreign iModel to that iModel", async () => {
      const foreignIModel = createBlankConnection();
      try {
        await testBlankViewportAsync(async (vp) => {
          const x = Math.floor(vp.viewRect.width / 2);
          const y = Math.floor(vp.viewRect.height / 2);
          const pts = [
            new Point3d(x - 10, y - 10, 0), new Point3d(x + 10, y - 10, 0), new Point3d(x + 10, y + 10, 0), new Point3d(x - 10, y + 10, 0), new Point3d(x - 10, y - 10, 0),
          ];
          vp.viewToWorldArray(pts);

          const modelId = foreignIModel.transientIds.getNext();
          const elemId = foreignIModel.transientIds.getNext();
          const builder = IModelApp.renderSystem.createGraphic({
            type: GraphicType.Scene,
            computeChordTolerance: () => 0,
            pickable: { id: elemId, modelId },
          });
          builder.addShape(pts);

          const ref = TileTreeReference.createFromRenderGraphic({
            iModel: foreignIModel,
            graphic: builder.finish(),
            modelId,
          });

          vp.addTiledGraphicsProvider({
            forEachTileTreeRef: (_vp, func) => func(ref),
            getReferences: () => [ref],
          });

          await ref.treeOwner.loadTree();
          await vp.waitForSceneCompletion();

          const findFeature = () => {
            for (const pixel of readUniquePixelData(vp))
              if (pixel.feature?.elementId === elemId)
                return pixel.feature;

            return undefined;
          };

          const feature = findFeature();
          expect(feature).toBeDefined();

          // The pixel must be attributed to the provider's iModel, not the viewport's primary iModel.
          expect(feature!.iModelRef.iModel).toBe(foreignIModel);
          expect(feature!.iModelRef.iModel).not.toBe(vp.iModel);
          expect(feature!.iModelRef).not.toBe(vp.iModelRefs.primary);

          // Attribution must be stable across frames.
          vp.invalidateScene();
          vp.renderFrame();
          const feature2 = findFeature();
          expect(feature2!.iModelRef).toBe(feature!.iModelRef);
        });
      } finally {
        await foreignIModel.close();
      }
    });

    it("scopes excluded elements to their IModelDisplayReference", () => {
      const linkedIModel = createBlankConnection();
      try {
        testBlankViewport((vp) => {
          const refs = vp.iModelRefs;
          if (!refs.isSpatial)
            throw new Error("Expected a spatial viewport");

          const linkedRef = refs.link({ iModel: linkedIModel });
          try {
            const createSquare = (z: number) => {
              const points = [
                new Point3d(-10, -10, z), new Point3d(10, -10, z), new Point3d(10, 10, z), new Point3d(-10, 10, z), new Point3d(-10, -10, z),
              ];
              vp.viewToWorldArray(points);

              const builder = IModelApp.renderSystem.createGraphic({
                type: GraphicType.WorldDecoration,
                pickable: { id: "0xa" },
                computeChordTolerance: () => 0,
              });
              builder.addShape(points);
              return IModelApp.renderSystem.createGraphicOwner(builder.finish());
            };

            const primaryGraphic = createSquare(0);
            const linkedBranch = new GraphicBranch(true);
            linkedBranch.add(createSquare(-10));
            const linkedGraphic = IModelApp.renderSystem.createGraphicBranch(linkedBranch, Transform.identity, { iModelRef: linkedRef });

            addDecorator({
              decorate: (context) => context.addDecoration(GraphicType.WorldDecoration, primaryGraphic),
            });
            addDecorator({
              decorate: (context) => context.addDecoration(GraphicType.WorldDecoration, linkedGraphic),
            });

            vp.renderFrame();

            const readVisibleReference = (excludedElements?: ReadPixelsArgs["excludedElements"]) => {
              let feature: Pixel.Data["feature"];
              vp.readPixels({
                selector: Pixel.Selector.Feature,
                excludedElements,
                receiver: (pixels) => {
                  if (pixels) {
                    const coordinate = vp.cssPixelsToDevicePixels(1);
                    feature = pixels.getPixel(coordinate, coordinate).feature;
                  }
                },
              });
              return feature?.iModelRef;
            };

            expect(readVisibleReference()).toBe(vp.iModelRefs.primary);
            expect(readVisibleReference(["0xa"])).toBe(linkedRef);
            expect(readVisibleReference([["0xa", linkedRef]])).toBe(vp.iModelRefs.primary);
            expect(readVisibleReference([["0xa", refs.primary]])).toBe(linkedRef);
            expect(readVisibleReference([["0xa", refs.primary], ["0xa", linkedRef]])).toBeUndefined();
            expect(readVisibleReference()).toBe(refs.primary);
          } finally {
            refs.unlink(linkedRef);
          }
        });
      } finally {
        linkedIModel.closeSync();
      }
    });

    it("can filter out specified elements within a single batch", () => {
      testBlankViewport((vp) => {
        const frontPts = [
          new Point3d(-10, -10, 0), new Point3d(10, -10, 0), new Point3d(10, 10, 0), new Point3d(-10, 10, 0), new Point3d(-10, -10, 0),
        ];
        const backPts = frontPts.map((pt) => new Point3d(pt.x, pt.y, -10));

        vp.viewToWorldArray(frontPts);
        vp.viewToWorldArray(backPts);

        const builder = IModelApp.renderSystem.createGraphic({
          type: GraphicType.WorldDecoration,
          pickable: { id: "0xc" },
          computeChordTolerance: () => 0,
        });

        builder.addShape(frontPts);
        builder.activateFeature(new Feature("0xd"));
        builder.addShape(backPts);

        const graphic = IModelApp.renderSystem.createGraphicOwner(builder.finish());
        addDecorator({
          decorate: (context) => context.addDecoration(GraphicType.WorldDecoration, graphic),
        });

        vp.renderFrame();

        let features = readUniqueFeatures(vp, undefined, undefined, undefined);
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xc"))).to.be.true;

        features = readUniqueFeatures(vp, undefined, undefined, undefined);
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xc"))).to.be.true;

        features = readUniqueFeatures(vp, undefined, undefined, ["0xd"]);
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xc"))).to.be.true;

        features = readUniqueFeatures(vp, undefined, undefined, ["0xc", "0xd"]);
        expect(features.length).to.equal(0);

        features = readUniqueFeatures(vp, undefined, undefined, ["0xc"]);
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xd"))).to.be.true;
      });
    });

    it("picks from the correct texture after toggling rendersToScreen", () => {
      class SquareDecorator {
        private readonly _graphic: RenderGraphic;

        public constructor(id: string, vp: Viewport) {
          const pts = [
            new Point3d(-50, -50, 0), new Point3d(50, -50, 0), new Point3d(50, 50, 0), new Point3d(-50, 50, 0), new Point3d(-50, -50, 0),
          ];
          vp.viewToWorldArray(pts);

          const builder = IModelApp.renderSystem.createGraphic({
            type: GraphicType.WorldDecoration,
            pickable: { id },
            computeChordTolerance: () => 0,
          });
          builder.addShape(pts);

          this._graphic = IModelApp.renderSystem.createGraphicOwner(builder.finish());
        }

        public decorate(context: DecorateContext): void {
          context.addDecoration(GraphicType.WorldDecoration, this._graphic);
        }
      }

      testBlankViewport((vp) => {
        addDecorator(new SquareDecorator("0xa", vp));
        vp.renderFrame();

        // Simulate switching back to on-screen rendering, for example after a secondary viewport is closed
        vp.rendersToScreen = false;
        vp.rendersToScreen = true;

        const features = readUniqueFeatures(vp, new ViewRect(0, 0, 8, 8));
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xa"))).to.be.true;
      });
    });
  });

  describe("contour overrides", () => {
    it("keeps planar classifiers distinct for references with the same model Id", () => {
      const linkedIModel = createBlankConnection();
      try {
        testBlankViewport((vp) => {
          const refs = vp.iModelRefs;
          if (!refs.isSpatial)
            throw new Error("Expected a spatial viewport");

          const linkedRef = refs.link({ iModel: linkedIModel });
          const classifier = { setSource: vi.fn() } as any;
          vi.spyOn(vp.target, "getPlanarClassifier").mockReturnValue(undefined);
          vi.spyOn(vp.target, "createPlanarClassifier").mockReturnValue(classifier);

          const primaryContext = new SceneContext(vp);
          const linkedContext = new SceneContext({ viewport: vp, iModelRef: linkedRef });
          primaryContext.addPlanarClassifier("0x123");
          linkedContext.addPlanarClassifier("0x123");

          expect(primaryContext.planarClassifiers.size).toBe(1);
          expect(linkedContext.planarClassifiers.size).toBe(1);
          expect([...primaryContext.planarClassifiers.keys()][0]).not.toBe([...linkedContext.planarClassifiers.keys()][0]);

          refs.unlink(linkedRef);
        });
      } finally {
        linkedIModel.closeSync();
      }
    });

    it("uses reference-specific contours and falls back to the display style", () => {
      const linkedIModel = createBlankConnection();
      try {
        testBlankViewport((vp) => {
          const refs = vp.iModelRefs;
          if (!refs.isSpatial)
            throw new Error("Expected a spatial viewport");

          const linkedRef = refs.link({ iModel: linkedIModel });
          const displayStyleContours = ContourDisplay.create({ displayContours: true, groups: [ContourGroup.create()] });
          const linkedContours = ContourDisplay.create({ displayContours: false, groups: [ContourGroup.create()] });
          if (!vp.view.isSpatialView())
            throw new Error("Expected a spatial viewport");

          vp.view.getDisplayStyle3d().settings.contours = displayStyleContours;

          expect(refs.primary.activeContours).toBe(displayStyleContours);
          expect(linkedRef.activeContours).toBe(displayStyleContours);

          let activeContoursChanged = 0;
          linkedRef.onActiveContoursChanged.addListener(() => activeContoursChanged++);
          linkedRef.overrides.contours = linkedContours;

          expect(linkedRef.activeContours).toBe(linkedContours);
          expect(refs.primary.activeContours).toBe(displayStyleContours);
          expect(activeContoursChanged).toBe(1);

          vp.renderFrame();
          const target = vp.target as Target;
          expect(target.currentContours).toBe(displayStyleContours);

          const graphic = IModelApp.renderSystem.createGraphicBranch(new GraphicBranch(), Transform.identity, { iModelRef: linkedRef });
          expect(graphic).toBeInstanceOf(Branch);
          target.pushBranch(graphic as Branch);
          expect(target.currentContours).toBe(linkedContours);
          target.popBranch();
          expect(target.currentContours).toBe(displayStyleContours);

          linkedRef.overrides.contours = undefined;
          expect(linkedRef.activeContours).toBe(displayStyleContours);
          expect(activeContoursChanged).toBe(2);
          refs.unlink(linkedRef);
        });
      } finally {
        linkedIModel.closeSync();
      }
    });
  });

  describe("Map layers", () => {
    // Issue #4436
    it("ignores map layer with invalid format Id", async () => {
      await testBlankViewportAsync(async (vp) => {
        const settings = ImageMapLayerSettings.fromJSON({
          formatId: "BadFormat",
          url: "https://sampleUrl",
          name: "test",
          subLayers: [{ id: 0, name: "test", visible: true }],
        });

        // Set the base map to solid color so no Bing maps requests are made, and potentially hang the test.
        vp.displayStyle.backgroundMapBase = ColorDef.black;
        vp.viewFlags = vp.viewFlags.with("backgroundMap", true);

        expect(() => vp.displayStyle.attachMapLayer({ settings, mapLayerIndex: { isOverlay: false, index: -1 } })).not.toThrow();
        await vp.waitForSceneCompletion();
      });
    });
  });

  describe("Pixel selection", () => {
    it("isPixelSelectable should return false when no map-layers ids", () => {
      testBlankViewport((vp) => {
        const stub = vi.spyOn(Viewport.prototype, "mapLayerFromIds").mockImplementation(function (_mapTreeId: Id64String, _layerTreeId: Id64String) {
          return [];
        });
        const fakePixelData = { modelId: "123", elementId: "456" };
        expect(vp.isPixelSelectable(fakePixelData as any)).toBe(true);
        stub.mockRestore();
      });
    });
  });

  function createViewport(): ScreenViewport {
    const state = SpatialViewState.createBlank(createBlankConnection(), { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })
    const parentDiv = document.createElement("div");
    parentDiv.setAttribute("height", "1px");
    parentDiv.setAttribute("width", "1px");
    parentDiv.style.height = parentDiv.style.width = "1px";
    document.body.appendChild(parentDiv);
    return ScreenViewport.create(parentDiv, state);
  }

  describe("Read Image To Canvas", () => {

    class PixelCanvasDecoration implements CanvasDecoration {
      public drawDecoration(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = "red";
        ctx.fillRect(0, 0, 1, 1);
      }
    }

    class PixelCanvasDecorator implements Decorator {
      public decorate(context: DecorateContext) {

        const builder = context.createGraphicBuilder(GraphicType.WorldDecoration, undefined);
        context.addDecorationFromBuilder(builder);
        context.addCanvasDecoration(new PixelCanvasDecoration());
      }
    }

    const activeDecorators: Decorator[] = [];
    function addDecorator(dec: Decorator) {
      IModelApp.viewManager.addDecorator(dec);
      activeDecorators.push(dec);
    }

    afterEach(() => {
      for (const dec of activeDecorators) {
        IModelApp.viewManager.dropDecorator(dec);
      }

      activeDecorators.length = 0;
    });

    it("should not include canvas decorations if omitCanvasDecorations is true", () => {
      const vp = createViewport();
      IModelApp.viewManager.addViewport(vp);
      addDecorator(new PixelCanvasDecorator());
      vp.renderFrame();

      const readImageOptions: ReadImageToCanvasOptions = {
        omitCanvasDecorations: true,
      };

      expect(vp.rendersToScreen).to.be.true;
      const canvas = vp.readImageToCanvas(readImageOptions);
      const ctx = canvas.getContext("2d");
      const pixel = ctx!.getImageData(0, 0, 1, 1).data;
      const rgb = [pixel[0], pixel[1], pixel[2]];
      expect(rgb).toEqual([0, 0, 0]);

      IModelApp.viewManager.dropViewport(vp);
    });


    it("should include canvas decorations if omitCanvasDecorations is false or undefined", () => {
      const vp = createViewport();
      IModelApp.viewManager.addViewport(vp);
      addDecorator(new PixelCanvasDecorator());
      vp.renderFrame();

      let readImageOptions: ReadImageToCanvasOptions = {
        omitCanvasDecorations: false,
      };

      expect(vp.rendersToScreen).to.be.true;
      let canvas = vp.readImageToCanvas(readImageOptions);
      let ctx = canvas.getContext("2d");
      let pixel = ctx!.getImageData(0, 0, 1, 1).data;
      let rgb = [pixel[0], pixel[1], pixel[2]];
      expect(rgb).toEqual([255, 0, 0]);

      readImageOptions = {
        omitCanvasDecorations: undefined,
      };

      canvas = vp.readImageToCanvas(readImageOptions);
      ctx = canvas.getContext("2d");
      pixel = ctx!.getImageData(0, 0, 1, 1).data;
      rgb = [pixel[0], pixel[1], pixel[2]];
      expect(rgb).toEqual([255, 0, 0]);

      IModelApp.viewManager.dropViewport(vp);
    });

    it("should not include canvas decorations if omitCanvasDecorations is true with multiple viewports", () => {
      const vp = createViewport();
      const vp2 = createViewport();
      IModelApp.viewManager.addViewport(vp);
      IModelApp.viewManager.addViewport(vp2);

      addDecorator(new PixelCanvasDecorator());
      vp.renderFrame();
      vp2.renderFrame();

      const readImageOptions: ReadImageToCanvasOptions = {
        omitCanvasDecorations: true,
      };

      expect(vp.rendersToScreen).to.be.false;
      let canvas = vp.readImageToCanvas(readImageOptions);
      let ctx = canvas.getContext("2d");
      let pixel = ctx!.getImageData(0, 0, 1, 1).data;
      let rgb = [pixel[0], pixel[1], pixel[2]];
      expect(rgb).toEqual([0, 0, 0]);

      expect(vp2.rendersToScreen).to.be.false;
      canvas = vp2.readImageToCanvas(readImageOptions);
      ctx = canvas.getContext("2d");
      pixel = ctx!.getImageData(0, 0, 1, 1).data;
      rgb = [pixel[0], pixel[1], pixel[2]];
      expect(rgb).toEqual([0, 0, 0]);

      IModelApp.viewManager.dropViewport(vp);
      IModelApp.viewManager.dropViewport(vp2);
    });


    it("should include canvas decorations if omitCanvasDecorations is false or undefined with multiple viewports", () => {
      const vp = createViewport();
      const vp2 = createViewport();
      IModelApp.viewManager.addViewport(vp);
      IModelApp.viewManager.addViewport(vp2);

      addDecorator(new PixelCanvasDecorator());
      vp.renderFrame();
      vp2.renderFrame();

      let readImageOptions: ReadImageToCanvasOptions = {
        omitCanvasDecorations: false,
      };

      expect(vp.rendersToScreen).to.be.false;
      let canvas = vp.readImageToCanvas(readImageOptions);
      let ctx = canvas.getContext("2d");
      let pixel = ctx!.getImageData(0, 0, 1, 1).data;
      let rgb = [pixel[0], pixel[1], pixel[2]];
      expect(rgb).toEqual([255, 0, 0]);

      readImageOptions = {
        omitCanvasDecorations: undefined,
      };

      expect(vp2.rendersToScreen).to.be.false;
      canvas = vp2.readImageToCanvas(readImageOptions);
      ctx = canvas.getContext("2d");
      pixel = ctx!.getImageData(0, 0, 1, 1).data;
      rgb = [pixel[0], pixel[1], pixel[2]];
      expect(rgb).toEqual([255, 0, 0]);

      IModelApp.viewManager.dropViewport(vp);
      IModelApp.viewManager.dropViewport(vp2);
    });
  });

  describe("Cached decorations", () => {
    let vp: ScreenViewport;
    let dec: Decorator;

    beforeAll(() => {
      vp = createViewport();
      IModelApp.viewManager.addViewport(vp);

      dec = {
        useCachedDecorations: true as const,
        decorate: (context: DecorateContext) => {
          context.addHtmlDecoration(document.createElement("div"));
        },
      };

      IModelApp.viewManager.addDecorator(dec);
    });

    afterAll(() => {
      IModelApp.viewManager.dropViewport(vp);
      IModelApp.viewManager.dropDecorator(dec);
    });

    function test(expectCacheClear: boolean, operation: () => void): void {
      const isCacheEmpty = () => {
        const cache = (vp as any)._decorationCache as DecorationsCache;
        expect(cache.size).not.to.be.undefined;
        return cache.size === 0;
      }

      // Ensure decorations are generated and cached.
      vp.renderFrame();
      expect(isCacheEmpty()).to.be.false;

      // Ensure cache is cleared or preserved after operation is performed.
      operation();
      expect(isCacheEmpty()).to.equal(expectCacheClear);

      // Ensure decorations are regenerated and cached.
      vp.renderFrame();
      expect(isCacheEmpty()).to.be.false;
    }

    it("are invalidated when always/never-drawn elements change", () => {
      function makeIdSet(id: string): Set<string> {
        return new Set<string>([id]);
      }

      test(false, () => { });

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      test(true, () => vp.setNeverDrawn(makeIdSet("0x123")));
      // It doesn't check if the contents of the set match the previous contents.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      test(true, () => vp.setNeverDrawn(makeIdSet("0x123")));
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      test(true, () => vp.clearNeverDrawn());
      // No-op because never-drawn is already empty.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      test(false, () => vp.clearNeverDrawn());

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      test(true, () => vp.setAlwaysDrawn(makeIdSet("0x123")));
      // It doesn't check if the contents of the set match the previous contents.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      test(true, () => vp.setAlwaysDrawn(makeIdSet("0x123")));
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      test(true, () => vp.clearAlwaysDrawn());
      // No-op because always-drawn is already empty
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      test(false, () => vp.clearAlwaysDrawn());

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      test(true, () => vp.setAlwaysDrawn(makeIdSet("0x123"), true));
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      expect(vp.isAlwaysDrawnExclusive).to.be.true;
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      test(true, () => vp.clearAlwaysDrawn());
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      expect(vp.isAlwaysDrawnExclusive).to.be.false;
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      test(false, () => vp.clearAlwaysDrawn());

      test(true, () => vp.primaryIModelRef.neverDrawnElements.add("0x123"));
      test(true, () => vp.primaryIModelRef.neverDrawnElements.delete("0x123"));
      test(true, () => vp.primaryIModelRef.alwaysDrawnElements.add("0x123"));
      test(true, () => vp.primaryIModelRef.alwaysDrawnElements.delete("0x123"));
      test(true, () => vp.primaryIModelRef.isAlwaysDrawnExclusive = true);
      test(true, () => vp.primaryIModelRef.isAlwaysDrawnExclusive = false);
    });

    it("are invalidated when symbology overrides change", () => {
      test(true, () => vp.setFeatureOverrideProviderChanged());
    });

    it("are invalidated when excluded elements change", () => {
      test(true, () => vp.displayStyle.settings.addExcludedElements("0x123"));
      // It doesn't try to detect no-ops.
      test(true, () => vp.displayStyle.settings.addExcludedElements("0x123"));
      test(true, () => vp.displayStyle.settings.addExcludedElements("0x456"));
      test(true, () => vp.displayStyle.settings.dropExcludedElements("0x456"));
      test(true, () => vp.displayStyle.settings.clearExcludedElements());
      test(true, () => vp.displayStyle.settings.clearExcludedElements());
    });
  });
});
