# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)

## [Unreleased]

## [1.2.3] - 2021-07-17
### Changed
* Update dependencies
* Update base Docker image

## [1.2.2] - 2021-06-27
### Changed
* Update dependencies
* Allow `--enable-https` too, not only `--enable-https=true` or `--enable-https=false`

## [1.2.1] - 2021-03-01
### Changed
* (internal) Reduce size of npm tarball [#462](https://github.com/nwtgck/piping-server/pull/462) by [@crazazy](https://github.com/crazazy)

## [1.2.0] - 2021-02-14
### Changed
* Update dependencies
* Remove `X-Content-Type-Options: nosniff` for better UX for command-line users

## [1.1.4] - 2021-01-23
### Changed
* Update dependencies
* (internal) updates

## [1.1.3] - 2020-09-22
### Changed
* Update dependencies
* (Docker) Reduce Docker image size [#388](https://github.com/nwtgck/piping-server/pull/388) by [@peaceiris](https://github.com/peaceiris)

## [1.1.2] - 2020-09-01
### Changed
* Update dependencies
* Simplify links in Web UI

## [1.1.1] - 2020-07-30
### Changed
* Update dependencies

## [1.1.0] - 2020-06-01
### Changed
* Update dependencies
* Update constructor parameter (dev only)

## [1.0.1] - 2020-05-23
### Changed
* Update dependencies

### Fixed
* Not close receiver when sender is closed

## [1.0.0] - 2020-03-29
### Changed
* Update dependencies

## [0.15.9] - 2020-03-17
### Changed
* Update dependencies

## [0.15.8] - 2020-02-27
### Fixed
* Send data over relative path on simple Web UI

## [0.15.7] - 2020-02-24
### Changed
* Update dependencies

## [0.15.6] - 2020-01-24
### Changed
* Update dependencies
* Improve reliability of implementation

## [0.15.5] - 2020-01-03
### Changed
* Update dependencies
* Change title of Web UI and add version

## [0.15.4] - 2019-12-17
### Changed
* Update dependencies

## [0.15.3] - 2019-11-17
### Changed
* Update dependencies

## [0.15.2] - 2019-11-12
### Changed
* Update dependencies
* Allow cross-origin for /version and /help

## [0.15.1] - 2019-11-06
### Changed
* Update dependencies

## [0.15.0] - 2019-10-22
### Changed
* Update dependencies
* Update Docker base image version to node:12.13-alpine
* Not force web user to download text and add Piping UI link

## [0.14.0] - 2019-08-26
### Changed
* Reject Service Worker registration requests for receiver using Web browser
* Not add `application/octet-stream` if Content-Type is missing

## [0.13.2] - 2019-08-23
### Changed
* Update dependencies

## [0.13.1] - 2019-08-20
### Changed
* Allow cross-origin for 400 responses

## [0.13.0] - 2019-08-19
### Fixed
* Add `X-Content-Type-Options: nosniff` header for disabling sniffing 
### Changed
* Replace `text/html` with `text/plain` not to use `Content-Disposition: attachment`

## [0.12.0] - 2019-08-18
### Changed
* Prevent hijacking top page of simple Web UI by Service Worker

## [0.11.6] - 2019-08-15
### Changed
* Update dependencies

## [0.11.5] - 2019-08-08
### Changed
* Allow HTTP/1 in HTTPS
* Update dependencies

## [0.11.4] - 2019-07-16
### Changed
* Handle uncaughtException
* Update dependencies

## [0.11.3] - 2019-07-14
### Fixed
* Handle error in multipart

## [0.11.2] - 2019-07-12
### Changed
* Update dependency

## [0.11.1] - 2019-07-11
### Changed
* Update dependencies

## [0.11.0] - 2019-07-07
### Changed
* Revise English message for sender
* Use log4js-node for logger
* Remove `--enable-log` option
* Update dependencies

## [0.10.2] - 2019-05-14
### Changed
* Update dependencies

## [0.10.1] - 2019-04-23
### Changed
* Expose Content-Length and Content-Length by Access-Control-Expose-Headers

## [0.10.0] - 2019-04-13
### Added
* Support HTTP/2 over HTTPS

## [0.9.4] - 2019-04-05
### Changed
* Support Preflight request

## [0.9.3] - 2019-03-31
### Fixed
* Fix sender's header to have "Access-Control-Allow-Origin: *" when an access order is "sender => receiver"

## [0.9.2] - 2019-03-16
### Fixed
* Fix for running server on Windows

## [0.9.1] - 2019-03-10
### Fixed
* Allow user to ctrl-c to terminate piping-server docker container
### Changed
* Return "Content-Length" and "Content-Type" when accessing index, /version and /help

## [0.9.0] - 2019-03-08
### Changed
* Make logs for sednder consistent
* Update dependencies

## [0.8.10] - 2019-02-24
### Changed
* Not to allow user to send "/robots.txt" and return 404 when user access to "/rebots.txt"

## [0.8.9] - 2019-02-23
### Added
* Pass sender's Content-Disposition to receivers' one in both POST/PUT and multipart

## [0.8.8] - 2019-02-15
### Changed
* Return 204 No Content when user gets /favicon.ico
* Update dependencies

## [0.8.7] - 2019-02-06
### Changed
* Allow cross-origin

## [0.8.6] - 2019-02-05
### Fixed
* Fix web client to run on IE11

## [0.8.5] - 2019-02-04
### Changed
* Update dependencies

## [0.8.4] - 2019-01-28
### Fixed
* Fix not to pass "undefined" if content-type in multipart is not present
### Added
* Add a functionality of text input in web client

## [0.8.3] - 2019-01-25
### Added
* Pass the sender's headers in multipart

## [0.8.2] - 2019-01-23
### Added
* Pass sender's Content-Type to receivers' one

## [0.8.1] - 2019-01-21
### Fixed
* Fix "main" and "types" in package.json to be imported as a library

## [0.8.0] - 2019-01-18
### Changed
* Introduce TSLint and change the interfaces of `Server` class

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

[Unreleased]: https://github.com/nwtgck/piping-server/compare/v1.2.3...HEAD
[1.2.3]: https://github.com/nwtgck/piping-server/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/nwtgck/piping-server/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/nwtgck/piping-server/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/nwtgck/piping-server/compare/v1.1.4...v1.2.0
[1.1.4]: https://github.com/nwtgck/piping-server/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/nwtgck/piping-server/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/nwtgck/piping-server/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/nwtgck/piping-server/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/nwtgck/piping-server/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/nwtgck/piping-server/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/nwtgck/piping-server/compare/v0.15.9...v1.0.0
[0.15.9]: https://github.com/nwtgck/piping-server/compare/v0.15.8...v0.15.9
[0.15.8]: https://github.com/nwtgck/piping-server/compare/v0.15.7...v0.15.8
[0.15.7]: https://github.com/nwtgck/piping-server/compare/v0.15.6...v0.15.7
[0.15.6]: https://github.com/nwtgck/piping-server/compare/v0.15.5...v0.15.6
[0.15.5]: https://github.com/nwtgck/piping-server/compare/v0.15.4...v0.15.5
[0.15.4]: https://github.com/nwtgck/piping-server/compare/v0.15.3...v0.15.4
[0.15.3]: https://github.com/nwtgck/piping-server/compare/v0.15.2...v0.15.3
[0.15.2]: https://github.com/nwtgck/piping-server/compare/v0.15.1...v0.15.2
[0.15.1]: https://github.com/nwtgck/piping-server/compare/v0.15.0...v0.15.1
[0.15.0]: https://github.com/nwtgck/piping-server/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/nwtgck/piping-server/compare/v0.13.2...v0.14.0
[0.13.2]: https://github.com/nwtgck/piping-server/compare/v0.13.1...v0.13.2
[0.13.1]: https://github.com/nwtgck/piping-server/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/nwtgck/piping-server/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/nwtgck/piping-server/compare/v0.11.6...v0.12.0
[0.11.6]: https://github.com/nwtgck/piping-server/compare/v0.11.5...v0.11.6
[0.11.5]: https://github.com/nwtgck/piping-server/compare/v0.11.4...v0.11.5
[0.11.4]: https://github.com/nwtgck/piping-server/compare/v0.11.3...v0.11.4
[0.11.3]: https://github.com/nwtgck/piping-server/compare/v0.11.2...v0.11.3
[0.11.2]: https://github.com/nwtgck/piping-server/compare/v0.11.1...v0.11.2
[0.11.1]: https://github.com/nwtgck/piping-server/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/nwtgck/piping-server/compare/v0.10.2...v0.11.0
[0.10.2]: https://github.com/nwtgck/piping-server/compare/v0.10.1...v0.10.2
[0.10.1]: https://github.com/nwtgck/piping-server/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/nwtgck/piping-server/compare/v0.9.4...v0.10.0
[0.9.4]: https://github.com/nwtgck/piping-server/compare/v0.9.3...v0.9.4
[0.9.3]: https://github.com/nwtgck/piping-server/compare/v0.9.2...v0.9.3
[0.9.2]: https://github.com/nwtgck/piping-server/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/nwtgck/piping-server/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/nwtgck/piping-server/compare/v0.8.10...v0.9.0
[0.8.10]: https://github.com/nwtgck/piping-server/compare/v0.8.9...v0.8.10
[0.8.9]: https://github.com/nwtgck/piping-server/compare/v0.8.8...v0.8.9
[0.8.8]: https://github.com/nwtgck/piping-server/compare/v0.8.7...v0.8.8
[0.8.7]: https://github.com/nwtgck/piping-server/compare/v0.8.6...v0.8.7
[0.8.6]: https://github.com/nwtgck/piping-server/compare/v0.8.5...v0.8.6
[0.8.5]: https://github.com/nwtgck/piping-server/compare/v0.8.4...v0.8.5
[0.8.4]: https://github.com/nwtgck/piping-server/compare/v0.8.3...v0.8.4
[0.8.3]: https://github.com/nwtgck/piping-server/compare/v0.8.2...v0.8.3
[0.8.2]: https://github.com/nwtgck/piping-server/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/nwtgck/piping-server/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/nwtgck/piping-server/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/nwtgck/piping-server/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/nwtgck/piping-server/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/nwtgck/piping-server/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/nwtgck/piping-server/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/nwtgck/piping-server/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/nwtgck/piping-server/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/nwtgck/piping-server/compare/v0.3.6...v0.4.0
[0.3.6]: https://github.com/nwtgck/piping-server/compare/v0.3.5...v0.3.6
[0.3.5]: https://github.com/nwtgck/piping-server/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/nwtgck/piping-server/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/nwtgck/piping-server/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/nwtgck/piping-server/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/nwtgck/piping-server/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/nwtgck/piping-server/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/nwtgck/piping-server/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/nwtgck/piping-server/compare/v0.1.0...v0.2.0
