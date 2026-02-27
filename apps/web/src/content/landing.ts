import {
  landingContentFiles,
  validateLandingContentRuntime,
  validateLandingContentStrict,
  type ContentValidationError,
  type LandingValidationInput
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

function logErrors(errors: ContentValidationError[]) {
  for (const error of errors) {
    console.error("content_validation_error", error);
  }
}

const strictValidation = validateLandingContentStrict(input);

if (import.meta.env.DEV && strictValidation.errors.length > 0) {
  logErrors(strictValidation.errors);
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
  logErrors(runtimeValidation.errors);
}

export const LANDING_CONTENT = runtimeValidation;
export { landingContentFiles };
