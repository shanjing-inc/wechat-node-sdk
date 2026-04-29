export type AstroAdapterOptions = {
  fetch?: typeof fetch;
};

export function createAstroFetch(options: AstroAdapterOptions = {}): typeof fetch {
  return options.fetch ?? globalThis.fetch.bind(globalThis);
}
