const core = require("@actions/core");

const {
  parseBranchName,
  parseEnvVarPossibilities,
  matchBranchToEnvironmentVariable,
} = require("./index");

jest.mock("@actions/core");

describe("parseBranchName", () => {
  test("empty input", () => {
    expect(parseBranchName()).toBe(undefined);
  });

  test("branches", () => {
    expect(parseBranchName("refs/heads/mytestbranch")).toBe("mytestbranch");
    expect(parseBranchName("refs/heads/another-cool-branch")).toBe(
      "another-cool-branch"
    );
    expect(parseBranchName("refs/heads/branch/with/slashes")).toBe(
      "branch/with/slashes"
    );
  });

  test("pull requests should resolve to !pr", () => {
    expect(parseBranchName("refs/pulls/mytestbranch")).toBe("!pr");
    expect(parseBranchName("refs/pull/mytestbranch")).toBe("!pr");
    expect(parseBranchName("refs/pull/branch/with/slashes")).toBe("!pr");
  });

  test("tags should resolve to !tag", () => {
    expect(parseBranchName("refs/tags/mytestbranch")).toBe("!tag");
    expect(parseBranchName("refs/tags/branch/with/slashes")).toBe("!tag");
  });
});

describe("parseEnvVarPossibilities", () => {
  test("filters out settings", () => {
    const envVars = {
      INPUT_BEVOVERWRITE: "abc",
      INPUT_BEVACTIONONNOREF: "abc",
      INPUT_BEVSETEMPTYVARS: "abc",
    };

    expect(parseEnvVarPossibilities(envVars)).toStrictEqual([]);
  });

  test("gets all possible values", () => {
    const envVars = {
      INPUT_TESTENVVAR: `
      master:mb-value
      staging:sb-value
      another-branch:abb-value
      colon:cb-value
      uses-env-var:uevb-value
      has/slashes/in/branch/name:hsibn-value
      these-are-just-branch-names:tajbnb-value
      wildcard/*:wildcard-value

      # this is a comment! (of course, we support empty lines!)
      # you can also set special values, like the following

      !pr:pr-value
      !tag:tag-value
      !default:default-value
`,
    };

    const results = parseEnvVarPossibilities(envVars)[0][1];

    expect(results.master).toStrictEqual("mb-value");
    expect(results.staging).toStrictEqual("sb-value");
    expect(results["another-branch"]).toStrictEqual("abb-value");
    expect(results.colon).toStrictEqual("cb-value");
    expect(results["uses-env-var"]).toStrictEqual("uevb-value");
    expect(results["has/slashes/in/branch/name"]).toStrictEqual("hsibn-value");
    expect(results["these-are-just-branch-names"]).toStrictEqual(
      "tajbnb-value"
    );
    expect(results["wildcard/*"]).toStrictEqual("wildcard-value");

    expect(results["!pr"]).toStrictEqual("pr-value");
    expect(results["!tag"]).toStrictEqual("tag-value");
    expect(results["!default"]).toStrictEqual("default-value");
  });
});

describe("matchBranchToEnvironmentVariable", () => {
  test("wildcards work", () => {
    const envVars = {
      INPUT_TESTENVVAR: `
      release/*:wildcard-value

      !default:default-value
`,
    };

    const results = parseEnvVarPossibilities(envVars)[0][1];
    const value = matchBranchToEnvironmentVariable(results, "release/1.0.0");
    expect(value).toStrictEqual("wildcard-value");
  });

  test("multiple wildcards work", () => {
    const envVars = {
      INPUT_TESTENVVAR: `
      release/*/feature/*/abc-123:wildcard-value

      !default:default-value
`,
    };

    const results = parseEnvVarPossibilities(envVars)[0][1];
    const value = matchBranchToEnvironmentVariable(
      results,
      "release/1.0.0/feature/v1/abc-123"
    );
    expect(value).toStrictEqual("wildcard-value");
  });

  test("wildcards that don't match don't work", () => {
    const envVars = {
      INPUT_TESTENVVAR: `
      release/*/feature/*/abc-123:wildcard-value

      !default:default-value
`,
    };

    const results = parseEnvVarPossibilities(envVars)[0][1];
    const value = matchBranchToEnvironmentVariable(results, "release/1.0.0");
    expect(value).toStrictEqual("default-value");
  });

  test("glob wildcards work", () => {
    const envVars = {
      INPUT_TESTENVVAR: `
      release/**/v1/**/abc-123:glob-value

      !default:default-value
`,
    };

    const results = parseEnvVarPossibilities(envVars)[0][1];
    const value = matchBranchToEnvironmentVariable(
      results,
      "release/1.0.0/feature/v1/feature/123/abc-123"
    );
    expect(value).toStrictEqual("glob-value");
  });

  test("normal keys work", () => {
    const envVars = {
      INPUT_TESTENVVAR: `
      master:master-value

      !default:default-value
`,
    };
    const results = parseEnvVarPossibilities(envVars)[0][1];
    const value = matchBranchToEnvironmentVariable(results, "master");
    expect(value).toStrictEqual("master-value");
  });

  test("multiple keys including wildcards work", () => {
    const envVars = {
      INPUT_TESTENVVAR: `
      master:master-value
      release/*:release-branch-value

      !default:default-value
`,
    };
    const results = parseEnvVarPossibilities(envVars)[0][1];
    const value = matchBranchToEnvironmentVariable(results, "master");
    expect(value).toStrictEqual("master-value");
  });

  test("key is just wildcard", () => {
    const envVars = {
      INPUT_TESTENVVAR: `
      *:master-value

      !default:default-value
`,
    };
    const results = parseEnvVarPossibilities(envVars)[0][1];
    const value = matchBranchToEnvironmentVariable(results, "master");
    expect(value).toStrictEqual("master-value");
  });
});
