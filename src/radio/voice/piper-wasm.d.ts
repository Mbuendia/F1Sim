// [IA6] El traductor a fonemas de @diffusionstudio/piper-wasm es un módulo de Emscripten sin tipos.
declare module '@diffusionstudio/piper-wasm/build/piper_phonemize.js' {
  const createPiperPhonemize: (args: object) => Promise<{ callMain(args: string[]): void }>;
  export default createPiperPhonemize;
}
