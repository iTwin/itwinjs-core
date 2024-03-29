# iTwin.js Documentation Linking Syntax

The documentation for the iTwin.js website is authored from two sources:

1. Markdown (`.md`) files in the `docs` directory
2. TypeDoc comments in source `.ts` files

Each type of file is processed (using [MetalSmith](https://metalsmith.io/) scripts) to create `.html` files for the documentation website. It is often necessary to create links across the content of the website. These are the rules for the syntax, in the respective source files, to create those links.

## Linking to TypeDoc generated content

You can create links into the TypeDoc generated documentation using the same syntax, either from Markdown files or from other TypeDoc comments.

| Link to: | Syntax| Notes
|---------|----|--
| A package | `($package)`| links to the documentation found in the index.ts file for *package*, marked with the `@docs-package-description` tag.
| A topic|`[label]($package:Topic)`| links to the documentation found in the index.ts file for *package*, marked with the `@docs-group-description Topic` tag.
| A class|`[Class]($package)`| links to the documentation for *Class* in *package*
| An inner class|`[Class.InnerClass]($package)`| links to links to the documentation for *Class.InnerClass* in *package*
| A method|`[Class.method]($package)` or `[method]($package.Class)`|links to the documentation for *Class.method* in *package*

> *Package aliases* can be added to config/docSites.json to allow for shorter names to be used as the package variable. Ex: common -> core-common.

## Linking Markdown -> Markdown

Standard markdown rules apply:

| Destination | Syntax | Notes
|---|---|--
| In same file |`[label](#section)`| |
| In same folder|`[label](./filename.md#section)`| both `./` and `.md` are required|
| Another folder|`[label](./relativePath/filename.md#section)`|`.md` is required|

### Notes on #section

- `#section` is optional if a filename is specified. If not present, the target is the top of the file.
- must be all lowercase. Use ‘-‘ instead of spaces.

For example, if the target is:

```md
(in ECSQL.md)

## ECSQL Parameters
```

The link from a markdown file in the same directory would be:

```md
[ECSQL Params](./ECSQL.md#ecsql-parameters)
```

## Linking TypeDoc -> Markdown

The same syntax as linking from Markdown applies, with the `$docs` prefix instead of a relative path.

For example:

```ts
/** in a TypeDoc comment
 * @see [label]($docs/learning/path/filename.md#section)
 * @see [label]($docs/learning/path/filename.md#section)
 */
```

## Linking to external Urls

Standard markdown applies: `[label](URL)`

## Linking to code snippets

The itwinjs-core repository has a directory of code snippets you can reference in docs.  The directory is `/example-code/snippets/` and contains both backend and frontend snippets, more can be added as needed.

Snippets use the special comment to start `__PUBLISH_EXTRACT_START__ <unique.name>` and `__PUBLISH_EXTRACT_END__` to end the code snippet.

For example:

```ts
   // __PUBLISH_EXTRACT_START__ IModelDb.somethingUsingIModelDb
    // This is an example of how to do the thing.
    do { theThing(iModelDb) } while (youCan)
    // __PUBLISH_EXTRACT_END__
```

A snippet can be referenced in conceptual or API docs using double square brackets around the name of the snippet.  It should be wrapped in the appropriate code block to get the correct formatting.

For example:

```ts
/**
 * Does the thing
 *
 * ** Example:**
 * ``` ts
 * [[IModelDb.somethingUsingIModelDb]]
 * ```
 * @public
 */
export class SomeIModelThing {}
```
