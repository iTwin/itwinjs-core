/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { NineZoneProps, getDefaultProps } from "@src/zones/state/NineZone";

export namespace TestProps {
  export const defaultProps = getDefaultProps();
  export const openedZone6: NineZoneProps = {
    ...defaultProps,
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
        widgets: [
          {
            id: 6,
            tabIndex: 14,
          },
        ],
      },
      [9]: {
        ...defaultProps.zones[9],
        bounds: {
          left: 10,
          top: 54,
          right: 99,
          bottom: 110,
        },
        widgets: [
          {
            id: 9,
            tabIndex: 1,
          },
        ],
      },
    },
  };

  export const floatingOpenedZone6: NineZoneProps = {
    ...openedZone6,
    zones: {
      ...openedZone6.zones,
      6: {
        ...openedZone6.zones[6],
        floatingBounds: {
          left: 0,
          top: 0,
          right: 10,
          bottom: 10,
        },
      },
    },
  };

  export const merged9To6: NineZoneProps = {
    ...openedZone6,
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
        widgets: [
          {
            id: 6,
            tabIndex: -1,
          },
          {
            id: 9,
            tabIndex: 1,
          },
        ],
      },
      9: {
        ...openedZone6.zones[9],
        widgets: [],
      },
    },
  };

  export const merged6To9: NineZoneProps = {
    ...openedZone6,
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
        widgets: [
          {
            id: 9,
            tabIndex: -1,
          },
          {
            id: 6,
            tabIndex: 1,
          },
        ],
      },
    },
  };

  export const merged9And6To6: NineZoneProps = {
    ...merged9To6,
    zones: {
      ...merged9To6.zones,
      6: {
        ...merged9To6.zones[6],
        widgets: [
          {
            id: 9,
            tabIndex: -1,
          },
          {
            id: 6,
            tabIndex: 1,
          },
        ],
      },
    },
  };

  export const swapped6and9: NineZoneProps = {
    ...defaultProps,
    zones: {
      ...defaultProps.zones,
      6: {
        ...defaultProps.zones[6],
        bounds: {
          left: 10,
          top: 20,
          right: 99,
          bottom: 54,
        },
        widgets: [
          {
            id: 9,
            tabIndex: 1,
          },
        ],
      },
      9: {
        ...defaultProps.zones[9],
        bounds: {
          left: 10,
          top: 54,
          right: 99,
          bottom: 110,
        },
        widgets: [
          {
            id: 6,
            tabIndex: 1,
          },
        ],
      },
    },
  };

  export const merged9And3To6: NineZoneProps = {
    ...merged9To6,
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
        widgets: [
          {
            id: 6,
            tabIndex: -1,
          },
          {
            id: 9,
            tabIndex: 1,
          },
          {
            id: 3,
            tabIndex: 1,
          },
        ],
      },
    },
  };

  export const merged3To2: NineZoneProps = {
    ...defaultProps,
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
        widgets: [
          {
            id: 2,
            tabIndex: -1,
          },
          {
            id: 3,
            tabIndex: 1,
          },
        ],
      },
      3: {
        ...defaultProps.zones[3],
        widgets: [],
      },
    },
  };

  export const merged6To4: NineZoneProps = {
    ...defaultProps,
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
        widgets: [
          {
            id: 4,
            tabIndex: -1,
          },
          {
            id: 6,
            tabIndex: 1,
          },
        ],
      },
      6: {
        ...defaultProps.zones[6],
        widgets: [],
      },
    },
  };

  export const merged9To7: NineZoneProps = {
    ...defaultProps,
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
        widgets: [
          {
            id: 7,
            tabIndex: -1,
          },
          {
            id: 9,
            tabIndex: 1,
          },
        ],
      },
      9: {
        ...defaultProps.zones[9],
        widgets: [],
      },
    },
  };

  export const merged4To9: NineZoneProps = {
    ...defaultProps,
    zones: {
      ...defaultProps.zones,
      9: {
        ...defaultProps.zones[9],
        widgets: [
          {
            id: 9,
            tabIndex: -1,
          },
          {
            id: 4,
            defaultZoneId: 6,
            tabIndex: 1,
          },
        ],
      },
    },
  };

  export const merged6And4To3: NineZoneProps = {
    ...defaultProps,
    zones: {
      ...defaultProps.zones,
      3: {
        ...defaultProps.zones[3],
        widgets: [
          {
            id: 3,
            tabIndex: -1,
          },
          {
            id: 6,
            tabIndex: -1,
          },
          {
            id: 4,
            defaultZoneId: 9,
            tabIndex: -1,
          },
        ],
      },
      6: {
        ...merged9To6.zones[6],
        bounds: {
          left: 10,
          top: 2,
          right: 99,
          bottom: 110,
        },
        widgets: [
          {
            id: 6,
            tabIndex: -1,
          },
          {
            id: 9,
            tabIndex: 1,
          },
          {
            id: 3,
            tabIndex: 1,
          },
        ],
      },
    },
  };
}

export default TestProps;
