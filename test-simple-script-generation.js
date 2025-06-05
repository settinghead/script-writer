const http = require('http');

// Test script generation for episode 2 to see if we get the episodeNumber validation error
const postData = JSON.stringify({
  episodeId: '2',
  stageId: 'ef6d30ee-88be-4a1e-a7ca-65db60756ece',
  userRequirements: 'Test generation'
});

const options = {
  hostname: 'localhost',
  port: 4600,
  path: '/api/scripts/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Cookie': 'auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIteGl5YW5nIiwiaWF0IjoxNzMzMzY5NzI4fQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end(); 