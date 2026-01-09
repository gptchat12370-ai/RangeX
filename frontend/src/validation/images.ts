import { z } from "zod";

const forbiddenChars = /[\s;&|`$><()]/;
const imageRegex = /^(?:[a-zA-Z0-9.-]+(?::[0-9]+)?\/)?(?:[a-z0-9._-]+\/)*[a-z0-9._-]+(?::[A-Za-z0-9_.-]+)?$/;

export const imageRefSchema = z
  .string()
  .min(1, "Image reference is required")
  .refine((val) => !val.startsWith("http://") && !val.startsWith("https://"), "Do not prefix with http/https")
  .refine((val) => !forbiddenChars.test(val), "Remove whitespace or shell characters")
  .refine((val) => imageRegex.test(val), "Invalid image reference format");

export const registryCredentialSchema = z.object({
  label: z.string().min(3, "Label is required"),
  registryUrl: z.string().min(3, "Registry URL is required"),
  username: z.string().min(1, "Username required"),
  passwordOrToken: z.string().min(8, "Secret must be at least 8 characters"),
});
