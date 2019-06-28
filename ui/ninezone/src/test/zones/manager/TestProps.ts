/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ZonesManagerProps, getDefaultZonesManagerProps } from "../../../ui-ninezone";
import { HorizontalAnchor } from "../../../ui-ninezone/widget/Stacked";
import { getDefaultWidgetProps } from "../../../ui-ninezone/zones/manager/Widget";

// tslint:disable: completed-docs
export namespace TestProps {
  export const defaultProps = getDefaultZonesManagerProps();

  export const inWidgetMode: ZonesManagerProps = {
    ...defaultProps,
    zones: {
      ...defaultProps.zones,
      [8]: {
        ...defaultProps.zones[8],
        isInFooterMode: false,
        allowsMerging: true,
      },
    },
  };

  export const openedZone6: ZonesManagerProps = {
    ...defaultProps,
    widgets: {
      ...defaultProps.widgets,
      6: {
        ...defaultProps.widgets[6],
        tabIndex: 14,
      },
      9: {
        ...defaultProps.widgets[9],
        tabIndex: 1,
      },
    },
    zones: {
      ...defaultProps.zones,
      [4]: {
        ...defaultProps.zones[4],
        bounds: {
          left: 0,
          top: 20,
          right: 5,
          bottom: 54,
        },
      },
      [6]: {
        ...defaultProps.zones[6],
        bounds: {
          left: 10,
          top: 20,
          right: 99,
          bottom: 54,
        },
        widgets: [6],
      },
      [9]: {
        ...defaultProps.zones[9],
        bounds: {
          left: 10,
          top: 54,
          right: 99,
          bottom: 110,
        },
        widgets: [9],
      },
    },
  };

  export const floatingOpenedZone6: ZonesManagerProps = {
    ...openedZone6,
    zones: {
      ...openedZone6.zones,
      6: {
        ...openedZone6.zones[6],
        floating: {
          bounds: {
            left: 0,
            top: 0,
            right: 10,
            bottom: 10,
          },
          stackId: 1,
        },
      },
    },
  };

  export const merged9To6: ZonesManagerProps = {
    ...openedZone6,
    widgets: {
      ...openedZone6.widgets,
      6: {
        ...openedZone6.widgets[6],
        tabIndex: -1,
      },
      9: {
        ...openedZone6.widgets[9],
        tabIndex: 1,
      },
    },
    zones: {
      ...openedZone6.zones,
      6: {
        ...openedZone6.zones[6],
        bounds: {
          left: 10,
          top: 20,
          right: 99,
          bottom: 110,
        },
        widgets: [6, 9],
      },
      9: {
        ...openedZone6.zones[9],
        widgets: [],
      },
    },
  };

  export const merged6To9: ZonesManagerProps = {
    ...openedZone6,
    widgets: {
      ...openedZone6.widgets,
      6: {
        ...openedZone6.widgets[6],
        tabIndex: 1,
      },
      9: {
        ...openedZone6.widgets[9],
        tabIndex: -1,
      },
    },
    zones: {
      ...openedZone6.zones,
      6: {
        ...openedZone6.zones[6],
        bounds: {
          left: 10,
          top: 20,
          right: 99,
          bottom: 110,
        },
        widgets: [],
      },
      9: {
        ...openedZone6.zones[9],
        widgets: [9, 6],
      },
    },
  };

  export const merged9To8: ZonesManagerProps = {
    ...defaultProps,
    widgets: {
      ...defaultProps.widgets,
      8: getDefaultWidgetProps(8),
      9: {
        ...getDefaultWidgetProps(9),
        tabIndex: 1,
      },
    },
    zones: {
      ...defaultProps.zones,
      8: {
        ...defaultProps.zones[8],
        allowsMerging: true,
        bounds: {
          left: 10,
          top: 20,
          right: 99,
          bottom: 110,
        },
        widgets: [8, 9],
      },
      9: {
        ...defaultProps.zones[9],
        widgets: [],
      },
    },
  };

  export const merged9And6To6: ZonesManagerProps = {
    ...merged9To6,
    widgets: {
      ...merged9To6.widgets,
      6: {
        ...merged9To6.widgets[6],
        tabIndex: 1,
      },
      9: {
        ...merged9To6.widgets[9],
        tabIndex: -1,
      },
    },
    zones: {
      ...merged9To6.zones,
      6: {
        ...merged9To6.zones[6],
        widgets: [9, 6],
      },
    },
  };

  export const merged9And3To6: ZonesManagerProps = {
    ...merged9To6,
    widgets: {
      ...merged9To6.widgets,
      3: {
        ...merged9To6.widgets[3],
        tabIndex: 1,
      },
      6: {
        ...merged9To6.widgets[6],
        tabIndex: -1,
      },
      9: {
        ...merged9To6.widgets[9],
        tabIndex: 1,
      },
    },
    zones: {
      ...merged9To6.zones,
      3: {
        ...merged9To6.zones[3],
        widgets: [],
      },
      6: {
        ...merged9To6.zones[6],
        bounds: {
          left: 10,
          top: 2,
          right: 99,
          bottom: 110,
        },
        widgets: [6, 9, 3],
      },
    },
  };

  export const merged3To2: ZonesManagerProps = {
    ...defaultProps,
    widgets: {
      ...defaultProps.widgets,
      2: {
        ...defaultProps.widgets[2],
        tabIndex: -1,
      },
      3: {
        ...defaultProps.widgets[3],
        tabIndex: 1,
      },
    },
    zones: {
      ...defaultProps.zones,
      2: {
        ...defaultProps.zones[2],
        bounds: {
          left: 55,
          top: 20,
          right: 125,
          bottom: 30,
        },
        widgets: [2, 3],
      },
      3: {
        ...defaultProps.zones[3],
        widgets: [],
      },
    },
  };

  export const merged6To4: ZonesManagerProps = {
    ...defaultProps,
    widgets: {
      ...defaultProps.widgets,
      4: {
        ...defaultProps.widgets[4],
        tabIndex: -1,
      },
      6: {
        ...defaultProps.widgets[6],
        tabIndex: 1,
      },
    },
    zones: {
      ...defaultProps.zones,
      4: {
        ...defaultProps.zones[4],
        bounds: {
          left: 5,
          top: 20,
          right: 125,
          bottom: 30,
        },
        widgets: [4, 6],
      },
      6: {
        ...defaultProps.zones[6],
        widgets: [],
      },
    },
  };

  export const merged9To7: ZonesManagerProps = {
    ...defaultProps,
    widgets: {
      ...defaultProps.widgets,
      7: {
        ...defaultProps.widgets[7],
        tabIndex: -1,
      },
      9: {
        ...defaultProps.widgets[9],
        tabIndex: 1,
      },
    },
    zones: {
      ...defaultProps.zones,
      7: {
        ...defaultProps.zones[7],
        bounds: {
          left: 5,
          top: 20,
          right: 125,
          bottom: 30,
        },
        widgets: [7, 9],
      },
      9: {
        ...defaultProps.zones[9],
        widgets: [],
      },
    },
  };

  export const merged4To9: ZonesManagerProps = {
    ...defaultProps,
    widgets: {
      ...defaultProps.widgets,
      4: {
        ...defaultProps.widgets[4],
        tabIndex: 1,
      },
      9: {
        ...defaultProps.widgets[9],
        tabIndex: -1,
      },
    },
    zones: {
      ...defaultProps.zones,
      9: {
        ...defaultProps.zones[9],
        widgets: [9, 4],
      },
    },
  };

  export const merged6And4To3: ZonesManagerProps = {
    ...defaultProps,
    widgets: {
      ...defaultProps.widgets,
      3: {
        ...defaultProps.widgets[3],
        tabIndex: -1,
      },
      4: {
        ...defaultProps.widgets[4],
        tabIndex: -1,
      },
      6: {
        ...defaultProps.widgets[6],
        tabIndex: -1,
      },
    },
    zones: {
      ...defaultProps.zones,
      3: {
        ...defaultProps.zones[3],
        widgets: [3, 6, 4],
      },
      6: {
        ...defaultProps.zones[6],
        bounds: {
          left: 10,
          top: 2,
          right: 99,
          bottom: 110,
        },
        widgets: [],
      },
    },
  };

  export const merged9And8To7: ZonesManagerProps = {
    ...defaultProps,
    widgets: {
      ...defaultProps.widgets,
      7: {
        ...defaultProps.widgets[7],
        horizontalAnchor: HorizontalAnchor.Left,
        tabIndex: 1,
      },
      8: {
        ...defaultProps.widgets[8],
        horizontalAnchor: HorizontalAnchor.Left,
        tabIndex: -1,
      },
      9: {
        ...defaultProps.widgets[9],
        horizontalAnchor: HorizontalAnchor.Left,
        tabIndex: -1,
      },
    },
    zones: {
      ...defaultProps.zones,
      7: {
        ...defaultProps.zones[7],
        bounds: {
          bottom: 100,
          left: 20,
          right: 80,
          top: 10,
        },
        widgets: [7, 8, 9],
      },
      8: {
        ...defaultProps.zones[8],
        widgets: [],
        allowsMerging: true,
      },
      9: {
        ...defaultProps.zones[9],
        widgets: [],
      },
    },
  };
}

export default TestProps;
