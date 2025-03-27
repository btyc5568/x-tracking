import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock the store and router since they're required by the App component
jest.mock('./store', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(),
    subscribe: jest.fn(),
    dispatch: jest.fn(),
  },
}));

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  BrowserRouter: ({ children }) => <div>{children}</div>,
  Routes: ({ children }) => <div>{children}</div>,
  Route: ({ element }) => element,
}));

test('renders home page text', () => {
  render(<App />);
  const homeElement = screen.getByText(/home page/i);
  expect(homeElement).toBeInTheDocument();
});
