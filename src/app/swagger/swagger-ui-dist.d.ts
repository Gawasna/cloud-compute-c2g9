declare module "swagger-ui-dist" {
  export const SwaggerUIBundle: {
    (options: Record<string, unknown>): unknown;
    presets: { apis: unknown };
    plugins: { DownloadUrl: unknown };
  };
  export const SwaggerUIStandalonePreset: unknown;
  export const absolutePath: () => string;
  export const getAbsoluteFSPath: () => string;
}

