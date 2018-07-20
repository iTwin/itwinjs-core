# Tips for Converting from C++ to TypeScript

If you are converting existing C++ code to TypeScript, the following advice may be helpful.

## Naming

Follow the standard [TypeScript Coding Guidelines](./typescript-coding-guidelines.md), but in particular:

* method names in TypeScript always start with lower case letter. In C++ there is often the opposite convention, so every method name may change.
* remove "`m_`" prefix on member variables. TypeScript requires the `this.` prefix so there is no ambiguity with local variables names. For private member variables use the "`_`" prefix convention.
* remove prefixes from class names that don't add clarity. For example, `Dgn` should not be propagated.
* exported names only need to be unique within a file. Remember that every export is implicitly qualified by the file name. If they are ambiguous in the context of another file's imports, they can be "renamed" unambiguously.

## Private and Protected members

JavaScript does not support the concept of *private*, or *protected* members - they are TypeScript-only concepts. Therefore, there is no way to *really* stop someone from accessing members of a class.

Also, in C++, inlined accessor methods are "compiled away" and therefore add no runtime overhead. This is not true in JavaScript where accessor methods become members of the class prototype and have a runtime expense.

Therefore, in TypeScript there are fewer reasons to make members private and provide accessors. You will likely end up with _many more public members_ in TypeScript. This implies an enhanced need for good and accurate documentation.

for example, in C++:

```cpp
struct MyValue
{
private:
    int m_val;
public:
    MyValue(int val=0) {m_val=val;}
    int GetValue() {return m_val;}
    void SetValue(int val) {m_val = val;}
};
```

in TypeScript, can become:

``` ts
class MyValue {
  public constructor(public value = 0) { }
}
```

## Constructors / Destructors

TypeScript does not support:

* destructors
* overloaded constructors

You can only have one constructor, though often in JavaScript constructors test their argument types at runtime to allow more than one calling permutation. This happens every time the constructor is called, so be aware of performance implications.

TypeScript attempts to simulate the idea of multiple constructors, but since it compiles to JavaScript, that's not really possible. **Avoid using multiple constructors in TypeScript.**

If there is any cleanup work in the C++ destructor, other than freeing memory, you need to create a `destroy`-like method on the TypeScript side and explicitly call it where appropriate. This is very unfamiliar to a Javascript programmer, since there is no way to actually delete an object in JavaScript

## enums

In JavaScript, enums are a runtime object. This does have some advantages, such as the ability to reverse lookup the enum name from its value, and concepts like string enums and even heterogeneous enums. But, they add real overhead at runtime.

TypeScript adds an additional concept of [const enums](https://www.typescriptlang.org/docs/handbook/enums.html), which are similar to C++ enums. Const enums are completely invisible to JavaScript and are "compiled away" by the TypeScript compiler.

C++ enums should almost always be converted to `const enums` in TypeScript.

## Virtual methods

In JavaScript, **all** methods are virtual (actually, even member variables are "virtual)" in the C++ sense. That means that *any* method may be overridden in subclasses, even static methods.

Sometimes in C++ we have both a private virtual and public non-virtual method with the same name, except a leading underscore on the virtual method. This converts to just a single public method with the (previously virtual) implementation.

Note that TypeScript does not have an "override" keyword. So, if you attempt to override a method and misspell its name, you'll get no errors from the compiler. However, it will warn you about incorrect arguments and return types. This does complicate renaming methods on base classes, since no error is generated if the corresponding change is not reflected in subclasses.

TypeScript does support both abstract methods and abstract classes. In TypesScript just use the "abstract" keyword in both places.

## By-value members

JavaScript only supports heap-based, garbage collected, objects. So, there is no way to create a class with a member that "embeds" another object by-value, as is common in C++.

Therefore, when converting C++ code with by-value members, often the best approach is to use a "readonly" member in TypeScript. The readonly keyword enforces that the reference in the member variable can only be initialized in the constructor. This is similar to what the compiler does in C++. Any attempt to reassign the value will generate a compile error, and you will have to use a copy-assignment, much like the copy constructor in C++.

For example, given the following C++ code:

```cpp
struct ViewPlacement
{
private:
    Transform m_placement;
    DgnViewportP m_viewport;
public:
    ViewPlacement(TransformCR placement, DgnViewportP vp) : m_placement(placement), m_viewport(vp) {}
    void SetPlacement(TransformCR placement) {m_placement = placement;}
};
```

A natural straightforward conversion might look like:

```ts
// WRONG!!
export class ViewPlacement {
  private _placement: Transform;
  private _viewport?: Viewport;
  public constructor(placement: Transform, vp?: Viewport) {
    this._placement = placement;
    this._viewport = vp;
  }
  public setPlacement(placement: Transform): void { this._placement = placement; }
}
```

The problem is that the `_placement` member holds a *reference* to, not a copy of, the constructor argument. If the caller changes the value of that Transform after calling the constructor, the ViewPlacement structure will see the changed version, not the original value. This can cause subtle and hard-to-find bugs. Note also that the C++ SetPlacement method actually silently invokes Transform's copy constructor.

 A correct solution would be:

```ts
// Correct!!
export class ViewPlacement {
  private readonly _placement: Transform;
  public constructor(placement: Transform, private _viewport?: Viewport) {
    this._placement = placement.clone();
  }
  public setPlacement(placement: Transform): void { this._placement.setFrom(placement); }
}
```

If you had forgot to use ".setFrom" in the setPlacement method, it would generate a compiler error.

Here's another example:

```cpp
struct SomeParams : RefCountedBase
{
private:
    DPoint3d m_origin;
    RotMatrix m_rMatrix;
    double m_scale;
    bool m_invisible;
    ColorDef m_color;
    uint32_t m_weight;
    bvector<LineType> m_lines;
. . .
};
```

can become:

```ts
export class SomeParams {
  public readonly origin = new Point3d();
  public readonly rMatrix = RotMatrix.createIdentity();
  private _scale: number;
  private _invisible = false;
  private _color?: ColorDef;
  private _weight = 0;
  public readonly lines: LineType[] = [];
. . .
}
```

Notes:

* in TypeScript everything is garbage collected, so `RefCountBase` is irrelevant.
* any attempt to reassign `this.origin`, `this.rMatrix`, or `this.lines` will generate a compiler error. This matches the behavior in C++ where changes must always be copied by value. It may be less obvious in the case of `bvector`, but that is also by-value in C++.
* the `_color` member now works differently in TypeScript than C++. It was converted to a "reference that may be undefined". Care must be taken wherever code that uses `m_color` is converted to make sure it clones the input.
* the `_scale` member is uninitialized in the declaration above. It *must* be initialized in the constructor.
* if the C++ code provided "GetOriginR" and "GetRMatrixR() methods, making them public readonly member variables is equivalent.

## Nested classes

TypeScript does not support nested classes. Nested C++ classes become top-level classes in TypeScript. Sometimes it is helpful to use TypeScript namespaces to group classes with a common base name. But, that approach is not common in the TypeScript community because users must import the whole namespace as a single variable.

## Id64

In C++ we have a class for a 64-bit integer Id called `BeSQLite::BeBriefcaseBasedId`. We often make subclasses of it to differentiate the various types of things that can have a 64-bit Id. JavaScript does not have a native datatype for 64-bit integers. Therefore, we represent 64-bit Ids using hex-encoded strings. There is a class called `Id64` in `@bentleyjs-core/Id`. We do not make subclasses of `Id64`.

An important limitation of JavaScript is that the `Set` and `Map` classes do not allow any key types other than the native JavaScript types (vs. C++'s ability to have user-defined key types.) This means that for the very common case of a collection of `Id64`s we can only use strings for the keys. There are [type aliases](https://www.typescriptlang.org/docs/handbook/advanced-types.html) in `Id.ts` to help indicate that the strings are meant to be `Id64` strings.:

```ts
export type Id64Set = Set<string>;
export type Id64Array = string[];
```

Note that unfortunately these are only aliases, the compiler does not enforce anything about the content of the string.

A common pattern in TypeScript is to write a single function that can accept *one or more* `Id64` values. Again, we have a type alias in `Id.ts`:

```ts
export type Id64Arg = Id64[] | Id64 | Id64Set | Id64Array | string;
```

This says that an argument of type `Id64Arg` can be:

1. an array of Id64 objects
1. a single Id64 object
1. an `Id64Set` (`Set<string>`)
1. an `Id64Array` (`string[]`)
1. a single `string`

From a C++ perspective, this doesn't seem very type-safe, since `string` doesn't necessarily have to be a properly formatted Id64 value. While that is true, ignore that fact - in practice it doesn't hurt much.

To implement a function that takes an `Id64Arg`, use the static method:

```ts
  Id64.toIdSet(arg: Id64Arg): Id64Set;
```

That method converts any of the `Id64Arg` types into an `Id64Set`. This is a very convenient type, since it removes duplicate entries. For example:

```ts
export class FoundElements {
  public found = new Set<string>();
  public addElements(elements: Id64Arg) { Id64.toIdSet(elements).forEach((id) => this.found.add(id)); }
  public dropElements(elements: Id64Arg) { Id64.toIdSet(elements).forEach((id) => this.found.delete(id)); }
  . . .
}
```

## Other 64-bit integers

The largest integer representable in variable of type `number` in JavaScript is defined as `Number.MAX_SAFE_INTEGER`, which is 2<sup>53</sup>-1.

If you just happen to *know* that an `int64` type in C++ will never be larger than that, you can use a `number` [N.B. that is not entirely equivalent since nothing will enforce integer-ness. Though that problem exists for 32-bit integers as well]. Otherwise, things get much more complicated. One possibility is to use an ArrayBuffer, but that is somewhat complicated and rarely worthwhile. There are 64-bit JavaScript libraries, but they generally use conversion to strings to hold values, and are very inefficient compared to `number`.

Fortunately, other than the `Id64` case above, `int64` use cases are rare. Try to avoid them in C++ for this reason.

## GUID

Use the `Guid` class from `@bentleyjs-core/Id`. It stores its value as a string in the "8-4-4-4-12" pattern.

## Friend classes

JavaScript does not support the C++ `friend` class concept. This leads to more public member and methods in TypeScript. All you can do is "hide" a member/method in the documentation using the `@hidden` documentation keyword.
