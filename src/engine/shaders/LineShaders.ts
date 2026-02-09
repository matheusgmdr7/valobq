// Shaders para gráfico de linha
export const LineVertexShader = `#version 300 es
in vec2 a_position;
in vec4 a_color;
in float a_width;

uniform mat3 u_transform;
uniform float u_time;

out vec4 v_color;
out float v_width;

void main() {
  vec3 position = u_transform * vec3(a_position, 1.0);
  gl_Position = vec4(position.xy, 0.0, 1.0);
  
  v_color = a_color;
  v_width = a_width;
}`;

export const LineFragmentShader = `#version 300 es
precision mediump float;

in vec4 v_color;
in float v_width;

out vec4 fragColor;

void main() {
  fragColor = v_color;
}`;

// Shader para pontos na linha
export const PointVertexShader = `#version 300 es
in vec2 a_position;
in vec4 a_color;
in float a_size;

uniform mat3 u_transform;

out vec4 v_color;
out float v_size;

void main() {
  vec3 position = u_transform * vec3(a_position, 1.0);
  gl_Position = vec4(position.xy, 0.0, 1.0);
  
  v_color = a_color;
  v_size = a_size;
}`;

export const PointFragmentShader = `#version 300 es
precision mediump float;

in vec4 v_color;
in float v_size;

out vec4 fragColor;

void main() {
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  
  if (dist > 0.5) {
    discard;
  }
  
  fragColor = v_color;
}`;

// Objeto de exportação para compatibilidade
export const LineShaders = {
  LineVertexShader,
  LineFragmentShader,
  PointVertexShader,
  PointFragmentShader
};
