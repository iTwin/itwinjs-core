# Guidelines for Contributing to iTwin.js UI Source Code

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

In order to maintain consistency in the iTwin.js UI source code, please abide by the following guidelines for classes and React components.

## Guidelines

* Include a copyright notice at the top of __all__ TypeScript and CSS/Sass files. The copyright notice comment should be similar to the following:

```typescript
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
```

* Document __all__ exported classes, interfaces, enums, types, etc.
* Add release tags (`@public`, `@beta`, `@alpha` or `@internal`) to all exported classes, interfaces, enums, types, etc. For more information on release tags, see [Release Tags](https://github.com/iTwin/itwinjs-core/blob/master/docs/learning/guidelines/release-tags-guidelines.md).
* In addition, it’s preferable that all *Props interface members and component public methods be documented. You can put `@internal` on React lifecycle and render methods.
* Add a,

  ```ts
  /** @packageDocumentation
  * @module xyz
  */
  ```

  comment to the top of the TypeScript file for the documentation module. An existing documentation module will often be appropriate to use. However, if you need to add a documentation module, see additional guidelines below. Example of `@module` comment:

  ```ts
  /** @packageDocumentation
   * @module Button
  */
  ```

* Use the theme colors (e.g. $buic-text-color, $buic-background-control, $buic-background-widget, etc.). These are located in `imodeljs/ui/core/src/ui-core/style/themecolors.scss`. Please do __not__ use $uicore-text-color, $uicore-black, $uicore-white,  $uicore-gray*, etc.)
* Include an appropriate prefix on CSS class names to prevent class name clashes (e.g. `uifw-` in ui-framework, `core-` in ui-core, `components-` in ui-components, `nz-` in ui-ninezone)
* Add an export for the component to the barrel file of the package (e.g. ui-framework.ts, ui-components.ts, ui-core.ts, ui-ninezone.ts). Example:

```typescript
export * from "./ui-core/base/UiEvent";
```

* Localize all strings to be seen by the user and use `i18n.translate` to get the localized string. Please do __not__ use hard-coded strings. The translatable strings should be in a JSON file in the `public/locales/en` of the repository. Example:

```json
{
  . . .
  "dialog": {
    "ok": "OK",
    . . .
  }
}
```

```typescript
buttonText = UiCore.i18n.translate("UiCore:dialog.ok");
```

* Run `npm run extract-api` to update the `*api.md` file for the package
* Write unit tests for the new component or class. The tests should cover as many code statements, branches, functions and lines as possible (100% is the goal). To run the tests, run `npm run test` or `rush test`. To run coverage, run `npm run cover`. To see the coverage report, open the report from one of the following directories in your browser:
  * imodeljs/ui/framework/lib/test/coverage/lcov-report/index.html
  * imodeljs/ui/core/lib/test/coverage/lcov-report/index.html
  * imodeljs/ui/components/lib/test/coverage/lcov-report/index.html
  * imodeljs/ui/ninezone/lib/test/coverage/lcov-report/index.html

## New Documentation Module

If the component’s documentation @module is new, please follow these guidelines:

* Add a `@docs-group-description` comment to the barrel file of the package. Example:

```js
/**
 * @docs-group-description Button
 * Classes for working with various Buttons.
 */
```

* Add the module to the imodeljs/docs/ui/reference/leftNav.md file in alphabetical order. Example:

```md
- [Button]($core:Button)
```

* Add the module to the appropriate `index.md` in the Learning section (e.g. imodeljs/docs/ui/learning/components/index.md or imodeljs/docs/ui/learning/core/index.md). Example:

```md
* [Button](./Button.md)
```

* Add a markdown file in the same folder as the `index.md` above (e.g. imodeljs/docs/ui/learning/components/Timeline.md)
* Add learning content and an example usage to the new markdown file
