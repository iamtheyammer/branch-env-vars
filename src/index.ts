import {
  setFailed,
  warning,
  exportVariable,
  getInput,
  debug
} from "@actions/core";

const protectedEnvVars = [
  "INPUT_BEVOVERWRITE",
  "INPUT_BEVACTIONONNOREF",
  "INPUT_BEVSETEMPTYVARS",
];

let canOverwrite;
let noRefAction;
let setEmptyVars;

// determines the branch we should match to.
// if we're building a branch, returns the branch name.
// if a base ref exists, it'll return !pr>$base_ref
// tags return !tag
// finally, for everything else, we'll return !default
export function parseBranchName(ref?: string, baseRef?: string): string {
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

  // if there is a base ref, we are building a pr.
  debug(`baseRef ${baseRef}`)
  if(baseRef) {
    branchName = `!pr>${baseRef}`;
  } else {
    debug(`refType ${refType}`)
    switch (refType) {
      case "heads":
        branchName = refSourceName;
        break;
      // case "pull":
      //   branchName = `!pr>${baseRef}`;
      //   break;
      case "tags":
        branchName = "!tag";
        break;
    }
  }

  return branchName;
}

type PossibleValues = {
  [branchNameOrPattern: string]: string,
  "!default"?: string
}

type EnvVarPossibilities = [
    // var name
    string,
    PossibleValues
][];

export function parseEnvVarPossibilities(envVars: {[varName: string]: string}): EnvVarPossibilities {
  return Object.entries(envVars)
    // use only input (uses) data and
    // remove protected var names (settings)
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
      Here, we reduce the paragraph value of branch:value pairs into
      a JavaScript object with branch names/patterns (like !default) as keys.
      {
        "master": "someValueForMaster",
        "staging": "someValueForStaging",
        // ...
      }
       */
      const possibleValues: {[branchNameOrPattern: string]: string} = value.split("\n").reduce((acc, pair) => {
        // comment or empty line
        if (pair.trim().startsWith("#") || !pair.trim().length) {
          return acc;
        }

        // find first colon
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

export function getValueForBranch(branchName: string, possibleValues: PossibleValues): string {
  const possibleValueKeys = Object.keys(possibleValues);

  // handle wildcards
  const wildcardKeys = possibleValueKeys.filter((k) => k.includes("*"));
  let key = branchName;
  // if there's a wildcard and no exact match
  if (wildcardKeys.length > 0 && !possibleValues[key]) {
    // find the first branch pattern where the wildcard matches
    const wildcardKey = wildcardKeys.find((k) => {
      // replace *s with .* and run as regex
      const regex = new RegExp(k.replace(/\*\*/g, ".*").replace(/\*/g, ".*"));
      // return whether the branch name matches the regex
      return regex.test(branchName);
    });
    // if we found a match, wildcardKey will be used. If not, the key will stay as the branch name.
    // so, if key was !pr>staging/* and our branch is staging/1234, key will now be !pr>staging/*.
    key = wildcardKey ? wildcardKey : branchName;
  }

  if (key.startsWith("!pr")) {
    // first, attempt to use the key
    if (possibleValues[key] !== undefined) {
      return possibleValues[key];
    } else if (possibleValues["!pr"] !== undefined) {
      // if that doesn't work, try to use the default pr matcher
      return possibleValues["!pr"];
    }
    // fallback to default since no pr matched
    return possibleValues["!default"];
  }

  return (possibleValues[key] !== undefined) ? possibleValues[key] : possibleValues["!default"];
}

export function branchEnvVars(environmentVariables): void {
  try {
    // handle settings
    canOverwrite = getInput("bevOverwrite") === "true";
    noRefAction = getInput("bevActionOnNoRef");
    setEmptyVars = getInput("bevSetEmptyVars") === "true";

    // head ref (branch we're building)
    const ref = environmentVariables.GITHUB_REF;
    // base ref (if on a pr, base we're going to merge into)
    const baseRef = environmentVariables.GITHUB_BASE_REF;
    const branchName = parseBranchName(ref, baseRef);
    debug(`baseRef ${baseRef}`);
    debug(`branchName ${branchName}`);
    debug(`ref ${ref}`);

    parseEnvVarPossibilities(environmentVariables).forEach(
      ([name, possibleValues]) => {
        if (!canOverwrite && !!environmentVariables[name]) {
          return;
        }

        const value = getValueForBranch(branchName, possibleValues);
        if (value === undefined) {
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

debug(`environmentVariables`)
Object.entries(process.env).forEach(([key, value]) => {
  console.log(`Key: ${key}, Value: ${value}`);
});
if (!process.env.JEST_WORKER_ID) {
  branchEnvVars(process.env);
}
