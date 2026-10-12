// Compatibility entry point. Run: npm run test:browser
const {spawnSync}=require('node:child_process');
const result=spawnSync(process.execPath,[require.resolve('@playwright/test/cli'),'test'],{stdio:'inherit'});
process.exitCode=result.status??1;
