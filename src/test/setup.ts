import '@testing-library/jest-dom/jest-globals';
import { afterEach, jest } from '@jest/globals';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());
window.scrollTo = jest.fn();
