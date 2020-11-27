/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { Placement2dProps, ViewAttachmentProps } from "@bentley/imodeljs-common";
import { IModelApp, SheetViewState, Tool } from "@bentley/imodeljs-frontend";
import { parseArgs } from "@bentley/frontend-devtools";

interface AttachmentProps {
  viewId: Id64String;
  categoryId: Id64String;
  priority: number;
  origin: { x: number, y: number };
  rotation: number;
  sizeRatio: number;
  drawAsRaster: boolean;
  preserveBackground: boolean;
}

async function attachView(opts: AttachmentProps): Promise<void> {
  const { viewId, categoryId, priority, drawAsRaster, preserveBackground } = { ...opts };
  const vp = IModelApp.viewManager.selectedView;
  if (!vp || !viewId || !Id64.isValidId64(viewId) || !categoryId || !Id64.isValidId64(categoryId) || !(vp.view instanceof SheetViewState))
    return;

  let placement: Placement2dProps | undefined;
  try {
    const view = await vp.iModel.views.load(opts.viewId);
    const sheetSize = vp.view.sheetSize;
    let w;
    let h;
    const aspect = view.getAspectRatio();
    if (aspect > 1) {
      w = sheetSize.x * opts.sizeRatio;
      h = w / aspect;
    } else {
      h = sheetSize.y * opts.sizeRatio;
      w = h * aspect;
    }

    placement = {
      origin: opts.origin,
      angle: opts.rotation,
      bbox: {
        low: opts.origin,
        high: {
          x: opts.origin.x + w,
          y: opts.origin.y + h,
        },
      },
    };
  } catch (_) {
  }

  if (!placement)
    return;

  const props: ViewAttachmentProps = {
    classFullName: "BisCore.ViewAttachment",
    model: vp.view.baseModelId,
    code: {
      spec: Id64.invalid,
      scope: Id64.invalid,
    },
    jsonProperties: {
      displayPriority: priority,
      displayOptions: {
        drawAsRaster,
        preserveBackground,
      },
    },
    category: categoryId,
    placement,
    view: { id: viewId },
  };

  await vp.view.attachViews([props]);
  vp.invalidateController();
}

/** Attaches a view to a sheet view.
 * Arguments:
 * view (required) view Id
 * category category Id. Defaults to the first category found in the sheet view's category selector.
 * x origin x. Default zero.
 * y origin y. Default zero.
 * rotation rotation in degrees. Default zero.
 * size Ratio of the width or height of the sheet's area that the attachment should occupy. Default 1.
 * p display priority in [-500,500]. Default zero.
 * i Draw as raster image.
 * b Preserve background color.
 */
export class AttachViewTool extends Tool {
  public static toolId = "AttachView";
  public static get minArgs(): number { return 1; }
  public static get maxArgs(): number { return 7; }

  public run(opts?: AttachmentProps): boolean {
    if (opts && opts.viewId)
      attachView(opts); // eslint-disable-line @typescript-eslint/no-floating-promises

    return true;
  }

  public parseAndRun(...inputArgs: string[]): boolean {
    const sheetView = IModelApp.viewManager.selectedView?.view;
    if (!sheetView || !(sheetView instanceof SheetViewState))
      return true;

    const args = parseArgs(inputArgs);
    const viewId = args.get("v");
    if (!viewId)
      return true;

    let categoryId = args.get("c");
    if (!categoryId) {
      // Choose the first category we find
      for (const category of sheetView.categorySelector.categories) {
        categoryId = category;
        break;
      }
    }

    if (!categoryId)
      return true;

    const props: AttachmentProps = {
      viewId,
      categoryId,
      priority: args.getFloat("p") ?? 0,
      origin: {
        x: args.getFloat("x") ?? 0,
        y: args.getFloat("y") ?? 0,
      },
      rotation: args.getFloat("r") ?? 0,
      sizeRatio: args.getFloat("s") ?? 1,
      drawAsRaster: args.getBoolean("i") ?? false,
      preserveBackground: args.getBoolean("b") ?? false,
    };

    return this.run(props);
  }
}

export class DetachViewsTool extends Tool {
  public static toolId = "DetachViews";

  public run(): boolean {
    const view = IModelApp.viewManager.selectedView?.view;
    if (view && view instanceof SheetViewState) {
      view.detachViews();
      IModelApp.viewManager.selectedView!.invalidateController();
    }

    return true;
  }
}
