const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const connectDB = require("./db");
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

connectDB();


// Keyword matcher utility function
const keywordMatcher = (comment, keywords) => {
    for (const keyword of keywords) {
        if (comment.includes(keyword.keyword)) {
            return keyword;
        }
    }
    return null;
};

// Function to send reply to comment
const sendReply = async (commentId, message) => {
    const url = `https://graph.facebook.com/v15.0/${commentId}/comments`;
    await axios.post(url, {
        message: message,
        access_token: ACCESS_TOKEN
    });
};

// Function to send direct message
const sendDirectMessage = async (userId, message) => {
    const url = `https://graph.facebook.com/v15.0/me/messages`;
    await axios.post(url, {
        recipient: { id: userId },
        message: { text: message },
        access_token: ACCESS_TOKEN
    });
};

// Function to handle webhook events
const handleWebhook = async (req, res) => {
    const body = req.body;

    if (body.object === 'instagram') {
        for (const entry of body.entry) {
            for (const comment of entry.changes) {
                if (comment.field === 'comments') {
                    const commentData = comment.value;
                    const keywords = [
                        { keyword: 'help', reply: 'How can I assist you?', directMessage: 'Thanks for reaching out. How can I help you?' },
                        // Add more keywords and responses here
                    ];

                    const keywordMatch = keywordMatcher(commentData.text, keywords);

                    if (keywordMatch) {
                        await sendReply(commentData.id, keywordMatch.reply);
                        await sendDirectMessage(commentData.from.id, keywordMatch.directMessage);
                    }
                }
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
};

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Webhook verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === VERIFY_TOKEN) {
        console.log('Webhook verified');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// Handle webhook events
app.post('/webhook', handleWebhook);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
