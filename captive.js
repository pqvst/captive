const os = require('os');
const request = require('request-promise');
const address = require('address');


function getNetworkInfo() {
  return new Promise((resolve, reject) => {
    const ip = address.ip();
    address.mac((err, mac) => {
      if (err) {
        reject(err);
      } else {
        resolve({ ip, mac });
      }
    });
  });
}


async function isCaptive() {
  console.log('checking...');
  try {
    const resp = await request.get('http://gstatic.com/generate_204', { 
      followRedirect: false, 
      resolveWithFullResponse: true,
      timeout: 3000,
      simple: false,
    });
    if (resp.statusCode === 204 && resp.body.length === 0 && resp.headers.location == null) {
      console.log('> ok, we are free!');
      return false;
    } else if (resp.headers.location != null) {
      console.log(`> oh no, we are captured! (${resp.headers.location})`);
      return true;
    } else {
      console.log(`> hmm, captured, but no redirect...`);
      return false;
    }
  } catch (err) {
    console.log(`> uh-oh, something went wrong (${err.message})`);
    return false;
  }
}


async function authenticate () {
  console.log(`=== ${new Date} ===`);

  console.log('querying network interface...');
  const { mac, ip } = await getNetworkInfo();
  console.log('> ip:', ip);
  console.log('> mac:', mac);

  console.log('authenticating...');

  const jar = request.jar();
  const url = `https://service.wi2.ne.jp/wi2auth/redirect?cmd=login&mac=${mac}&ip=${ip}&essid=%20&apname=tunnel%201&apgroup=&url=http%3A%2F%2Fdetectportal%2Efirefox%2Ecom%2Fsuccess%2Etxt%2F`;
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36';
  const headers = { 'user-agent': userAgent };

  let resp;
  
  // HTTP Redirect
  console.log('checking...');
  resp = await request.get('http://gstatic.com/generate_204', { headers, jar, followAllRedirects: true, resolveWithFullResponse: true });
  if (resp.statusCode == 204) {
    console.log('> ok! no captive needed');
  } else {
    console.log('>', resp.statusCode, resp.req.path);
  }
  
  // Loading redirect page
  console.log('loading redirect page...');
  resp = await request.get(url, { headers, jar, resolveWithFullResponse: true });
  if (resp.req.path == '/wi2auth/error/ctrlapi_timeout.html') {
    return console.log('> timeout! are you on a different wifi network?');
  }

  console.log('loading agreement page...');
  resp = await request.get('https://service.wi2.ne.jp/wi2auth/at_STARBUCKS_Wi2/agreement.html', { headers, jar, resolveWithFullResponse: true });
  if (resp.statusCode != 200) {
    return console.log('> agreement failed');
  }
  
  console.log('accepting agreement...');
  resp = await request.post('https://service.wi2.ne.jp/wi2auth/xhr/login', {
    resolveWithFullResponse: true,
    headers,
    jar,
    json: {
      login_method: 'onetap',
      login_params: {
        agree: '1'
      }
    } 
  });

  if (resp.statusCode != 200) {
    return console.log('> login failed');
  } else {
    console.log('> login ok!');
  }
}


async function loop() {
  if (await isCaptive()) {
    await authenticate();
  }
  setTimeout(loop, 1000);
}

loop();
