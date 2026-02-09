// Shaders para gráfico de área
export const AreaVertexShader = `#version 300 es
in vec2 a_position;
in vec4 a_color;

uniform mat3 u_transform;
uniform float u_time;

out vec4 v_color;

void main() {
  vec3 position = u_transform * vec3(a_position, 1.0);
  gl_Position = vec4(position.xy, 0.0, 1.0);
  
  v_color = a_color;
}`;

export const AreaFragmentShader = `#version 300 es
precision mediump float;

in vec4 v_color;

out vec4 fragColor;

void main() {
  fragColor = v_color;
}`;

// Shader para gradiente de área
export const GradientAreaVertexShader = `#version 300 es
in vec2 a_position;
in vec4 a_color;
in vec4 a_gradientColor;

uniform mat3 u_transform;
uniform float u_time;

out vec4 v_color;
out vec4 v_gradientColor;

void main() {
  vec3 position = u_transform * vec3(a_position, 1.0);
  gl_Position = vec4(position.xy, 0.0, 1.0);
  
  v_color = a_color;
  v_gradientColor = a_gradientColor;
}`;

export const GradientAreaFragmentShader = `#version 300 es
precision mediump float;

in vec4 v_color;
in vec4 v_gradientColor;

out vec4 fragColor;

void main() {
  // Interpolação linear entre as cores
  fragColor = mix(v_color, v_gradientColor, 0.5);
}`;

// Objeto de exportação para compatibilidade
export const AreaShaders = {
  AreaVertexShader,
  AreaFragmentShader,
  GradientAreaVertexShader,
  GradientAreaFragmentShader
};