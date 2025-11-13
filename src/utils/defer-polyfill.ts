/*
 * Polyfill for matrix-js-sdk defer function
 * This provides the defer utility that creates a deferred promise
 */

export interface IDeferred<T> {
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
    promise: Promise<T>;
}

export function defer<T = void>(): IDeferred<T> {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    
    return { resolve, reject, promise };
}

