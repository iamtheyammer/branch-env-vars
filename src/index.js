const {
  setFailed,
  warning,
  exportVariable,
  getInput,
  debug,
} = require("@actions/core");

const protectedEnvVars = [
  "INPUT_BEVOVERWRITE",
  "INPUT_BEVACTIONONNOREF",
  "INPUT_BEVSETEMPTYVARS",
];

let canOverwrite;
let noRefAction;
let setEmptyVars;

function parseBranchName(ref) {
  if (!ref) {
    switch (noRefAction) {
      case "error":
        setFailed("Unable to get github.ref/GITHUB_REF");
        return;
      case "warn":
        warning("Unable to get github.ref/GITHUB_REF");
        break;
      case "continue":
        break;
      default:
        setFailed(`Invalid value for bevActionOnNoRef: ${noRefAction}`);
        return;
    }
  }
  // should look like [heads, my-branch-name] or [pulls, my-pull] or [tags, v0.0.0]
  const sanitizedRef = ref.replace("refs/", "");
  const refType = sanitizedRef.slice(0, sanitizedRef.indexOf("/"));
  const refSourceName = sanitizedRef.slice(sanitizedRef.indexOf("/") + 1);

  /* workflow yaml with:
  TEST_ENV_VAR: |
    master:someValueForMaster
    staging:someValueForStaging
    !pr:someValueForAPR
    !tag:someValueForTags
    !default:someDefaultValue
   */

  let branchName = "!default";

  switch (refType) {
    case "heads":
      branchName = refSourceName;
      break;
    case "pull":
      branchName = `!pr>${refSourceName}`;
      break;
    case "tags":
      branchName = "!tag";
      break;
  }

  return branchName;
}

function parseEnvVarPossibilities(envVars) {
  return Object.entries(envVars)
    .filter(
      ([name]) => name.startsWith("INPUT_") && !protectedEnvVars.includes(name)
    )
    .map(([name, value]) => {
      // name of the environment variable
      const transformedName = name.replace("INPUT_", "").toUpperCase();

      // handle static environment variables
      if (!value.includes("\n")) {
        return [
          transformedName,
          {
            "!default": value.trim(),
          },
        ];
      }

      /*
      {
        "master": "someValueForMaster",
        "staging": "someValueForStaging",
        // ...
      }
       */
      const possibleValues = value.split("\n").reduce((acc, pair) => {
        // comment or empty line
        if (pair.trim().startsWith("#") || !pair.trim().length) {
          return acc;
        }

        const separatorLoc = pair.indexOf(":");
        if (separatorLoc === -1) {
          throw new Error(
            `Invalid value for ${transformedName}: ${pair} does not contain a colon`
          );
        }

        // what environment variable name the values are for
        const valueFor = pair.substring(0, separatorLoc).trim();

        acc[valueFor] = pair.substring(separatorLoc + 1);

        return acc;
      }, {});

      return [transformedName, possibleValues];
    });
}

function matchBranchToEnvironmentVariable(possibleValues, branchName) {
  const possibleValueKeys = Object.keys(possibleValues);

  // handle wildcards
  const wildcardKeys = possibleValueKeys.filter((k) => k.includes("*"));
  let key = branchName;
  if (wildcardKeys.length > 0) {
    const wildcardKey = wildcardKeys.find((k) => {
      const regex = new RegExp(
        `${k.replace(/\*\*/g, ".*").replace(/\*/g, ".*")}`
      );
      return regex.test(branchName);
    });
    key = wildcardKey || branchName;
  }

  if (key.startsWith("!pr")) {
    // if a specific pr matcher matches, use that
    if (possibleValues[key]) {
      return possibleValues[key];
    } else if (possibleValues["!pr"]) {
      return possibleValues["!pr"];
    }
    return possibleValues["!default"];
  }

  return possibleValues[key] || possibleValues["!default"];
}

function branchEnvVars(environmentVariables) {
  try {
    canOverwrite = getInput("bevOverwrite") === "true";
    noRefAction = getInput("bevActionOnNoRef");
    setEmptyVars = getInput("bevSetEmptyVars") === "true";

    const ref = environmentVariables.GITHUB_REF;
    const branchName = parseBranchName(ref);

    parseEnvVarPossibilities(environmentVariables).forEach(
      ([name, possibleValues]) => {
        if (!canOverwrite && !!environmentVariables[name]) {
          return;
        }

        const value = matchBranchToEnvironmentVariable(
          possibleValues,
          branchName
        );
        if (!value) {
          if (setEmptyVars) {
            exportVariable(name, "");
            debug(`Exporting ${name} with an empty value`);
          }
        } else {
          exportVariable(name, value);
          debug(`Exporting ${name} with value ${value}`);
        }
      }
    );
  } catch (e) {
    setFailed(e);
  }
}

if (!process.env.JEST_WORKER_ID) {
  branchEnvVars(process.env);
}

module.exports = {
  branchEnvVars,
  parseBranchName,
  parseEnvVarPossibilities,
  matchBranchToEnvironmentVariable,
};
