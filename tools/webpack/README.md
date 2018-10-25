# @bentley/webpack-tools

Copyright © 2018 Bentley Systems, Incorporated. All rights reserved.

The `@bentley/webpack-tools` package includes configuration and scripts for developing, building, and testing TypeScript apps and services.
It supports building for web, electron, and mobile from the same codebase, and is designed to support the basic backend/frontend architecture
of [iModelJs apps](#TODO!).

## Background ########################################################################################################################################

### What is Webpack? ###
As its name implies, `webpack-tools` makes extensive use of [webpack](https://webpack.js.org/).
At its core, webpack is a module bundler – it combines files so you can use a module system like [RequireJS](https://requirejs.org/)
or [ES6 imports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import) in a web environment – where such
module systems aren't generally supported.  Lots of smaller modules may make sense on the server side of things (where the files are
already on the filesystem), but the overhead of fetching these files via HTTP means that we need to combine them into a few larger files
for the client side.

Basically, webpack looks at a particular JS module (a file using import or require), and recursively follows all module imports,
building out a dependency graph. Then, it's able to "bundle" all of those separate files into a single JavaScript file.  Webpack
is incredibly extensible and super powerful, so it does a _lot_ more than just bundling (it can compile TypeScript, minifiy/optimize
JavaScript, handle HTML, CSS, etc), but that's its core responsibility.

### A "Toolbox" Approach ###
In addition to webpack itself, there are many other tools, plugins, and other packages required to build and test apps.
There is also a lot of configuration required to use all these tools together.  Instead of maintaining these dependencies and
configurations in every project, application developers can use `webpack-tools` as a curated "toolbox" with no configuration.

This approach is best explained in [this article](https://increment.com/development/the-melting-pot-of-javascript/)
by [Dan Abramov](https://github.com/gaearon) (you may also want to check out
[his presentation](https://www.youtube.com/watch?v=G39lKaONAlA) on the subject as well).

As a "toolbox" package, `webpack-tools` tries to adhere to the following fundamental principles:

- **Configuration should not stand in the way of getting started.**
- **More configuration should only be added when absolutely necessary.**
- **Advanced features should be disclosed progressively.**
- **Output should be concise, relevant, and actionable.**

------------------------------------------------------------------------------------------------------------------------------------------------------
## How to Use @bentley/webpack-tools #################################################################################################################

Like create-react-app and other "toolbox" packages, `@bentley/webpack-tools` is very opinionated.  It makes choices for you about what an ideal
project setup should look like.  Although much of this is actually quite configurable, we believe that a good set of defaults is more important than
a powerful set of configuration options.

So in this section, we'll describe only how to setup your project using these defaults. NOTE: This documentation is very much a work in progress.

### Folder Structure

```txt
my-app/
  public/
  src/
    backend/
      electron/
      mobile/
      web/
      main.ts
    frontend/
      index.tsx
  test/
```

For the project to build, **these files must exist with *exact*[¹] filenames**

- `public/index.html` is the frontend page template;
- `src/frontend/index.tsx` is the TypeScript entry point for the frontend.
- `src/backend/main.ts` is the TypeScript entry point for the backend.

You can delete or rename the other files.  However, your source code should be organized according to where it can run:

| Directory       | Description         |
|-----------------|---------------------|
| `src/backend/`  | The application's "server-side" backend. Runs in a standalone JavaScript engine (Node in this case). May have file system and Node dependencies |
| `src/frontend/` | The application's "client-side" frontend. Must be able to run in a web browser. Should not have file system or Node dependencies. |

> You may create additional subdirectories inside `src`.
> However, anything inside `src` that does not fall under one of the directories above should be designed to run either in frontend ***or*** backend,
> and so must adhere to frontend restrictions.

For faster rebuilds, only files inside `src` are processed by Webpack.
You need to **put any TS and CSS files inside `src`**, otherwise Webpack won’t see them.

Only files inside `public` can be used from `public/index.html`.
Read instructions below for using assets from TypeScript and HTML.

You can, however, create more top-level directories.
They will not be included in the production build so you can use them for things like documentation.

### Available Scripts

A basic project should have the following scripts defined in their package.json:

```json
    "start": "bentley-webpack-tools start",
    "test": "bentley-webpack-tools test --watch",
    "cover": "bentley-webpack-tools cover",
    "build": "bentley-webpack-tools build electron",
    "electron": "electron lib/main.js",
```


With these defined, you can run the following from your project directory:

#### `npm start`

Runs both the electron and web apps in development mode.
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The app will automatically rebuild and reload as you make changes to the source code.
Frontend-only changes will either be hot-reloaded (if CSS/SCSS only) or refresh the page.
You will also see any TypeScript and TSLint errors in the console.

> ##### How it works
> Basically, when you run `npm start`, there are several processes that run concurrently:
>   - For the backend, we just run webpack in watch mode.  So webpack watches the source files, and rebuilds after any changes are saved.
>     - We also start two instances of [nodemon](https://nodemon.io/) – one for the backend webserver (normally this runs on port 5000)
>       and one for the electron app.  Nodemon is watching webpack’s output and killing/restarting these backends anytime those files change.
>   - For the frontend, since we’re really building a static site, we’re able to use the [webpack devServer](https://webpack.js.org/configuration/dev-server/).
>     This essentially runs webpack in watch mode, but instead of writing the output to disk, it just keeps them in memory and serves them via
>     a simple webserver (normally this runs on port 3000).
>
> So when you run a web app in development mode via `npm start`, we have totally separate backend and frontend webservers.
> This is meant to mimic the actual deployment environment.  However, when these apps are deployed, we expect that both the backend and frontend
> will be served at the same (root) URL (e.g., https://myimodeljsapp.bentley.com or something). So normally, when the frontend makes a request to
> the backend, it will make a request to a relative URL (e.g., /my-app-name/something).  That way, it’s all the same origin and we don’t run into
> any CORS trouble.


#### `npm test`

Launches the test runner in the interactive watch mode.
See the section about [running tests](#running-tests) for more information.

#### `npm run cover`

Launches the test runner in code coverage reporting mode.
See the section about [coverage reporting](#coverage-reporting) for more information.

#### `npm run build`

Builds an optimized "production" electron app.

#### `npm run electron`

Runs the optimized "production" electron app created by `npm run build`.

---
###### 1:
This is actually configurable. More documentation coming soon...

[¹]: #1