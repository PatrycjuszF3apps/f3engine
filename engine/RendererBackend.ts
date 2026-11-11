import { ColorPalette } from './Palette';
import { VirtualFramebuffer } from './VirtualSurface';

export type RendererBackendType = 'canvas2d' | 'webgl';

/**
 * Interface for the physical renderer backend presenting the VirtualFramebuffer
 * onto an HTMLCanvasElement. Allows hot-swapping implementations (Canvas 2D <-> WebGL)
 * without any changes to game or UI decorator code.
 */
export interface IRendererBackend {
  readonly type: RendererBackendType;
  mount(
    container: HTMLElement,
    virtualWidth: number,
    virtualHeight: number,
    ariaLabel?: string
  ): HTMLCanvasElement;
  resizeVirtualGrid(virtualWidth: number, virtualHeight: number): void;
  present(framebuffer: VirtualFramebuffer, palette: ColorPalette): void;
  getCanvas(): HTMLCanvasElement | null;
  dispose(): void;
}

/**
 * Renderer backend implementation powered by HTML5 CanvasRenderingContext2D (ImageData).
 */
export class Canvas2DRendererBackend implements IRendererBackend {
  public readonly type: RendererBackendType = 'canvas2d';
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private imageData: ImageData | null = null;
  private pixelBuffer32: Uint32Array | null = null;

  public mount(
    container: HTMLElement,
    virtualWidth: number,
    virtualHeight: number,
    ariaLabel?: string
  ): HTMLCanvasElement {
    this.dispose();

    const canvas = document.createElement('canvas');
    canvas.id = 'game-canvas';
    canvas.className = 'virtual-viewport-canvas';
    canvas.width = virtualWidth;
    canvas.height = virtualHeight;
    if (ariaLabel) {
      canvas.setAttribute('aria-label', ariaLabel);
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('error.canvas_2d_context');
    }
    ctx.imageSmoothingEnabled = false;

    container.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = ctx;
    this.allocateBuffers(virtualWidth, virtualHeight);

    return canvas;
  }

  public resizeVirtualGrid(virtualWidth: number, virtualHeight: number): void {
    if (!this.canvas || !this.ctx) return;
    if (this.canvas.width === virtualWidth && this.canvas.height === virtualHeight && this.imageData) {
      return;
    }
    this.canvas.width = virtualWidth;
    this.canvas.height = virtualHeight;
    this.ctx.imageSmoothingEnabled = false;
    this.allocateBuffers(virtualWidth, virtualHeight);
  }

  public present(framebuffer: VirtualFramebuffer, palette: ColorPalette): void {
    if (!this.ctx || !this.imageData || !this.pixelBuffer32) return;

    if (
      this.imageData.width !== framebuffer.width ||
      this.imageData.height !== framebuffer.height
    ) {
      this.resizeVirtualGrid(framebuffer.width, framebuffer.height);
    }
    if (!this.imageData || !this.pixelBuffer32) return;

    const indices = framebuffer.getIndexBuffer();
    const lut32 = palette.getUint32Buffer();
    const out32 = this.pixelBuffer32;
    const len = indices.length;

    for (let i = 0; i < len; i++) {
      out32[i] = lut32[indices[i]] ?? lut32[0];
    }

    this.ctx.putImageData(this.imageData, 0, 0);
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  public dispose(): void {
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
    this.ctx = null;
    this.imageData = null;
    this.pixelBuffer32 = null;
  }

  private allocateBuffers(width: number, height: number): void {
    if (!this.ctx) return;
    this.imageData = this.ctx.createImageData(width, height);
    this.pixelBuffer32 = new Uint32Array(this.imageData.data.buffer);
  }
}

/**
 * Renderer backend implementation powered by WebGL (indexed luminance texture + 256x1 RGBA LUT shader).
 * Includes an automatic fallback to Canvas 2D in environments without WebGL acceleration.
 */
export class WebGLRendererBackend implements IRendererBackend {
  public readonly type: RendererBackendType = 'webgl';
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private fbTexture: WebGLTexture | null = null;
  private paletteTexture: WebGLTexture | null = null;
  private quadBuffer: WebGLBuffer | null = null;
  private paletteBytes = new Uint8Array(256 * 4);
  private fallback2d: Canvas2DRendererBackend | null = null;

  public mount(
    container: HTMLElement,
    virtualWidth: number,
    virtualHeight: number,
    ariaLabel?: string
  ): HTMLCanvasElement {
    this.dispose();

    const canvas = document.createElement('canvas');
    canvas.id = 'game-canvas';
    canvas.className = 'virtual-viewport-canvas';
    canvas.width = virtualWidth;
    canvas.height = virtualHeight;
    if (ariaLabel) {
      canvas.setAttribute('aria-label', ariaLabel);
    }

    const gl =
      (canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        preserveDrawingBuffer: true,
      }) as WebGLRenderingContext | null) ??
      (canvas.getContext('experimental-webgl', {
        alpha: false,
        antialias: false,
        preserveDrawingBuffer: true,
      }) as WebGLRenderingContext | null);

    if (!gl) {
      // Fallback to Canvas2D if WebGL is unavailable in the host environment
      this.fallback2d = new Canvas2DRendererBackend();
      return this.fallback2d.mount(container, virtualWidth, virtualHeight, ariaLabel);
    }

    container.appendChild(canvas);
    this.canvas = canvas;
    this.gl = gl;
    this.initPipeline(gl, virtualWidth, virtualHeight);

    return canvas;
  }

  public resizeVirtualGrid(virtualWidth: number, virtualHeight: number): void {
    if (this.fallback2d) {
      this.fallback2d.resizeVirtualGrid(virtualWidth, virtualHeight);
      return;
    }
    if (!this.canvas || !this.gl) return;
    this.canvas.width = virtualWidth;
    this.canvas.height = virtualHeight;
    this.gl.viewport(0, 0, virtualWidth, virtualHeight);
  }

  public present(framebuffer: VirtualFramebuffer, palette: ColorPalette): void {
    if (this.fallback2d) {
      this.fallback2d.present(framebuffer, palette);
      return;
    }
    const gl = this.gl;
    if (!gl || !this.program || !this.fbTexture || !this.paletteTexture) return;

    if (
      this.canvas &&
      (this.canvas.width !== framebuffer.width ||
        this.canvas.height !== framebuffer.height)
    ) {
      this.resizeVirtualGrid(framebuffer.width, framebuffer.height);
    }

    gl.useProgram(this.program);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    // 1. Update palette LUT texture (256x1 RGBA)
    this.paletteBytes.fill(0);
    const entries = palette.getEntries();
    for (let i = 0; i < entries.length; i++) {
      const { rgba } = entries[i];
      const offset = i * 4;
      this.paletteBytes[offset] = rgba.r;
      this.paletteBytes[offset + 1] = rgba.g;
      this.paletteBytes[offset + 2] = rgba.b;
      this.paletteBytes[offset + 3] = rgba.a;
    }

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      256,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.paletteBytes
    );

    // 2. Update virtual pixel grid texture (W x H LUMINANCE)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fbTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      framebuffer.width,
      framebuffer.height,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      framebuffer.getIndexBuffer()
    );

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public getCanvas(): HTMLCanvasElement | null {
    if (this.fallback2d) {
      return this.fallback2d.getCanvas();
    }
    return this.canvas;
  }

  public dispose(): void {
    if (this.fallback2d) {
      this.fallback2d.dispose();
      this.fallback2d = null;
    }
    if (this.gl) {
      if (this.fbTexture) this.gl.deleteTexture(this.fbTexture);
      if (this.paletteTexture) this.gl.deleteTexture(this.paletteTexture);
      if (this.quadBuffer) this.gl.deleteBuffer(this.quadBuffer);
      if (this.program) this.gl.deleteProgram(this.program);
    }
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
    this.gl = null;
    this.program = null;
    this.fbTexture = null;
    this.paletteTexture = null;
    this.quadBuffer = null;
  }

  private initPipeline(
    gl: WebGLRenderingContext,
    virtualWidth: number,
    virtualHeight: number
  ): void {
    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = vec2((a_position.x + 1.0) * 0.5, 1.0 - (a_position.y + 1.0) * 0.5);
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_framebuffer;
      uniform sampler2D u_palette;
      void main() {
        float index = texture2D(u_framebuffer, v_texCoord).r;
        float lutCoord = (floor(index * 255.0 + 0.5) + 0.5) / 256.0;
        gl_FragColor = texture2D(u_palette, vec2(lutCoord, 0.5));
      }
    `;

    const vs = this.compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const quadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const fbTex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const palTex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, palTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.uniform1i(gl.getUniformLocation(program, 'u_framebuffer'), 0);
    gl.uniform1i(gl.getUniformLocation(program, 'u_palette'), 1);

    gl.viewport(0, 0, virtualWidth, virtualHeight);

    this.program = program;
    this.fbTexture = fbTex;
    this.paletteTexture = palTex;
    this.quadBuffer = quadBuffer;
  }

  private compileShader(
    gl: WebGLRenderingContext,
    type: number,
    source: string
  ): WebGLShader {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }
}
