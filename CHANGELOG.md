# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)

## [Unreleased]

## [0.3.6] - 2018-12-29
### Changed
* Update some libraries versions
* Update docker base image version
* Refactor routing

## [0.3.5] - 2018-12-09
### Changed
* Update some libraries versions
* Update docker base image version

## [0.3.4] - 2018-12-01
### Changed
* Update some libraries versions

## [0.3.3] - 2018-11-15
### Added
* Support multipart 

## [0.3.2] - 2018-09-27
### Added
* Support Heroku deployment
* Allow user to specify `--enable-log` option

### Fixed
*  Not to allow user to specify n <= 0 in query parameter

## [0.3.1] - 2018-09-23
### Fixed
* Fix /version routing

## [0.3.0] - 2018-09-23
### Added
* Return `Content-Length` if request of sender has `Content-Length`
* Support PUT method to send data

## [0.2.1] - 2018-09-22
### Fixed
* Not allow users to send reserved paths via POST method

### Added
* `piping-server` command

## [0.2.0] - 2018-09-21
### Added
* Add index routing
* Add /version routing for getting Piping server version

## 0.1.0 - 2018-09-20
### Added
* Implement basic data-piping server on HTTP 
* Support multi-receiver
* Docker automated build on Docker Hub
* Support HTTPS

[Unreleased]: https://github.com/nwtgck/piping-server/compare/v0.3.6...HEAD
[0.3.6]: https://github.com/nwtgck/piping-seraver/compare/v0.3.5...v0.3.6
[0.3.5]: https://github.com/nwtgck/piping-seraver/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/nwtgck/piping-seraver/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/nwtgck/piping-seraver/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/nwtgck/piping-seraver/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/nwtgck/piping-seraver/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/nwtgck/piping-seraver/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/nwtgck/piping-seraver/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/nwtgck/piping-server/compare/v0.1.0...v0.2.0
