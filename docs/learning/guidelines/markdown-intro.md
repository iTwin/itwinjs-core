# Markdown Introduction

Bentley has standardized on [markdown](http://commonmark.org/) files for programmer guide documentation.
The goal should be to combine the programmer guide documentation (extracted from markdown source) with reference documentation (extracted from JavaDoc-style source code comments) to produce the final documentation set (typically a static HTML web site).

[There](http://assemble.io/docs/Cheatsheet-Markdown.html) are [tons](https://www.cheatography.com/simon-fermor/cheat-sheets/markdown/) of [cheatsheets](https://beegit.com/markdown-cheat-sheet) for markdown, and wide support for the format in source code editors (including VS Code).

> Note: The **Markdown Preview Enhanced** extension for VS Code is pretty useful for reviewing the output generated from the markdown.
>
> Note: The **Code Spell Checker** extension for VS Code is also useful.

Examples of the markdown syntax are below...

---

# Heading

## Sub-heading

### Another deeper heading

Paragraphs are separated
by a blank line.

Two spaces at the end of a line leave a
line break.

Text attributes: _italic_, *italic*, __bold__, **bold**, `monospace`, ~~strikethrough~~.

Use 3 hyphens for a horizontal rule:

---

Bullet list:

  * apples
  * oranges
  * pears
    - sublist
    - sublist

Numbered list:

  1. apples
     - sublist
     - sublist
  2. oranges
  3. pears

> Note:

A [link](https://en.wikipedia.org/wiki/Markdown)

An image: ![logo](logo.png "Bentley Logo")

## Source Code

Use backticks for inline source code: `public static myPublicStaticMethod(x: number): Promise<string>`

Use 3 backticks plus **ts** for source code blocks. This is non-standard but is usually supported.

``` ts
/** My public static method */
public static myPublicStaticMethod(x: number): Promise<string> {
  if (0 === x)
    return Promise.reject(new Error("Invalid parameter"));

  // Rest of implementation removed...
}
```

## Tables

Tables are created by adding pipes as dividers between each cell, and by adding a line of dashes (also separated by bars) beneath the header. Note that the pipes do not need to be vertically aligned.

| Option | Description |
| ------ | ----------- |
| data   | path to data files that will be passed into templates. |
| engine | engine to be used for processing templates. |
| ext    | extension to be used for destination files. |
