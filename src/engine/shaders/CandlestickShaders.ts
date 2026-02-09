// Shaders para gráfico de candlestick
export const CandlestickVertexShader = `#version 300 es
in vec2 a_position;
in vec4 a_color;

uniform mat3 u_transform;

out vec4 v_color;

void main() {
  vec3 position = u_transform * vec3(a_position, 1.0);
  gl_Position = vec4(position.xy, 0.0, 1.0);
  v_color = a_color;
}`;

export const CandlestickFragmentShader = `#version 300 es
precision mediump float;

in vec4 v_color;

out vec4 fragColor;

void main() {
  fragColor = v_color;
}`;

// Shader para wick (pavio) das velas
export const WickVertexShader = `#version 300 es
in vec2 a_position;
in vec4 a_color;

uniform mat3 u_transform;

out vec4 v_color;

void main() {
  vec3 position = u_transform * vec3(a_position, 1.0);
  gl_Position = vec4(position.xy, 0.0, 1.0);
  v_color = a_color;
}`;

export const WickFragmentShader = `#version 300 es
precision mediump float;

in vec4 v_color;

out vec4 fragColor;

void main() {
  fragColor = v_color;
}`;

// Objeto de exportação para compatibilidade
export const CandlestickShaders = {
  CandlestickVertexShader,
  CandlestickFragmentShader,
  WickVertexShader,
  WickFragmentShader
};
