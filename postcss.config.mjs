import path from "node:path";
import { fileURLToPath } from "node:url";

// The project folder name contains spaces and parentheses
// ("build-notebooklm-style-application (1)"). Turbopack's dev resolver
// truncates the project path at the first space/paren and walks up to
// `Downloads`, where it can't find `node_modules/tailwindcss`
// (Can't resolve 'tailwindcss' in 'C:\Users\AbuEmad\Downloads').
//
// Explicitly setting `base` to the absolute project root forces
// @tailwindcss/postcss to resolve `@import "tailwindcss"` and scan for
// class candidates from the correct directory, bypassing the corrupted
// default root that Turbopack derives from the folder name.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const postcssConfig = {
  plugins: {
    "@tailwindcss/postcss": {
      base: projectRoot,
    },
  },
};

export default postcssConfig;
