import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders SSL Certificate Monitor title', () => {
  render(<App />);
  const titleElement = screen.getByText(/SSL Certificate Monitor/i);
  expect(titleElement).toBeInTheDocument();
});

test('renders dashboard subtitle', () => {
  render(<App />);
  const subtitleElement = screen.getByText(/Midwest Universities Security Dashboard/i);
  expect(subtitleElement).toBeInTheDocument();
});

test('has proper header structure', () => {
  render(<App />);
  const headerElement = screen.getByRole('banner');
  expect(headerElement).toBeInTheDocument();
  expect(headerElement).toHaveClass('app-header');
});

test('renders main content area', () => {
  render(<App />);
  const mainElement = screen.getByRole('main');
  expect(mainElement).toBeInTheDocument();
});
