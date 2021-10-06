# @itwin/appui-layout-react

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

The __@itwin/appui-layout-react__ package contains React components for 9-Zone UI and other purposes.

## Documentation

See the [iTwin.js](https://www.itwinjs.org) documentation for more information.

## Usage

### Installation

```shell
npm install @itwin/appui-layout-react
```

### Basic Usage

```javascript
import BackButton from "@itwin/appui-layout-react";

<BackButton />
```

### Components

* Buttons
  * App
  * Back
  * Button
  * Close
* ...

### Local Demo

```shell
cd imodeljs
rush install
rush build
cd ui/ninezone
npm start
```

### Coding Guidelines

Look at the existing code and try to keep your code similar.

* Every component class name should follow nz-path-to-component-componentName naming style.

* Every inner class name should have nz- prefix.

* Import the Sass classnames with: `import "./YourComponent.scss";`

* Every component should accept `className?: string` and `style?: React.CSSProperties` props.

* Components that accept one or a list of children should use the `children?: React.ReactNode` prop.

### Advice

* Use [classnames](https://www.npmjs.com/package/classnames) function to create className strings for the elements.

* Use `const className` inside render for the root element className value.
