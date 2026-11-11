const readline = require('readline');
const HSAuth = require('./hsauth');

const auth = new HSAuth({
  name: 'MyApp',
  ownerid: 'your_app_identifier_here',
  secret: 'your_app_secret_here',
  version: '1.0',
  apiUrl: 'https://hsauth.mujahid.xyz/api/1.3/',
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
  console.log('[*] Connecting to HS DEVS AUTH server...');
  const initRes = await auth.init();

  if (!initRes.success) {
    console.error(`[!] Init failed: ${initRes.message}`);
    process.exit(1);
  }

  console.log(`[+] Connected! Application Version: ${auth.appData.version}`);

  let authenticated = false;
  while (!authenticated) {
    console.log('\n[1] Login');
    console.log('[2] Register');
    console.log('[3] License Key Only');
    console.log('[4] Exit');
    const opt = await question('\nSelect option: ');

    if (opt === '1') {
      const u = await question('Username: ');
      const p = await question('Password: ');
      const res = await auth.login(u, p);
      if (res.success) authenticated = true;
      else console.error(`[!] ${res.message}`);
    } else if (opt === '2') {
      const u = await question('Username: ');
      const p = await question('Password: ');
      const k = await question('License Key: ');
      const res = await auth.register(u, p, k);
      if (res.success) authenticated = true;
      else console.error(`[!] ${res.message}`);
    } else if (opt === '3') {
      const k = await question('License Key: ');
      const res = await auth.license(k);
      if (res.success) authenticated = true;
      else console.error(`[!] ${res.message}`);
    } else if (opt === '4') {
      process.exit(0);
    }
  }

  console.log(`\n[+] Logged in as: ${auth.userData.username} (HWID: ${auth.userData.hwid})`);

  // Start heartbeat
  auth.startHeartbeat(30, (msg) => {
    console.log(`\n[BROADCAST MESSAGE] ${msg.title}: ${msg.content}`);
  });

  while (true) {
    console.log('\n--- Features Menu ---');
    console.log('[1] Get Remote Variable');
    console.log('[2] Online Users');
    console.log('[3] Send Log');
    console.log('[4] Logout & Exit');
    const act = await question('\nSelect action: ');

    if (act === '1') {
      const v = await question('Variable Name: ');
      const val = await auth.var(v);
      console.log(`Value: ${val}`);
    } else if (act === '2') {
      const users = await auth.fetchOnline();
      console.log(`Online: ${users.length} users`);
    } else if (act === '3') {
      const m = await question('Message: ');
      await auth.log(m);
      console.log('[+] Logged!');
    } else if (act === '4') {
      await auth.logout();
      console.log('Logged out.');
      process.exit(0);
    }
  }
}

main().catch(console.error);
