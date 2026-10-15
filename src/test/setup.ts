import '@testing-library/jest-dom/jest-globals';
import { afterEach, jest } from '@jest/globals';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());
if (typeof window !== 'undefined') window.scrollTo = jest.fn();
if (typeof HTMLElement !== 'undefined') HTMLElement.prototype.scrollIntoView = jest.fn();
