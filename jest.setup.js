// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock WebGL context
global.WebGLRenderingContext = class WebGLRenderingContext {};
global.WebGL2RenderingContext = class WebGL2RenderingContext {};

// Mock canvas
HTMLCanvasElement.prototype.getContext = jest.fn((contextType) => {
  if (contextType === 'webgl' || contextType === 'webgl2') {
    return {
      canvas: {},
      drawingBufferWidth: 800,
      drawingBufferHeight: 600,
      getParameter: jest.fn(() => 0),
      createShader: jest.fn(() => ({})),
      shaderSource: jest.fn(),
      compileShader: jest.fn(),
      getShaderParameter: jest.fn(() => true),
      createProgram: jest.fn(() => ({})),
      attachShader: jest.fn(),
      linkProgram: jest.fn(),
      getProgramParameter: jest.fn(() => true),
      useProgram: jest.fn(),
      createBuffer: jest.fn(() => ({})),
      bindBuffer: jest.fn(),
      bufferData: jest.fn(),
      enable: jest.fn(),
      disable: jest.fn(),
      clear: jest.fn(),
      clearColor: jest.fn(),
      viewport: jest.fn(),
      drawArrays: jest.fn(),
      drawElements: jest.fn(),
      getUniformLocation: jest.fn(() => ({})),
      getAttribLocation: jest.fn(() => 0),
      uniformMatrix4fv: jest.fn(),
      enableVertexAttribArray: jest.fn(),
      vertexAttribPointer: jest.fn(),
      createTexture: jest.fn(() => ({})),
      bindTexture: jest.fn(),
      texImage2D: jest.fn(),
      activeTexture: jest.fn(),
    };
  }
  return null;
});

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => []),
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

