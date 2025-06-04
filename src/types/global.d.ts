/// <reference types="@webgpu/types" />

export {}; // force le mode module

declare global {
  interface Navigator {
    /** Présent seulement si le navigateur implémente WebGPU */
    gpu?: GPU;
  }
}