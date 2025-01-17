import { InjectHooks } from "./inject-hooks";
import test from "ava";

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

test("constructor", (t) => {
    const hooks = new InjectHooks();
    t.truthy(hooks);
    t.truthy(hooks instanceof InjectHooks);
});

test("emit with no listeners", (t) => {
    const hooks = new InjectHooks();
    t.notThrows(() => hooks.emit("test"));
});

test("trigger one listener", async (t) => {
    const hooks = new InjectHooks();
    let called = false;
    hooks.on("test", () => {
        called = true;
    });
    hooks.emit("test");
    await sleep(1);
    t.true(called);
});

test("triggers multiple listeners", async (t) => {
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
    await sleep(1);
    t.true(called1);
    t.true(called2);
});

test("triggers an interceptor without a listener", async (t) => {
    const hooks = new InjectHooks();
    let called = false;
    hooks.inject("test", "test", (data, next) => {
        called = true;
        next(data);
    });
    hooks.emit("test");
    await sleep(1);
    t.true(called);
});

test("triggers an interceptor with a listener", async (t) => {
    const hooks = new InjectHooks();
    let called1 = false;
    let called2 = false;
    hooks.on("test", (data) => {
        called1 = true;
        t.is(data, 1);
    });
    hooks.inject("test", "test", (data, next) => {
        called2 = true;
        next(data);
    });
    hooks.emit("test", 1);
    await sleep(1);
    t.true(called1);
    t.true(called2);
});

test("triggering one name will not trigger other names", async (t) => {
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
    await sleep(1);
    t.true(called1);
    t.false(called2);
});

test("interceptors can change data", async (t) => {
    const hooks = new InjectHooks();
    let data = null;
    hooks.inject("test", "one", (d, next) => {
        next(`${d} one`);
    });
    hooks.inject("test", "two", (d, next) => {
        next(`${d} two`);
    });
    hooks.on("test", (d) => {
        data = d;
    });
    hooks.emit("test", "zero");
    await sleep(1);
    t.is(data, "zero one two");
});

test("emit returns this", (t) => {
    const hooks = new InjectHooks();
    t.is(hooks.emit("test"), hooks);
});

test("inject returns this", (t) => {
    const hooks = new InjectHooks();
    t.is(
        hooks.inject("test", "test", () => {}),
        hooks
    );
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

test("off only removes one instance if handler added multiple times", async (t) => {
    const hooks = new InjectHooks();
    let count = 0;
    const handler = () => {
        count += 1;
    };
    hooks.on("test", handler);
    hooks.on("test", handler);
    hooks.off("test", handler);
    hooks.emit("test");
    await sleep(1);
    t.is(count, 1);
});

test("once only triggers once", async (t) => {
    const hooks = new InjectHooks();
    let count = 0;
    hooks.once("test", () => {
        count += 1;
    });
    hooks.emit("test");
    await sleep(1);
    hooks.emit("test");
    await sleep(1);
    t.is(count, 1);
});

test("once returns this", (t) => {
    const hooks = new InjectHooks();
    t.is(
        hooks.once("test", () => {}),
        hooks
    );
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

test("emit with done modifies data", async (t) => {
    const hooks = new InjectHooks();
    hooks.inject("test", "one", (d, next) => {
        next(`${d} one`);
    });
    let result = null;
    hooks.emit("test", "zero", (d) => (result = d));
    await sleep(1);
    t.is(result, "zero one");
});

test("emit with done only applies interceptors that match the name", async (t) => {
    const hooks = new InjectHooks();
    hooks.inject("test", "one", (d, next) => {
        next(`${d} one`);
    });
    let result = null;
    hooks.emit("not-test", "zero", (d) => (result = d));
    await sleep(1);
    t.is(result, "zero");
});

test("validate returns this", (t) => {
    const hooks = new InjectHooks();
    t.is(hooks.validate(), hooks);
});

test("validate throws on interceptor conflicts", (t) => {
    const hooks = new InjectHooks();
    hooks.inject("test", "one", () => {}, { conflicts: "two" });
    t.notThrows(() => hooks.validate());
    hooks.inject("test", "two", () => {});
    t.throws(() => hooks.validate());
});

test("validate throws when interceptor depends on missing interceptor", (t) => {
    const hooks = new InjectHooks();
    hooks.inject("test", "one", () => {}, { depends: "two" });
    t.throws(() => hooks.validate());
    hooks.inject("test", "two", () => {});
    t.notThrows(() => hooks.validate());
});

test("interceptor order changes based on conditions", async (t) => {
    const hooks = new InjectHooks();
    hooks.inject(
        "test",
        "one",
        (d, next) => {
            next(`${d} one`);
        },
        { before: "two" }
    );
    let result = null;
    hooks.on("test", (d) => (result = d));
    hooks.emit("test", "zero");
    await sleep(1);
    t.is(result, "zero one");
    hooks.inject(
        "test",
        "two",
        (d, next) => {
            next(`${d} two`);
        },
        { after: "one" }
    );
    hooks.emit("test", "zero");
    await sleep(1);
    t.is(result, "zero one two");
    hooks.inject(
        "test",
        "three",
        (d, next) => {
            next(`${d} three`);
        },
        { before: "two" }
    );
    hooks.emit("test", "zero");
    await sleep(1);
    t.is(result, "zero one three two");
    hooks.remove("test", "two");
    hooks.emit("test", "zero");
    await sleep(1);
    t.is(result, "zero one three");
});

test("interceptor order with circular dependencies will throw", (t) => {
    const hooks = new InjectHooks();
    hooks.inject("test", "one", () => {}, { before: "two" });
    hooks.inject("test", "two", () => {}, { before: "three", after: "one" });
    hooks.inject("test", "three", () => {}, { before: "one" });
    t.throws(() => hooks.emit("test"));
});

test("ordered interceptors only are relative to interceptors in that same order", async (t) => {
    const hooks = new InjectHooks();
    hooks.inject(
        "test",
        "one",
        (d, next) => {
            next(`${d} one`);
        },
        { order: "pre", after: "two" }
    );
    hooks.inject(
        "test",
        "two",
        (d, next) => {
            next(`${d} two`);
        },
        {}
    );
    let result = "";
    hooks.on("test", (d) => (result = d));
    hooks.emit("test", "zero");
    await sleep(1);
    t.is(result, "zero one two");
});

test("can use a function to determine if an interceptor should run", async (t) => {
    const hooks = new InjectHooks();
    hooks.inject(
        (name: string) => !!name.match(/e/),
        "one",
        (data, next) => next(`${data} one`)
    );
    hooks.inject(
        (name: string) => !!name.match(/s/),
        "two",
        (data, next) => next(`${data} two`)
    );
    let resultTest: string | null = null;
    let resultStan: string | null = null;
    hooks.on("test", (d) => (resultTest = d));
    hooks.on("stan", (d) => (resultStan = d));
    hooks.emit("test", "zero");
    await sleep(1);
    t.is(resultTest, "zero one two");
    t.is(resultStan, null);
    hooks.emit("stan", "zero");
    await sleep(1);
    t.is(resultTest, "zero one two");
    t.is(resultStan, "zero two");
});

test("can use a function to listen for events", async (t) => {
    const hooks = new InjectHooks();
    const e: string[] = [];
    const s: string[] = [];
    hooks.on(
        (name: string) => !!name.match(/e/),
        (data) => e.push(data)
    );
    hooks.emit("test", "one");
    await sleep(1);
    t.is(e.length, 1);
    t.is(s.length, 0);
    hooks.on(
        (name: string) => !!name.match(/s/),
        (data) => s.push(data)
    );
    hooks.emit("test", "two");
    await sleep(1);
    t.is(e.length, 2);
    t.is(s.length, 1);
    hooks.emit("stan", "three");
    await sleep(1);
    t.is(e.length, 2);
    t.is(s.length, 2);
});

test("can add and remove interceptors with a function", async (t) => {
    const hooks = new InjectHooks();
    let hits = 0;
    const filter = (name: string) => !!name.match(/e/);
    const handler = (data: string) => hits++;
    hooks.on(filter, handler);
    hooks.emit("test", "one");
    await sleep(1);
    t.is(hits, 1);
    hooks.off(filter, handler);
    hooks.emit("test", "one");
    await sleep(1);
    t.is(hits, 1);
});

test("can add and remove handlers with a function", async (t) => {
    const hooks = new InjectHooks();
    let hits = 0;
    const filter = (name: string) => !!name.match(/e/);
    const handler = (data: string) => hits++;
    hooks.on(filter, handler);
    hooks.emit("test", "one");
    await sleep(1);
    t.is(hits, 1);
    hooks.off(filter, handler);
    hooks.emit("test", "one");
    await sleep(1);
    t.is(hits, 1);
});

test("interceptors and handlers get names passed in", async (t) => {
    const hooks = new InjectHooks();
    let hits = 0;
    hooks.on("test", (data, name) => {
        t.is(name, "test");
        hits += 1;
    });
    hooks.on(
        (name) => name !== "skip",
        (data, name) => {
            t.is(name, "test");
            hits += 1;
        }
    );
    hooks.inject("test", "one", (data, next, name) => {
        t.is(name, "test");
        hits += 1;
        next(data);
    });
    hooks.inject(
        (name) => name !== "skip",
        "two",
        (data, next, name) => {
            t.is(name, "test");
            hits += 1;
            next(data);
        }
    );
    hooks.emit("test", "zero");
    await sleep(1);
    t.is(hits, 4);
});
