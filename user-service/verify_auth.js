const http = require('http');

const post = (path, data) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5001,
            path: '/api/users' + path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, body });
                }
            });
        });

        req.on('error', reject);
        req.write(JSON.stringify(data));
        req.end();
    });
};

async function test() {
    const email = `test_driver_${Date.now()}@test.com`;
    const password = 'password123';

    console.log(`Testing with email: ${email}`);

    // 1. Register Driver
    console.log('1. Registering Driver...');
    const regRes = await post('/register/driver', {
        firstName: 'Test',
        lastName: 'Driver',
        driverLicenseId: 'DL123',
        email,
        password
    });
    console.log(`Response: ${regRes.status}`, regRes.body);

    if (regRes.status !== 201) return;

    // 2. Login valid
    console.log('\n2. Logging in (Valid)...');
    const loginRes = await post('/login', {
        email,
        password
    });
    console.log(`Response: ${loginRes.status}`, loginRes.body);

    if (loginRes.body.token) {
        console.log('SUCCESS: Token received.');
    } else {
        console.log('FAILURE: No token.');
    }

    if (loginRes.body.user && loginRes.body.user.role === 'driver') {
        console.log('SUCCESS: Correct Role received.');
    } else {
        console.log('FAILURE: Role mismatch.');
    }

    // 3. Login invalid
    console.log('\n3. Logging in (Invalid Password)...');
    const failRes = await post('/login', {
        email,
        password: 'wrongpassword'
    });
    console.log(`Response: ${failRes.status}`, failRes.body);
}

test();
