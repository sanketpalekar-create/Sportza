import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi";

export const registry = new OpenAPIRegistry();

export function generateOpenAPISpec(): object {
  const generator = new OpenApiGeneratorV31(registry.definitions);

  // Relative "/api" → Swagger "Try it out" uses the same host as /api/docs
  // (works on Railway and locally). Paths are registered as /auth/..., /venues/...
  // so the server base must include the /api mount prefix.
  const publicApiUrl = process.env.PUBLIC_API_URL?.replace(/\/$/, "");

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Sportza API",
      version: "2.0.0",
      description:
        "Sportza platform API — venue booking, training, matches, tournaments, and payments.",
    },
    servers: [
      { url: "/api", description: "Current host" },
      ...(publicApiUrl
        ? [{ url: `${publicApiUrl}/api`, description: "Configured public API" }]
        : []),
      { url: "http://localhost:5000/api", description: "Local development" },
    ],
    security: [{ bearerAuth: [] }],
  });
}

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});
