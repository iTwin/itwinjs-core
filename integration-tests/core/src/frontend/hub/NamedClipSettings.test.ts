/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection, MockRender, ScreenViewport, SpatialViewState, StandardViewId, ViewClipDecorationProvider, ViewClipSettingsProvider, SavedClipEntry, IModelApp, ViewClipTool, Viewport, ClipOrientation, ClipEventType, ActiveClipStatus } from "@bentley/imodeljs-frontend";
import { assert } from "chai";
import { SettingsStatus, ImsTestAuthorizationClient, ConnectSettingsClient } from "@bentley/imodeljs-clients";
import { ClientRequestContext, LogLevel, Logger, GuidString } from "@bentley/bentleyjs-core";
import { TestUsers } from "./TestUsers";
import { TestUtility } from "./TestUtility";
import { Point3d, Plane3dByOriginAndUnitNormal, ConvexClipPlaneSet, ClipPlane, ClipPrimitive, ClipVector } from "@bentley/geometry-core";

function createViewDiv() {
  const div = document.createElement("div") as HTMLDivElement;
  assert(null !== div);
  div!.style.width = div!.style.height = "1000px";
  document.body.appendChild(div!);
  return div;
}

export class NamedClipTestUtils {
  public static async cleanExistingSettings(imodel: IModelConnection, shared: boolean, provider: ViewClipSettingsProvider): Promise<void> {
    provider.clearActiveClipIdAllViews();
    const settings: SavedClipEntry[] = [];
    const getStatus = await provider.getSettings(settings, imodel, shared);
    assert.isTrue(SettingsStatus.Success === getStatus || SettingsStatus.SettingNotFound === getStatus, "clean - getSettings should return Success or SettingNotFound");
    if (SettingsStatus.Success !== getStatus || 0 === settings.length)
      return;
    for (const entry of settings) {
      const delStatus = await provider.deleteClip(imodel, entry.shared, entry.id);
      assert.isTrue(SettingsStatus.Success === delStatus, "clean - deleteClip should return Success");
    }
  }

  public static createClipPlane(viewport: Viewport, orientation: ClipOrientation, origin: Point3d, planeSet: ConvexClipPlaneSet): ClipVector | undefined {
    const normal = ViewClipTool.getPlaneInwardNormal(orientation, viewport);
    assert.isFalse(undefined === normal, "get clip plane normal from standard view");
    const plane = Plane3dByOriginAndUnitNormal.create(origin, normal!);
    assert.isFalse(undefined === plane, "get clip plane from normal");
    planeSet.addPlaneToConvexSet(ClipPlane.createPlane(plane!));
    const prim = ClipPrimitive.createCapture(planeSet);
    const clip = ClipVector.createEmpty();
    clip.appendClone(prim);
    return clip;
  }

  public static setClipPlane(viewport: Viewport, orientation: ClipOrientation, origin: Point3d, clearExistingPlanes: boolean): boolean {
    const normal = ViewClipTool.getPlaneInwardNormal(orientation, viewport);
    assert.isFalse(undefined === normal, "get clip plane normal from standard view");
    const status = ViewClipTool.doClipToPlane(viewport, origin, normal!, clearExistingPlanes);
    assert.isTrue(status, "added plane to existing clip");
    return true;
  }
}

describe("ViewClipDecorationProvider (#integration)", () => {
  let imodel: IModelConnection;
  let viewState: SpatialViewState;
  const viewDiv = createViewDiv();
  const viewClipDecoProvider = ViewClipDecorationProvider.create();

  before(async () => {
    MockRender.App.startup();

    Logger.initializeToConsole();
    Logger.setLevel("imodeljs-frontend.IModelConnection", LogLevel.Error); // Change to trace to debug

    const settingsClient = new ConnectSettingsClient("");
    const requestContext = new ClientRequestContext();
    const baseUrl: string = await settingsClient.getUrl(requestContext);
    const imsTestAuthorizationClient = new ImsTestAuthorizationClient();
    await imsTestAuthorizationClient.signIn(requestContext, TestUsers.regular, baseUrl);
    IModelApp.authorizationClient = imsTestAuthorizationClient;

    const testProjectId = await TestUtility.getTestProjectId("iModelJsIntegrationTest");
    const testIModelId = await TestUtility.getTestIModelId(testProjectId, "ConnectionReadTest");
    imodel = await IModelConnection.open(testProjectId, testIModelId);

    const viewDefinitions = await imodel.views.getViewList({ from: "BisCore.OrthographicViewDefinition" });
    assert.isAtLeast(viewDefinitions.length, 1, "found a view definition");
    const firstViewState = await imodel.views.load(viewDefinitions[0].id) as SpatialViewState;
    assert.exists(firstViewState, "found a spatial view");
    viewState = firstViewState!;
    viewState.setStandardRotation(StandardViewId.Top);

    viewClipDecoProvider.settings.namespace = "imodeljs-NamedClipVectors-Integration-Tests";
  });

  after(async () => {
    if (imodel) await imodel.close();
    MockRender.App.shutdown();
  });

  it("test user setttings", async () => {
    const shared = false;
    const viewport = ScreenViewport.create(viewDiv!, viewState.clone());
    await NamedClipTestUtils.cleanExistingSettings(viewport.iModel, shared, viewClipDecoProvider.settings); // Cleanup previous test runs...

    // Create some new saved clips...
    const clipIds: GuidString[] = [];
    const nClips = 3;
    const planeSet = ConvexClipPlaneSet.createEmpty();
    for (let iPlane = 0; iPlane < nClips; iPlane++) {
      const clip = NamedClipTestUtils.createClipPlane(viewport, iPlane, Point3d.create(), planeSet);
      assert.isFalse(undefined === clip, "created new clip vector with additional plane added");
      const newId = await viewClipDecoProvider.settings.newClip(viewport.iModel, shared, clip!);
      assert.isFalse(undefined === newId, "clip successfully saved");
      clipIds.push(newId!);
    }
    assert.isTrue(clipIds.length === nClips, "created correct number of saved clips");

    // Test clip settings cache...
    for (let iClip = 0; iClip < nClips; iClip++) {
      const clip = await viewClipDecoProvider.settings.getClip(viewport.iModel, shared, clipIds[iClip]);
      assert.isFalse(undefined === clip, "cached - retrieved clip");
      const clipPlanes = ViewClipTool.isSingleConvexClipPlaneSet(clip!);
      assert.isFalse(undefined === clipPlanes, "cached - retrieved clip planes from clip");
      assert.isTrue(clipPlanes!.planes.length === iClip + 1, "cached - has correct number of clip planes");
    }

    // Test populating cache from settings...
    viewClipDecoProvider.settings.clearActiveClipIdAllViews(); // clear cache to test getClip from settings...
    for (let iClip = 0; iClip < nClips; iClip++) {
      const clip = await viewClipDecoProvider.settings.getClip(viewport.iModel, shared, clipIds[iClip]);
      assert.isFalse(undefined === clip, "uncached - retrieved clip");
      const clipPlanes = ViewClipTool.isSingleConvexClipPlaneSet(clip!);
      assert.isFalse(undefined === clipPlanes, "uncached - retrieved clip planes from clip");
      assert.isTrue(clipPlanes!.planes.length === iClip + 1, "uncached - has correct number of clip planes");
    }

    // Test rename and copy...
    for (let iClip = 0; iClip < nClips; iClip++) {
      const status = await viewClipDecoProvider.settings.renameClip(viewport.iModel, shared, clipIds[iClip], iClip.toString());
      assert.isTrue(SettingsStatus.Success === status, "clip successfully renamed");
      const copyId = await viewClipDecoProvider.settings.copyClip(viewport.iModel, shared, clipIds[iClip], shared, (nClips + iClip).toString());
      assert.isFalse(undefined === copyId, "clip successfully copied");
      clipIds.push(copyId!);
    }

    // Test getSettings...
    const settings: SavedClipEntry[] = [];
    const getStatus = await viewClipDecoProvider.settings.getSettings(settings, viewport.iModel, shared);
    assert.isTrue(SettingsStatus.Success === getStatus, "getSettings should return Success");
    assert.isTrue(nClips * 2 === settings.length, "getSettings returned expected number of settings");
    for (const entry of settings) {
      const index = clipIds.indexOf(entry.id);
      assert.isTrue(-1 !== index && entry.name === index.toString(), "found clip id with expected name");
    }
  });

  it("test active view clip", async () => {
    const shared = false;
    const viewport = ScreenViewport.create(viewDiv!, viewState.clone());
    await NamedClipTestUtils.cleanExistingSettings(viewport.iModel, shared, viewClipDecoProvider.settings); // Cleanup previous test runs...

    assert.isTrue(ActiveClipStatus.None === viewClipDecoProvider.settings.getActiveClipStatus(viewport));
    const allEvents: ClipEventType[] = [];
    const allStatus: ActiveClipStatus[] = [];
    const removeActiveClipListener = viewClipDecoProvider.onActiveClipChanged.addListener((vp: Viewport, eventType: ClipEventType, provider: ViewClipDecorationProvider) => {
      allEvents.push(eventType);
      allStatus.push(provider.settings.getActiveClipStatus(vp));
    });

    // Create a new view clip...
    NamedClipTestUtils.setClipPlane(viewport, ClipOrientation.Top, Point3d.create(), true);
    viewClipDecoProvider.onNewClipPlane(viewport);
    assert.isTrue(1 === allEvents.length && ClipEventType.NewPlane === allEvents[0]);
    assert.isTrue(1 === allStatus.length && ActiveClipStatus.Unsaved === allStatus[0]);

    // Modify unnamed active view clip...
    NamedClipTestUtils.setClipPlane(viewport, ClipOrientation.Top, Point3d.create(0, 0, 1), true);
    viewClipDecoProvider.onModifyClip(viewport);
    assert.isTrue(2 === allEvents.length && ClipEventType.Modify === allEvents[1]);
    assert.isTrue(2 === allStatus.length && ActiveClipStatus.Unsaved === allStatus[1]);

    // Create new named clip from active view clip...
    const topId = await viewClipDecoProvider.settings.saveActiveClip(viewport, shared, "Top");
    assert.isFalse(undefined === topId, "active view clip successfully saved");
    assert.isTrue(ActiveClipStatus.Saved === viewClipDecoProvider.settings.getActiveClipStatus(viewport));

    // Verify that calling save is a no-op when the active named clip isn't modified...
    const activeId = await viewClipDecoProvider.settings.saveActiveClip(viewport, shared);
    assert.isTrue(activeId === topId, "named view clip unchanged");
    assert.isTrue(ActiveClipStatus.Saved === viewClipDecoProvider.settings.getActiveClipStatus(viewport));

    // Modify named active view clip...
    NamedClipTestUtils.setClipPlane(viewport, ClipOrientation.Top, Point3d.create(0, 0, 2), true);
    viewClipDecoProvider.onModifyClip(viewport);
    assert.isTrue(3 === allEvents.length && ClipEventType.Modify === allEvents[2]);
    assert.isTrue(3 === allStatus.length && ActiveClipStatus.Modified === allStatus[2]);

    // Verify that calling save updates an active named clip that is modified...
    const updateId = await viewClipDecoProvider.settings.saveActiveClip(viewport, shared);
    assert.isTrue(activeId === updateId, "named view clip updated");
    assert.isTrue(ActiveClipStatus.Saved === viewClipDecoProvider.settings.getActiveClipStatus(viewport));

    // Clear active view clip...
    const clearClip = ViewClipTool.doClipClear(viewport);
    assert.isTrue(clearClip, "clear view clip");
    viewClipDecoProvider.onClearClip(viewport);
    assert.isTrue(4 === allEvents.length && ClipEventType.Clear === allEvents[3]);
    assert.isTrue(4 === allStatus.length && ActiveClipStatus.None === allStatus[3]);

    // Make saved clip the active view clip...
    const activateStatus = await viewClipDecoProvider.settings.activateSavedClip(viewport, topId!, shared);
    assert.isTrue(SettingsStatus.Success === activateStatus, "make named clip active view clip");
    assert.isTrue(5 === allEvents.length && ClipEventType.Activate === allEvents[4]);
    assert.isTrue(5 === allStatus.length && ActiveClipStatus.Saved === allStatus[4]);

    // Create a new "front" clip plane...
    const planeSetF = ConvexClipPlaneSet.createEmpty();
    const frontClip = NamedClipTestUtils.createClipPlane(viewport, ClipOrientation.Front, Point3d.create(), planeSetF);
    assert.isFalse(undefined === frontClip, "created front clip plane");
    const frontId = await viewClipDecoProvider.settings.newClip(viewport.iModel, shared, frontClip!, "Front");
    assert.isFalse(undefined === frontId, "front clip plane successfully saved");

    // Create a new "right" clip plane...
    const planeSetR = ConvexClipPlaneSet.createEmpty();
    const rightClip = NamedClipTestUtils.createClipPlane(viewport, ClipOrientation.Right, Point3d.create(), planeSetR);
    assert.isFalse(undefined === rightClip, "created right clip plane");
    const rightId = await viewClipDecoProvider.settings.newClip(viewport.iModel, shared, rightClip!, "Right");
    assert.isFalse(undefined === rightId, "right clip plane successfully saved");

    // Test setting view clip by combining named clips that are all single plane...
    const allSinglePlanes = await viewClipDecoProvider.settings.areSavedClipPlanes(viewport.iModel, [topId!, frontId!, rightId!], [shared, shared, shared]);
    assert.isTrue(allSinglePlanes, "saved clips are all a single clip plane");
    const activatePlanesStatus = await viewClipDecoProvider.settings.activateSavedClipPlanes(viewport, [topId!, frontId!, rightId!], [shared, shared, shared]);
    assert.isTrue(SettingsStatus.Success === activatePlanesStatus, "make named single clip planes the active view clip");
    assert.isTrue(6 === allEvents.length && ClipEventType.Activate === allEvents[5]);
    assert.isTrue(6 === allStatus.length && ActiveClipStatus.Unsaved === allStatus[5]);

    // Test getSettings...
    const settings: SavedClipEntry[] = [];
    const getStatus = await viewClipDecoProvider.settings.getSettings(settings, viewport.iModel, shared);
    assert.isTrue(SettingsStatus.Success === getStatus, "getSettings should return Success");
    assert.isTrue(3 === settings.length, "getSettings returned expected number of settings");
    for (const entry of settings) {
      if (entry.id === topId)
        assert.isTrue(entry.name === "Top", "found Top");
      else if (entry.id === frontId)
        assert.isTrue(entry.name === "Front", "found Front");
      else if (entry.id === rightId)
        assert.isTrue(entry.name === "Right", "found Right");
      else
        assert(false, "Unexpected saved clip found");
    }

    removeActiveClipListener();
  });

});
