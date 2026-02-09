# 🚀 Getting Started - Implementação do Sistema de Gráficos

## 📋 Preparação Inicial

### **1. Configuração do Ambiente**

#### **Pré-requisitos:**
```bash
# Node.js (versão 18+)
node --version

# npm ou yarn
npm --version

# Git
git --version

# Emscripten (para Fase 2)
# Instalar após completar Fase 1
```

#### **Estrutura de Projeto:**
```
src/
├── components/
│   ├── charts/
│   │   ├── WebGLChart.tsx
│   │   ├── Canvas.tsx
│   │   └── Shaders/
│   ├── ui/
│   └── layout/
├── engine/
│   ├── webgl/
│   │   ├── WebGLContext.ts
│   │   ├── ShaderManager.ts
│   │   └── Renderer.ts
│   ├── wasm/ (Fase 2)
│   └── assets/
├── api/
│   ├── websocket/ (Fase 3)
│   └── rest/
├── utils/
└── types/
```

### **2. Primeira Tarefa: WebGL 2.0 Context**

#### **Arquivo: `src/engine/webgl/WebGLContext.ts`**
```typescript
export class WebGLContext {
  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.init();
  }

  private init(): void {
    if (!this.canvas) {
      throw new Error('Canvas element is required');
    }

    // Tentar WebGL 2.0 primeiro
    this.gl = this.canvas.getContext('webgl2');
    
    if (!this.gl) {
      // Fallback para WebGL 1.0
      const gl1 = this.canvas.getContext('webgl');
      if (!gl1) {
        throw new Error('WebGL is not supported');
      }
      console.warn('WebGL 2.0 not supported, falling back to WebGL 1.0');
    }

    this.setupContext();
  }

  private setupContext(): void {
    if (!this.gl) return;

    // Configurações básicas
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    
    // Configurar viewport
    this.resize();
  }

  public resize(): void {
    if (!this.gl || !this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Configurar dimensões do canvas
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    // Configurar viewport
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  public getContext(): WebGL2RenderingContext | WebGLRenderingContext | null {
    return this.gl;
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }
}
```

#### **Arquivo: `src/components/charts/Canvas.tsx`**
```typescript
import React, { useRef, useEffect } from 'react';
import { WebGLContext } from '../../engine/webgl/WebGLContext';

interface CanvasProps {
  width?: number;
  height?: number;
  className?: string;
}

export const Canvas: React.FC<CanvasProps> = ({ 
  width = 800, 
  height = 600, 
  className = '' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webglContextRef = useRef<WebGLContext | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      // Inicializar WebGL context
      webglContextRef.current = new WebGLContext(canvasRef.current);
      
      // Configurar resize handler
      const handleResize = () => {
        webglContextRef.current?.resize();
      };

      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    } catch (error) {
      console.error('Failed to initialize WebGL:', error);
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        display: 'block'
      }}
    />
  );
};
```

### **3. Primeira Tarefa: Shaders Básicos**

#### **Arquivo: `src/engine/webgl/Shaders/vertex.glsl`**
```glsl
#version 300 es

in vec2 a_position;
in vec2 a_texCoord;

uniform mat3 u_transform;

out vec2 v_texCoord;

void main() {
  vec3 position = u_transform * vec3(a_position, 1.0);
  gl_Position = vec4(position.xy, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
```

#### **Arquivo: `src/engine/webgl/Shaders/fragment.glsl`**
```glsl
#version 300 es

precision mediump float;

in vec2 v_texCoord;

uniform vec4 u_color;

out vec4 fragColor;

void main() {
  fragColor = u_color;
}
```

#### **Arquivo: `src/engine/webgl/ShaderManager.ts`**
```typescript
export class ShaderManager {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;

  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    this.gl = gl;
  }

  public createShader(type: number, source: string): WebGLShader | null {
    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  public createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
    const program = this.gl.createProgram();
    if (!program) return null;

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Program linking error:', this.gl.getProgramInfoLog(program));
      this.gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  public loadShaders(vertexSource: string, fragmentSource: string): WebGLProgram | null {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
      return null;
    }

    const program = this.createProgram(vertexShader, fragmentShader);

    // Limpar shaders após criar o programa
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    return program;
  }
}
```

### **4. Primeira Tarefa: Sistema de Coordenadas**

#### **Arquivo: `src/engine/webgl/CoordinateSystem.ts`**
```typescript
export class CoordinateSystem {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;
  private program: WebGLProgram;
  private transformLocation: WebGLUniformLocation | null = null;

  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext, program: WebGLProgram) {
    this.gl = gl;
    this.program = program;
    this.transformLocation = gl.getUniformLocation(program, 'u_transform');
  }

  public setViewport(width: number, height: number): void {
    // Configurar matriz de projeção ortogonal
    const left = 0;
    const right = width;
    const bottom = height;
    const top = 0;
    const near = -1;
    const far = 1;

    const transform = this.createOrthographicMatrix(left, right, bottom, top, near, far);
    this.gl.uniformMatrix3fv(this.transformLocation, false, transform);
  }

  private createOrthographicMatrix(
    left: number, 
    right: number, 
    bottom: number, 
    top: number, 
    near: number, 
    far: number
  ): Float32Array {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);

    return new Float32Array([
      2 * lr, 0, 0,
      0, 2 * bt, 0,
      0, 0, 2 * nf,
      (left + right) * lr, (top + bottom) * bt, (far + near) * nf
    ]);
  }
}
```

### **5. Primeira Tarefa: Renderização Básica**

#### **Arquivo: `src/engine/webgl/Renderer.ts`**
```typescript
export class Renderer {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;
  private shaderManager: ShaderManager;
  private coordinateSystem: CoordinateSystem;
  private program: WebGLProgram | null = null;

  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    this.gl = gl;
    this.shaderManager = new ShaderManager(gl);
    this.init();
  }

  private init(): void {
    // Carregar shaders
    const vertexSource = `
      #version 300 es
      in vec2 a_position;
      uniform mat3 u_transform;
      void main() {
        vec3 position = u_transform * vec3(a_position, 1.0);
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      #version 300 es
      precision mediump float;
      uniform vec4 u_color;
      out vec4 fragColor;
      void main() {
        fragColor = u_color;
      }
    `;

    this.program = this.shaderManager.loadShaders(vertexSource, fragmentSource);
    
    if (this.program) {
      this.coordinateSystem = new CoordinateSystem(this.gl, this.program);
    }
  }

  public render(): void {
    if (!this.program) return;

    this.gl.useProgram(this.program);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    
    // Configurar viewport
    const canvas = this.gl.canvas as HTMLCanvasElement;
    this.coordinateSystem.setViewport(canvas.width, canvas.height);
  }

  public clear(): void {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }
}
```

## 🎯 Próximos Passos

### **Esta Semana:**
1. **Criar estrutura de projeto** conforme acima
2. **Implementar WebGLContext** com fallback para WebGL 1.0
3. **Criar componente Canvas** responsivo
4. **Implementar shaders básicos** (vertex + fragment)
5. **Configurar sistema de coordenadas** ortogonal
6. **Implementar renderização básica** com limpeza

### **Testes Iniciais:**
```typescript
// Teste básico no componente
useEffect(() => {
  if (webglContextRef.current) {
    const gl = webglContextRef.current.getContext();
    if (gl) {
      console.log('WebGL Version:', gl.getParameter(gl.VERSION));
      console.log('WebGL Vendor:', gl.getParameter(gl.VENDOR));
      console.log('WebGL Renderer:', gl.getParameter(gl.RENDERER));
    }
  }
}, []);
```

### **Métricas de Sucesso:**
- [ ] WebGL context criado sem erros
- [ ] Shaders compilando sem warnings
- [ ] Canvas responsivo funcionando
- [ ] Renderização básica (limpeza) funcionando
- [ ] Performance > 30fps

---

**Status:** 🚀 PRONTO PARA INICIAR  
**Próxima Tarefa:** Configurar WebGL 2.0 context  
**Prazo:** Esta semana  
**Responsável:** [Nome]

