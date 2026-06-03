const express = require('express');
const otplib = require("otplib");
const { SmsmodeRcsClient } = require('@smsmode/rcs');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = 3000;
const hotp = new otplib.OTP({ strategy: "hotp" });
const client = new SmsmodeRcsClient({ apiKey: process.env.SMSMODE_API_KEY });

app.get('/generate', async (req, res) => {
    const { tel } = req.query;
    const secret = hotp.generateSecret();
    const token = await hotp.generate({ secret, counter: 0 });
    console.log('Token: ' + token)
    // tel 33682768181
    const message = await client.send({
        recipient: { to: tel },
        body: { type: 'TEXT', text: `Token: ${token}` },
    });
    res.send({ secret: secret })
})

app.get('/verify', async (req, res) => {
    const { secret, token } = req.query;
    const result = await hotp.verify({ secret, token, counter: 0 });
    console.log(result);
    res.send({ valid: result.valid });
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})