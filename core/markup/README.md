# @itwin/core-markup

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

The __@itwin/core-markup__ package contains classes for creating and editing SVG-based markup for iTwin.js Viewports.

## SVG sanitizing

SVG supplied by the application is sanitized with [DOMPurify](https://github.com/cure53/DOMPurify) before it is added to the document. This applies to saved markup passed to `MarkupApp.start` and to symbols placed with `SymbolTool`.

Sanitizing removes content that can run script, such as `script` elements, event handler attributes and `javascript:` links, and content that is not SVG. `use` elements can only reference content in the same document.

Markup created with the built-in markup tools is not affected.

## Documentation

See the [iTwin.js](https://www.itwinjs.org) documentation for more information.
