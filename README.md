# branch-env-vars

A GitHub Action to allow for branch-based environment variables

## Inputs

### Example

You may add as many branch-based environment variables as you'd like, in this fashion:

(a step in a job in your workflow file)

```yaml
- name: Set branch-based environment variables
  uses: iamtheyammer/branch-env-vars@v1.0.0
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

      # this is a comment! (of course, we support empty lines!)
      # you can also set special values, like the following

      !pr:this is the value if we are building a PR
      !tag:this is the value if we are building a tag
      !default:this is the default value. leaving this out is fine, but the variable might be empty. see bevSetEmptyVars.
    STATIC_VAR: 'i am a static env var. static vars may not contain line breaks.'
    I_AM_SECRET: |
      master:${{ secrets.I_AM_SECRET_PROD }}
      staging:${{ secrets.I_AM_SECRET_STG }}
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
      !default:defaultvalue
```

In the above example, if the branch is `master`, the value will be `valueformaster`.
If the branch is `staging`, the value will be `valueforstaging`.
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