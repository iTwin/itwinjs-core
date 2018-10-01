# Change Log - @bentley/webpack-tools

This log was last generated on Mon, 01 Oct 2018 19:10:45 GMT and should not be manually modified.

## 0.143.0
Mon, 01 Oct 2018 19:10:45 GMT

*Version update only*

## 0.142.0
Mon, 01 Oct 2018 10:28:46 GMT

*Version update only*

## 0.141.0
Fri, 28 Sep 2018 22:27:44 GMT

### Updates

- 0.140.0

## 0.140.0
Fri, 28 Sep 2018 21:04:21 GMT

### Updates

- Version 0.139.0

## 0.139.0
Fri, 28 Sep 2018 19:37:10 GMT

*Version update only*

## 0.138.0
Fri, 28 Sep 2018 17:15:55 GMT

*Version update only*

## 0.137.0
Fri, 28 Sep 2018 00:57:48 GMT

### Updates

- Added ForkTsCheckerWebpackPlugin to speed up webpack builds and test runs.

While this should greatly improve webpack performance, there are two side effects that may be considered breaking changes:
  - The TypeScript type checking process will now rely soley on tsconfig files when resolving modules.  (See https: //www.npmjs.com/package/fork-ts-checker-webpack-plugin#modules-resolution).
  - Type checking errors will now be reported concurrently with test result output.

## 0.136.0
Thu, 27 Sep 2018 15:02:45 GMT

*Version update only*

## 0.135.0
Wed, 26 Sep 2018 19:16:30 GMT

*Version update only*

## 0.134.0
Wed, 26 Sep 2018 00:50:11 GMT

### Updates

- Fixed warnings about banned and multiple license types and added option to configure overrides for particular packages.
- Added custom loader to remove bentleyjs-core asserts.

## 0.133.0
Tue, 25 Sep 2018 16:41:02 GMT

*Version update only*

## 0.132.0
Mon, 24 Sep 2018 18:55:46 GMT

*Version update only*

## 0.131.0
Sun, 23 Sep 2018 17:07:30 GMT

*Version update only*

## 0.130.0
Sun, 23 Sep 2018 01:19:16 GMT

*Version update only*

## 0.129.0
Fri, 21 Sep 2018 23:16:13 GMT

*Version update only*

## 0.128.0
Fri, 14 Sep 2018 17:08:05 GMT

*Version update only*

## 0.127.0
Thu, 13 Sep 2018 17:07:12 GMT

*Version update only*

## 0.126.0
Wed, 12 Sep 2018 19:12:11 GMT

*Version update only*

## 0.125.0
Wed, 12 Sep 2018 13:35:50 GMT

*Version update only*

## 0.124.0
Tue, 11 Sep 2018 13:53:00 GMT

### Updates

- Fixed electron devtools extension installation in development builds.

## 0.123.0
Wed, 05 Sep 2018 17:14:50 GMT

### Updates

- Fixed test script excluding *all* filenames beginning with "web" and "electron".

## 0.122.0
Tue, 28 Aug 2018 12:25:19 GMT

### Updates

- Updated Enzyme version.

## 0.121.0
Fri, 24 Aug 2018 12:49:09 GMT

*Version update only*

## 0.120.0
Thu, 23 Aug 2018 20:51:32 GMT

*Version update only*

## 0.119.0
Thu, 23 Aug 2018 15:25:49 GMT

### Updates

- Fixed sourcemapping in test runs.
- Fixed errors in tests when SCSS/CSS files are imported from packages in node_modules.
- Stopped creating TypeScript declaration files in test, start, and build scripts.
- Simplified coverage setup. Apps are no longer required to define an nyc config in their package.json.

## 0.118.0
Tue, 21 Aug 2018 17:20:41 GMT

### Updates

- Updated to use TypeScript 3.0

## 0.117.0
Wed, 15 Aug 2018 17:08:54 GMT

*Version update only*

## 0.116.0
Wed, 15 Aug 2018 15:13:19 GMT

*Version update only*

## 0.115.0
Tue, 14 Aug 2018 15:21:27 GMT

*Version update only*

## 0.114.0
Tue, 14 Aug 2018 12:04:18 GMT

*Version update only*

## 0.113.0
Fri, 10 Aug 2018 05:06:20 GMT

### Updates

- Moved into imodeljs-core monorepo

