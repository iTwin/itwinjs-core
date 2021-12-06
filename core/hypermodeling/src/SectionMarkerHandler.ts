/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HyperModeling
 */

import { IModelApp } from "@itwin/core-frontend";
import type { AbstractToolbarProps } from "@itwin/appui-abstract";
import { SectionMarker } from "./SectionMarkers";
import { SectionMarkerConfig } from "./HyperModelingConfig";
import { HyperModelingDecorator } from "./HyperModelingDecorator";

/** Supplies interactions with [[SectionMarker]]s, including a mini-toolbar displayed when the mouse hovers over a marker and what action occurs when the user clicks a marker.
 * The base implementation supplies the following interactions:
 *  * Click: Toggle display of the section graphics and clip volume; apply the section's spatial view if toggling on.
 *  * Toolbar:
 *    * Apply Section: Applies the section location's spatial view to the viewport and displays the 2d section graphics.
 *    * Open Drawing: Navigates to the section drawing view. By default, this applies the section drawing view to the viewport.
 *    * Open Sheet: Navigates to the [ViewAttachment]($backend) of the section drawing on a [Sheet]($backend). Disabled if no such attachment exists.
 * @see [[HyperModelingConfig]] to override the default handler by supplying a subclass of `SectionMarkerHandler`.
 * @see [[HyperModelingDecorator]] for various methods that might be usefully wired up to marker click or toolbar actions.
 * @public
 */
export class SectionMarkerHandler {
  /** Respond to activation of the specified marker. Return true if the marker should become the active marker - i.e., if the marker was successfully activated.
   * @see [[SectionMarkerHandler.deactivateMarker]].
   */
  public async activateMarker(marker: SectionMarker, decorator: HyperModelingDecorator): Promise<boolean> {
    return decorator.toggleSection(marker, true);
  }

  /** Respond to deactivation of the specified marker. Invoked when the user clicks on the marker while it is the active marker.
   * This should perform the inverse of [[SectionMarkerHandler.activateMarker]]. The marker becomes inactive as a result.
   */
  public async deactivateMarker(marker: SectionMarker, decorator: HyperModelingDecorator): Promise<void> {
    await decorator.toggleSection(marker, false);
  }

  /** Return toolbar items for the specified marker. If the array of toolbar items is empty, no toolbar will be displayed.
   * @see [[executeCommand]] to implement each toolbar command.
   */
  public getToolbarProps(marker: SectionMarker, _decorator: HyperModelingDecorator): AbstractToolbarProps {
    const localization = IModelApp.localization;
    return {
      items: [
        {
          id: "apply_view",
          itemPriority: 10,
          label: localization.getLocalizedString("HyperModeling:Message.ApplyView"),
          icon: "icon-spatial-view-apply",
          execute: () => { },
          isDisabled: false,
        },
        {
          id: "open_section",
          itemPriority: 20,
          label: localization.getLocalizedString("HyperModeling:Message.OpenSection"),
          icon: "icon-plan-drawing",
          execute: () => { },
          isDisabled: false,
        },
        {
          id: "open_sheet",
          itemPriority: 30,
          label: localization.getLocalizedString("HyperModeling:Message.OpenSheet"),
          icon: "icon-plan-floor",
          execute: () => { },
          isDisabled: undefined === marker.state.viewAttachment?.viewId,
        },
      ],
    };
  }

  /** Execute the command associated with the specified tool bar item.
   * @see [[getToolbarProps]] to define the set of commands.
   */
  public async executeCommand(commandId: string, marker: SectionMarker, decorator: HyperModelingDecorator): Promise<void> {
    switch (commandId) {
      case "apply_view":
        await decorator.applySpatialView(marker);
        break;
      case "open_section":
        await decorator.openSection(marker);
        break;
      case "open_sheet":
        await decorator.openSheet(marker);
        break;
    }
  }

  /** Customize which markers are visible. [[HyperModelingDecorator]] determines marker visibility as follows:
   *  - If a marker is currently active (selected), only that marker is visible.
   *  - Otherwise, the marker is visible if this method returns `true`.
   * The default implementation of this method determines visibility based on the [[SectionMarkerConfig]] as follows.
   *  - If the marker is of a type included in the config's `hiddenSectionTypes`, it is invisible.
   *  - If the marker belongs to a model not currently displayed in the viewport and the config's `ignoreModelSelector` is false, it is invisible.
   *  - If the marker belongs to a category not currently displayed in the viewport and the config's `ignoreCategorySelector` is false, it is invisible,
   *  - Otherwise, the marker is visible, unless this method returns `false`.
   * The default implementation of this method always returns `true`
   * @param marker The marker whose visibility is to be determined.
   * @param decorator The hypermodeling decorator to which the marker belongs.
   * @param config The configuration controlling marker visibility based on [SectionType]($common), [ModelSelectorState]($frontend), and [CategorySelectorState]($frontend).
   * @returns true if the marker should be displayed; false to make it invisible.
   * @see [[HyperModelingDecorator.requestSync]] to force the decorator to reevaluate marker visibility when the criterion used by your implementation of this method changes.
   */
  public isMarkerVisible(marker: SectionMarker, decorator: HyperModelingDecorator, config: SectionMarkerConfig): boolean {
    if (undefined !== config.hiddenSectionTypes && config.hiddenSectionTypes.includes(marker.state.sectionType))
      return false;

    if (!config.ignoreCategorySelector && !decorator.viewport.view.viewsCategory(marker.state.category))
      return false;

    if (!config.ignoreModelSelector && !decorator.viewport.view.viewsModel(marker.state.model))
      return false;

    return true;
  }
}
