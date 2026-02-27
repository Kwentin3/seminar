import {
  landingContentFiles,
  validateLandingContentRuntime,
  validateLandingContentStrict,
  type ContentValidationError,
  type LandingValidationInput,
  type RuntimeClassifiedError
} from "@seminar/contracts";
import manifestJson from "@content/landing/manifest.v1.json";
import step1HeroJson from "@content/landing/step1.hero.v1.json";
import step2RolesJson from "@content/landing/step2.roles.v1.json";

const input: LandingValidationInput = {
  manifest: manifestJson,
  modules: {
    "landing.step1.hero": step1HeroJson,
    "landing.step2.roles": step2RolesJson
  }
};

function formatError(error: ContentValidationError): string {
  return `${error.file} ${error.json_pointer} ${error.error_code}`;
}

function logErrors(errors: ContentValidationError[], runtimeErrors: RuntimeClassifiedError[]) {
  for (let index = 0; index < errors.length; index += 1) {
    const error = errors[index];
    const runtime = runtimeErrors[index];
    console.error("content_validation_error", {
      ...error,
      level: runtime?.level ?? "structural"
    });
  }
}

const strictValidation = validateLandingContentStrict(input);

if (import.meta.env.DEV && strictValidation.errors.length > 0) {
  logErrors(strictValidation.errors, strictValidation.runtime_errors);
  throw new Error(
    [
      "Landing content validation failed.",
      ...strictValidation.errors.map((error) => `- ${formatError(error)}`)
    ].join("\n")
  );
}

const runtimeValidation = import.meta.env.DEV
  ? strictValidation
  : validateLandingContentRuntime(input);

if (runtimeValidation.errors.length > 0) {
  logErrors(runtimeValidation.errors, runtimeValidation.runtime_errors);
}

export const LANDING_CONTENT = runtimeValidation;
export { landingContentFiles };
