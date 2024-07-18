# Inject-Hooks

When writing an application, you might want to separate your user's actions from the code that gets executed. For instance, let's pretend that the application needs to load a specific page on startup.

```js
import { InjectHooks } from 'inject-hooks';
import { loadPage } from './your-code';

const hooks = new InjectHooks();
window.addEventListener('load', () => hooks.emit('load'));
hooks.on('show-page', (pageUrl) => loadPage(pageUrl));
window.on('load', () => hooks.emit('show-page', '/'));
hooks.on('navigate', (url) => {
    loadPage(pageUrl);
});
```

This is a huge win because now you can trigger dozens of things on page load. Let's pretend that our page load routine can take an optional parameter for the page to load, and the navigation is hooked up to the system as well to save the last loaded page.

```js
// Continuing the above example. We're going to name these interceptors
// "preserve-page-in-localstorage". More on that later.
hooks.inject(
    'navigate',
    'preserve-page-in-localstorage',
    (url, next) => {
        next(localStorage.setItem('lastUrl', url));
    }
);
hooks.inject(
    'load',
    'preserve-page-in-localstorage',
    (defaultUrl, next) => {
        next(localStorage.getItem('lastUrl') || defaultUrl);
    }
);
```

This will work fine, but what if you'd want to do other alterations to the URL? What if there are plugins that need to execute in a specific order? Let's keep going with this example, but we need to make sure that the page exists in our list of pages; otherwise we should load the 404 page through a different event. This needs to happen before the code above.

```js
// Continuing the example from before.
const allPages = new Map();
// Add all pages to allPages.
hooks.inject(
    'navigate',
    'redirect-to-404',
    (url, next) => {
        if (allPages.has(url)) {
            next(url);
        } else {
            hooks.emit('404', url);
            // Do not call next() so the event ends.
        }
    },
    {
        before: ['preserve-page-in-localstorage']
    }
);

// Handle the 404 page with a special event handler
import { load404Page } from './your-code';

hooks.on('404', (url) => load404Page(url));
```


## Error Handling

People familiar with typical Node-style callbacks and middleware will see similarities, but please note how errors are not forwarded. It is expected that you will emit a different event or handle the error yourself in another way.

Take, for example, this setup where we want to perform an action after a small delay, but the delay is too short so the

```
hooks.on('login:submit', (config) => {
    document.getElementById('myForm').submit();
});
hooks.on('login:submit:require-password', (err) => {
    document.getElementById('missing-password').addClass('visible');
});
hooks.inject('login:submit', 'require-password-during-login', (payload, next) => {
    if (!payload.password) {
        hooks.emit('login:submit:require-password');
    } else {
        next(payload);
    }
});
hooks.emit('login:submit', {
    username: 'example01',
    password: '',
});
```

For this example, imagine a login screen and clicking on the login button triggers `login:submit`. The interceptor checks the payload and sees that the password field is empty. A new event is fired and the original event does not get triggered because `next()` was not called. The new event triggers the display of an error message that was hidden in the HTML by adding a class to make it visible.


## Naming Conventions

There is no required naming convention. All of the examples here use strings for easier tracability. It is highly recommended that you do adopt a naming standard for your software, such as this:

* Name user intention hooks with the page, section, or component first, then use the element or target, and finally the action.
    * `login:form:submit`
    * `browser:navigation:change`
    * `users:row:hover`
* Name interceptors after the plugin's vendor (a company name, the username, or some way to distinguish the author), followed by the name of the plugin.
    * `wiki-core:external-assets-in-web-cache`
    * `fancy-company:hover-panel`
    * `raphael26:instant-download`


## API

First, you need to load `InjectHooks` somehow. Pick a method that works best for you.

```js
// CommonJS
const InjectHooks = require('inject-hooks').InjectHooks;
```

```js
// Modules
import { InjectHooks } from 'inject-hooks';
```

```html
<!-- Browser, HTML, loaded as window.InjectHooks -->
<script src="https://unpkg.com/inject-hooks"></script>
```

```html
<!-- Browser, loaded as a module -->
<script>
import { InjectHooks } from 'https://unpkg.com/inject-hooks?module';
</script>
```


### `new InjectHooks()`

Create a new instance.

All methods return `this` as the result for chaining.

```js
import { InjectHooks } from 'inject-hooks';

const hooks = new InjectHooks();
```


### `hooks.emit(name, data)`

```js
// hooks.emit(name: any, data?: any): this
```

Sends an event with an optional data payload to any listeners.

```js
const elem = document.querySelector('a').addEventListener('click', (e) => {
    hooks.emit('link clicked', e.target);
});
```


### `hooks.on(name, handlerSuccess, handlerError?)`

```js
// hooks.on(name: any, handler: (data: any?) => void): this
```

Attach an event handler. Data passed along with the event is included as the first argument.

Returns a function that can be called to remove the event handler.

```js
// Add the event handler
hooks
    .on('init', (data) => {
        console.log('Init hook called', data);
    })
    .emit('init', ['test']); // Init hook called ['test']
```


### `hooks.off(name, handler)`

```js
// hooks.off(name: any, handler: (data: any?) => void): this
```

Removes an event handler. This must be the same function object as what was passed to `hooks.on()`.

```js
// Add the event handler
const handler = (data) => {
    console.log('Debug:', data);
};
hooks
    .on('debug', handler)
    .emit('debug', 'DATA') // Debug: DATA
    .off('debug', handler);
```


### `hooks.once(name, handler)`


```js
// hooks.once(name: any, handler: (data: any?) => void): this
```

Calls an event handler once when the event is triggered, then removes the event handler.

The handler can still be removed using `hooks.off()` until it has been activated.

```js
hooks
    .once('save', (filename) => {
        console.log('Saving', filename);
    })
    .emit('save', 'a') // "Saving a"
    .emit('save', 'b'); // Nothing.
```


### `hooks.inject(name, id, interceptor, conditions = {})`

```js
// hooks.inject(
//     name: any,
//     id: any,
//     interceptor: (data: any?, next: (data?: any) => void,
//     conditions?: {
//         after?: any[] | any;
//         before?: any[] | any;
//         conficts?: any[] | any;
//         depends?: any[] | any;
//     }
// ): this
```

Add an interceptor to the list for a specific hook name. If there's already an interceptor with the same `id` and `name`, then this method will throw.

```js
hooks.inject('abort', 'log-to-console', (reason, next) => {
    console.log(reason);
    next(reason);
});
```

Because plugins for applications can conflict or augment each other, the conditions specified are checked to make sure the order is correct. Whenever any interceptor is added, the list of interceptors may need to be erased or checked for conflicts. This is done on-demand so plugins can all be added in a batch, without any order, and they won't cause problems if loaded out of order. The list of plugins is calculated and cached when the hook is called. It can also be done on demand after all plugins are loaded by using `hooks.validate()`.

```js
hooks.inject('test', 'one', () => {}, {
    after: ['four']
});

// Order: one

hooks.inject('test', 'two', () => {}, {
    before: ['three']
});

// Order: (one two) or (two one)

hooks.inject('test', 'three', () => {}, {
    after: ['one']
});

// Order: (one two three) or (two one three)
```

Plugins may also conflict with each other.

```js
hooks.inject('test', 'four', () => {}, {
    conflicts: ['five']
});

// The above would work if validated

hooks.inject('test', 'five', () => {}, {
    depends: ['six']
});
```

If the above examples were all used, there would be validation errors. Because "five" was added, "four" now conflicts with "five" and "five" requires "six" but "six" is not available.


### `hooks.remove(name, id)`

```js
// hooks.remove(name: any, id: any);
```

Eliminates an interceptor. Also clears the calculated list. For more information, see `hooks.inject()`.

```js
hooks.remove('abort', 'log-to-console');
```


### `hooks.transform(name, data, callback)`

```
// hooks.transform(name: any, data: any, callback: (data: any) => void)
```

Transforms the data using all registered interceptors for the given name. Can throw if the list of interceptors isn't able to be resolved - see `hooks.validate()`. Also, if any interceptor does not continue the event, your callback will never be called.

```
const pageData = '<html><head>...';
hooks.transform('page-loaded', pageData, (result) => {
    console.log('Result:', result);
});
```


### `hooks.validate()`

```js
hooks.validate(name?: any): boolean
```

Calculate the order for all interceptors or for a specific hook name. If there are problems, this throws an Error.

```js
// First, load all of the interceptors.
// When done, you can check for issues.
try {
    hooks.validate();
} catch (err) {
    console.error(err);
}
```


## Special Thanks

This is a combination of techniques seen in other projects. Without their ideas, this would not have been made.

    * [SquirrelMail](https://www.squirrelmail.org/)'s hooks, to allow plugins to alter/update data at specific points.
    * [systemd](https://systemd.io/) organizing of plugins for hooks.
    * [EventEmitter](https://nodejs.org/api/events.html#class-eventemitter) to decouple intents from effects.
    * [events-intercept](https://github.com/brandonhorst/events-intercept), which can change event data or prevent the event from being emitted.
    * [Express](https://expressjs.com/) middleware, allowing infinite flexibility for appropriately structured applications.
