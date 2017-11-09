/// <reference types="mocha" />
/// <reference path="./defaultImports.ts" />

declare namespace Polymer {
  type Element = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {class: string, children: any};

  var Element: {
    prototype: Element;
    new(): Element;
  };
}

declare module "*.svg" {
  const value: any;
  export default value;
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