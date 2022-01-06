/**
 * @jest-environment jsdom
 */

import { get, isEqual, remove } from 'lodash';

import { perfMeasure, useRouteVuexModulesClient, useFetchDataClient } from '../src/entry-client';

const getResolvablePromise = () => {
    let resolve;
    // eslint-disable-next-line no-return-assign
    const promise = new Promise(r => resolve = r);
    return { promise, resolve };
};

function initWindowPerformance() {
    const entries = [];
    Object.assign(window.performance, {
        getEntriesByType(type) {
            return entries.filter(e => e.entryType === type);
        },
        mark(name) {
            entries.push({
                entryType: 'mark',
                name,
            });
        },
        measure(name, markName) {
            entries.push({
                entryType: 'measure',
                name,
                markName,
            });
        },
        clearMarks(name) {
            remove(entries, e => e.entryType === 'mark' && e.name === name);
        },
        clearMeasures(name) {
            remove(entries, e => e.entryType === 'measure' && e.name === name);
        },
    });
    return entries;
}

describe('entry-client utils', () => {
    const noop = () => {};
    const logger = {
        info: noop,
        debug: noop,
        warn: noop, // For debugging, change to console.warn
        error: noop, // For debugging, change to console.error
    };

    describe('useRouteVuexModulesClient', () => {

        it('should register route-level vuex modules', async () => {
            const testModule = {
                namespaced: true,
                state: {
                    count: 1,
                },
            };
            let beforeResolveFn;
            const app = { name: 'App' };
            const router = {
                afterEach() {},
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const store = {
                hasModule: () => false,
                registerModule: jest.fn(),
            };
            useRouteVuexModulesClient(app, router, store, logger);

            // No calls yet - no routing lifecycles processed
            expect(store.registerModule).not.toHaveBeenCalled();

            const from = { path: '/test1' };
            const to = {
                path: '/test2',
                matched: [{
                    components: {
                        test2: {
                            vuex: {
                                moduleName: 'test2',
                                module: testModule,
                            },
                        },
                    },
                }],
            };
            const { promise, resolve } = getResolvablePromise();
            beforeResolveFn(to, from, resolve);
            const nextParam = await promise;
            expect(store.registerModule).toHaveBeenCalledWith(['test2'], testModule, {
                preserveState: false,
            });
            expect(nextParam).toBe(undefined);
        });

        it('should ignore modules which do not specify a vuex key', async () => {
            let beforeResolveFn;
            const app = { name: 'App' };
            const router = {
                afterEach() {},
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const store = {
                hasModule: () => false,
                registerModule: jest.fn(),
            };
            useRouteVuexModulesClient(app, router, store, logger);

            // No calls yet - no routing lifecycles processed
            expect(store.registerModule).not.toHaveBeenCalled();

            const from = { path: '/test1' };
            const to = {
                path: '/test2',
                matched: [{
                    components: {
                        test2: {},
                    },
                }],
            };
            const { promise, resolve } = getResolvablePromise();
            beforeResolveFn(to, from, resolve);
            const nextParam = await promise;
            expect(store.registerModule).not.toHaveBeenCalled();
            expect(nextParam).toBe(undefined);
        });

        it('should handle nested routes', async () => {
            const testModule1 = {
                namespaced: true,
                state: {
                    count: 1,
                },
            };
            const testModule2 = {
                namespaced: true,
                state: {
                    count: 2,
                },
            };
            let beforeResolveFn;
            const app = { name: 'App' };
            const router = {
                afterEach() {},
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const store = {
                hasModule: () => false,
                registerModule: jest.fn(),
            };
            useRouteVuexModulesClient(app, router, store, logger);

            // No calls yet - no routing lifecycles processed
            expect(store.registerModule).not.toHaveBeenCalled();

            const from = { path: '/test' };
            const to = {
                path: '/test/child',
                matched: [{
                    components: {
                        a: {
                            vuex: {
                                moduleName: 'test',
                                module: testModule1,
                            },
                        },
                        b: {
                            // No vuex module on this component
                        },
                        c: {
                            vuex: {
                                moduleName: 'child',
                                module: testModule2,
                            },
                        },
                    },
                }],
            };

            const { promise, resolve } = getResolvablePromise();
            beforeResolveFn(to, from, resolve);
            const nextParam = await promise;
            expect(store.registerModule).toHaveBeenCalledWith(['test'], testModule1, {
                preserveState: false,
            });
            expect(store.registerModule).toHaveBeenCalledWith(['child'], testModule2, {
                preserveState: false,
            });
            expect(nextParam).toBe(undefined);
        });

        it('should preserve state if it already exists', async () => {
            const testModule = {
                namespaced: true,
                state: {
                    count: 1,
                },
            };
            let beforeResolveFn;
            const app = { name: 'App' };
            const router = {
                afterEach() {},
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const store = {
                hasModule: () => false,
                registerModule: jest.fn(),
                state: {
                    test2: {
                        count: 2,
                    },
                },
            };
            useRouteVuexModulesClient(app, router, store, logger);

            // No calls yet - no routing lifecycles processed
            expect(store.registerModule).not.toHaveBeenCalled();

            const from = { path: '/test1' };
            const to = {
                path: '/test2',
                matched: [{
                    components: {
                        test2: {
                            vuex: {
                                moduleName: 'test2',
                                module: testModule,
                            },
                        },
                    },
                }],
            };
            const { promise, resolve } = getResolvablePromise();
            beforeResolveFn(to, from, resolve);
            const nextParam = await promise;
            expect(store.registerModule).toHaveBeenCalledWith(['test2'], testModule, {
                preserveState: true,
            });
            expect(nextParam).toBe(undefined);
        });

        it('should not re-register modules that are already registered', async () => {
            const testModule = {
                namespaced: true,
                state: {
                    count: 1,
                },
            };
            let beforeResolveFn;
            const app = { name: 'App' };
            const router = {
                afterEach() {},
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const store = {
                hasModule: name => isEqual(name, ['test2']),
                registerModule: jest.fn(),
            };
            useRouteVuexModulesClient(app, router, store, logger);

            // No calls yet - no routing lifecycles processed
            expect(store.registerModule).not.toHaveBeenCalled();

            const from = { path: '/test1' };
            const to = {
                path: '/test2',
                matched: [{
                    components: {
                        test2: {
                            vuex: {
                                moduleName: 'test2',
                                module: testModule,
                            },
                        },
                    },
                }],
            };
            const { promise, resolve } = getResolvablePromise();
            beforeResolveFn(to, from, resolve);
            const nextParam = await promise;
            expect(store.registerModule).not.toHaveBeenCalled();
            expect(nextParam).toBe(undefined);
        });

        it('should support function to specify module name', async () => {
            const testModule = {
                namespaced: true,
                state: {
                    count: 1,
                },
            };
            let beforeResolveFn;
            const app = { name: 'App' };
            const router = {
                afterEach() {},
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const store = {
                hasModule: () => false,
                registerModule: jest.fn(),
            };
            useRouteVuexModulesClient(app, router, store, logger);

            // No calls yet - no routing lifecycles processed
            expect(store.registerModule).not.toHaveBeenCalled();

            const from = { path: '/test1' };
            const to = {
                path: '/test2',
                params: {
                    slug: 'foo',
                },
                matched: [{
                    components: {
                        test2: {
                            vuex: {
                                moduleName: ({ $route }) => `test2--${$route.params.slug}`,
                                module: testModule,
                            },
                        },
                    },
                }],
            };
            const { promise, resolve } = getResolvablePromise();
            beforeResolveFn(to, from, resolve);
            const nextParam = await promise;
            expect(store.registerModule).toHaveBeenCalledWith(['test2--foo'], testModule, {
                preserveState: false,
            });
            expect(nextParam).toBe(undefined);
        });

        it('should support nested modules', async () => {
            const testModule = {
                namespaced: true,
                state: {
                    count: 1,
                },
            };
            let beforeResolveFn;
            const app = { name: 'App' };
            const router = {
                afterEach() {},
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const store = {
                hasModule: () => false,
                registerModule: jest.fn(),
            };
            useRouteVuexModulesClient(app, router, store, logger);

            // No calls yet - no routing lifecycles processed
            expect(store.registerModule).not.toHaveBeenCalled();

            const from = { path: '/test1' };
            const to = {
                path: '/test2',
                matched: [{
                    components: {
                        test2: {
                            vuex: {
                                moduleName: 'foo/bar/baz',
                                module: testModule,
                            },
                        },
                    },
                }],
            };
            const { promise, resolve } = getResolvablePromise();
            beforeResolveFn(to, from, resolve);
            const nextParam = await promise;
            expect(store.registerModule).toHaveBeenCalledWith(['foo', 'bar', 'baz'], testModule, {
                preserveState: false,
            });
            expect(nextParam).toBe(undefined);
        });

        it('should cancel routing if something goes wrong', async () => {
            let beforeResolveFn;
            const app = { name: 'App' };
            const router = {
                afterEach() {},
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const store = {
                hasModule: () => false,
                registerModule: jest.fn(),
            };
            useRouteVuexModulesClient(app, router, store, logger);

            // No calls yet - no routing lifecycles processed
            expect(store.registerModule).not.toHaveBeenCalled();

            const from = { path: '/test1' };
            const to = {
                path: '/test2',
                // No matched array, so will throw an error inside getMatchedComponents
            };
            const { promise, resolve } = getResolvablePromise();
            beforeResolveFn(to, from, resolve);
            const nextParam = await promise;
            expect(store.registerModule).not.toHaveBeenCalled();
            expect(nextParam).toEqual(expect.any(Error));
        });

        it('should deregister modules', async () => {
            const testModule = {
                namespaced: true,
                state: {
                    count: 1,
                },
            };
            let afterEachFn;
            let beforeResolveFn;
            const app = { name: 'App' };
            const router = {
                afterEach(fn) {
                    afterEachFn = fn;
                },
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const activeModules = [
                ['a'], // Present from SSR
            ];
            const moduleNameComparator = m => arr => JSON.stringify(arr) === JSON.stringify(m);
            const store = {
                hasModule: m => activeModules.some(moduleNameComparator(m)),
                registerModule(moduleName) {
                    activeModules.push(moduleName);
                },
                unregisterModule(m) {
                    const removed = remove(activeModules, moduleNameComparator(m));
                    if (!removed) {
                        throw new Error('Unable to find module to remove');
                    }
                },
            };
            useRouteVuexModulesClient(app, router, store, logger);

            let ctx;
            let nextParam;

            const fromRoute = {
                path: '/a',
                matched: [{
                    components: {
                        name: {
                            vuex: {
                                moduleName: ({ $route }) => $route.path.replace('/', ''),
                                module: testModule,
                            },
                        },
                    },
                }],
            };
            const toRoute = {
                path: '/b',
                matched: [{
                    components: {
                        name: {
                            vuex: {
                                moduleName: ({ $route }) => $route.path.replace('/', ''),
                                module: testModule,
                            },
                        },
                    },
                }],
            };

            // a -> b
            ctx = getResolvablePromise();
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            nextParam = await ctx.promise;
            expect(activeModules).toEqual([['a'], ['b']]);
            expect(nextParam).toBe(undefined);
            afterEachFn(toRoute, fromRoute);
            expect(activeModules).toEqual([['a'], ['b']]);

            // b -> c
            ctx = getResolvablePromise();
            fromRoute.path = '/b';
            toRoute.path = '/c';
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            nextParam = await ctx.promise;
            expect(activeModules).toEqual([['a'], ['b'], ['c']]);
            expect(nextParam).toBe(undefined);
            afterEachFn(toRoute, fromRoute);
            expect(activeModules).toEqual([['b'], ['c']]);

            // c -> d
            ctx = getResolvablePromise();
            fromRoute.path = '/c';
            toRoute.path = '/d';
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            nextParam = await ctx.promise;
            expect(activeModules).toEqual([['b'], ['c'], ['d']]);
            expect(nextParam).toBe(undefined);
            afterEachFn(toRoute, fromRoute);
            expect(activeModules).toEqual([['c'], ['d']]);

            // d -> c
            ctx = getResolvablePromise();
            fromRoute.path = '/d';
            toRoute.path = '/c';
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            nextParam = await ctx.promise;
            expect(activeModules).toEqual([['c'], ['d']]);
            expect(nextParam).toBe(undefined);
            afterEachFn(toRoute, fromRoute);
            expect(activeModules).toEqual([['c'], ['d']]);

            // d -> d?foo=1
            // Should short circuit due to shouldProcessRouteUpdate and not remove c
            ctx = getResolvablePromise();
            fromRoute.path = '/d';
            toRoute.path = '/d';
            toRoute.query = { foo: '1' };
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            nextParam = await ctx.promise;
            expect(activeModules).toEqual([['c'], ['d']]);
            expect(nextParam).toBe(undefined);
            afterEachFn(toRoute, fromRoute);
            expect(activeModules).toEqual([['c'], ['d']]);
        });

        it('should support shouldProcessRouteUpdate object', async () => {
            const testModule = {
                namespaced: true,
                state: {
                    count: 1,
                },
            };
            let beforeResolveFn;
            const app = { name: 'App' };
            const shouldProcessRouteUpdate = {};
            const router = {
                afterEach() {},
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const store = {
                hasModule: () => false,
                registerModule: jest.fn(),
            };
            useRouteVuexModulesClient(app, router, store, logger);

            let ctx;

            // Test Defaults
            const fromRoute = {
                path: '/a',
                matched: [{
                    components: {
                        name: {
                            vuex: {
                                moduleName: ({ $route }) => $route.path.replace('/', ''),
                                module: testModule,
                            },
                        },
                    },
                }],
            };
            const toRoute = {
                path: '/b',
                matched: [{
                    components: {
                        name: {
                            shouldProcessRouteUpdate,
                            vuex: {
                                moduleName: ({ $route }) => $route.path.replace('/', ''),
                                module: testModule,
                            },
                        },
                    },
                }],
            };

            // /a -> /a - process due to name change
            // Not a real scenario but we want to ensure we always refetch when going between
            // routing table entries - path should full handle this in theory though
            ctx = getResolvablePromise();
            fromRoute.path = '/a';
            fromRoute.name = '1';
            toRoute.path = '/a';
            toRoute.name = '2';
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(store.registerModule.mock.calls.length).toBe(1);
            delete fromRoute.name;
            delete toRoute.name;

            // /a -> /b - process due to path change
            ctx = getResolvablePromise();
            fromRoute.path = '/a';
            toRoute.path = '/b';
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(store.registerModule.mock.calls.length).toBe(2);

            // /b -> /b?foo=1 - do not process due to query change
            ctx = getResolvablePromise();
            fromRoute.path = '/b';
            toRoute.path = '/b';
            toRoute.query = { foo: '1' };
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(store.registerModule.mock.calls.length).toBe(2);
            delete toRoute.query;

            // /b -> /b#foo - do not process due to hash change
            ctx = getResolvablePromise();
            fromRoute.path = '/b';
            toRoute.path = '/b';
            toRoute.hash = '#foo';
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(store.registerModule.mock.calls.length).toBe(2);
            delete toRoute.hash;

            // Test component specifications
            store.registerModule.mockReset();
            Object.assign(shouldProcessRouteUpdate, {
                path: true,
                query: true,
                hash: true,
            });

            // /a -> /b - process due to path change
            ctx = getResolvablePromise();
            fromRoute.path = '/a';
            toRoute.path = '/b';
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(store.registerModule.mock.calls.length).toBe(1);

            // /b -> /b?foo=1 - process due to query change
            ctx = getResolvablePromise();
            fromRoute.path = '/b';
            toRoute.path = '/b';
            toRoute.query = { foo: '1' };
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(store.registerModule.mock.calls.length).toBe(2);
            delete toRoute.query;

            // /b -> /b#foo - process due to hash change
            ctx = getResolvablePromise();
            fromRoute.path = '/b';
            toRoute.path = '/b';
            toRoute.hash = '#foo';
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(store.registerModule.mock.calls.length).toBe(3);
            delete toRoute.hash;
        });

        it('should support shouldProcessRouteUpdate function', async () => {
            const testModule = {
                namespaced: true,
                state: {
                    count: 1,
                },
            };
            let beforeResolveFn;
            const app = { name: 'App' };
            // Only re-run when path or foo query changes
            const shouldProcessRouteUpdate = jest.fn(({ route, from }) => (
                route.path !== from.path ||
                get(route, 'query.foo') !== get(from, 'query.foo')
            ));
            const router = {
                afterEach() {},
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const store = {
                hasModule: () => false,
                registerModule: jest.fn(),
            };
            useRouteVuexModulesClient(app, router, store, logger);

            let ctx;

            const fromRoute = {
                path: '/a',
                matched: [{
                    components: {
                        name: {
                            vuex: {
                                moduleName: ({ $route }) => $route.path.replace('/', ''),
                                module: testModule,
                            },
                        },
                    },
                }],
            };
            const toRoute = {
                path: '/b',
                matched: [{
                    components: {
                        name: {
                            shouldProcessRouteUpdate,
                            vuex: {
                                moduleName: ({ $route }) => $route.path.replace('/', ''),
                                module: testModule,
                            },
                        },
                    },
                }],
            };

            // /a -> /b - process due to path change
            ctx = getResolvablePromise();
            fromRoute.path = '/a';
            toRoute.path = '/b';
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(store.registerModule.mock.calls.length).toBe(1);

            // /b -> /b?foo=1 - process due to foo query change
            ctx = getResolvablePromise();
            fromRoute.path = '/b';
            toRoute.path = '/b';
            toRoute.query = { foo: '1' };
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(store.registerModule.mock.calls.length).toBe(2);
            delete toRoute.query;

            // /b -> /b?bar=1 - do not process due to bar query change
            ctx = getResolvablePromise();
            fromRoute.path = '/b';
            toRoute.path = '/b';
            toRoute.query = { bar: '1' };
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(store.registerModule.mock.calls.length).toBe(2);
            delete toRoute.query;

            // /b -> /b#foo - do not process due to hash change
            ctx = getResolvablePromise();
            fromRoute.path = '/b';
            toRoute.path = '/b';
            toRoute.hash = '#foo';
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(store.registerModule.mock.calls.length).toBe(2);
            delete toRoute.hash;
        });
    });

    describe('useFetchDataClient', () => {

        it('should fetchData for matched components', async () => {
            const app = { name: 'App' };
            let beforeResolveFn;
            const router = {
                beforeEach() {},
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const fromRoute = {
                path: '/a',
                matched: [{
                    components: {
                        a: { fetchData: jest.fn() },
                    },
                }],
            };
            const toRoute = {
                path: '/b',
                matched: [{
                    components: {
                        b: { fetchData: jest.fn() },
                    },
                }],
            };
            const store = { state: {} };
            useFetchDataClient(app, router, store, logger);
            const ctx = getResolvablePromise();
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(fromRoute.matched[0].components.a.fetchData).not.toHaveBeenCalled();
            expect(toRoute.matched[0].components.b.fetchData).toHaveBeenCalledWith({
                ssrContext: null,
                app,
                router,
                store,
                route: toRoute,
                from: fromRoute,
            });
        });

        it('should fetchData for matched nested components', async () => {
            const app = { name: 'App' };
            let beforeResolveFn;
            const router = {
                beforeEach() {},
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const fromRoute = {
                path: '/a',
            };
            const toRoute = {
                path: '/b',
                matched: [{
                    components: {
                        b: { fetchData: jest.fn() },
                        // No FetchData
                        b1: {},
                        b2: { fetchData: jest.fn() },
                    },
                }, {
                    components: {
                        b3: { fetchData: jest.fn() },
                    },
                }],
            };

            const store = { state: {} };
            useFetchDataClient(app, router, store, logger);
            const ctx = getResolvablePromise();
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            const expectedArg = {
                ssrContext: null,
                app,
                router,
                store,
                route: toRoute,
                from: fromRoute,
            };
            expect(toRoute.matched[0].components.b.fetchData).toHaveBeenCalledWith(expectedArg);
            expect(toRoute.matched[0].components.b2.fetchData).toHaveBeenCalledWith(expectedArg);
            expect(toRoute.matched[1].components.b3.fetchData).toHaveBeenCalledWith(expectedArg);
        });

        it('should call middlewares if specified', async () => {
            const app = { name: 'App' };
            const component = {
                fetchData: jest.fn(),
            };
            let beforeResolveFn;
            const router = {
                beforeEach() {},
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const fromRoute = {
                path: '/a',
            };
            const toRoute = {
                path: '/b',
                matched: [{
                    components: {
                        b: component,
                    },
                }],
            };
            const store = { state: {} };
            const globalFetchData = jest.fn();
            const middleware = jest.fn();
            const postMiddleware = jest.fn();
            useFetchDataClient(app, router, store, logger, {
                globalFetchData,
                middleware,
                postMiddleware,
            });
            const ctx = getResolvablePromise();
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            const expectedArg = {
                ssrContext: null,
                app,
                router,
                store,
                route: toRoute,
                from: fromRoute,
            };
            expect(middleware).toHaveBeenCalledWith(expectedArg);
            expect(globalFetchData).toHaveBeenCalledWith(expectedArg);
            expect(component.fetchData).toHaveBeenCalledWith(expectedArg);
            expect(postMiddleware).toHaveBeenCalledWith(expectedArg);
        });

        it('should reject via the next callback on any failures', async () => {
            const app = { name: 'App' };
            const component = {
                fetchData: jest.fn(),
            };
            let beforeResolveFn;
            const router = {
                beforeEach() {},
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const fromRoute = {
                path: '/a',
            };
            const toRoute = {
                path: '/b',
                matched: [{
                    components: {
                        b: component,
                    },
                }],
            };
            const store = { state: {} };

            let ctx;
            let nextArg;

            component.fetchData.mockImplementation(() => Promise.reject('error'));
            useFetchDataClient(app, router, store, logger);
            ctx = getResolvablePromise();
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            nextArg = await ctx.promise;
            expect(nextArg).toEqual(new Error('error'));

            component.fetchData.mockImplementation(() => Promise.reject(new Error('error')));
            useFetchDataClient(app, router, store, logger);
            ctx = getResolvablePromise();
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            nextArg = await ctx.promise;
            expect(nextArg).toEqual(new Error('error'));

            component.fetchData.mockImplementation(() => Promise.reject({ error: 'oops' }));
            useFetchDataClient(app, router, store, logger);
            ctx = getResolvablePromise();
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            nextArg = await ctx.promise;
            expect(nextArg).toEqual(new Error('{"error":"oops"}'));
        });

        it('should support the shouldProcessRouteUpdate object', async () => {
            const app = { name: 'App' };
            const shouldProcessRouteUpdate = {};
            const component = {
                shouldProcessRouteUpdate,
                fetchData: jest.fn(),
            };
            let beforeResolveFn;
            const router = {
                beforeEach() {},
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const fromRoute = {
                path: '/a',
            };
            const toRoute = {
                path: '/b',
                matched: [{
                    components: {
                        b: component,
                    },
                }],
            };
            const store = { state: {} };
            useFetchDataClient(app, router, store, logger);

            let ctx;

            // /a -> /b - should run on path change
            ctx = getResolvablePromise();
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(component.fetchData.mock.calls.length).toBe(1);

            // /a -> /a?foo=1 - should not run on query change
            ctx = getResolvablePromise();
            toRoute.path = '/a';
            toRoute.query = { foo: '1' };
            toRoute.hash = null;
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(component.fetchData.mock.calls.length).toBe(1);

            // /a -> /a#foo - should not run on hash change
            ctx = getResolvablePromise();
            toRoute.path = '/a';
            toRoute.query = null;
            toRoute.hash = '#foo';
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(component.fetchData.mock.calls.length).toBe(1);

            // Test component specifications
            component.fetchData.mockReset();
            Object.assign(shouldProcessRouteUpdate, {
                path: true,
                query: true,
                hash: true,
            });

            // /a -> /b - process due to path change
            ctx = getResolvablePromise();
            toRoute.path = '/b';
            toRoute.query = null;
            toRoute.hash = null;
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(component.fetchData.mock.calls.length).toBe(1);

            // /a -> /a?foo=1 - do not process due to query change
            ctx = getResolvablePromise();
            toRoute.path = '/a';
            toRoute.query = { foo: '1' };
            toRoute.hash = null;
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(component.fetchData.mock.calls.length).toBe(2);

            // /a -> /a#foo - do not process due to hash change
            ctx = getResolvablePromise();
            toRoute.path = '/a';
            toRoute.query = null;
            toRoute.hash = '#foo';
            beforeResolveFn(toRoute, fromRoute, ctx.resolve);
            await ctx.promise;
            expect(component.fetchData.mock.calls.length).toBe(3);
        });

        it('should initialize a client-side performance trace', async () => {
            const entries = initWindowPerformance();
            const app = { name: 'App' };
            // Must have matched components to trigger perfInit
            const matched = [{
                components: {
                    a: {},
                },
            }];
            let beforeEachFn;
            let beforeResolveFn;
            const router = {
                beforeEach(fn) {
                    beforeEachFn = fn;
                },
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const store = { state: {} };

            useFetchDataClient(app, router, store, logger);

            let ctx;

            ctx = getResolvablePromise();
            beforeEachFn(
                { name: 'b', path: '/b', matched },
                { name: 'a', path: '/a', matched },
                ctx.resolve,
            );
            await ctx.promise;
            expect(entries).toEqual([
                { entryType: 'mark', name: 'urbnperf|a->b|start' },
            ]);
            ctx = getResolvablePromise();
            beforeResolveFn(
                { path: '/b', matched },
                { path: '/a', matched },
                ctx.resolve,
            );
            await ctx.promise;
            expect(entries).toEqual([
                {
                    entryType: 'mark',
                    name: 'urbnperf|a->b|start',
                },
                {
                    entryType: 'measure',
                    markName: 'urbnperf|a->b|start',
                    name: 'urbnperf|a->b|beforeResolve',
                },
                {
                    entryType: 'measure',
                    markName: 'urbnperf|a->b|start',
                    name: 'urbnperf|a->b|middleware-complete',
                },
                {
                    entryType: 'measure',
                    markName: 'urbnperf|a->b|start',
                    name: 'urbnperf|a->b|fetchData-complete',
                },
            ]);

            // Ensure prior marks get cleared on a new route
            ctx = getResolvablePromise();
            beforeEachFn(
                { name: 'c', path: '/c', matched },
                { name: 'b', path: '/b', matched },
                ctx.resolve,
            );
            await ctx.promise;
            expect(entries).toEqual([
                { entryType: 'mark', name: 'urbnperf|b->c|start' },
            ]);
            ctx = getResolvablePromise();
            beforeResolveFn(
                { path: '/b', matched },
                { path: '/a', matched },
                ctx.resolve,
            );
            await ctx.promise;
            expect(entries).toEqual([
                {
                    entryType: 'mark',
                    name: 'urbnperf|b->c|start',
                },
                {
                    entryType: 'measure',
                    markName: 'urbnperf|b->c|start',
                    name: 'urbnperf|b->c|beforeResolve',
                },
                {
                    entryType: 'measure',
                    markName: 'urbnperf|b->c|start',
                    name: 'urbnperf|b->c|middleware-complete',
                },
                {
                    entryType: 'measure',
                    markName: 'urbnperf|b->c|start',
                    name: 'urbnperf|b->c|fetchData-complete',
                },
            ]);

            // Ensure nothing changes for shouldProcessRouteUpdate short circuits
            ctx = getResolvablePromise();
            beforeEachFn(
                { name: 'c', path: '/c', query: { foo: '1' }, matched },
                { name: 'c', path: '/c', matched },
                ctx.resolve,
            );
            await ctx.promise;
            expect(entries).toEqual([
                {
                    entryType: 'mark',
                    name: 'urbnperf|b->c|start',
                },
                {
                    entryType: 'measure',
                    markName: 'urbnperf|b->c|start',
                    name: 'urbnperf|b->c|beforeResolve',
                },
                {
                    entryType: 'measure',
                    markName: 'urbnperf|b->c|start',
                    name: 'urbnperf|b->c|middleware-complete',
                },
                {
                    entryType: 'measure',
                    markName: 'urbnperf|b->c|start',
                    name: 'urbnperf|b->c|fetchData-complete',
                },
            ]);
        });

        it('should fail gracefully when window.performance is not available', async () => {
            const app = { name: 'App' };
            const matched = [{
                components: {
                    a: { fetchData: () => {} },
                },
            }];
            let beforeEachFn;
            let beforeResolveFn;
            const router = {
                beforeEach(fn) {
                    beforeEachFn = fn;
                },
                beforeResolve(fn) {
                    beforeResolveFn = fn;
                },
            };
            const store = { state: {} };

            const oldPerformance = window.performance;
            window.performance = null;

            useFetchDataClient(app, router, store, logger);

            let ctx;

            ctx = getResolvablePromise();
            beforeEachFn(
                { name: 'b', path: '/b', matched },
                { name: 'a', path: '/a', matched },
                ctx.resolve,
            );
            await ctx.promise;
            ctx = getResolvablePromise();
            beforeResolveFn(
                { path: '/b', matched },
                { path: '/a', matched },
                ctx.resolve,
            );
            await ctx.promise;

            window.performance = oldPerformance;
        });

    });

    describe('perfMeasure', () => {

        it('should measure from a given start mark', () => {
            const entries = initWindowPerformance();

            window.performance.mark('urbnperf|a->b|start');
            perfMeasure('junk');
            expect(entries).toEqual([
                {
                    entryType: 'mark',
                    name: 'urbnperf|a->b|start',
                },
                {
                    entryType: 'measure',
                    markName: 'urbnperf|a->b|start',
                    name: 'urbnperf|a->b|junk',
                },
            ]);
        });

        it('should require a start mark', () => {
            const entries = initWindowPerformance();
            perfMeasure('junk');
            expect(entries).toEqual([]);
        });

    });

});
