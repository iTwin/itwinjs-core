/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { HydrateViewStateRequestProps, HydrateViewStateResponseProps, ViewAttachmentProps } from "@itwin/core-common";
import { ViewState } from "../ViewState";
import { assert, CompressedId64Set, dispose, Id64String } from "@itwin/core-bentley";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";

interface Attachments {
  clone(iModel: IModelConnection): Attachments;
  preload(request: HydrateViewStateRequestProps): void;
  postload(response: HydrateViewStateResponseProps, iModel: IModelConnection): Promise<Attachments>;
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
  private readonly _infos: ViewAttachmentInfo[];

  public constructor(infos: ViewAttachmentInfo[]) {
    this._infos = infos;
  }

  public clone(iModel: IModelConnection): Attachments {
    const infos = this._infos.map((info) => {
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

export class SheetViewAttachments implements Disposable {
  private _impl: Attachments;
  private _reload?: Promise<Attachments>;

  private constructor(impl: Attachments) {
    this._impl = impl;
  }

  public [Symbol.dispose](): void {
    // ###TODO dispose of ViewAttachmentRenderers
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
    const reload = this._reload = reloadAttachments(sheetModelId, iModel);
    const impl = await this._reload;
    if (this._reload === reload) {
      this._impl = impl;
      this._reload = undefined;
    }
  }
}
