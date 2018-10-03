# @bentley/ui-framework

Copyright © Bentley Systems, Inc. 2018

## Description

The __@bentley/ui-framework__ package contains application fragments for Login, Project, iModel and View selection, and configuration of the application UI including the Backstage, Frontstages, Widgets, etc.

The ui-framework package is a portion of the iModel.js User Interface library. It consists of major fragments of code that combine the
functionality from the imodeljs-frontend and imodeljs-clients packages with the ui-core, ui-components and ui-ninezone packages to implement substantial
functionality that can be used within an iModel.js application.

The ui-framework package makes use of React for rendering of the user interface, and uses react-redux and its concept of the state store for
actions using reducers.

There are a number of sub-frameworks, each which has a set of components, actions, and reducers, and contributes to the overall State. Each such
sub-framework is contained in a separate folder.

## Documentation

See the [iModel.js](https://www.imodeljs.org) documentation for more information.
