/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { getDefaultZonesManagerProps, WidgetZoneId, ZonesManagerProps } from "../../ui-ninezone";
import { getDefaultProps as getDefaultNestedStagePanelsProps } from "./NestedStagePanels.test";

// tslint:disable: completed-docs
export namespace NineZoneManagerTestProps {
  export const defaultProps = {
    nested: getDefaultNestedStagePanelsProps(),
    zones: getDefaultZonesManagerProps(),
  };

  export const widget6InRightPanel = {
    ...defaultProps,
    nested: {
      ...defaultProps.nested,
      panels: {
        ...defaultProps.nested.panels,
        0: {
          ...defaultProps.nested.panels[0],
          right: {
            ...defaultProps.nested.panels[0].right,
            panes: [
              {
                ...defaultProps.nested.panels[0].right.panes[0],
                widgets: [6 as WidgetZoneId],
              },
            ],
          },
        },
      },
    },
    zones: {
      ...defaultProps.zones,
      widgets: {
        ...defaultProps.zones.widgets,
        6: {
          ...defaultProps.zones.widgets[6],
          tabIndex: 2,
        },
      },
      zones: {
        ...defaultProps.zones.zones,
        6: {
          ...defaultProps.zones.zones[6],
          widgets: [],
          floating: {
            ...defaultProps.zones.zones[6].floating,
            bounds: {
              left: 10,
              top: 20,
              right: 50,
              bottom: 100,
            },
          },
        },
      },
    } as ZonesManagerProps,
  };

  export const widget6InLeftPanel = {
    ...defaultProps,
    nested: {
      ...defaultProps.nested,
      panels: {
        ...defaultProps.nested.panels,
        0: {
          ...defaultProps.nested.panels[0],
          left: {
            ...defaultProps.nested.panels[0].left,
            panes: [
              {
                ...defaultProps.nested.panels[0].left.panes[0],
                widgets: [6 as WidgetZoneId],
              },
            ],
          },
        },
      },
    },
    zones: widget6InRightPanel.zones,
  };

  export const widget6InTopPanel = {
    ...defaultProps,
    nested: {
      ...defaultProps.nested,
      panels: {
        ...defaultProps.nested.panels,
        0: {
          ...defaultProps.nested.panels[0],
          top: {
            ...defaultProps.nested.panels[0].top,
            panes: [
              {
                ...defaultProps.nested.panels[0].top.panes[0],
                widgets: [6 as WidgetZoneId],
              },
            ],
          },
        },
      },
    },
    zones: widget6InRightPanel.zones,
  };

  export const widget6and9InRightPanel = {
    ...defaultProps,
    nested: {
      ...defaultProps.nested,
      panels: {
        ...defaultProps.nested.panels,
        0: {
          ...defaultProps.nested.panels[0],
          right: {
            ...defaultProps.nested.panels[0].right,
            panes: [
              {
                ...defaultProps.nested.panels[0].right.panes[0],
                widgets: [6 as WidgetZoneId, 9 as WidgetZoneId],
              },
            ],
          },
        },
      },
    },
    zones: {
      ...defaultProps.zones,
      widgets: {
        ...defaultProps.zones.widgets,
        6: {
          ...defaultProps.zones.widgets[6],
          tabIndex: 3,
        },
      },
    },
  };

  export const draggedWidget6 = {
    ...defaultProps,
    zones: {
      ...defaultProps.zones,
      draggedWidget: {
        id: 6 as WidgetZoneId,
        isUnmerge: false,
        lastPosition: {
          x: 0,
          y: 0,
        },
        tabIndex: 20,
      },
    },
  };

  export const draggedWidget4 = {
    ...NineZoneManagerTestProps.draggedWidget6,
    zones: {
      ...NineZoneManagerTestProps.draggedWidget6.zones,
      draggedWidget: {
        ...NineZoneManagerTestProps.draggedWidget6.zones.draggedWidget,
        id: 4 as WidgetZoneId,
      },
    },
  };

  export const draggedWidget9WithWidget6InRightPanel = {
    ...defaultProps,
    nested: widget6InRightPanel.nested,
    zones: {
      ...defaultProps.zones,
      draggedWidget: {
        id: 9 as WidgetZoneId,
        isUnmerge: false,
        lastPosition: {
          x: 0,
          y: 0,
        },
        tabIndex: 20,
      },
    },
  };
}
