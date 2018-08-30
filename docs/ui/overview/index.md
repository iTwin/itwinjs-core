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