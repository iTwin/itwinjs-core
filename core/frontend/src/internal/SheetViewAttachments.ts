/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { ColorDef, HydrateViewStateRequestProps, HydrateViewStateResponseProps, ViewAttachmentProps } from "@itwin/core-common";
import { ViewState } from "../ViewState";
import { assert, CompressedId64Set, Id64String } from "@itwin/core-bentley";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { createViewAttachmentRenderer, ViewAttachmentRenderer } from "./ViewAttachmentRenderer";
import { Frustum2d } from "../Frustum2d";

interface Attachments {
  clone(iModel: IModelConnection): Attachments;
  preload(request: HydrateViewStateRequestProps): void;
  postload(response: HydrateViewStateResponseProps, iModel: IModelConnection): Promise<Attachments>;
  readonly infos?: ViewAttachmentInfo[];
}

interface ViewAttachmentInfo extends ViewAttachmentProps {
  attachedView: ViewState;
}

class EmptyAttachments implements Attachments {
  private static _instance?: Attachments;

  public static get(): Attachments {
    return this._instance ?? (this._instance = new EmptyAttachments());
  }

  private constructor() {
    // We only need one instance of this stateless class.
  }

  public clone(): Attachments {
    return this;
  }

  public preload(): void {
    // nothing to load.
  }

  public async postload(): Promise<Attachments> {
    return this;
  }
}

class AttachmentIds implements Attachments {
  private readonly _ids: Id64String[];

  public constructor(ids: Id64String[]) {
    this._ids = ids;
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

    const viewStateProps = response.sheetViewViews; // This is viewstateProps, need to turn this into ViewState
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

class AttachmentInfos implements Attachments {
  public readonly infos: ViewAttachmentInfo[];

  public constructor(infos: ViewAttachmentInfo[]) {
    this.infos = infos;
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

export class SheetViewAttachments implements Disposable {
  private _impl: Attachments;
  private _reload?: Promise<Attachments>;
  private _maxDepth = Frustum2d.minimumZDistance;
  private _rendererArgs?: { sheetModelId: Id64String, backgroundColor: ColorDef };
  private _renderers?: ViewAttachmentRenderer[];

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
}
