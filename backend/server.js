const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const app = express();

require('dotenv').config(); // Load environment variables from .env file
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const TOKEN_FILE = './refresh_token.txt';

let REFRESH_TOKEN = ' '; 

// Load refresh token from file on startup, if it exists
if (fs.existsSync(TOKEN_FILE)) {
    REFRESH_TOKEN = fs.readFileSync(TOKEN_FILE, 'utf-8');
    console.log('Loaded refresh token from file');
} else {
    //fallback to your hardcoded token if file doesn't exist
    REFRESH_TOKEN = '06sjnsvnhmzimcib0m4jows7whveor318cojgj2k9j9p7vl90p';
    console.log('No refresh token file found, using hardcoded token');
}

app.use(cors({
    origin: 'http://localhost:3000', // allows your React app origin
    credentials: true, //if sending cookies or auth headers
}));

app.get('/', (req, res) => {
  res.send('Backend server is running');
});

// save refresh token helper
function saveRefreshToken(token) {
    fs.writeFileSync(TOKEN_FILE, token, 'utf-8');
    console.log('Saved new refresh token to file');
}


// OAuth callback route to handle Twitch redirect
app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    const error = req.query.error;

    if (error) {
        return res.status(400).send(`Error from Twitch: ${error}`);
    }

    if (!code) {
        return res.status(400).send('No code provided');
    }

    try {
        // Exchange authorization code for access token and refresh token
        const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: 'https://13dcbc618ad0.ngrok-free.app/auth/callback' // must match your registered redirect URI
            }
        });

        const data = tokenResponse.data;

        // Save tokens (update your refresh token variable or store in DB)
        REFRESH_TOKEN = data.refresh_token;

        // You can send a response or redirect
        res.send('Authentication successful! You can close this window.');

        // Optionally log tokens for debugging (don't expose in prod)
        console.log('Access token:', data.access_token);
        console.log('Refresh token:', data.refresh_token);
    } catch (error) {
        console.error('Error refreshing token:', error.response ? error.response.data : error.message);
        res.status(500).json({error: 'Failed to refresh token', details: error.response ? error.response.data : error.message});
    }
});

app.get("/refresh-token", async (req, res) => {
    try {
        const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: REFRESH_TOKEN
            }
        });

        const data = response.data;

        REFRESH_TOKEN = data.refresh_token;
        saveRefreshToken(REFRESH_TOKEN); // Save the new refresh token to file

        res.json({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in,
            scope: data.scope,
            token_type: data.token_type,
        });
    } catch (error) {
        console.error('Error refreshing token:', error.response ? error.response.data : error.message);
        res.status(500).json({error: 'Failed to refresh token'});
    }
});

const PORT = 3002;
app.listen(PORT, () => {
    console.log(`Token refresh server running on port ${PORT}`);
});