/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { ColorDef, HydrateViewStateRequestProps, HydrateViewStateResponseProps, Placement2d, ViewAttachmentProps } from "@itwin/core-common";
import { ComputeDisplayTransformArgs, GetAttachmentViewportArgs, ViewState } from "../ViewState";
import { assert, CompressedId64Set, expectDefined, Id64String } from "@itwin/core-bentley";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { createViewAttachmentRenderer, ViewAttachmentRenderer } from "./ViewAttachmentRenderer";
import { Frustum2d } from "../Frustum2d";
import { Range3d, Transform } from "@itwin/core-geometry";
import { DisclosedTileTreeSet, RenderMemory, SceneContext, Viewport } from "../core-frontend";

/** Represents the current state of the view attachments to be displayed by a SheetViewAttachments. */
interface Attachments {
  clone(iModel: IModelConnection): Attachments;
  preload(request: HydrateViewStateRequestProps): void;
  postload(response: HydrateViewStateResponseProps, iModel: IModelConnection): Promise<Attachments>;
  readonly infos?: ViewAttachmentInfo[];
  readonly attachmentIds: readonly string[];
}

/** The properties describing a view attachment, plus the ViewState created from them. */
interface ViewAttachmentInfo extends ViewAttachmentProps {
  attachedView: ViewState;
}

/** Stateless state for a sheet that has no view attachments. */
class EmptyAttachments implements Attachments {
  // We only need one instance of this stateless class.
  private static _instance?: Attachments;

  public static get(): Attachments {
    return this._instance ?? (this._instance = new EmptyAttachments());
  }

  private constructor() { }

  public clone(): Attachments {
    return this;
  }

  public preload(): void { }

  public async postload(): Promise<Attachments> {
    return this;
  }

  public get attachmentIds() {
    return [];
  }
}

/** Holds the element Ids of the view attachments to be loaded for display. */
class AttachmentIds implements Attachments {
  private readonly _ids: Id64String[];

  public constructor(ids: Id64String[]) {
    this._ids = ids;
  }

  public get attachmentIds() {
    return this._ids;
  }

  public clone(): Attachments {
    return new AttachmentIds([...this._ids]);
  }

  public preload(request: HydrateViewStateRequestProps): void {
    request.sheetViewAttachmentIds = CompressedId64Set.sortAndCompress(this._ids);
    request.viewStateLoadProps = {
      displayStyle: {
        omitScheduleScriptElementIds: !IModelApp.tileAdmin.enableFrontendScheduleScripts,
        compressExcludedElementIds: true,
      },
    };
  }

  public async postload(response: HydrateViewStateResponseProps, iModel: IModelConnection): Promise<Attachments> {
    if (undefined === response.sheetViewViews || undefined === response.sheetViewAttachmentProps) {
      return this;
    }

    const viewStateProps = response.sheetViewViews;
    const promises = [];
    for (const viewProps of viewStateProps) {
      const loadView = async () => {
        try {
          if (viewProps === undefined)
            return undefined;
          const view = await iModel.views.convertViewStatePropsToViewState(viewProps);
          return view;
        } catch {
          return undefined;
        }
      };
      promises.push(loadView());
    }

    const views = await Promise.all(promises);

    const attachmentProps = response.sheetViewAttachmentProps as ViewAttachmentInfo[];
    assert(views.length === attachmentProps.length);
    const infos = [];
    for (let i = 0; i < views.length; i++) {
      const view = views[i];
      if (view && !(view.isSheetView())) {
        const props = attachmentProps[i];
        props.attachedView = view;
        infos.push(props);
      }
    }

    return new AttachmentInfos(infos);
  }
}

/** Fully loaded view attachments. */
class AttachmentInfos implements Attachments {
  public readonly infos: ViewAttachmentInfo[];

  public constructor(infos: ViewAttachmentInfo[]) {
    this.infos = infos;
  }

  public get attachmentIds() {
    return this.infos.map((x) => expectDefined(x.id));
  }

  public clone(iModel: IModelConnection): Attachments {
    const infos = this.infos.map((info) => {
      return {
        ...info,
        attachedView: info.attachedView.clone(iModel),
      };
    });

    return new AttachmentInfos(infos);
  }

  public preload(): void {
    // already loaded.
  }

  public async postload(): Promise<Attachments> {
    // already loaded.
    return this;
  }
}

/** Reloads the attachments after a change to the database. */
async function reloadAttachments(sheetModelId: Id64String, iModel: IModelConnection): Promise<Attachments> {
  const ecsql = `SELECT ECInstanceId as attachmentId FROM bis.ViewAttachment WHERE model.Id=${sheetModelId}`;
  const ids: string[] = [];
  for await (const row of iModel.createQueryReader(ecsql)) {
    ids.push(row[0]);
  }

  const attachmentProps = await iModel.elements.getProps(ids) as ViewAttachmentInfo[];
  const promises = [];
  for (const attachment of attachmentProps) {
    const loadView = async () => {
      try {
        const view = await iModel.views.load(attachment.view.id);
        return view;
      } catch {
        return undefined;
      }
    };

    promises.push(loadView());
  }

  const views = await Promise.all(promises);
  assert(views.length === attachmentProps.length);

  const infos = [];
  for (let i = 0; i < views.length; i++) {
    const view = views[i];
    if (view && !view.isSheetView()) {
      const props = attachmentProps[i];
      props.attachedView = view;
      infos.push(props);
    }
  }

  return new AttachmentInfos(infos);
}

function disposeRenderers(renderers: ViewAttachmentRenderer[] | undefined) {
  if (renderers) {
    for (const renderer of renderers) {
      renderer[Symbol.dispose]();
    }
  }
}

/** Manages the set of ViewAttachment elements to be rendered by a SheetViewState.
 * Takes care of reloading them after ViewAttachment elements are modified, deleted, or inserted.
 */
export class SheetViewAttachments implements Disposable {
  private _impl: Attachments;
  private _reload?: Promise<Attachments>;
  private _maxDepth = Frustum2d.minimumZDistance;
  private _rendererArgs?: { sheetModelId: Id64String, backgroundColor: ColorDef };
  private _renderers?: ViewAttachmentRenderer[];

  public get maxDepth(): number {
    return this._maxDepth;
  }

  public *getSecondaryViewports(): Iterable<Viewport> {
    if (this._renderers) {
      for (const renderer of this._renderers) {
        if (renderer.viewport) {
          yield renderer.viewport;
        }
      }
    }
  }

  private constructor(impl: Attachments) {
    this._impl = impl;
  }

  public [Symbol.dispose](): void {
    disposeRenderers(this._renderers);
    this._renderers = this._rendererArgs = undefined;
    this._reload = undefined;
  }

  public static create(attachmentIds: Id64String[]): SheetViewAttachments {
    const impl = attachmentIds.length === 0 ? EmptyAttachments.get() : new AttachmentIds([...attachmentIds]);
    return new this(impl);
  }

  public get attachmentIds(): readonly string[] {
    return this._impl.attachmentIds;
  }

  public clone(iModel: IModelConnection): SheetViewAttachments {
    return new SheetViewAttachments(this._impl.clone(iModel));
  }

  public preload(request: HydrateViewStateRequestProps): void {
    this._impl.preload(request);
  }

  public async postload(response: HydrateViewStateResponseProps, iModel: IModelConnection): Promise<void> {
    this._impl = await this._impl.postload(response, iModel);
  }

  public async reload(sheetModelId: Id64String, iModel: IModelConnection): Promise<void> {
    const renderers = this._renderers;
    const reload = this._reload = reloadAttachments(sheetModelId, iModel);
    const impl = await this._reload;

    // We keep the previous renderers until reloading completes, to avoid drawing a blank view while waiting.
    // Afterward, always destroy the previous renderers.
    disposeRenderers(renderers);

    // If reload was not called again while we waited...
    if (this._reload === reload) {
      this._impl = impl;
      this._reload = this._renderers = undefined;

      if (this._rendererArgs) {
        // We are attached to a Viewport - reload the renderers.
        this.loadRenderers();
      }
    }
  }

  public attachToViewport(args: {
    backgroundColor: ColorDef,
    sheetModelId: Id64String,
  }): void {
    assert(undefined === this._renderers);
    assert(undefined === this._rendererArgs);

    this._rendererArgs = args;
    this.loadRenderers();
  }

  public detachFromViewport(): void {
    assert(undefined !== this._rendererArgs);
    this._rendererArgs = undefined;

    disposeRenderers(this._renderers);
    this._renderers = undefined;
  }

  public areAllTileTreesLoaded(displayedExtents: Range3d): boolean {
    if (this._reload) {
      return false;
    } else if (!this._renderers) {
      return true;
    }

    return this._renderers.every((renderer) => {
      const attachmentRange = Placement2d.fromJSON(renderer.viewAttachmentProps.placement).calculateRange();
      return !attachmentRange.intersectsRangeXY(displayedExtents) || renderer.areAllTileTreesLoaded;
    });
  }

  public discloseTileTrees(trees: DisclosedTileTreeSet): void {
    for (const renderer of this.renderers()) {
      trees.disclose(renderer);
    }
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    for (const renderer of this.renderers()) {
      renderer.collectStatistics(stats);
    }
  }

  public addToScene(context: SceneContext): void {
    for (const renderer of this.renderers()) {
      renderer.addToScene(context);
    }
  }

  public getAttachmentViewport(args: GetAttachmentViewportArgs): Viewport | undefined {
    const renderer = args.viewAttachmentId ? this.findRendererById(args.viewAttachmentId) : undefined;
    if (!renderer) {
      return undefined;
    }

    return args.inSectionDrawingAttachment ? renderer.viewport?.view.getAttachmentViewport({ inSectionDrawingAttachment: true }) : renderer.viewport;
  }

  public computeDisplayTransform(args: ComputeDisplayTransformArgs): Transform | undefined {
    const renderer = undefined !== args.viewAttachmentId ? this.findRendererById(args.viewAttachmentId) : undefined;
    const ortho = renderer?.ortho;
    const sheetTransform = ortho?.toSheet;
    if (!sheetTransform) {
      return undefined;
    }

    const sectionTransform = args.inSectionDrawingAttachment ? ortho.view.computeDisplayTransform(args) : undefined;
    if (!sectionTransform) {
      return sheetTransform.clone(args.output);
    }

    return sheetTransform.multiplyTransformTransform(sectionTransform, args.output);
  }

  /** Strictly for tests. */
  public areAllAttachmentsLoaded(): boolean {
    return !this._reload && (!this._renderers || this._renderers.every((x) => x.areAllTileTreesLoaded));
  }

  /** Strictly for tests. */
  public get attachments(): object[] | undefined {
    return this._renderers;
  }

  /** Strictly for tests. */
  public get attachmentProps(): Array<Readonly<ViewAttachmentProps>> {
    const infos = this._impl.infos;
    if (!infos) {
      return [];
    }

    return infos.map((x) => {
      return {
        ...x,
        attachedView: undefined,
      };
    });
  }

  /** Strictly for tests. */
  public get attachmentInfos(): readonly Id64String[] | Array<{ attachedView: ViewState }> {
    const infos = this._impl.infos;
    return infos ?? this._impl.attachmentIds;
  }

  private loadRenderers(): void {
    const args = this._rendererArgs;
    assert(undefined !== args);
    assert(undefined === this._renderers);

    this._maxDepth = Frustum2d.minimumZDistance;

    const infos = this._impl.infos;
    if (!infos) {
      return;
    }

    this._renderers = infos.map((info) => {
      const renderer = createViewAttachmentRenderer({
        ...args,
        props: info,
        view: info.attachedView,
      });
      this._maxDepth = Math.max(this._maxDepth, renderer.zDepth);
      return renderer;
    });
  }

  private *renderers(): Iterable<ViewAttachmentRenderer> {
    if (this._renderers) {
      for (const renderer of this._renderers) {
        yield renderer;
      }
    }
  }

  private findRendererById(id: Id64String): ViewAttachmentRenderer | undefined {
    return this._renderers?.find((x) => x.viewAttachmentProps.id === id);
  }
}
