# Changelog

## 1.4.0

* Tightened TypeScript typings, allowing consumers to specify an interface that defines the event names and payloads.
* Made `emit` throw synchronously (so it can be caught) when interceptors have an ordering problem.
* Fixed tests from async addition in 1.3.1.

## 1.3.1

* Made `hooks.emit()` asynchronous. This makes debugging significantly easier because events that trigger followup events will be logged in the right order.

## 1.3.0

* Added ability to have interceptors and event listeners listen to any number of events through filter functions.
* Added extra parameter to all handlers and interceptors indicating the name of the current event.
* Cleaned up documentation and made it consistent.
* Tightened up typings for event names; strings or functions instead of `any`.

## 1.2.0

* Removed `hooks.transform()` and combined it into `hooks.emit()`.

## 1.1.0

* Added `hooks.transform()` method.
* Added `order` property to the conditions to indicate "pre", "post", or "mid".

## 1.0.0

* Initial release
