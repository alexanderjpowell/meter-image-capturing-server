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