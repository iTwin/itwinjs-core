# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.1] - 2018-09-06

## Changed

- Updated dependencies
- Changed the output to use spaces instead of tabs

## [0.7.0] - 2018-08-11

## Changed

- Updated dependencies

## [0.6.1] - 2018-06-01

### Added

- Added test coverage with nyc

### Removed

- Bentley Systems header from all output files

## [0.6.0]  -  2018-05-31

### Added

- [#896868] Populated cache with BisCore schemas

### Changed

- Updated dependencies
- [#807792] Package references now use "@bentley/{packageName}" instead of looking in the /lib directory
- Output of ec2ts command is now two separate files:
  - {schemaName}.ts : Registers the schema and all of the classes associated with the schema
  - {schemaName}Elements.ts : Defines schema classes and elements

### Fixed

- [#896868] Fixed problem with ECSchemas which extend BisCore


[Unreleased]: https://bentleycs.visualstudio.com/iModelTechnologies/_git/ec2ts/branches?_a=commits&baseVersion=GT0.7.1&targetVersion=GBmaster
[0.7.0]: https://bentleycs.visualstudio.com/iModelTechnologies/_git/ec2ts/branches?_a=commits&baseVersion=GT0.7.0&targetVersion=GT0.7.1
[0.7.0]: https://bentleycs.visualstudio.com/iModelTechnologies/_git/ec2ts/branches?_a=commits&baseVersion=GT0.6.1&targetVersion=GT0.7.0
[0.6.1]: https://bentleycs.visualstudio.com/iModelTechnologies/_git/ec2ts/branches?_a=commits&baseVersion=GT0.6.0&targetVersion=GT0.6.1
[0.6.0]: https://bentleycs.visualstudio.com/iModelTechnologies/_git/ec2ts/branches?_a=commits&baseVersion=GT0.5.0&targetVersion=GT0.6.0
[0.5.0]: https://bentleycs.visualstudio.com/iModelTechnologies/_git/ec2ts/branches?_a=commits&baseVersion=GT0.4.2&targetVersion=GT0.5.0
[0.4.2]: https://bentleycs.visualstudio.com/iModelTechnologies/_git/ec2ts/branches?_a=commits&baseVersion=GT0.4.1&targetVersion=GT0.4.2
[0.4.1]: https://bentleycs.visualstudio.com/iModelTechnologies/_git/ec2ts/branches?_a=commits&baseVersion=GT0.4.0&targetVersion=GT0.4.1
[0.4.0]: https://bentleycs.visualstudio.com/iModelTechnologies/_git/ec2ts/branches?_a=commits&baseVersion=GT0.3.0&targetVersion=GT0.4.0
[0.3.0]: https://bentleycs.visualstudio.com/iModelTechnologies/_git/ec2ts/branches?_a=commits&targetVersion=GT0.3.0

[#807792]: https://tfs.bentley.com/tfs/ProductLine/Platform%20Technology/_workitems?id=807792&_a=edit
[#896868]: https://tfs.bentley.com/tfs/ProductLine/Platform%20Technology/_workitems?id=896868&_a=edit

<!-- This is a slightly better formatting in the VSCode markdown preview: -->
<style>
  h2 > a { font-weight: 600; }
  h2::after { content:''; display: block; border-bottom: 1px solid currentColor; opacity: .25 }
</style>
