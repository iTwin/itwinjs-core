/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HyperModeling
 */

import { IModelApp } from "@bentley/imodeljs-frontend";
import { AbstractToolbarProps, BadgeType } from "@bentley/ui-abstract";
import { SectionMarker } from "./SectionMarkers";
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
 * @beta
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
    const i18n = IModelApp.i18n;
    return {
      items: [
        {
          id: "apply_view",
          itemPriority: 10,
          label: i18n.translate("HyperModeling:Message.ApplyView"),
          icon: "icon-spatial-view-apply",
          badgeType: BadgeType.New,
          execute: () => { },
          isDisabled: false,
        },
        {
          id: "open_section",
          itemPriority: 20,
          label: i18n.translate("HyperModeling:Message.OpenSection"),
          icon: "icon-plan-drawing",
          badgeType: BadgeType.None,
          execute: () => { },
          isDisabled: false,
        },
        {
          id: "open_sheet",
          itemPriority: 30,
          label: i18n.translate("HyperModeling:Message.OpenSheet"),
          icon: "icon-plan-floor",
          badgeType: BadgeType.New,
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
}
