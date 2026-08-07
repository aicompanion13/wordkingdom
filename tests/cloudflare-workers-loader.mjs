const workersStub =
  "data:text/javascript," +
  encodeURIComponent(`
    export const env = {
      DB: {
        prepare() {
          return {
            bind() { return this; },
            async run() { return { success: true, results: [] }; },
            async first() { return null; }
          };
        },
        async batch() { return []; }
      }
    };
  `);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return { url: workersStub, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
