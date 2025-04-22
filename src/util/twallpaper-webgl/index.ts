// https://github.com/crashmax-dev/twallpaper-webgl - all regards to the author crashmax-dev
// This version is modified - core logic is wrapped in a class
// Also, mask handling is cut atm
// Also, shaders were extracted as simple strings to avoid using new webpack plugin for raw glsl

import type { TBGPatternColorScheme } from '../../types';

import { distance } from './util';
import { contrastColor } from './contrast-color';
import { fragmentShader } from './fragment-shader';
import { hexToVec3 } from './hex-to-vec3';
import { loadShaders } from './load-shaders';
import { vertexShader } from './vertex-shader';

export class TWallpaperWebGL {
  static instance: TWallpaperWebGL;

  static multitonInstances: Record<string, TWallpaperWebGL> = {};

  private initialized: boolean;

  private gl: WebGLRenderingContext | undefined;

  private gradientCanvas: HTMLCanvasElement | undefined;

  private animating: boolean = false;

  private readonly speed: number = 0.1;

  private keyShift: number = 0;

  // Color positions and targets
  private color1Pos: number[] = [0, 0];

  private color2Pos: number[] = [0, 0];

  private color3Pos: number[] = [0, 0];

  private color4Pos: number[] = [0, 0];

  private targetColor1Pos: number[] = [0, 0];

  private targetColor2Pos: number[] = [0, 0];

  private targetColor3Pos: number[] = [0, 0];

  private targetColor4Pos: number[] = [0, 0];

  // WebGL locations
  private resolutionLoc: WebGLUniformLocation = [0, 0];

  private color1Loc: WebGLUniformLocation = [0, 0];

  private color2Loc: WebGLUniformLocation = [0, 0];

  private color3Loc: WebGLUniformLocation = [0, 0];

  private color4Loc: WebGLUniformLocation = [0, 0];

  private color1PosLoc: WebGLUniformLocation = [0, 0];

  private color2PosLoc: WebGLUniformLocation = [0, 0];

  private color3PosLoc: WebGLUniformLocation = [0, 0];

  private color4PosLoc: WebGLUniformLocation = [0, 0];

  // Color values
  private colors: {
    color1: readonly [number, number, number];
    color2: readonly [number, number, number];
    color3: readonly [number, number, number];
    color4: readonly [number, number, number];
  } | undefined;

  private readonly keyPoints = [
    [0.265, 0.582],
    [0.176, 0.918],
    [1 - 0.585, 1 - 0.164],
    [0.644, 0.755],
    [1 - 0.265, 1 - 0.582],
    [1 - 0.176, 1 - 0.918],
    [0.585, 0.164],
    [1 - 0.644, 1 - 0.755],
  ];

  constructor() {
    this.initialized = false;
  }

  public initCanvas(
    gradientCanvas: HTMLCanvasElement | null | undefined,
    colorScheme: TBGPatternColorScheme,
  ): void {
    if (!gradientCanvas) {
      this.initialized = false;
      return;
    }
    if (this.gradientCanvas === gradientCanvas) {
      // check new color scheme
      if (!this.colors
        || colorScheme.color1 !== this.colors.color1.toString()
        || colorScheme.color2 !== this.colors.color2.toString()
        || colorScheme.color3 !== this.colors.color3.toString()
        || colorScheme.color4 !== this.colors.color4.toString()
      ) {
        this.setColorScheme(colorScheme);
      }
      return;
    }
    this.gradientCanvas = gradientCanvas;

    this.gl = this.gradientCanvas.getContext('webgl')!;
    if (!this.gl) {
      this.initialized = false;
      return;
    }

    const program = this.gl.createProgram()!;
    if (!program) {
      this.initialized = false;
      return;
    }

    // Initialize shaders and program
    const shaders = loadShaders(this.gl, [vertexShader, fragmentShader]);
    for (const shader of shaders) {
      this.gl.attachShader(program, shader);
    }

    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      this.initialized = false;
      return;
    }

    // Get all uniform locations
    this.resolutionLoc = this.gl.getUniformLocation(program, 'resolution') ?? [0, 0];
    this.color1Loc = this.gl.getUniformLocation(program, 'color1') ?? [0, 0];
    this.color2Loc = this.gl.getUniformLocation(program, 'color2') ?? [0, 0];
    this.color3Loc = this.gl.getUniformLocation(program, 'color3') ?? [0, 0];
    this.color4Loc = this.gl.getUniformLocation(program, 'color4') ?? [0, 0];
    this.color1PosLoc = this.gl.getUniformLocation(program, 'color1Pos') ?? [0, 0];
    this.color2PosLoc = this.gl.getUniformLocation(program, 'color2Pos') ?? [0, 0];
    this.color3PosLoc = this.gl.getUniformLocation(program, 'color3Pos') ?? [0, 0];
    this.color4PosLoc = this.gl.getUniformLocation(program, 'color4Pos') ?? [0, 0];

    this.gl.useProgram(program);

    // look up where the vertex data needs to go.
    const positionAttributeLocation = this.gl.getAttribLocation(program, 'a_position');

    // Create a buffer to put three 2d clip space points in
    const positionBuffer = this.gl.createBuffer();

    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);

    // fill it with a 2 triangles that cover clipspace
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([
        -1,
        -1, // first triangle
        1,
        -1,
        -1,
        1,
        -1,
        1, // second triangle
        1,
        -1,
        1,
        1,
      ]),
      this.gl.STATIC_DRAW,
    );

    // Tell WebGL how to convert from clip space to pixels
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    // Tell it to use our program (pair of shaders)
    this.gl.useProgram(program);

    // Turn on the attribute
    this.gl.enableVertexAttribArray(positionAttributeLocation);

    // Bind the position buffer.
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);

    // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    this.gl.vertexAttribPointer(
      positionAttributeLocation,
      2, // 2 components per iteration
      this.gl.FLOAT, // the data is 32bit floats
      false, // don't normalize the data
      0, // 0 = move forward size * sizeof(type) each iteration to get the next position
      0, // start at the beginning of the buffer
    );

    this.targetColor1Pos = this.keyPoints[this.keyShift % 8];
    this.targetColor2Pos = this.keyPoints[(this.keyShift + 2) % 8];
    this.targetColor3Pos = this.keyPoints[(this.keyShift + 4) % 8];
    this.targetColor4Pos = this.keyPoints[(this.keyShift + 6) % 8];
    this.keyShift = (this.keyShift + 1) % 8;
    this.color1Pos = [this.targetColor1Pos[0], this.targetColor1Pos[1]];
    this.color2Pos = [this.targetColor2Pos[0], this.targetColor2Pos[1]];
    this.color3Pos = [this.targetColor3Pos[0], this.targetColor3Pos[1]];
    this.color4Pos = [this.targetColor4Pos[0], this.targetColor4Pos[1]];

    this.colors = {
      color1: hexToVec3(colorScheme.color1),
      color2: hexToVec3(colorScheme.color2),
      color3: hexToVec3(colorScheme.color3),
      color4: hexToVec3(colorScheme.color4),
    };

    this.initialized = true;
    this.renderGradientCanvas();
  }

  public get isInitialized(): boolean {
    return this.initialized;
  }

  public setColorScheme(newColors: TBGPatternColorScheme): void {
    this.colors = {
      color1: hexToVec3(newColors.color1),
      color2: hexToVec3(newColors.color2),
      color3: hexToVec3(newColors.color3),
      color4: hexToVec3(newColors.color4),
    };

    this.updateColors(this.colors);
    this.renderGradientCanvas();
  }

  private updateColors(newColorsVec3: Record<string, readonly [number, number, number]>): void {
    if (!this.gl) {
      return;
    }
    this.gl.uniform3fv(this.color1Loc, newColorsVec3.color1);
    this.gl.uniform3fv(this.color2Loc, newColorsVec3.color2);
    this.gl.uniform3fv(this.color3Loc, newColorsVec3.color3);
    this.gl.uniform3fv(this.color4Loc, newColorsVec3.color4);
  }

  private renderGradientCanvas(): void {
    if (!this.gl || !this.colors) {
      return;
    }
    this.gl.uniform2fv(this.resolutionLoc, [this.gl.canvas.width, this.gl.canvas.height]);
    this.gl.uniform3fv(this.color1Loc, this.colors.color1);
    this.gl.uniform3fv(this.color2Loc, this.colors.color2);
    this.gl.uniform3fv(this.color3Loc, this.colors.color3);
    this.gl.uniform3fv(this.color4Loc, this.colors.color4);
    this.gl.uniform2fv(this.color1PosLoc, this.color1Pos);
    this.gl.uniform2fv(this.color2PosLoc, this.color2Pos);
    this.gl.uniform2fv(this.color3PosLoc, this.color3Pos);
    this.gl.uniform2fv(this.color4PosLoc, this.color4Pos);

    this.gl.drawArrays(
      this.gl.TRIANGLES,
      0, // offset
      6, // num vertices to process
    );
  }

  private updateTargetColors(): void {
    this.targetColor1Pos = this.keyPoints[this.keyShift % 8];
    this.targetColor2Pos = this.keyPoints[(this.keyShift + 2) % 8];
    this.targetColor3Pos = this.keyPoints[(this.keyShift + 4) % 8];
    this.targetColor4Pos = this.keyPoints[(this.keyShift + 6) % 8];
    this.keyShift = (this.keyShift + 1) % 8;
  }

  private animate(): void {
    this.animating = true;
    if (
      distance(this.color1Pos, this.targetColor1Pos) > 0.01
      || distance(this.color2Pos, this.targetColor2Pos) > 0.01
      || distance(this.color3Pos, this.targetColor3Pos) > 0.01
      || distance(this.color3Pos, this.targetColor3Pos) > 0.01
    ) {
      this.color1Pos[0] = this.color1Pos[0] * (1 - this.speed) + this.targetColor1Pos[0] * this.speed;
      this.color1Pos[1] = this.color1Pos[1] * (1 - this.speed) + this.targetColor1Pos[1] * this.speed;
      this.color2Pos[0] = this.color2Pos[0] * (1 - this.speed) + this.targetColor2Pos[0] * this.speed;
      this.color2Pos[1] = this.color2Pos[1] * (1 - this.speed) + this.targetColor2Pos[1] * this.speed;
      this.color3Pos[0] = this.color3Pos[0] * (1 - this.speed) + this.targetColor3Pos[0] * this.speed;
      this.color3Pos[1] = this.color3Pos[1] * (1 - this.speed) + this.targetColor3Pos[1] * this.speed;
      this.color4Pos[0] = this.color4Pos[0] * (1 - this.speed) + this.targetColor4Pos[0] * this.speed;
      this.color4Pos[1] = this.color4Pos[1] * (1 - this.speed) + this.targetColor4Pos[1] * this.speed;
      this.renderGradientCanvas();
      requestAnimationFrame(this.animate.bind(this));
    } else {
      this.animating = false;
    }
  }

  public playAnimation(): void {
    if (!this.animating) {
      this.updateTargetColors();
      requestAnimationFrame(() => this.animate.bind(this)());
    }
  }

  public static getInstance(): TWallpaperWebGL {
    if (!this.instance) {
      this.instance = new TWallpaperWebGL();
    }
    return this.instance;
  }

  public static getMultitonInstance(key: string): TWallpaperWebGL {
    if (!this.multitonInstances[key]) {
      this.multitonInstances[key] = new TWallpaperWebGL();
    }
    return this.multitonInstances[key];
  }

  public deinit(): void {
    if (this.initialized) {
      this.initialized = false;
      this.animating = false;
      this.colors = undefined;
    }

    if (this.gl) {
      this.gl = undefined;
    }
  }

  public static renderPreview(
    gradientCanvas: HTMLCanvasElement | null | undefined,
    colorScheme: TBGPatternColorScheme,
  ): void {
    if (!gradientCanvas) {
      return;
    }

    const ctx = gradientCanvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const width = gradientCanvas.width;
    const height = gradientCanvas.height;

    ctx.clearRect(0, 0, width, height);

    const minDim = Math.min(width, height);

    // overlap colors settings
    ctx.globalCompositeOperation = 'color';
    // Preview does not produce the best result. Maybe, picking some other composite operation option could help
    // "color" |
    // "color-burn" |
    // "color-dodge" |
    // "copy" |
    // "darken" |
    // "destination-atop" |
    // "destination-in" |
    // "destination-out" |
    // "destination-over" |
    // "difference" |
    // "exclusion" |
    // "hard-light" |
    // "hue" |
    // "lighten" |
    // "lighter" |
    // "luminosity" |
    // "multiply" |
    // "overlay" |
    // "saturation" |
    // "screen" |
    // "soft-light" |
    // "source-atop" |
    // "source-in" |
    // "source-out" |
    // "source-over" |
    // "xor";

    const radgrad = ctx.createRadialGradient(0, 0, 1, 0, 0, minDim);
    radgrad.addColorStop(0, colorScheme.color1);
    radgrad.addColorStop(1, `${colorScheme.color1}40`);

    const radgrad2 = ctx.createRadialGradient(0, height, 1, 0, height, minDim);
    radgrad2.addColorStop(0, colorScheme.color2);
    radgrad2.addColorStop(1, `${colorScheme.color2}40`);

    const radgrad3 = ctx.createRadialGradient(width, 0, 1, width, 0, minDim);
    radgrad3.addColorStop(0, colorScheme.color3);
    radgrad3.addColorStop(1, `${colorScheme.color3}40`);

    const radgrad4 = ctx.createRadialGradient(width, height, 1, width, height, minDim);
    radgrad4.addColorStop(0, colorScheme.color4);
    radgrad4.addColorStop(1, `${colorScheme.color4}40`);

    ctx.fillStyle = radgrad4;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = radgrad3;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = radgrad2;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = radgrad;
    ctx.fillRect(0, 0, width, height);
  }

  public static contrastInvertedMaskColors({
    color1, color2, color3, color4,
  }: TBGPatternColorScheme): TBGPatternColorScheme {
    return {
      color1: contrastColor(color1),
      color2: contrastColor(color2),
      color3: contrastColor(color3),
      color4: contrastColor(color4),
    };
  }
}
