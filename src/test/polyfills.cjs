const { TextEncoder, TextDecoder } = require('node:util');
const { ReadableStream, WritableStream, TransformStream } = require('node:stream/web');
const { MessagePort } = require('node:worker_threads');
Object.assign(globalThis, { TextEncoder, TextDecoder, ReadableStream, WritableStream, TransformStream, MessagePort });
const { Headers, Request, Response } = require('undici');
Object.assign(globalThis, { Headers, Request, Response });
// Individual tests must explicitly supply every network response.
globalThis.fetch = jest.fn(() => Promise.reject(new Error('Unexpected network request in test')));
