import { defineConfig } from "orval";

export default defineConfig({
  sportza: {
    input: {
      target: "../../apps/api/openapi.json",
    },
    output: {
      target: "./src/generated/api.ts",
      client: "react-query",
      mode: "tags-split",
      override: {
        mutator: {
          path: "./src/axios-instance.ts",
          name: "customInstance",
        },
        query: {
          useQuery: true,
          useMutation: true,
        },
      },
    },
  },
});
