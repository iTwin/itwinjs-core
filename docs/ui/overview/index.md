<p style="text-align: center;">
![](./imodeljs.ico)
</p>
<h1 style="text-align: center;">
  iModelJs UI - React components and TypeScript library for building iModelJs application user interfaces
</h1>

## Introduction

iModelJs UI is a set of [React](https://www.reactjs.org) components and a [TypeScript](https://www.typescriptlang.org) library for building [iModelJs](https://imodeljs.github.io/iModelJs-docs-output) application user interfaces.

## Library Organization

The iModelJs UI library is divided into these NPM packages in the `@bentley` scope:

|Package Name|Description
|-----|-----
|**ui&#8209;core**|General purpose React components, such as Dialog, MessageBox, SearchBox, RadialMenu and SplitButton.
|**ui&#8209;components**|React components that are data-oriented, such as PropertyGrid, Table, Tree and Breadcrumb.
|**ui&#8209;ninezone**|React components for application user interface layouts following the Bentley 9&#8209;Zone pattern.
|**ui&#8209;framework**|Application fragments for Login, Project, iModel and View selection, and configuration of the application UI including the Backstage, Frontstages, Widgets, etc.
|**bwc**|Sass/SCSS library and React components for building standardized Bentley user interfaces.

## Application UI Configuration

There are numerous React components and TypeScript classes in the ui&#8209;framework NPM package for configuring the application user interface. The following are defined using these classes:

* Backstage
* Frontstages
* Content Groups
* Content Layouts
* Content Views
* Widgets
* Dialogs
* Status Bars and Fields
* Navigation Aids
* Tool Settings
* Tasks
* Workflows

## 9-Zone UI Pattern

The 9-Zone pattern is user interface layout for applications. It is an alternative to a ribbon or toolbar based interfaces.
Traditional toolbar and dialog interfaces compress the content into an ever shrinking area. They do not scale to large presentation screens or small mobile devices.
The 9-Zone UI Pattern allows applications to work across a range of devices and stop shrinking the content area.

### Core Principles

* Content is full screen
* UI appears on a layer above the content
* The UI layer is divided into zones. Each zone has a specific purpose
* Widgets not dialogs

### Zones

The 9-zone UI takes gets its name because it divides up the screen into different zones.
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

### Widgets

Widgets are configured to occupy one or more zones. Multiple widgets may be stacked within a zone.
Widgets may have one of 5 states: Off, Minimized, Open, Popup, Floating.
Pertaining to layout considerations, widgets float on the UI, either as free form or rectangular visuals.
The 9-Zone pattern includes a variety of strategies to support content that is larger than the widget area itself.

### Responsive strategy

To work across a range of devices and stop shrinking the content area, the layout will adjust depending of the size of the screen or device.

### Accessibility

For large touch screens the Radial Hub allows the user to bring the UI that may be out of reach to their location. The 9-Zone UI Pattern also supports keyboard shortcuts for accessing different parts of the UI.

For information on creating markdown links to internal site content, see:
[Linking](https://imodeljs.github.io/iModelJs-docs-output/learning/guidelines/documentation-link-syntax/).
