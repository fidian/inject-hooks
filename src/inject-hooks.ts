export type InjectHooksKey = any;
export type InjectHooksCallback = (data?: any) => void;
export interface InjectHooksConditions {
    after?: InjectHooksKey[] | InjectHooksKey;
    before?: InjectHooksKey[] | InjectHooksKey;
    conflicts?: InjectHooksKey[] | InjectHooksKey;
    depends?: InjectHooksKey[] | InjectHooksKey;
}
export interface InjectHooksConditionsAbsolute {
    after: InjectHooksKey[];
    before: InjectHooksKey[];
    conflicts: InjectHooksKey[];
    depends: InjectHooksKey[];
}
export type InjectHooksHandler = (data?: any) => void;
export type InjectHooksInterceptor = (data: any, next: InjectHooksCallback) => void;
interface InjectHooksInterceptorInfo {
    id: InjectHooksKey;
    injector: InjectHooksInterceptor;
    conditions: InjectHooksConditionsAbsolute;
}

export class InjectHooks {
    private _handlers = new Map<InjectHooksKey, InjectHooksHandler[]>();
    private _interceptors = new Map<InjectHooksKey, Map<InjectHooksKey, InjectHooksInterceptorInfo>>();
    private _interceptorsOrdered = new Map<InjectHooksKey, InjectHooksInterceptor[]>();

    emit(name: InjectHooksKey, data?: any): this {
        this.transform(name, data, (modifiedData: any) => {
            const list = [...(this._handlers.get(name)??[])];
            list.forEach((handler) => {
                handler(modifiedData);
            });
        });

        return this;
    }

    inject(name: InjectHooksKey, id: InjectHooksKey, injector: InjectHooksInterceptor, conditions: InjectHooksConditions = {}): this {
        const toArray = (a: InjectHooksKey | InjectHooksKey[] | undefined) => {
            if (Array.isArray(a)) {
                return a;
            }

            if (a === undefined) {
                return [];
            }

            return [a];
        }

        this._interceptorsOrdered.delete(name);
        const map = this._interceptors.get(name) || this._interceptors.set(name, new Map()).get(name)!;

        if (map.has(id)) {
            throw new Error(`InjectHooks - ID already exists: ${id}`);
        }

        map.set(id, {
            id,
            injector,
            conditions: {
                after: toArray(conditions.after),
                before: toArray(conditions.before),
                conflicts: toArray(conditions.conflicts),
                depends: toArray(conditions.depends),
            },
        });

        return this;
    }

    off(name: InjectHooksKey, handler: InjectHooksHandler): this {
        const a = this._handlers.get(name) || [];

        for (let i = 0; i < a.length; i += 1) {
            if (a[i] === handler) {
                a.splice(i, 1);

                return this;
            }
        }

        throw new Error(`InjectHooks - ${name} handler not found`);
    }

    on(name: InjectHooksKey, handler: InjectHooksHandler): this {
        const a = this._handlers.get(name) || this._handlers.set(name, []).get(name)!;
        a.push(handler);

        return this;
    }

    once(name: InjectHooksKey, handler: InjectHooksHandler): this {
        const onceHandler = () => {
            this.off(name, onceHandler);
            this.off(name, handler);
        };
        this.on(name, onceHandler);

        return this.on(name, handler);
    }

    remove(name: InjectHooksKey, id: InjectHooksKey): this {
        this._interceptorsOrdered.delete(name);
        const map = this._interceptors.get(name);

        if (map) {
            map.delete(id);
            return this;
        }

        throw new Error(`InjectHooks - ${name} interceptor ${id} not found`);
    }

    transform(name: InjectHooksKey, data: any, callback: InjectHooksCallback): this {
        const runNext = (interceptors: InjectHooksInterceptor[], data: any) => {
            const interceptor = interceptors.shift();

            if (interceptor) {
                interceptor(data, (data) => {
                    runNext(interceptors, data);
                });
            } else {
                callback(data);
            }
        };
        runNext(this._getInterceptors(name), data);

        return this;
    }

    validate(name?: InjectHooksKey): this {
        if (name) {
            this._getInterceptors(name);
        } else {
            for (const name of this._interceptors.keys()) {
                this._getInterceptors(name);
            }
        }

        return this;
    }

    private _getInterceptors(name: InjectHooksKey): InjectHooksInterceptor[] {
        const cached = this._interceptorsOrdered.get(name);

        if (cached) {
            return cached;
        }

        const map = this._interceptors.get(name);

        if (!map) {
            return [];
        }

        const unresolved = new Set(map.keys());

        // Verify depends and conflicts
        for (const info of map.values()) {
            for (const depend of info.conditions.depends) {
                if (!unresolved.has(depend)) {
                    throw new Error(`InjectHooks - ${info.id} requires missing dependency ${depend}`);
                }
            }

            for (const conflict of info.conditions.conflicts) {
                if (unresolved.has(conflict)) {
                    throw new Error(`InjectHooks - ${info.id} conflicts with ${conflict}`);
                }
            }
        }

        let unresolvedLastSize = unresolved.size;
        const ordered: InjectHooksInterceptor[] = [];

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
                    ordered.push(info.injector);
                    unresolved.delete(id);
                }
            }
        } while (unresolved.size !== unresolvedLastSize && unresolved.size);

        if (unresolved.size) {
            throw new Error(`InjectHooks - Circular dependencies: ${Array.from(unresolved).join(', ')}`);
        }

        this._interceptorsOrdered.set(name, ordered);

        return ordered;
    }
}
