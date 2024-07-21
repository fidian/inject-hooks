# Inject-Hooks

This is the framework for a plugin system that is similar to combining `EventEmitter` with middleware, but also provides the ability to dynamically change the order of execution. This allows plugins to work together without needing a user to install them in a specific order, or even for both plugins to know about each other. It provides the following features:

* Listening for events and emitting events
* Canceling an event
* Changing the data passed to an event
* Decoupling user intents and actions from the processes that need to happen
* Asynchronous processing to allow for more complicated or intensive operations before allowing the event to be triggered
* Ordering extra pieces of code, allowing two plugins to operate in harmony, consistently executing in the correct order

This would be useful when writing an application. It can coordinate actions between different teams, or you could allow extra functionality (eg. plugins or system extensions) to change how your software operates. For instance, let's pretend that the application needs to load a specific page on startup.

```js
import { InjectHooks } from 'inject-hooks';
import { loadPage } from './your-code';

// Emit "load" when the window is loaded
const hooks = new InjectHooks();
window.addEventListener('load', () => hooks.emit('load'));

// On load, let's trigger the "show-page" action
hooks.on('load', () => hooks.emit('show-page', '/'));

// This action could load a page to be viewed in the browser
hooks.on('show-page', (pageUrl) => loadPage(pageUrl));

// Navigation in the page would likewise want to load a page
hooks.on('navigate', (url) => {
    hooks.emit('show-page', url);
});
```

This is a huge win because now you can trigger dozens of things on page load. Let's pretend that our page load routine can take an optional parameter for the page to load, and the navigation is hooked up to the system as well to save the last loaded page.

```js
// Continuing the above example. We're going to name these interceptors
// "preserve-page-in-localstorage". Names are arbitrary, but you should
// follow a convention in your codebase. There's a section documenting
// suggested practices for names.
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

People familiar with typical Node-style callbacks and middleware will see similarities, but please note how errors are not forwarded. It is expected that you will emit a different event or handle the error yourself in another way. In the following example, one event is changed into another event to signify a handled error has happened and that the action should be prevented.

```js
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
* Name internal processing hooks with the service, library, or code focus first. Include the type of data next when applicable, then add the action.
    * `email:list:update`
    * `page-data:markdown:convert-to-html`
    * `application:loaded`
* Name interceptors after the plugin's vendor (a company name, the username, or some way to distinguish the author), followed by the name of the plugin.
    * `wiki-core:external-assets-in-web-cache`
    * `fancy-company:hover-panel`
    * `raphael26:instant-download`


## Skipping Processing

There are times when you would like a plugin to be able to override chunks of what your software normally does. For instance, let's pretend that we are writing a tool that needs to fetch a page from your site.

```js
// One way to do it
hooks.on('load-page-okay', (pageContent) => {
    document.getElementById('page').innerHTML = pageContent;
});
hooks.inject('load-page-okay', 'core:load-page', (name, next) => {
    fetch(`https://example.com/page/${name}.txt`)
        .then((response) => response.text())
        .then((text) => next(text));
}
hooks.emit('load-page-okay', name);
```

Doing it this way will not make it easy for plugins to override your functionality. Instead, you should be allowed to skip processing under a specific condition. Here's an updated example illustrating this technique, and we are assuming all of this code is part of your core software.

```js
// This version allows plugins to handle retrieval of the page content
// and still modify the page content as needed.
hooks.on('load-page-better', (data) => {
    document.getElementById('page').innerHTML = data.content;
});

hooks.inject('load-page-better', 'core:load-page:fetch', (data, next) => {
    if (data.content) {
        return next(data);
    }

    fetch(`https://example.com/page/${data.name}.txt`)
        .then((response) => response.text())
        .then((text) => next({
            ...data,
            content: text
        }));
}

hooks.emit('load-page-better', { name });
```

How is this better? Let's add three plugins. The first will load the page from `localStorage` if it is available. The second plugin caches the page into `localStorage` if it isn't there already, and the last one will search and replace content.

```js
hooks.inject('load-page-better', 'local-storage:fetch', (data, next) => {
    // Allow for other plugins to come before this one
    if (!data.content) {
        const content = localStorage.getItem(data.name);

        if (content) {
            return next({
                ...data,
                content
            });
        }
    }

    next(data);
}, { order: 'pre' });

hooks.inject('load-page-better', 'local-storage:save', (data, next) => {
    if (data.content) {
        localStorage.setItem(data.name, data.content);
    }

    next(data);
}, { order: 'post' });

hooks.inject('load-page-better', 'alter-content', (data, next) => {
    if (data.content) {
        data.content = data.content.replace(/##VERSION##/g, '1.2.3');
    }
}, { order: 'post', after: 'local-storage:save' });
```

With the "load-page-okay" version of the code, we couldn't skip the loading of the page from the server.


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


### `hooks.emit(name, data, done)`

```js
// hooks.emit(name: any, data?: any, done?: (data?: any) => void): this
```

Sends an event with an optional data payload to any listeners.

```js
const elem = document.querySelector('a').addEventListener('click', (e) => {
    hooks.emit('link clicked', e.target);
});
```

You can also pass a callback as an optional third parameter. This will be called after all of the injectors have completed their transformations of the data, assuming they have all let the event pass through. It's similar to using `hooks.once()` but will only be called for this particular transformation of data and will not accidentally get the wrong event's data.

```js
const pageData = '<html><head>...';
hooks.emit('page-loaded', pageData, (result) => {
    console.log('Result:', result);
});
```

This method can throw if the list of interceptors is unable to be resolved; see `hooks.validate()` for further information. Also, if any interceptor does not continue the event, then the `hooks.on()` handlers will not be called and the optional callback to `hooks.emit()` will not be called.


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
//         order?: 'pre' | 'mid' | 'post'; // "mid" is default
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

Finally, you may wish to have some set of plugins happen before or after the "main point" of the hook. Take, for example, forwarding something to a user. If you'd like to allow usernames (without the hostname portion of an email) to be used and automatically apply `@fancy-company.com` to them, a plugin could do this. Similarly, another plugin could happen after the username processing is done and to ensure the user isn't on a blacklist.

```js
// Main code
hooks.inject('forward', 'main-code:verify-username', (username, next) => {
    fetch(`https://my-api/verify-user?username`)
        .then((response) => response.json())
        .then(() => next(username), hooks.emit('forward:bad-username'));
});
hooks.on('forward', (username) => {
    console.log('Forwarding to', username);
});

// Plugins
hooks.inject('forward', 'default-to-org-email', (username, next) => {
    if (username.indexOf('@') < 0) {
        next(username + '@fancy-company.com');
    } else {
        next(username);
    }
}, { order: 'pre' });
const blacklist = ['user@bad-place.net', ...];
hooks.inject('forward', 'disallow-from-blacklist', (username, next) => {
    if (blacklist.contains(username)) {
        hooks.emit('forward:bad-username');
    } else {
        next(username);
    }
}, { order: 'post' });
```

By default, the value for "order" is "mid". You can think of them as separating interceptors into three buckets. "before" and "after" will order interceptors within a bucket. "depends" and "conflicts" will scan plugins across all buckets.


### `hooks.remove(name, id)`

```js
// hooks.remove(name: any, id: any);
```

Eliminates an interceptor. Also clears the calculated list. For more information, see `hooks.inject()`.

```js
hooks.remove('abort', 'log-to-console');
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
    * [Rollup](https://rollupjs.org/) plugins allow extra code before and after a specific point.
