# branch-env-vars

A GitHub Action to allow for branch-based environment variables

## Inputs

### Example

You may add as many branch-based environment variables as you'd like, in this fashion:

(a step in a job in your workflow file)

```yaml
- name: Set branch-based environment variables
  uses: iamtheyammer/branch-env-vars@v1.1.0
  with:
    # optional, just an example of setting a setting
    bevOverwrite: true
    KITCHEN_SINK: |
      master:this is the value for KITCHEN_SINK if we are on the master branch
      staging:this is the value if we are on the staging branch
      another-branch:add as many as you want!
      colon:of course you can put colons in your values: see!
      uses-env-var:our workspace is at: ${{ env.GITHUB_WORKSPACE }}
      these-are-just-branch-names:isn't that cool!
      wildcard/*:this is for branches prefixed by wildcard/

      # this is a comment! (of course, we support empty lines!)
      # you can also set special values, like the following

      !pr:this is the value if we are building a PR
      !tag:this is the value if we are building a tag
      !default:this is the default value. leaving this out is fine, but the variable might be empty. see bevSetEmptyVars.
    STATIC_VAR: 'i am a static env var. static vars may not contain line breaks.'
    I_AM_SECRET: |
      master:${{ secrets.I_AM_SECRET_PROD }}
      staging:${{ secrets.I_AM_SECRET_STG }}
      release/*:${{ secrets.I_AM_SECRET_PRE_PROD }}
      !default:i am not secret
    ANOTHER_EXAMPLE: |
      master:VALUEFORmaster
      !default:DEFAULTvalue
```

### Settings

Settins are prefixed with `bev`.

- `bevOverwrite`: Whether to overwrite other, already-set environment variables with the same name (default `true`)
- `bevActionOnNoRef`: What to do when there is no GITHUB_REF: (default `warn`)
  - `error` (fail the build)
  - `warn` (print a warning but pass)
  - `continue` (pass and continue silently)
  - if any other value is put here, the build will fail
- `bevSetEmptyVars`: Whether to set environment variables with empty values. This may happen if you don't specify a default value.

### Environment variables

We use multi-line YAML strings to store branches and their values. For example,

```yaml
key: |
  multi-line value
```

We use multi-line values because they can contain special characters, like `'`, line breaks, and more.

This action supports setting environment variables for:

- Specific branches by name
- Wildcard branch patterns
- Pull requests
- Tags
- Defaults

It also supports static values.

#### Values by branch name

```yaml
- name: Set branch-based environment variables
  uses: iamtheyammer/branch-env-vars@...
  with:
    EXAMPLE: |
      master:valueformaster
      staging:valueforstaging
      release/*:valueforreleasebranches
      !default:defaultvalue
```

In the above example, if the branch is `master`, the value will be `valueformaster`.
If the branch is `staging`, the value will be `valueforstaging`.
If the branch is `release/1.0.0`, the value will be `valueforreleasebranches`.
If we are building anything else, including a pull request, tag, or other branch, the value will be `defaultvalue`.

If we did NOT provide a default, either the environment variable would not be set or it would be set to an empty string, based on your `bevSetEmptyVars` setting.

#### Values for pull requests and tags

```yaml
- name: Set branch-based environment variables
  uses: iamtheyammer/branch-env-vars@...
  with:
    EXAMPLE: |
      !pr:valueforapullrequest
      !tag:valueforatag
      !default:valueforanythingelse
```

In the above example, if the run is for a pull request, the value will be `valueforapullrequest`.
If the run is for a tag, the value will be `valueforatag`.
If we are building anything else, like a branch, the value will be `valueforanythingelse`.

#### Static values

```yaml
- name: Set branch-based environment variables
  uses: iamtheyammer/branch-env-vars@...
  with:
    EXAMPLE: 'staticvalueforEXAMPLE'
```

In the above example, the value for `EXAMPLE` will always be `staticvalueforEXAMPLE`.

Note that static variables may not have line breaks.

#### Comments and empty lines

```yaml
- name: Set branch-based environment variables
  uses: iamtheyammer/branch-env-vars@...
  with:
    EXAMPLE: |
      master:valueformaster
      # this is a comment

      # you may leave empty lines, that's cool
```

Like YAML, comments are prefixed with a `#`.

Empty lines are not evaluated.

## Common Issues

### Variable value has branch name in it

```yaml
- name: Set branch-based environment variables
  uses: iamtheyammer/branch-env-vars@...
  with:
    EXAMPLE: 'master:valueformaster'
```

The value of `EXAMPLE` in the above code is `master:valueformaster`.

This is happening because you're using a static variable declaration (single line).
Switch to multi-line YAML for this to make it work.

```yaml
- name: Set branch-based environment variables
  uses: iamtheyammer/branch-env-vars@...
  with:
    EXAMPLE: |
      master:valueformaster
```

The value of `EXAMPLE` is now `valueformaster`.

This happens because we use the presence of a line break to detect static environment variables.
YAML automatically appends a line break to multi-line strings, so every multi-line declaration is non-static.

```yaml
- name: Set branch-based environment variables
  uses: iamtheyammer/branch-env-vars@...
  with:
    EXAMPLE: |
      master:valueformaster
    SOMETHING_ELSE: |
    	master:somethingelse
        staging:somethingelsestaging

```

The above YAML converts to the following JSON, where you can see the line breaks.

```json
[
  {
    "name": "Set branch-based environment variables",
    "uses": "iamtheyammer/branch-env-vars@...",
    "with": {
      "EXAMPLE": "master:valueformaster\n",
      "SOMETHING_ELSE": "master:somethingelse\nstaging:somethingelsestaging\n"
    }
  }
]
```

If you're still having this issue with a multiline declaration, make there's a newline after your last character in the multi-line declaration.

### Warning: Unexpected input(s) 'YOUR_VAR_NAME', ...

This warning is caused by the way GitHub parses `with` data. Don't worry about it.
