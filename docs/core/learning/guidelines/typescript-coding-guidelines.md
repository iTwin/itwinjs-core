# iModelJs TypeScript Coding Guidelines

These are the TypeScript coding guidelines that we expect all iModelJs contributors to follow.
Where possible, these guidelines are enforced through our TSLint configuration file (tslint.json).

## Names

1. Use PascalCase for type names.
2. Do **not** use `I` as a prefix for interface names.
3. Use PascalCase for enum values.
4. Use camelCase for function names.
5. Use camelCase for property names and local variables.
6. Use `_` as a prefix for private properties.
7. Use whole words in names when possible. Only use abbreviations where their use is common and obvious.
8. We use "Id", "3d", "2d" rather than capital D.
9. Do not use `Dgn` as a prefix in TypeScript code. Often no prefix is necessary, but if it is, prefer `IModel` or `Db` instead.

## Files

1. Use the **.ts** file extension for TypeScript files
2. TypeScript file names should be PascalCase

## Types

1. Do not export types/functions unless you need to share it across multiple components.
2. Do not introduce new types/values to the global namespace.
3. Within a file, type definitions should come first.

## Do not use `null`

* Use `undefined`. **Do not** use `null` anywhere.

## `===` and `!==` Operators

* Use `===` and `!==` operators whenever possible.
* The `==` and `!=` operators do type coercion, which is both inefficient and can lead to unexpected behavior.

## Strings

1. Use double quotes for strings.

## General Constructs

1. Always use semicolons. JavaScript does not require a semicolon when it thinks it can safely infer its existence. Not using a semicolon is confusing at best and a bug at worst.
2. Use curly braces `{}` instead of `new Object()`.
3. Use brackets `[]` instead of `new Array()`.

## Preserve vertical screen space

Programmer monitors are almost always wider than they are tall. It is common for widths to be at least 120 columns but heights to be less than 100. Therefore to make the greatest use of screen real estate, it is desireable to preserve vertical screen space wherever possible.

1. Some codebases advocate breaking lines at 80 columns. This is silly and wasteful. Don't break lines before 120 columns.
1. Don't use blank lines unnecessarily. For example the first line of a function *not* should be a blank line.
1. There should never be more than one blank line in a row.
1. **Don't use** clever/pretty multi-line comment blocks to separate sections of code. One line suffices, if you absolutely feel the need to include them. Usually they aren't necessary. Your well written, accurate and complete documentation and logical source organization is all the help anyone needs to understand your code.
1. If a function has only a single statement, it **should be** on one line.

```ts
  // WRONG !!!
  public middle(): number {
     return this.minimum + ((this.maximum - this.minimum) / 2.0);
  }
```

```ts
  // Correct (1 line vs 3) !!!
  public middle(): number { return this.minimum + ((this.maximum - this.minimum) / 2.0); }
```

## Style

1. Use arrow functions over anonymous function expressions.
1. Open curly braces always go on the same line as whatever necessitates them.
1. **Never** use `var`. Instead use `const` where possible and otherwise use `let`.
1. Use a single declaration per variable statement (i.e. use `let x = 1; let y = 2;` over `let x = 1, y = 2;`).
1. Parenthesized constructs should have no surrounding whitespace. A single space follows commas, colons, semicolons, and operators in those constructs. For example:
   1. `for (let i = 0, n = str.length; i < 10; ++i) { }`
   2. `if (x < 10) { }`
   3. `public calculate(x: number, y: string): void { . . . }`
1. Use 2 spaces per indentation. Do not use tabs!
1. Turn on `tslint` in your editor to see violations of these rules immediately.

## Return

If a return statement has a value you should not use parenthesis () around the value.

``` ts
return ("Hello World!"); // bad

return "Hello World!"; // good
```

Certain schools of programming advice hold that every method should have only one return statement. This could not be more misguided. *Always* return as soon as you know there's *no reason to proceed*.

``` ts
// bad!!
public getFirstUser(): Person | undefined {
  let firstUser?: Person;
  if (this.hasUsers()) {
    if (!this.usersValidated()) {
      if (this.validateUsers())
        firstUser = this.getUser(0);
    } else {
        firstUser = this.getUser(0);
    }
  }
  return firstUser;
}

// ok!!
public getFirstUser(): Person | undefined {
  if (!this.hasUsers())
    return undefined;

  if (!this.usersValidated() && !this.validateUsers())
      return undefined;

  return return this.getUser(0);
}

// best!!! For a simple case like this that is deciding between 2 return values
public getFirstUser(): Person | undefined {
  const userInvalid = !this.hasUsers() || (!this.usersValidated() && !this.validateUsers());
  return userInvalid ? undefined : this.getUser(0);
}
```

Always explicitly define a return type for methods that are more than one line. This can help TypeScript validate that you are always returning something that matches the correct type.

``` ts
// bad!! No return type specified
public getOwner(name: string) {
  if (this.isReady)
    return this.widget.getOwner(); // is this a Person???
  ...
  return new Person(name);
}

// good!!
public getOwner(name: string): Person {
  if (this.isReady)
    return this.widget.getOwner(); // if this is not a Person, compile error
  ...
  return new Person(name);
}
```

for methods that are one line and for which the return type is obvious, it is not necessary to include the return type:

``` ts
// fine, return type is obvious
public getCorner() { return new Point3d(this.x, this.y); }
```

When calling methods, the best practice would be to explicitly specify the return type. In the case of async methods calls, these calls almost always involve awaiting the results, and this practice guards against omitting the await keyword - a frequent cause of hard to debug race conditions.

``` ts
// bad!! no return type specified for async call, and missing await is not caught by the compiler
const iModels = iModelHub.getIModels(projectId);

// good!! omitting the await would be caught by the compiler as a type mismatch
const iModel: IModel[] = await iModelHub.getIModels(projectId);
```

## Getters and Setters

A common pattern is to have a `private` member that is read/write privately within the class, but read-only to the public API. This can be a good use for a getter. For example:

``` ts
class Person {
  private _name: string;
  public get name(): string { return _name; } // read-only to public API, so no setter provided
}
```

Note, however, if the value supplied by the getter is established in the constructor and *can never be changed*, the following may be preferable:

``` ts
class Person {
   constructor(public readonly name: string) { }
}
```

Another valid use of getters and setters is when you want to give the appearance of having a public member but you don't actually store the data that way. For example:

``` ts
class PersonName {
  constructor (public firstName: string, public lastName: string) { }
  public get fullName(): string { return this.firstName + " " + this.lastName; }
  public set fullName(name: string): void {
    const names: string[] = name.split(" ");
    this.firstName = names[0] || "";
    this.lastName = names[1] || "";
  }
}
```

It is also good to use getters and setters if data validation is required (which isn't possible in the case of a direct assignment to a public member).

There are cases where getters and setters would be overkill. For example:

``` ts
// This is fine!
class Corner {
  constructor(public x: number, public y: number, public z: number) { }
}
```

## use "?:" syntax vs. " | undefined"

When declaring member variables or function arguments, use the TypeScript "?:" syntax vs. adding " | undefined" for variables that can be undefined. For example

```ts
class Role {
  public name: string;
  public description: string | undefined; // Wrong !!
}
```

```ts
class Role {
  public name: string;
  public description?: string; // Correct !!
}
```

## Enforcing getters for certain function names

If a public method takes no parameters and its name begins with a keyword such as "is", "has", or "want", the method should be a getter (specified by using the "get" modifier in front of the method name). By doing this, the method may be accessed as a property of the object rather than as a function. This avoids confusion over whether it is necessary to include parenthesis when using the method to gain access to the value.

This rule will be enforced by the Typescript linter. If the value being returned is expensive to compute, consider using a different name for the method to reflect this. Possible examples may include prefixing the name with words such as "compute" or "calculate".

## Don't repeat type names unnecessarily

TypeScript is all about adding types to JavaScript. However, the compiler automatically infers type by context, and it is therefore not necessary to decorate every member or variable declaration with its type, if it is obvious. That only adds clutter and obscures the real code. For example,

```ts
  let width: number = 7.3; // useless type declaration
  public isReady: boolean = false; // useless type declaration
  public readonly origin: Point3d = new Point3d(); // useless type declaration

  let width = 7.3; // correct
  public isReady = false; // correct
  public readonly origin = new Point3d(); // correct
  const upVector: Vector3d = rMatrix.getRow(1); // fine, helps readability. Not strictly necessary.
```

However, as stated above, it is a good idea to always include the return type of a function if it is more than one line, to make sure no return path has an unexpected type.

## Error Handling

For public-facing APIs we have decided to prefer exceptions (`throw new Error`) and rejecting promises (`Promise.reject`) over returning status codes. The reasons include:

1. Exceptions can keep your code clean of *if error status then return* clutter. For example, a series of API calls could each be affected by network outages but the error handling would be the same regardless of which call failed.
2. Exceptions let you return the natural return value of success rather than an unnatural composite object.
3. Exceptions can carry more information than a status return.
4. Status returns can be ignored, but exceptions can't. If the immediate layer does not handle the exception it will be bubbled up to the outer layer.
5. Note that TypeScript/JavaScript doesn't have the same library boundary issues that C++ has with exceptions
6. The optional `message` property of an `Error` should (if defined) hold an English debugging message that is not meant to be localized. Instead, applications should catch errors and then separately provide a context-appropriate localized message.

> Note: Returning `SomeType` and throwing an `Error` is generally preferred over returning `SomeType | undefined`.

## Asynchronous Programming

1. Use `Promise`
2. Use `return Promise.reject(new MyError())` rather than resolving to an error status. The object passed into `Promise.reject` should be a subclass of `Error`. It is easy to forget the `return` so be careful.
3. Prefer `async`/`await` over `.then()` constructs

## Reference Documentation Comments

We have standardized on [TypeDoc](http://typedoc.org/guides/doccomments/) for generating reference documentation.

TypeDoc runs the TypeScript compiler and extracts type information from the generated compiler symbols. Therefore, TypeScript-specific elements like classes, enumerations, property types, and access modifiers will be automatically detected.
All comments are parsed as markdown. Additionally, you can link to other classes, members, or functions using double square brackets.

The following JavaDoc tags are supported by TypeDoc:

* `@param`
  * The parameter name and type are automatically propagated into the generated documentation, so `@param` should only be included when more of a description is necessary.
  * Use plain `@param`. Do not use `@param[in]` or `@param[out]` as this confuses TypeDoc.
  * The parameter description should start with a capital letter.
* `@returns`
  * The return type is automatically propagated into the generated documentation, so `@returns` should only be included when more of a description is necessary.
  * The `@returns` description (when provided) should start with *Returns* for readability within the generated documentation.
  * The `@return` JavaDoc tag is also supported, but `@returns` is preferred for readability and consistency with `@throws`.
  <!--
  - *TODO:*
    - *Need to decide how to document methods returning `Promise<T>`. Should the description mention a `Promise` or just `T` since the return type will clearly indicate `Promise` and using `await` will cause `T` to be returned.*
  -->
* `@throws`
  * If a method can potentially throw an `Error`, it should be documented with `@throws` as there is no automated way that thrown errors make it into the generated documentation.
  * There can be multiple `@throws` lines (one for each different `Error` class) in a method comment.
  * A link to the `Error` class should be incorporated into the description.
* `@hidden`
  * TypeDoc will not document the class, method, or member. This is useful for internal-only utility methods that must be public, but should not be called directly by outside API users.

See below for the recommended format of documentation comments:

``` ts
/** This is a valid single-line comment. */
public myMethod1(): void { }

/**
 * This is a valid multi-line comment.
 * The description uses double brackets to link to [[NameOfRelatedClass]].
 * The description also links to [[myMethod1]].
 * @param param1 Description of parameter
 * @returns Returns the number associated with param1.
 * @throws [[NameOfErrorClass]] when the parameter is invalid.
 */
public myMethod2(param1: string): number { /* ... */ }

```

## Defining JSON 'Wire Formats'

A common pattern in JavaScript is to transfer information from one context to another by serializing/deserializing to strings.

For example:

* from a *backend* program to a *frontend* program, or vice-versa
* from C++ to JavaScript, or vice-versa
* saving object state to/from a persistent store, such as a database

Since JSON strings are often sent over an internet connection, these strings are commonly referred to as "wire formats".

This pattern is *built-in* to JavaScript via [JSON](https://www.json.org/), using the methods [JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) and [JSON.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse). However, those methods are defined to take/generate objects of type `any`. That gives callers no help interpreting the contents of the `JSON.parse` result or supplying the correct input to `JSON.stringify`. Fortunately TypeScript has very nice techniques for defining the *shape* of an object, via [Interfaces](https://www.typescriptlang.org/docs/handbook/interfaces.html) and [Type Aliases](https://www.typescriptlang.org/docs/handbook/advanced-types.html).

Our convention is to define either a `Type Alias` or an `interface` with the suffix `Props` (for properties) for any information that can be serialized to/from JSON. There will often be an eponymous class without the `Props` suffice to supply methods for working with instances of that type. A serializeable class `Abc` will usually implement `AbcProps`, if it is an `interface`. Then, either its constructor or a static `fomJson` method will take an `AbcProps` as its argument, and it will override the `toJSON` method to return an `AbcProps`. Anyone implementing the "other end" of a JSON serialized type will then know what properties to expect/include.

For example, in `@bentley/geometry-core` we have a class called `Angle`. You will find code similar to:

```ts
/** The Properties for a JSON representation of an Angle.
 * If value is a number, it is in *degrees*.
 * If value is an object, it can have either degrees or radians.
 */
export type AngleProps = number | { degrees: number } | { radians: number };
export class Angle {
  . . .
  public static fromJSON(json?: AngleProps): Angle {. . .}
  public toJSON(asRadians?: boolean): AngleProps { return asRadians ? { radians: this.radians } : { degrees: this.degrees }; }
}
```

From this we can tell that an Angle may be serialized to/from JSON as either:

1. a `number`, in which case it will be a value in degrees
2. an object that:
* has a member named `degrees` of type `number`, or
* has a member named `radians` of type `number`.

Likewise, in `@bentley/geometry-core`, we have a class called XYZ. This is a base class for 3d points and vectors. We define the following type:

```ts
/** Properties for a JSON XYZ.
 * If an array, its values are [x,y,z].
 * @note Any undefined values are 0.
 */
export type XYZProps = { x?: number; y?: number; z?: number } | number[];
```

That tells you that a value of type XYZ (either Point3d or a Vector3d) may be serialized to/from JSON as:

1. an object with optional members `x`, `y`, and `z` of type `number`, or
1. an array of `numbers`, in the order x, y, z.
1. Any `undefined` values will be 0.

A correctly implemented program that interprets a JSON string containing an XYZ value must handle both forms (object and array). However, it is free to choose either form for creating JSON strings from XYZ values.

## Copyright notice

Every .ts file should have this notice as its **first 3 lines**:

```ts
/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 20xx Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
```

verbatim, with the xx replaced with the current year.

## Source Code Editor

1. While not an absolute requirement, we recommend and optimize for [Visual Studio Code](https://code.visualstudio.com/). You will be likely be less productive if you attempt to use anything else. We recommend configuring the **TSLint** extension for Visual Studio Code and using our **tslint.json** to get real-time feedback.
