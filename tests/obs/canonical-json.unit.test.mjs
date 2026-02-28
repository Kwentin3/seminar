import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJsonStringify, hashCanonicalJson } from "../../server/obs/canonical-json.mjs";

test("canonical JSON hash is deterministic for object key order variations", () => {
  const left = {
    schema_version: "1.0.0",
    modules: {
      "landing.step2.roles": {
        expects: "^1.0.0",
        path: "content/landing/step2.roles.v1.json"
      },
      "landing.step1.hero": {
        path: "content/landing/step1.hero.v1.json",
        expects: "^1.0.0"
      }
    }
  };

  const right = {
    modules: {
      "landing.step1.hero": {
        expects: "^1.0.0",
        path: "content/landing/step1.hero.v1.json"
      },
      "landing.step2.roles": {
        path: "content/landing/step2.roles.v1.json",
        expects: "^1.0.0"
      }
    },
    schema_version: "1.0.0"
  };

  assert.equal(canonicalJsonStringify(left), canonicalJsonStringify(right));
  assert.equal(hashCanonicalJson(left), hashCanonicalJson(right));
});

test("content unit hash is stable for identical unit payload", () => {
  const unit = {
    headline: {
      i18n: {
        ru: "Семинар",
        en: "Seminar"
      }
    },
    body: [
      {
        id: "hero.aggressive.body.p1",
        text: {
          i18n: {
            ru: "Первый абзац",
            en: "First paragraph"
          }
        }
      }
    ]
  };

  const hashA = hashCanonicalJson(unit);
  const hashB = hashCanonicalJson({
    body: [
      {
        text: {
          i18n: {
            en: "First paragraph",
            ru: "Первый абзац"
          }
        },
        id: "hero.aggressive.body.p1"
      }
    ],
    headline: {
      i18n: {
        en: "Seminar",
        ru: "Семинар"
      }
    }
  });

  assert.equal(hashA, hashB);
});
