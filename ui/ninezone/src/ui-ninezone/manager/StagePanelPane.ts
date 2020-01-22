/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StagePanels
 */

import { WidgetZoneId } from "../zones/manager/Zones";

/** Properties used by [[NineZoneStagePanelPaneManager]].
 * @alpha
 */
export interface NineZoneStagePanelPaneManagerProps {
  readonly widgets: ReadonlyArray<WidgetZoneId>;
}

/** Returns default [[NineZoneStagePanelPaneManagerProps]] object.
 * @alpha
 */
export const getDefaultNineZoneStagePanelPaneManagerProps = (): NineZoneStagePanelPaneManagerProps => ({
  widgets: [],
});

/** Class used to manage [[NineZoneStagePanelPaneManagerProps]].
 * @alpha
 */
export class NineZoneStagePanelPaneManager {
  public addWidget<TProps extends NineZoneStagePanelPaneManagerProps>(widgetId: WidgetZoneId, props: TProps): TProps {
    if (props.widgets.indexOf(widgetId) >= 0)
      return props;
    return {
      ...props,
      widgets: [
        ...props.widgets,
        widgetId,
      ],
    };
  }

  public removeWidget<TProps extends NineZoneStagePanelPaneManagerProps>(widgetId: WidgetZoneId, props: TProps): TProps {
    const id = props.widgets.indexOf(widgetId);
    if (id < 0)
      return props;
    return {
      ...props,
      widgets: [
        ...props.widgets.slice(0, id),
        ...props.widgets.slice(id + 1),
      ],
    };
  }
}
