import { describe, it, expect } from 'vitest';
import { describeError } from './errorDetails';

describe('describeError', () => {
    it('shows name and a plain message', () => {
        expect(describeError(new TypeError("Cannot read properties of undefined (reading 'map')")))
            .toEqual({ text: "TypeError: Cannot read properties of undefined (reading 'map')", withheld: false });
    });

    it('never includes the stack', () => {
        const e = new Error('boom');
        e.stack = 'Error: boom\n    at secret (/src/file.ts:1:1)';
        expect(describeError(e).text).toBe('Error: boom');
    });

    it.each([
        'charge failed for 4242 4242 4242 4242',
        'bad key sk_live_abc123DEF456',
        'no such customer cus_Nabc123456',
        'stripe request failed',
        'key AIza' + 'B'.repeat(30),
        'token eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig',
        'got enc:QUJDREVGRw==',
        'denied for users/abc/ideas/1',
        'unwrap failed for uid',
        'GET https://firestore.googleapis.com/v1/projects failed',
    ])('withholds payment and Firebase info: %s', (message) => {
        expect(describeError(new Error(message))).toEqual({ text: 'Error', withheld: true });
    });

    it.each([
        'Network request failed for a@b.com',
        'wrong password supplied',
        'idea 1760000000000 missing',
        'failed to fetch https://example.com/x',
    ])('no longer withholds other messages: %s', (message) => {
        expect(describeError(new Error(message)).withheld).toBe(false);
    });

    it('caps length and handles non-errors', () => {
        expect(describeError(new Error('x '.repeat(500))).text.length).toBeLessThanOrEqual(207);
        expect(describeError('oops')).toEqual({ text: 'Error', withheld: false });
    });
});
