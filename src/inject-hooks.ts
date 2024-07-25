export type InjectHooksKey = string;
export type InjectHooksId = string;
export type InjectHooksFilter = (name: InjectHooksKey) => boolean;
export type InjectHooksCallback = (data: any) => void;
export interface InjectHooksConditions {
    after?: InjectHooksKey[] | InjectHooksKey;
    before?: InjectHooksKey[] | InjectHooksKey;
    conflicts?: InjectHooksKey[] | InjectHooksKey;
    depends?: InjectHooksKey[] | InjectHooksKey;
    order?: "pre" | "mid" | "post";
}
export interface InjectHooksConditionsAbsolute {
    after: InjectHooksKey[];
    before: InjectHooksKey[];
    conflicts: InjectHooksKey[];
    depends: InjectHooksKey[];
    order: "pre" | "mid" | "post";
}
export type InjectHooksHandler<KEY, VALUE> = (data: VALUE, name: KEY) => void;
interface InjectHooksHandlerInfo {
    name: InjectHooksKey | InjectHooksFilter;
    handler: InjectHooksHandler<string, any>;
}
export type InjectHooksInterceptor<KEY, VALUE> = (
    data: VALUE,
    next: InjectHooksCallback,
    name: KEY
) => void;
interface InjectHooksInterceptorInfo {
    id: InjectHooksId;
    injector: InjectHooksInterceptor<string, any>;
    name: InjectHooksKey | InjectHooksFilter;
    conditions: InjectHooksConditionsAbsolute;
}

const InjectHooksFilter = Symbol("InjectHooksFilter");

export class InjectHooks<T = Record<InjectHooksKey, any>> {
    private _handlers = new Map<
        InjectHooksKey | Symbol,
        InjectHooksHandlerInfo[]
    >();
    private _interceptors = new Map<
        InjectHooksKey | Symbol,
        Map<InjectHooksKey, InjectHooksInterceptorInfo>
    >();
    private _interceptorsOrdered = new Map<
        InjectHooksKey | Symbol,
        InjectHooksInterceptor<string, any>[]
    >();

    emit<KEY extends keyof T & InjectHooksKey>(
        name: KEY,
        data?: T[KEY],
        done?: (data: T[KEY]) => void
    ): this {
        // Validate interceptors or throw
        this._getOrderedInterceptors(name);

        setTimeout(() => {
            this._transform(name, data as T[KEY], (modifiedData: any) => {
                const list = [...(this._handlers.get(name) ?? [])];

                for (const handler of this._handlers.get(InjectHooksFilter) ??
                    []) {
                    if (
                        typeof handler.name === "function" &&
                        handler.name(name)
                    ) {
                        list.push(handler);
                    }
                }

                const handlerList = list.map((item) => item.handler);

                if (done) {
                    handlerList.unshift(done);
                }

                handlerList.forEach((handler) => {
                    handler(modifiedData, name);
                });
            });
        });

        return this;
    }

    inject<KEY extends keyof T & InjectHooksKey>(
        name: KEY | InjectHooksFilter,
        id: InjectHooksId,
        injector: InjectHooksInterceptor<KEY, T[KEY]>,
        conditions: InjectHooksConditions = {}
    ): this {
        const toArray = (a: InjectHooksKey | InjectHooksKey[] | undefined) => {
            if (Array.isArray(a)) {
                return a;
            }

            if (a === undefined) {
                return [];
            }

            return [a];
        };

        let mapKey: InjectHooksKey | Symbol;

        if (typeof name === "function") {
            this._interceptorsOrdered.clear();
            mapKey = InjectHooksFilter;
        } else {
            this._interceptorsOrdered.delete(name);
            mapKey = name;
        }

        const map =
            this._interceptors.get(mapKey) ||
            this._interceptors.set(mapKey, new Map()).get(mapKey)!;

        if (map.has(id)) {
            throw new Error(`InjectHooks - ID already exists: ${id}`);
        }

        map.set(id, {
            id,
            injector: injector as InjectHooksInterceptor<string, any>,
            name,
            conditions: {
                after: toArray(conditions.after),
                before: toArray(conditions.before),
                conflicts: toArray(conditions.conflicts),
                depends: toArray(conditions.depends),
                order: conditions.order || "mid"
            }
        });

        return this;
    }

    off<KEY extends keyof T & string>(
        name: KEY | InjectHooksFilter,
        handler: InjectHooksHandler<KEY, T[KEY]>
    ): this {
        const key = typeof name === "function" ? InjectHooksFilter : name;
        const a = this._handlers.get(key) || [];

        for (let i = 0; i < a.length; i += 1) {
            if (a[i].handler === handler) {
                a.splice(i, 1);

                return this;
            }
        }

        if (a.length === 0) {
            this._handlers.delete(key);
        }

        throw new Error(`InjectHooks - ${name} handler not found`);
    }

    on<KEY extends keyof T & string>(
        name: KEY | InjectHooksFilter,
        handler: InjectHooksHandler<KEY, T[KEY]>
    ): this {
        const key = typeof name === "function" ? InjectHooksFilter : name;
        const a =
            this._handlers.get(key) || this._handlers.set(key, []).get(key)!;
        a.push({
            name,
            handler: handler as InjectHooksHandler<string, any>
        });

        return this;
    }

    once<KEY extends keyof T & string>(
        name: KEY | InjectHooksFilter,
        handler: InjectHooksHandler<KEY, T[KEY]>
    ): this {
        const onceHandler = () => {
            this.off(name, onceHandler);
            this.off(name, handler);
        };
        this.on(name, onceHandler);

        return this.on(name, handler);
    }

    remove<KEY extends keyof T & string>(
        name: KEY | InjectHooksFilter,
        id: InjectHooksId
    ): this {
        const key = typeof name === "function" ? InjectHooksFilter : name;
        this._interceptorsOrdered.delete(key);
        const map = this._interceptors.get(key);

        if (map) {
            map.delete(id);

            if (map.size === 0) {
                this._interceptors.delete(key);
            }

            return this;
        }

        throw new Error(`InjectHooks - ${name} interceptor ${id} not found`);
    }

    validate<KEY extends keyof T & string>(name?: KEY): this {
        if (name) {
            this._getOrderedInterceptors(name);
        } else {
            for (const name of this._interceptors.keys()) {
                if (name !== InjectHooksFilter) {
                    this._getOrderedInterceptors(name as string);
                }
            }
        }

        return this;
    }

    private _getInterceptors(
        name: InjectHooksKey
    ): Map<string, InjectHooksInterceptorInfo> {
        const result = new Map<string, InjectHooksInterceptorInfo>(
            this._interceptors.get(name) || []
        );

        for (const [id, info] of this._interceptors.get(InjectHooksFilter) ||
            []) {
            if (typeof info.name === "function" && info.name(name)) {
                if (result.has(id)) {
                    throw new Error(`InjectHooks - ID already exists: ${id}`);
                }

                result.set(id, info);
            }
        }

        return result;
    }

    private _getOrderedInterceptors(
        name: InjectHooksKey
    ): InjectHooksInterceptor<string, any>[] {
        const cached = this._interceptorsOrdered.get(name);

        if (cached) {
            return cached;
        }

        const map = this._getInterceptors(name);
        this._verifyInterceptors(map);
        const { pre, mid, post } = this._separateInterceptors(map);
        const ordered = [
            ...this._orderInterceptors(pre),
            ...this._orderInterceptors(mid),
            ...this._orderInterceptors(post)
        ];
        this._interceptorsOrdered.set(name, ordered);

        return ordered;
    }

    private _orderInterceptors(
        map: Map<InjectHooksKey, InjectHooksInterceptorInfo>
    ): InjectHooksInterceptor<string, any>[] {
        const unresolved = new Set(map.keys());
        const result = [];
        let unresolvedLastSize = unresolved.size;

        do {
            let wait = new Set<InjectHooksKey>();

            for (const id of unresolved) {
                const info = map.get(id)!;

                for (const after of info.conditions.after) {
                    if (unresolved.has(after)) {
                        wait.add(id);
                        break;
                    }
                }

                for (const before of info.conditions.before) {
                    if (unresolved.has(before)) {
                        wait.add(before);
                    }
                }
            }

            for (const id of unresolved) {
                if (!wait.has(id)) {
                    const info = map.get(id)!;
                    result.push(info.injector);
                    unresolved.delete(id);
                }
            }
        } while (unresolved.size !== unresolvedLastSize && unresolved.size);

        if (unresolved.size) {
            throw new Error(
                `InjectHooks - Circular dependencies: ${Array.from(unresolved).join(", ")}`
            );
        }

        return result;
    }

    private _separateInterceptors(
        map: Map<InjectHooksKey, InjectHooksInterceptorInfo>
    ) {
        const pre = new Map<InjectHooksKey, InjectHooksInterceptorInfo>();
        const mid = new Map<InjectHooksKey, InjectHooksInterceptorInfo>();
        const post = new Map<InjectHooksKey, InjectHooksInterceptorInfo>();

        for (const info of map.values()) {
            const order = info.conditions.order;

            if (order === "pre") {
                pre.set(info.id, info);
            } else if (order === "post") {
                post.set(info.id, info);
            } else {
                mid.set(info.id, info);
            }
        }

        return { pre, mid, post };
    }

    private _transform<KEY extends keyof T & string>(
        name: KEY,
        data: T[KEY],
        callback: InjectHooksCallback
    ): this {
        const runNext = (interceptors: InjectHooksInterceptor<string, any>[], data: any) => {
            const interceptor = interceptors.shift();

            if (interceptor) {
                interceptor(
                    data,
                    (data) => {
                        runNext(interceptors, data);
                    },
                    name
                );
            } else {
                callback(data);
            }
        };
        runNext(this._getOrderedInterceptors(name), data);

        return this;
    }

    private _verifyInterceptors(
        map: Map<InjectHooksKey, InjectHooksInterceptorInfo>
    ) {
        // Verify depends and conflicts
        for (const info of map.values()) {
            for (const depend of info.conditions.depends) {
                if (!map.has(depend)) {
                    throw new Error(
                        `InjectHooks - ${info.id} requires missing dependency ${depend}`
                    );
                }
            }

            for (const conflict of info.conditions.conflicts) {
                if (map.has(conflict)) {
                    throw new Error(
                        `InjectHooks - ${info.id} conflicts with ${conflict}`
                    );
                }
            }
        }
    }
}
