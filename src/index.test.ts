import {
  branchEnvVars,
  parseBranchName,
  parseEnvVarPossibilities,
  getValueForBranch,
} from "./index";

import {
  setFailed as unMockedSetFailed,
  exportVariable as unMockedExportVariable,
  getInput as unMockedGetInput,
} from "@actions/core";

const setFailed = jest.mocked(unMockedSetFailed, true);
const exportVariable = jest.mocked(unMockedExportVariable, true);
const getInput = jest.mocked(unMockedGetInput, true);

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

  test("pull requests to !pr>basebranch", () => {
    expect(parseBranchName("refs/pull/20/merge", "basebranch")).toBe("!pr>basebranch");
    expect(parseBranchName("refs/pull/20/merge", "branch/with/slashes")).toBe(
      "!pr>branch/with/slashes"
    );

    expect(parseBranchName("refs/pull/20/merge", "feature/*")).toBe("!pr>feature/*");
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
      !pr>basebranch:pr-basebranch-value
      !pr>basebranch/*:pr-basebranch-wildcard-value
      !pr>emptyvalue:
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
    expect(results["!pr>basebranch"]).toStrictEqual("pr-basebranch-value");
    expect(results["!pr>basebranch/*"]).toStrictEqual(
      "pr-basebranch-wildcard-value"
    );
    expect(results["!pr>emptyvalue"]).toStrictEqual("");
    expect(results["!tag"]).toStrictEqual("tag-value");
    expect(results["!default"]).toStrictEqual("default-value");
  });
});

describe("getValueForBranch", () => {
  describe("wildcard branch names", () => {
    test("wildcards work", () => {
      const envVars = {
        INPUT_TESTENVVAR: `
      release/*:wildcard-value

      !default:default-value
`,
      };

      const results = parseEnvVarPossibilities(envVars)[0][1];
      const value = getValueForBranch("release/1.0.0", results);
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
      const value = getValueForBranch(
        "release/1.0.0/feature/v1/abc-123",
        results
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
      const value = getValueForBranch("release/1.0.0", results);
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
      const value = getValueForBranch(
        "release/1.0.0/feature/v1/feature/123/abc-123",
        results
      );
      expect(value).toStrictEqual("glob-value");
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
      const value = getValueForBranch("master", results);
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
      const value = getValueForBranch("master", results);
      expect(value).toStrictEqual("master-value");
    });
  });

  describe("wildcard pr base branches", () => {
    test("wildcards work", () => {
      const envVars = {
        INPUT_TESTENVVAR: `
      !pr>release/*:wildcard-value

      !default:default-value
`,
      };

      const results = parseEnvVarPossibilities(envVars)[0][1];
      const value = getValueForBranch(
        "!pr>release/1.0.0",
        results
      );
      expect(value).toStrictEqual("wildcard-value");
    });

    test("multiple wildcards work", () => {
      const envVars = {
        INPUT_TESTENVVAR: `
      !pr>release/*/feature/*/abc-123:wildcard-value

      !default:default-value
`,
      };

      const results = parseEnvVarPossibilities(envVars)[0][1];
      const value = getValueForBranch(
        "!pr>release/1.0.0/feature/v1/abc-123",
        results
      );
      expect(value).toStrictEqual("wildcard-value");
    });

    test("glob wildcards work", () => {
      const envVars = {
        INPUT_TESTENVVAR: `
      !pr>release/**/v1/**/abc-123:glob-value

      !default:default-value
`,
      };

      const results = parseEnvVarPossibilities(envVars)[0][1];
      const value = getValueForBranch(
        "!pr>release/1.0.0/feature/v1/feature/123/abc-123",
        results
      );
      expect(value).toStrictEqual("glob-value");
    });

    test("multiple keys including wildcards work", () => {
      const envVars = {
        INPUT_TESTENVVAR: `
      !pr>pull/*:pull-branch-value
      master/*:master-value
      

      !default:default-value
`,
      };
      const results = parseEnvVarPossibilities(envVars)[0][1];
      const value = getValueForBranch("master/abc", results);
      const prValue = getValueForBranch(
        "!pr>pull/mypull",
        results
      );
      expect(value).toStrictEqual("master-value");
      expect(prValue).toStrictEqual("pull-branch-value");
    });

    test("key is just wildcard", () => {
      const envVars = {
        INPUT_TESTENVVAR: `
      !pr>*:master-value

      !default:default-value
`,
      };
      const results = parseEnvVarPossibilities(envVars)[0][1];
      expect(
        // matchBranchToEnvironmentVariable takes in the processed branch name, which would include !pr>.
        getValueForBranch("!pr>master", results)
      ).toStrictEqual("master-value");
    });

    test("!pr acts as a default", () => {
      const envVars = {
        INPUT_TESTENVVAR: `
        !pr>brancha:foo
        !pr>branchb/*:bar
        !pr:baz
        `,
      };

      const results = parseEnvVarPossibilities(envVars)[0][1];
      expect(
        // matchBranchToEnvironmentVariable takes in the processed branch name, which would include !pr>.
        getValueForBranch( "!pr>branchX", results)
      ).toStrictEqual("baz");
    });
  });

  test("normal keys work", () => {
    const envVars = {
      INPUT_TESTENVVAR: `
      master:master-value

      !default:default-value
`,
    };
    const results = parseEnvVarPossibilities(envVars)[0][1];
    const value = getValueForBranch("master", results);
    expect(value).toStrictEqual("master-value");
  });

  test("normal empty value keys work", () => {
    const envVars = {
      INPUT_TESTENVVAR: `
      master:

      !default:default-value
`,
    };
    const results = parseEnvVarPossibilities(envVars)[0][1];
    const value1 = getValueForBranch("master", results);
    expect(value1).toStrictEqual("");
    const value2 = getValueForBranch("nonexistent", results);
    expect(value2).toStrictEqual("default-value");
  });

  test("normal pr keys work", () => {
    const envVars = {
      INPUT_TESTENVVAR: `
      !pr>emptyvalue:
      !pr:pr-value

      !default:default-value
`,
    };
    const results = parseEnvVarPossibilities(envVars)[0][1];
    const value = getValueForBranch("!pr", results);
    expect(value).toStrictEqual("pr-value");
  });

  test("empty default pr values work", () => {
    const envVars = {
      INPUT_TESTENVVAR: `
      !pr>emptyvalue:pr-emptyvalue
      !pr:

      !default:default-value
`,
    };
    const results = parseEnvVarPossibilities(envVars)[0][1];
    const value1 = getValueForBranch("!pr>emptyvalue", results);
    expect(value1).toStrictEqual("pr-emptyvalue");
    const value2 = getValueForBranch("!pr>nonexistent", results);
    expect(value2).toStrictEqual("");
    const value3 = getValueForBranch("!pr", results);
    expect(value3).toStrictEqual("");
    const value4 = getValueForBranch("nonexistent", results);
    expect(value4).toStrictEqual("default-value");
  });

  test("empty specific pr values work", () => {
    const envVars = {
      INPUT_TESTENVVAR: `
      !pr>emptyvalue:
      !pr:pr-value

      !default:default-value
`,
    };
    const results = parseEnvVarPossibilities(envVars)[0][1];
    const value1 = getValueForBranch("!pr>emptyvalue", results);
    expect(value1).toStrictEqual("");
    const value2 = getValueForBranch("!pr>nonexistent", results);
    expect(value2).toStrictEqual("pr-value");
    const value3 = getValueForBranch("!pr", results);
    expect(value3).toStrictEqual("pr-value");
    const value4 = getValueForBranch("nonexistent", results);
    expect(value4).toStrictEqual("default-value");
  });
});

test("empty default values work", () => {
  const envVars = {
    INPUT_TESTENVVAR: `
    !pr>emptyvalue:pr-emptyvalue
    !pr:pr-value
    master:master-value

    !default:
`,
  };
  const results = parseEnvVarPossibilities(envVars)[0][1];
  const value1 = getValueForBranch("!pr>emptyvalue", results);
  expect(value1).toStrictEqual("pr-emptyvalue");
  const value2 = getValueForBranch("!pr>nonexistent", results);
  expect(value2).toStrictEqual("pr-value");
  const value3 = getValueForBranch("!pr", results);
  expect(value3).toStrictEqual("pr-value");
  const value4 = getValueForBranch("master", results);
  expect(value4).toStrictEqual("master-value");
  const value5 = getValueForBranch("nonexistent", results);
  expect(value5).toStrictEqual("");
});

describe("integration tests", () => {
  beforeEach(() => {
    setFailed.mockClear();
    exportVariable.mockClear();
    getInput.mockClear();
  });
  test("calls core.exportVariable", () => {
    const envVars = {
      GITHUB_REF: "refs/heads/master",
      INPUT_TESTENVVAR: `
      master:valueformaster
      `,
    };

    branchEnvVars(envVars);
    expect(setFailed).toHaveBeenCalledTimes(0);
    expect(exportVariable).toHaveBeenCalledWith("TESTENVVAR", "valueformaster");
  });

  test("properly handles base branches", () => {
    const envVars = {
      GITHUB_REF: "refs/pull/master",
      GITHUB_BASE_REF: "base",
      INPUT_TESTENVVAR: `
      !pr>base:basevalue
      !default:invalid
      `,
    };

    branchEnvVars(envVars);
    expect(setFailed).toHaveBeenCalledTimes(0);
    expect(exportVariable).toHaveBeenCalledWith("TESTENVVAR", "basevalue");
  });

  test("fails on invalid bevActionOnNoRef", () => {
    const envVars = {
      INPUT_BEVACTIONONNOREF: "invalidaction",
      // GITHUB_REF: "refs/heads/master",
      INPUT_TESTENVVAR: `
      master:valueformaster
      `,
    };

    getInput.mockImplementation((inputName) =>
      inputName === "bevActionOnNoRef" ? envVars.INPUT_BEVACTIONONNOREF : ""
    );

    branchEnvVars(envVars);

    expect(setFailed).toHaveBeenCalledWith(
      "Invalid value for bevActionOnNoRef: invalidaction"
    );
  });
});
