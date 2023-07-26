/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import { ConditionalStringValue } from "../items/ConditionalStringValue";
import { BadgeType } from "../items/BadgeType";
import { ProvidedItem } from "../items/ProvidedItem";
import { WidgetState } from "./WidgetState";

/** Properties for a Widget.
 * @deprecated in 3.6. Use [Widget]($appui-react) instead.
 * @public
 */
export interface AbstractWidgetProps extends ProvidedItem { // eslint-disable-line deprecation/deprecation
  /** Gets the widget content. */
  readonly getWidgetContent: () => any;
  /** Name of icon WebFont entry or if specifying an imported SVG symbol use "webSvg:" prefix to imported symbol Id. */
  readonly icon?: string | ConditionalStringValue;
  /** Id used to uniquely identify the widget.
   * @note It is recommended to provide unique widget id to correctly save/restore App layout.
   */
  readonly id?: string;
  /** Default Widget state. Controls how the Widget is initially displayed. Defaults to WidgetState.Unloaded. */
  readonly defaultState?: WidgetState; // eslint-disable-line deprecation/deprecation
  /** if set, component will be considered selected but will NOT display an "active stripe" - defaults to false. Typically used by buttons that toggle between two states. */
  readonly label?: string | ConditionalStringValue;
  /** used to explicitly set the tooltip shown by a component. */
  readonly tooltip?: string | ConditionalStringValue;
  /** Indicates whether the Widget is free-form or rectangular. Defaults to false for rectangular. The default is false.
   * @deprecated in 3.0. Free-form widgets are obsolete.
   * */
  readonly isFreeform?: boolean;
  /** Application data attached to the Widget. */
  readonly applicationData?: any;
  /** optional data to used by item implementor. */
  readonly internalData?: Map<string, any>;
  /** Indicates whether this Widget is for the Tool Settings. */
  readonly isToolSettings?: boolean;
  /** Indicates whether this Widget is for the Status Bar. */
  readonly isStatusBar?: boolean;
  /** Indicates whether this Widget should fill the available space in the Zone. */
  readonly fillZone?: boolean;
  /** Indicates if widget can be popped out to a child window. Defaults to false. */
  readonly canPopout?: boolean;
  /** If the widget state is changed to `floating` and the floatingContainerId is defined, the widget will be added to a
   * floating panel by that name. If no name is specified, a GUID is used. */
  readonly floatingContainerId?: string;
  /** Indicates if widget can be in floating state, default to true. */
  readonly isFloatingStateSupported?: boolean;
  /** Indicates if floating widget is resizable, defaults to false which caused the widget to be auto-sized.. */
  readonly isFloatingStateWindowResizable?: boolean;
  /** Defines that default Top Left position when widget is floated via API calls */
  readonly defaultFloatingPosition?: { x: number, y: number };
  /** Widget priority */
  readonly priority?: number;
  /** Defines the SyncUi event Ids that will trigger the stateFunc to run to determine the state of the widget. */
  readonly syncEventIds?: string[];
  /** Function executed to determine the state of the widget.
   *  Used by UI 1.0 widgets ONLY.
   * @deprecated in 3.3. UI 1.0 support will be removed in AppUi 4.0.
  */
  readonly stateFunc?: (state: Readonly<WidgetState>) => WidgetState; // eslint-disable-line deprecation/deprecation
  /** Badge to be overlaid on the widget tab. */
  readonly badgeType?: BadgeType;
  /** Handler for widget state changed event */
  readonly onWidgetStateChanged?: () => void;
  /** Save transient DOM state (i.e. scroll offset). */
  readonly saveTransientState?: () => void;
  /** Restore transient DOM state.
   * @note Return true if the state is restored or the Widget will remount.
   */
  readonly restoreTransientState?: () => boolean;
  /** Optional default size to use when floating a widget. If not specified then the default is to size to content if possible.
   * Certain widget can't be intrinsically sized and must specify a content. These are typically ones that use a canvas element
   * internally. */
  defaultFloatingSize?: { width: number, height: number };
  /** Optional prop that tells the widget system to fade this widget out with the rest of the UI when it is in floating state */
  hideWithUiWhenFloating?: boolean;
  /** Optional prop specifying which Panel sides can be docking targets for this widget. If this prop is not specified, all sides are allowed.
   *  An empty array is treated the same as an undefined prop, allowing all targets. */
  readonly allowedPanelTargets?:  ReadonlyArray<"left"|"right"|"bottom"|"top">;
}
