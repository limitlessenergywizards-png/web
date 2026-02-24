import axios from 'axios';

async function testRendi() {
    const API_KEY = 'eJwzMbE0SLJIN3dQ1NbW01DUxSzPTtbBMTdRNszBLSjFLNjA2MTeN94oy1s3OKgqONM8LcDF2jHR1qyizDAQAyuQQZA==';

    try {
        console.log('Sending request to Rendi Dev API...');
        const response = await axios.post(
            'https://api.rendi.dev/v1/run-ffmpeg-command',
            {
                "input_files": {
                    "in_1": "https://storage.rendi.dev/sample/sample.avi"
                },
                "output_files": {
                    "out_1": "output1.gif"
                },
                "ffmpeg_command": "-i {{in_1}} -vf \"select='lte(t,60)*gt(trunc(t/10),trunc(prev_t/10))',setpts='PTS*0.025',scale=trunc(oh*a/2)*2:320:force_original_aspect_ratio=decrease,pad=trunc(oh*a/2)*2:320:-1:-1\" -an -vsync vfr {{out_1}}"
            },
            {
                headers: {
                    'X-API-KEY': API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.dir(response.data, { depth: null });
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testRendi();
