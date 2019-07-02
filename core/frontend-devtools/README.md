# @bentley/frontend-devtools

Copyright © 2019 Bentley Systems, Incorporated. All rights reserved.

## Description

The __@bentley/frontend-devtools__ package contains various tools and widgets designed to help track information and diagnose issues related to the iModel.js front-end display system. It is intended chiefly for use by developers.

## Usage

The easiest way to use this package is to instantiate a `DiagnosticsPanel`, supplying a `Viewport` for which the panel will supply diagnostics and tools.
You can integrate the panel into your UI by append its `element` HTMLElement to your DOM.
