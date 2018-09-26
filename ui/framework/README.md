# The iModel.js Library

Copyright © Bentley Systems, Inc. 2018

The iModel.js ui-framework package is a portion of the iModel.js User Interface library. It consists of major fragments of code that combine the
functionality from the iModel.js-core packages with the ui-core and ui-components packages to implement substantial functionality that can be
used within an iModel.js application. See the ui-sampleapp package within the iModel.js-ui monorepo for examples of usage.

The ui-framework package makes use of React for rendering of the user interface, and uses react-redux and its concept of the state store for
actions using reducers.

There are a number of sub-frameworks, each which has a set of components, actions, and reducers, and contributes to the overall State. Each such
sub-framework is contained in a separate folder.

