const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const connectDB = require("./db");
const jwt = require('jsonwebtoken');
require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 3000;
const ACCESS_TOKEN = "EAB0lZCHQ1R8gBO3yLT5tFqnPf9DVobxl5ZAMOb55VIjzZAd10bPFyQW03ZBZAQhVwLRI78Vck99A0owOZBW1Hirwppxhsj9OyfVrSNvIRwzNKJkMWg1o55FUPZA1HCC4mDKk6kY7tzrWGYZCVKwNgCCJqboJrkkYtTmYsRVHSctDTSTHHzCEu2A40XRJ1ESbpEecN6ZBNal00rof9mB21DjfPMAJgBfLUhQF5m8DlnnzCXUyL0vI9KGpq0AwNrnVKzy1E0HxNEWtxwMEZD";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const JWT_SECRET = "shubhcode";

connectDB();
const CampaignSchema = new mongoose.Schema({
    userId: String,
    name: String,
    postId: String,
    keyword: String,
    message: String
});

const Campaign = mongoose.model('Campaign', CampaignSchema);

app.use(bodyParser.json());
app.use(cors());

// Passport Configuration
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "/auth/facebook/callback"
}, function (accessToken, refreshToken, profile, done) {
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

// Routes for Facebook Authentication
app.get('/auth/facebook', passport.authenticate('facebook'));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/' }),
    (req, res) => {
        const token = jwt.sign({ id: req.user.id }, JWT_SECRET, { expiresIn: '1h' });
        res.redirect(`http://localhost:3000?token=${token}`);
    }
);

// Middleware to verify JWT
const authenticateJWT = (req, res, next) => {
    const token = req.headers.authorization;
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

// Webhook to receive Instagram comments
app.get('/webhook', (req, res) => {
    if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
    } else {
        res.send('Verification token mismatch');
    }
});

app.post('/webhook', (req, res) => {
    const data = req.body;

    if (data.object === 'instagram') {
        data.entry.forEach(entry => {
            entry.changes.forEach(change => {
                if (change.field === 'comments') {
                    const postId = change.value.media.id;
                    const commentText = change.value.text;
                    const username = change.value.from.username;

                    Campaign.find({ postId: postId }, (err, campaigns) => {
                        if (err) {
                            console.error('Error fetching campaigns:', err);
                            return;
                        }

                        campaigns.forEach(campaign => {
                            if (commentText.includes(campaign.keyword)) {
                                sendDirectMessage(username, campaign.message);
                            }
                        });
                    });
                }
            });
        });
    }

    res.sendStatus(200);
});

// Function to send direct message
const sendDirectMessage = (username, message) => {
    const url = `https://graph.facebook.com/v11.0/me/messages?access_token=${ACCESS_TOKEN}`;
    const messageData = {
        recipient: { username: username },
        message: { text: message }
    };

    axios.post(url, messageData)
        .then(response => {
            console.log('Message sent:', response.data);
        })
        .catch(error => {
            console.error('Error sending message:', error.response ? error.response.data : error.message);
        });
};

// API to create a campaign
app.post('/api/campaigns', authenticateJWT, (req, res) => {
    const { name, postId, keyword, message } = req.body;
    const userId = req.user.id;

    const newCampaign = new Campaign({ userId, name, postId, keyword, message });

    newCampaign.save((err) => {
        if (err) {
            res.status(500).send('Error saving campaign');
        } else {
            res.status(200).send('Campaign saved');
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
