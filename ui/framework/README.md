# The iModelJs Library

Copyright © Bentley Systems, Inc. 2018

The iModelJs ui-framework package is a portion of the iModelJs User Interface library. It consists of major fragments of code that combine the
functionality from the iModelJs-core packages with the ui-core and ui-components packages to implement substantial functionality that can be
used within an iModelJs application. See the ui-sampleapp package within the iModelJs-ui monorepo for examples of usage.

The ui-framework package makes use of React for rendering of the user interface, and uses react-redux and its concept of the state store for
actions using reducers.

There are a number of sub-frameworks, each which has a set of components, actions, and reducers, and contributes to the overall State. Each such
sub-framework is contained in a separate folder.

