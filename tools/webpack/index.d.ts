/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/// <reference types="node" />
/// <reference types="mocha" />
/// <reference types="chai" />
/// <reference types="react" />
/// <reference types="react-dom" />

declare var sinon: typeof import("sinon");
declare var expect: Chai.ExpectStatic;
declare var shallow: typeof import("enzyme").shallow;
declare var mount: typeof import("enzyme").mount;

declare namespace Polymer {
  type Element = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { class: string, children: any };

  var Element: {
    prototype: Element;
    new(): Element;
  };
}

declare module "*.svg" {
  const moreVerticalSvg: any;
  export default moreVerticalSvg;
}

declare namespace JSX {
  interface IntrinsicAttributes {
    store?: any;
  }
}

declare namespace Chai {
  interface Assertion {
    matchSnapshot(resetSnapshot?: boolean): void;
  }
}
