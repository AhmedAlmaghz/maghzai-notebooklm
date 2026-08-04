import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, ".env") });

console.log("DATABASE_URL =", process.env.DATABASE_URL);
console.log("DATABASE_DRIVER =", process.env.DATABASE_DRIVER);