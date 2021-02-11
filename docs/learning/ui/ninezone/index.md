# 9-Zone UI Pattern

The 9-Zone pattern is a user interface layout for applications. It is an alternative to a ribbon or toolbar based interfaces.
Traditional toolbar and dialog interfaces compress the content into an ever shrinking area. They do not scale to large presentation screens or small mobile devices.
The 9-Zone UI Pattern allows applications to work across a range of devices and stop shrinking the content area.

## Core Principles

- Content is full screen
- UI appears on a layer above the content
- The UI layer is divided into zones. Each zone has a specific purpose
- Widgets not dialogs

## Zones

The 9-zone UI gets its name due to the fact that it divides the screen up into different zones.
Each zone has a specific purpose. These zones are positioned in a consistent orientation across all 9-zone UI apps.
This a list of the zones and their recommended contents:

1. Tools
2. Tool Settings
3. Navigation
4. App specific
5. Radial Hub & Context Bar
6. Browse
7. App specific
8. Status
9. Properties

![ninezone layout](./ninezone.png "Layout of the 9 Zones")

## Widgets

Widgets are configured to occupy one or more zones. Multiple widgets may be stacked within a zone.
Widgets may have one of 5 states: Off, Minimized, Open, Popup, Floating.
Pertaining to layout considerations, widgets float on the UI, either as free form or rectangular visuals.
The 9-Zone pattern includes a variety of strategies to support content that is larger than the widget area itself.

## Responsive strategy

To work across a range of devices and stop shrinking the content area, the layout will adjust depending on the size of the screen or device.

## Accessibility

For large touch screens the Radial Hub allows the user to bring the UI that may be out of reach to their location. The 9-Zone UI Pattern also supports keyboard shortcuts for accessing different parts of the UI.
