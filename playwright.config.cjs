const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests/browser',fullyParallel:false,timeout:30000,retries:process.env.CI?1:0,workers:2,
 reporter:[['list'],['html',{open:'never'}],['json',{outputFile:'test-results/results.json'}]],
 use:{baseURL:'http://127.0.0.1:4173',screenshot:'only-on-failure',trace:'retain-on-failure',acceptDownloads:true,
 launchOptions:process.env.ARENA_CHROMIUM_PATH?{executablePath:process.env.ARENA_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{}},
 projects:[
  {name:'android-chromium',use:{...devices['Pixel 7'],browserName:'chromium'}},
  {name:'iphone-webkit',use:{...devices['iPhone 13'],browserName:'webkit',launchOptions:{}}},
  {name:'small-mobile',use:{browserName:'chromium',viewport:{width:320,height:740},isMobile:true,hasTouch:true}},
  {name:'desktop-chromium',use:{browserName:'chromium',viewport:{width:1366,height:900}}}
 ],
 webServer:{command:'node scripts/serve.cjs',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI}
});
