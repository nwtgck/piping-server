# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)

## [Unreleased]

## [0.7.1] - 2019-01-17
### Fixed
* Close sender if all receivers close

## [0.7.0] - 2019-01-15
### Fixed
* Close receivers if a sender closes
### Changed
* Improve messages for sender

## [0.6.1] - 2019-01-11
### Changed
* Update dependencies

## [0.6.0] - 2019-01-09
### Added
* Add /help routing

## [0.5.1] - 2019-01-03
### Fixed
* Fix npm auto release on CircleCI

## [0.5.0] - 2019-01-02
### Changed
* Change the structures of data types
* Unregister sender and receivers before establishing if they close

## [0.4.0] - 2018-12-30
### Changed
* Ensure receivers to have # of receivers to get more secure

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

[Unreleased]: https://github.com/nwtgck/piping-server/compare/v0.7.1...HEAD
[0.7.1]: https://github.com/nwtgck/piping-seraver/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/nwtgck/piping-seraver/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/nwtgck/piping-seraver/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/nwtgck/piping-seraver/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/nwtgck/piping-seraver/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/nwtgck/piping-seraver/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/nwtgck/piping-seraver/compare/v0.3.6...v0.4.0
[0.3.6]: https://github.com/nwtgck/piping-seraver/compare/v0.3.5...v0.3.6
[0.3.5]: https://github.com/nwtgck/piping-seraver/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/nwtgck/piping-seraver/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/nwtgck/piping-seraver/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/nwtgck/piping-seraver/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/nwtgck/piping-seraver/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/nwtgck/piping-seraver/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/nwtgck/piping-seraver/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/nwtgck/piping-server/compare/v0.1.0...v0.2.0
