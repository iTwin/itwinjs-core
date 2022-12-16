/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  ClipPrimitive, ClipVector, ConvexClipPlaneSet, IndexedPolyface, Point3d, PolyfaceBuilder, UnionOfConvexClipPlaneSets,
} from "@itwin/core-geometry";
import {
  ElementMeshOptions, readElementMeshes,
} from "@itwin/core-common";
import {
  BeButtonEvent, CoordinateLockOverrides, EventHandled, IModelApp, LocateResponse, ViewClipTool, Viewport,
} from "@itwin/core-frontend";
import {
  ConvexMeshDecomposition, Options as DecompositionOptions,
} from "vhacd-js";

/** Settings that control the behavior of the ViewClipByElementGeometryTool. */
interface Settings extends ElementMeshOptions {
  /** If true, produce convex hulls from the element geometry. Convex hulls are required for proper clipping; if this is
   * set to false, make sure to only select elements that already have convex geometry.
   */
  computeConvexHulls: boolean;
  /** Options used to produce convex hulls, if computeConvexHulls is true. */
  decomposition: DecompositionOptions;
  /** An offset in meters by which to expand or contract the surfaces of the clipping polyfaces.
   * This is useful primarily for expanding the clipped volume slightly so that the element(s) from which the clip was produced are not clipped out.
   * ###TODO Awaiting an API that will apply the offset - unused for now.
   */
  offset?: number;
}

/** Uses vhacd-js to convert IndexedPolyfaces to convex IndexedPolyfaces. */
class ConvexDecomposer {
  private readonly _impl: ConvexMeshDecomposition;
  private readonly _opts: DecompositionOptions;

  private constructor(impl: ConvexMeshDecomposition, options: DecompositionOptions) {
    this._impl = impl;
    this._opts = options;
  }

  public static async create(options: DecompositionOptions): Promise<ConvexDecomposer> {
    const impl = await ConvexMeshDecomposition.create();
    return new ConvexDecomposer(impl, options);
  }

  public decompose(polyfaces: IndexedPolyface[]): IndexedPolyface[] {
    const decomposedPolyfaces: IndexedPolyface[] = [];
    const polygon = [new Point3d(), new Point3d(), new Point3d()];

    for (const polyface of polyfaces) {
      const points = polyface.data.point;

      // `points` is a GrowableXYZArray, which may allocate more space than it needs for the number of points it stores.
      // Make sure to only pass the used portion of the allocation to vhacd-js.
      const positions = new Float64Array(points.float64Data().buffer, 0, points.float64Length);

      // Unfortunately we must copy the indices rather than passing them directly to vhacd-js.
      const indices = new Uint32Array(polyface.data.pointIndex);
      if (indices.length === 0 || positions.length === 0)
        continue;

      // Decompose the polyface into any number of convex hulls.
      const meshes = this._impl.computeConvexHulls({ positions, indices }, this._opts);

      // Convert each hull into a polyface.
      for (const mesh of meshes) {
        const builder = PolyfaceBuilder.create();
        for (let i = 0; i < mesh.indices.length; i += 3) {
          for (let j = 0; j < 3; j++)
            this.getPoint(mesh.indices[i + j], mesh.positions, polygon[j]);

          builder.addPolygon(polygon);
        }

        decomposedPolyfaces.push(builder.claimPolyface());
      }
    }

    return decomposedPolyfaces;
  }

  private getPoint(index: number, positions: Float64Array, output: Point3d): void {
    index *= 3;
    output.set(positions[index + 0], positions[index + 1], positions[index + 2]);
  }
}

// For demo purposes, settings are global and the only way to change them is to edit the code below.
const settings: Settings = {
  computeConvexHulls: true,
  chordTolerance: 0.1,
  decomposition: {
    maxHulls: 10,
    maxVerticesPerHull: 16,
  },
};

/** Clips the view based on the geometry of one or more geometric elements.
 * We obtain polyfaces from the backend for each element and produce convex hulls from each polyface.
 * Then we create a ClipVector that clips out any geometry not inside one of the hulls.
 *
 * This tool exists for example purposes only. Some inefficiencies exist, including:
 *  - Convex mesh decomposition can take some time. Ideally it would be performed in a WebWorker so as not to block the UI thread.
 *  - If we had a way to determine if a polyface is already convex, we could avoid performing unnecessary decomposition on such polyfaces.
 */
export class ViewClipByElementGeometryTool extends ViewClipTool {
  public static override toolId = "DtaClipByElementGeometry";
  public static override iconSpec = "icon-section-element";

  public override async onPostInstall() {
    await super.onPostInstall();

    // If some elements are already selected, immediately clip the view using their geometry.
    if (this.targetView && this.targetView.iModel.selectionSet.isActive) {
      await this.doClipToSelectedElements(this.targetView);
      return;
    }

    // Wait for the user to select the elements to use for clipping.
    this.initLocateElements(true, false, "default", CoordinateLockOverrides.All);
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (!this.targetView)
      return EventHandled.No;

    // Identify the element selected.
    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    if (!hit || !hit.isElementHit)
      return EventHandled.No;

    // Clip the view using the selected element's geometry.
    return await this.doClipToElements(this.targetView, new Set<string>([hit.sourceId])) ? EventHandled.Yes : EventHandled.No;
  }

  /** Clip the view using the geometry of all elements currently in the selection set. */
  private async doClipToSelectedElements(viewport: Viewport): Promise<boolean> {
    if (await this.doClipToElements(viewport, viewport.iModel.selectionSet.elements))
      return true;

    await this.exitTool();
    return false;
  }

  /** Clip the view using the geometry of the specified elements. */
  private async doClipToElements(viewport: Viewport, ids: Set<string>): Promise<boolean> {
    try {
      const union = UnionOfConvexClipPlaneSets.createEmpty();
      const decomposer = settings.computeConvexHulls ? await ConvexDecomposer.create(settings.decomposition) : undefined;

      for (const source of ids) {
        // Obtain polyfaces for this element.
        const meshData = await viewport.iModel.generateElementMeshes({ ...settings, source });
        let polyfaces = readElementMeshes(meshData);

        // Convert to convex hulls unless otherwise specified.
        if (decomposer)
          polyfaces = decomposer.decompose(polyfaces);

        // Add each polyface as a clipper.
        for (const polyface of polyfaces)
          union.addConvexSet(ConvexClipPlaneSet.createConvexPolyface(polyface).clipper);
      }

      // Apply the clip to the view.
      ViewClipTool.enableClipVolume(viewport);
      const primitive = ClipPrimitive.createCapture(union);
      const clip = ClipVector.createCapture([primitive]);
      ViewClipTool.setViewClip(viewport, clip);

      this._clipEventHandler?.onNewClip(viewport);

      await this.onReinitialize();
      return true;
    } catch {
      return false;
    }
  }
}
