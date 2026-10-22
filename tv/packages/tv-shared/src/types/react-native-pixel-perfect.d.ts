declare module 'react-native-pixel-perfect' {
  /** Returns a scaler from design-resolution pixels to device pixels. */
  export function create(designResolution: { width: number; height: number }): (size: number) => number;
}
