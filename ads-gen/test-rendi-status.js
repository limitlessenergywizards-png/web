import axios from 'axios';

async function checkStatus() {
    const API_KEY = 'eJwzMbE0SLJIN3dQ1NbW01DUxSzPTtbBMTdRNszBLSjFLNjA2MTeN94oy1s3OKgqONM8LcDF2jHR1qyizDAQAyuQQZA==';
    const commandId = 'a25a786d-86ea-4f77-bc25-19359754d2fa';

    try {
        console.log(`Checking status for ${commandId}...`);

        const url = `https://api.rendi.dev/v1/commands/${commandId}`;
        console.log(`Trying GET ${url}`);
        const response = await axios.get(url, { headers: { 'X-API-KEY': API_KEY } });
        console.log(`SUCCESS at ${url}`);
        console.dir(response.data, { depth: null });

    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

checkStatus();
