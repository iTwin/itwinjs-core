/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HyperModeling
 */

import { SectionType } from "@bentley/imodeljs-common";
import {
  I18N,
  I18NNamespace,
} from "@bentley/imodeljs-i18n";
import {
  IModelApp,
  ScreenViewport,
  Tool,
} from "@bentley/imodeljs-frontend";
import { SectionMarkerSetDecorator } from "./SectionMarkerSetDecorator";
import { getDefaultSectionGraphicsConfig, getSectionGraphicsConfig, SectionGraphicsConfig, setSectionGraphicsConfig } from "./SectionGraphicsProvider";

/** Parses a string case-insensitively returning true for "ON", false for "OFF", undefined for "TOGGLE" or undefined, and the input string for anything else. */
function parseToggle(arg: string | undefined): string | boolean | undefined {
  if (undefined === arg)
    return undefined;

  switch (arg.toLowerCase()) {
    case "on": return true;
    case "off": return false;
    case "toggle": return undefined;
    default: return arg;
  }
}

function getViewport(vp: ScreenViewport | undefined): ScreenViewport | undefined {
  return vp ?? IModelApp.viewManager.selectedView;
}

function getDecorator(vp: ScreenViewport | undefined): SectionMarkerSetDecorator | undefined {
  vp = getViewport(vp);
  return undefined !== vp ? SectionMarkerSetDecorator.getForViewport(vp) : undefined;
}

abstract class FilterTool extends Tool {
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(enable?: boolean, vp?: ScreenViewport): boolean {
    this.execute(enable, vp);
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const enable = parseToggle(args[0]);
    return typeof enable !== "string" && this.run(enable);
  }

  protected abstract execute(enable: boolean | undefined, vp?: ScreenViewport): void;
}

abstract class TypeFilterTool extends FilterTool {
  protected abstract get sectionType(): SectionType;

  protected execute(enable: boolean | undefined, vp?: ScreenViewport): void {
    const decorator = getDecorator(vp);
    decorator?.setMarkerTypeDisplay(this.sectionType, enable);
  }
}

class SectionFilterTool extends TypeFilterTool {
  protected get sectionType() { return SectionType.Section; }
  public static toolId = "HyperModeling.Marker.Type.Section";
}

class ElevationFilterTool extends TypeFilterTool {
  protected get sectionType() { return SectionType.Elevation; }
  public static toolId = "HyperModeling.Marker.Type.Elevation";
}

class PlanFilterTool extends TypeFilterTool {
  protected get sectionType() { return SectionType.Plan; }
  public static toolId = "HyperModeling.Marker.Type.Plan";
}

class DetailFilterTool extends TypeFilterTool {
  protected get sectionType() { return SectionType.Detail; }
  public static toolId = "HyperModeling.Marker.Type.Detail";
}

abstract class DefaultTypeFilterTool extends FilterTool {
  protected abstract get sectionType(): SectionType;

  protected execute(enable: boolean | undefined): void {
    SectionMarkerSetDecorator.setDefaultMarkerTypeDisplay(this.sectionType, enable);
  }
}

class DefaultSectionFilterTool extends DefaultTypeFilterTool {
  protected get sectionType() { return SectionType.Section; }
  public static toolId = "HyperModeling.Marker.Default.Type.Section";
}

class DefaultElevationFilterTool extends DefaultTypeFilterTool {
  protected get sectionType() { return SectionType.Elevation; }
  public static toolId = "HyperModeling.Marker.Default.Type.Elevation";
}

class DefaultPlanFilterTool extends DefaultTypeFilterTool {
  protected get sectionType() { return SectionType.Plan; }
  public static toolId = "HyperModeling.Marker.Default.Type.Plan";
}

class DefaultDetailFilterTool extends DefaultTypeFilterTool {
  protected get sectionType() { return SectionType.Detail; }
  public static toolId = "HyperModeling.Marker.Default.Type.Detail";
}

class SectionMarkerDisplayTool extends Tool {
  public static toolId = "HyperModeling.Marker.Display";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(enable?: boolean, vp?: ScreenViewport): boolean {
    vp = getViewport(vp);
    if (undefined !== vp)
      SectionMarkerSetDecorator.showOrHide(vp, enable); // tslint:disable-line:no-floating-promises

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const enable = parseToggle(args[0]);
    return typeof enable !== "string" && this.run(enable);
  }
}

class CategoryFilterTool extends FilterTool {
  public static toolId = "HyperModeling.Marker.Category";

  protected execute(enable: boolean | undefined, vp?: ScreenViewport): void {
    const decorator = getDecorator(vp);
    decorator?.setCategoryDisplay(enable);
  }
}

class DefaultCategoryFilterTool extends FilterTool {
  public static toolId = "HyperModeling.Marker.Default.Category";

  protected execute(enable: boolean | undefined, _vp: ScreenViewport): void {
    SectionMarkerSetDecorator.setDefaultCategoryDisplay(enable);
  }
}

class ModelFilterTool extends FilterTool {
  public static toolId = "HyperModeling.Marker.Model";

  protected execute(enable: boolean | undefined, vp?: ScreenViewport): void {
    const decorator = getDecorator(vp);
    decorator?.setModelDisplay(enable);
  }
}

class DefaultModelFilterTool extends FilterTool {
  public static toolId = "HyperModeling.Marker.Default.Model";

  protected execute(enable: boolean | undefined, _vp: ScreenViewport): void {
    SectionMarkerSetDecorator.setDefaultModelDisplay(enable);
  }
}

/** Configures how section graphics are displayed. These are global settings. If no arguments are supplied, the defaults are restored.
 * Otherwise, each argument is of the form "name=value" where value is 0 (disable) or 1 (enable). Only the first letter of each argument matters.
 *  - drawings: Whether to display the drawing views. Default: 1.
 *  - sheets: Whether to display the sheet views. Default: 1.
 *  - clip: Whether to apply clip volumes to the sheets and drawings. Default: 1.
 *  - boundaries: Whether to display clip volumes as boundary shapes for debugging purposes. Default: 0.
 */
class SectionGraphicsConfigTool extends Tool {
  public static toolId = "HyperModeling.Graphics.Config";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 4; }

  public run(config?: SectionGraphicsConfig): boolean {
    if (!config)
      config = getDefaultSectionGraphicsConfig();

    setSectionGraphicsConfig(config);
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    if (0 === args.length)
      return this.run(); // restore defaults...

    const config = getSectionGraphicsConfig();
    for (const arg of args) {
      const parts = arg.toLowerCase().split("=");
      if (2 !== parts.length)
        continue;

      const value = Number.parseInt(parts[1], 10);
      if (Number.isNaN(value) || (0 !== value && 1 !== value))
        continue;

      const enable = 1 === value;
      switch (parts[0][0]) {
        case "d":
          config.displayDrawings = enable;
          break;
        case "s":
          config.displaySheets = enable;
          break;
        case "c":
          config.applyClipVolumes = enable;
          break;
        case "b":
          config.debugClipVolumes = enable;
          break;
      }
    }

    return this.run(config);
  }
}

export function registerTools(namespace: I18NNamespace | undefined, i18n: I18N): void {
  const register = (tool: typeof Tool) => IModelApp.tools.register(tool, namespace, i18n);
  register(SectionMarkerDisplayTool);
  register(SectionGraphicsConfigTool);

  register(SectionFilterTool);
  register(ElevationFilterTool);
  register(PlanFilterTool);
  register(DetailFilterTool);

  register(DefaultSectionFilterTool);
  register(DefaultElevationFilterTool);
  register(DefaultPlanFilterTool);
  register(DefaultDetailFilterTool);

  register(CategoryFilterTool);
  register(DefaultCategoryFilterTool);

  register(ModelFilterTool);
  register(DefaultModelFilterTool);
}
