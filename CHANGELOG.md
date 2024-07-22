# Changelog

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
