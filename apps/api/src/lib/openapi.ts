import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi";

export const registry = new OpenAPIRegistry();

export function generateOpenAPISpec(): object {
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Sportza API",
      version: "2.0.0",
      description:
        "Sportza platform API — venue booking, training, matches, tournaments, and payments.",
    },
    servers: [
      { url: "http://localhost:5000", description: "Development" },
    ],
    security: [{ bearerAuth: [] }],
  });
}

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});
