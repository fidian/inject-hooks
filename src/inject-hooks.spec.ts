import { InjectHooks } from "./inject-hooks";
import test from "ava";

test("constructor", (t) => {
    const hooks = new InjectHooks();
    t.truthy(hooks);
    t.truthy(hooks instanceof InjectHooks);
});

test("emit with no listeners", (t) => {
    const hooks = new InjectHooks();
    t.notThrows(() => hooks.emit("test"));
});

test("trigger one listener", (t) => {
    const hooks = new InjectHooks();
    let called = false;
    hooks.on("test", () => {
        called = true;
    });
    hooks.emit("test");
    t.true(called);
});

test("triggers multiple listeners", (t) => {
    const hooks = new InjectHooks();
    let called1 = false;
    let called2 = false;
    hooks.on("test", () => {
        called1 = true;
    });
    hooks.on("test", () => {
        called2 = true;
    });
    hooks.emit("test");
    t.true(called1);
    t.true(called2);
});

test("triggers an interceptor without a listener", (t) => {
    const hooks = new InjectHooks();
    let called = false;
    hooks.inject("test", "test", (data, next) => {
        called = true;
        next(data);
    });
    hooks.emit("test");
    t.true(called);
});

test("triggers an interceptor with a listener", (t) => {
    const hooks = new InjectHooks();
    let called1 = false;
    let called2 = false;
    hooks.on("test", () => {
        called1 = true;
    });
    hooks.inject("test", "test", (data, next) => {
        called2 = true;
        next(data);
    });
    hooks.emit("test");
    t.true(called1);
    t.true(called2);
});

test("triggering one name will not trigger other names", (t) => {
    const hooks = new InjectHooks();
    let called1 = false;
    let called2 = false;
    hooks.on("test1", () => {
        called1 = true;
    });
    hooks.on("test2", () => {
        called2 = true;
    });
    hooks.emit("test1");
    t.true(called1);
    t.false(called2);
});

test("interceptors can change data", (t) => {
    const hooks = new InjectHooks();
    let data = null;
    hooks.inject("test", "plus-one", (d, next) => {
        next(d + 1);
    });
    hooks.inject("test", "times-ten", (d, next) => {
        next(d * 10);
    });
    hooks.on("test", (d) => {
        data = d;
    });
    hooks.emit("test", 1);
    t.is(data, 20);
});

test("emit returns this", (t) => {
    const hooks = new InjectHooks();
    t.is(hooks.emit("test"), hooks);
});

test("inject returns this", (t) => {
    const hooks = new InjectHooks();
    t.is(hooks.inject("test", "test", () => {}), hooks);
});

test("inject throws if ID already exists", (t) => {
    const hooks = new InjectHooks();
    t.notThrows(() => hooks.inject("test", "test", () => {}));
    t.throws(() => hooks.inject("test", "test", () => {}));
});

test("off returns this", (t) => {
    const hooks = new InjectHooks();
    const handler = () => {};
    hooks.on("test", handler);
    t.notThrows(() => {
        t.is(hooks.off("test", handler), hooks);
    });
});

test("off throws if handler not found", (t) => {
    const hooks = new InjectHooks();
    t.throws(() => hooks.off("test", () => {}));
});

test("off only removes one instance if handler added multiple times", (t) => {
    const hooks = new InjectHooks();
    let count = 0;
    const handler = () => {
        count += 1;
    };
    hooks.on("test", handler);
    hooks.on("test", handler);
    hooks.off("test", handler);
    hooks.emit("test");
    t.is(count, 1);
});

test("once only triggers once", (t) => {
    const hooks = new InjectHooks();
    let count = 0;
    hooks.once("test", () => {
        count += 1;
    });
    hooks.emit("test");
    hooks.emit("test");
    t.is(count, 1);
});

test("once returns this", (t) => {
    const hooks = new InjectHooks();
    t.is(hooks.once("test", () => {}), hooks);
});

test("remove returns this", (t) => {
    const hooks = new InjectHooks();
    hooks.inject("test", "test", () => {});
    t.notThrows(() => {
        t.is(hooks.remove("test", "test"), hooks);
    });
});

test("remove throws if ID not found", (t) => {
    const hooks = new InjectHooks();
    t.throws(() => hooks.remove("test", "test"));
});

test("transform returns this", (t) => {
    const hooks = new InjectHooks();
    t.is(hooks.transform("test", 1, (d) => d), hooks);
});

test("transform modifies data", (t) => {
    const hooks = new InjectHooks();
    hooks.inject('test', 'test', (d, next) => {
        next(d + 1);
    });
    let result = null;
    hooks.transform("test", 1, (d) => result = d);
    t.is(result, 2);
});

test("transform only applies interceptors that match the name", (t) => {
    const hooks = new InjectHooks();
    hooks.inject('test', 'test', (d, next) => {
        next(d + 1);
    });
    let result = null;
    hooks.transform("not-test", 1, (d) => result = d);
    t.is(result, 1);
});

test("validate returns this", (t) => {
    const hooks = new InjectHooks();
    t.is(hooks.validate(), hooks);
});

test("validate throws on interceptor conflicts", (t) => {
    const hooks = new InjectHooks();
    hooks.inject('test', 'one', () => {}, { conflicts: 'two' });
    t.notThrows(() => hooks.validate());
    hooks.inject('test', 'two', () => {});
    t.throws(() => hooks.validate());
});

test("validate throws when interceptor depends on missing interceptor", (t) => {
    const hooks = new InjectHooks();
    hooks.inject('test', 'one', () => {}, { depends: 'two' });
    t.throws(() => hooks.validate());
    hooks.inject('test', 'two', () => {});
    t.notThrows(() => hooks.validate());
});

test("interceptor order changes based on conditions", (t) => {
    const hooks = new InjectHooks();
    hooks.inject('test', 'add-one', (d, next) => next(d + 1), { before: 'two' });
    let result = null;
    hooks.on('test', (d) => result = d);
    hooks.emit('test', 1);
    t.is(result, 2);
    hooks.inject('test', 'times-ten', (d, next) => next(d * 10), { after: 'add-one' });
    hooks.emit('test', 1);
    t.is(result, 20);
    hooks.inject('test', 'plus-one-tenth', (d, next) => next(d + 0.1), { before: 'times-ten' });
    hooks.emit('test', 1);
    t.is(result, 21);
    hooks.remove('test', 'times-ten');
    hooks.emit('test', 1);
    t.is(result, 2.1);
});

test("interceptor order with circular dependencies will throw", (t) => {
    const hooks = new InjectHooks();
    hooks.inject('test', 'one', () => {}, { before: 'two' });
    hooks.inject('test', 'two', () => {}, { before: 'three', after: 'one' });
    hooks.inject('test', 'three', () => {}, { before: 'one' });
    t.throws(() => hooks.emit('test'));
});
