# Why We Chose React

React is a fast and lightweight library for user interface development. The fact that it is a library rather than a framework makes it a better choice for developing a platform of reusable UI components than more opinionated frameworks. Other considerations include:

**Popularity** React topped StackOverflow’s “most loved framework” in their [2017 developer survey](https://insights.stackoverflow.com/survey/2017#technology-most-loved-dreaded-and-wanted-frameworks-libraries-and-other-technologies
) and was “most wanted” in their [2018 survey](https://insights.stackoverflow.com/survey/2018#technology-most-loved-dreaded-and-wanted-frameworks-libraries-and-tools). It also has the most five-star ratings and weekly downloads in NPM.
[(Download Comparison to Angular)](http://www.npmtrends.com/angular-vs-react-vs-@angular/core)

**Flexibility** React can be easily embedded into other applications thanks to the flexibility of ReactDOM.render(). Although React is commonly used at startup to load a single root React component into the DOM, ReactDOM.render() can also be called multiple times for independent parts of the UI which can be as small as a button, or as large as an app. In fact, this is exactly how React is used at Facebook. This lets them write applications in React piece by piece and combine them with existing server-generated templates and other client-side code.(link to Angular sample on github)

**Tooling**
React and Redux are supported by widely-available tools, including:

* VS Code – Visual Studio Code provides great support for TypeScript, React components and TSX/JSX.
* React Developer Tools for Chrome – these provide terrific support for the virtual DOM, showing component Props, allows dynamic changing of Props, etc.
* Redux DevTools for Chrome – Redux time travel support; you can completely control the currently running application’s actions/state