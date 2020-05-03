# Background functions and other admin scripts relevant for the MiC project

### Run all commands from top level directory

To deploy all functions in index.js:
```
firebase deploy --only functions
```

To deploy a specific function only:
```
firebase deploy --only functions:adminTrigger
```

Note: Ensure that all functions are idempotent, meaning the results remain unchanged when an operation is applied more than once.