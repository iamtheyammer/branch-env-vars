const core = require("@actions/core");

const { parseBranchName, parseEnvVarPossibilities } = require("./index");

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
    expect(results["!pr"]).toStrictEqual("pr-value");
    expect(results["!tag"]).toStrictEqual("tag-value");
    expect(results["!default"]).toStrictEqual("default-value");
  });
});
