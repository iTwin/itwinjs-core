import { ColorDef } from "@itwin/core-common";
import { DecorateContext, Decorator, GraphicType, IModelApp, Tool } from "@itwin/core-frontend";
import { Range3d } from "@itwin/core-geometry";
import { parseToggle } from "@itwin/frontend-devtools";

class OriginAndExtentsDecoration implements Decorator {
  private static _decorator?: OriginAndExtentsDecoration;
  // Controls the size of the world origin decorator. Decrease for sheet views, increase for large drawing views.
  private _originScale = 1;
  protected _removeDecorationListener?: () => void;

  public constructor(originScale?: number) {
    if (originScale)
      this._originScale = originScale;
    this.updateDecorationListener(true);
  }

  public async decorate(context: DecorateContext) {
    const builder = context.createSceneGraphicBuilder();
    // Show viewed extents in red
    const viewedExtents = context.viewport.view.getViewedExtents();
    builder.setSymbology(ColorDef.red, ColorDef.red, 2);
    builder.addRangeBox(Range3d.createFrom(viewedExtents), false);
    // Show a rough idea of where the world origin is in green
    builder.setSymbology(ColorDef.green, ColorDef.green, 2);
    builder.addRangeBox(Range3d.createXYZXYZ(0, 0, 0, this._originScale, this._originScale, this._originScale), true);
    // Show the project extents in blue
    builder.setSymbology(ColorDef.blue, ColorDef.blue, 2);
    const projectExtents = context.viewport.iModel.projectExtents.clone();
    builder.addRangeBox(projectExtents.clone(), false);
    context.addDecoration(GraphicType.WorldOverlay, builder.finish());
  }

  protected stop(): void { this.updateDecorationListener(false); }

  protected updateDecorationListener(add: boolean): void {
    if (this._removeDecorationListener) {
      if (!add) {
        this._removeDecorationListener();
        this._removeDecorationListener = undefined;
      }
    } else if (add) {
      if (!this._removeDecorationListener)
        this._removeDecorationListener = IModelApp.viewManager.addDecorator(this);
    }
  }

  public static toggle(enabled?: boolean, originScale?: number): boolean {
    if (undefined !== enabled) {
      const alreadyEnabled = undefined !== OriginAndExtentsDecoration._decorator;
      if (enabled === alreadyEnabled)
        return alreadyEnabled;
    }

    if (undefined === OriginAndExtentsDecoration._decorator) {
      OriginAndExtentsDecoration._decorator = new OriginAndExtentsDecoration(originScale);
      return true;
    } else {
      OriginAndExtentsDecoration._decorator.stop();
      OriginAndExtentsDecoration._decorator = undefined;
      return false;
    }
  }
}

export class ToggleOriginAndExtentsTool extends Tool {
  public static override toolId = "ToggleOriginAndExtents";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 2; }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const enable = parseToggle(args[0]);
    let originScale;
    if (args.length === 2 && Number(args[1])) {
      originScale = Number(args[1]);
    }
    if (typeof enable !== "string")
      await this.run(enable, originScale);

    return true;
  }

  public override async run(enable?: boolean, originScale?: number): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (vp) {
      if (OriginAndExtentsDecoration.toggle(enable, originScale))
        vp.onChangeView.addOnce(() => OriginAndExtentsDecoration.toggle(false));
    }
    return true;
  }
}
