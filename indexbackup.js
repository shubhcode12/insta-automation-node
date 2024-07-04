const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const axios = require("axios");
const cors = require("cors");
const passport = require("passport");
const FacebookStrategy = require("passport-facebook").Strategy;
const connectDB = require("./db");
const session = require("express-session");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

connectDB();

// Define Campaign schema and model
const campaignSchema = new mongoose.Schema({
  userId: String,
  name: String,
  postId: String,
  keyword: String,
  message: String,
});
const Campaign = mongoose.model("Campaign", campaignSchema);

app.use(bodyParser.json());
app.use(cors());

// Express Session Middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET, // Replace with your own secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true if using https
  })
);

// Passport Configuration
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: "/auth/facebook/callback",
      profileFields: ["id", "displayName", "emails"],
    },
    function (accessToken, refreshToken, profile, done) {
      console.log(profile)
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Routes for Facebook Authentication
app.get("/auth/facebook", passport.authenticate("facebook"));

app.get(
  "/auth/facebook/callback",
  passport.authenticate("facebook", { failureRedirect: "/" }),
  (req, res) => {
    //res.redirect(`http://localhost:3000?user=${req.user.id}`);
    res.send(req.user.displayName)
    console.log(req.user.displayName)
  }
);

// Webhook to receive Instagram comments
app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) {
    res.send(req.query["hub.challenge"]);
  } else {
    res.send("Verification token mismatch");
  }
});

app.post("/webhook", (req, res) => {
  const data = req.body;

  if (data.object === "instagram") {
    data.entry.forEach((entry) => {
      entry.changes.forEach((change) => {
        if (change.field === "comments") {
          const postId = change.value.media.id;
          const commentText = change.value.text;
          const username = change.value.from.username;

          Campaign.find({ postId: postId }, (err, campaigns) => {
            if (err) {
              console.error("Error fetching campaigns:", err);
              return res.status(500).send("Error fetching campaigns");
            }

            const promises = campaigns.map((campaign) => {
              if (commentText.includes(campaign.keyword)) {
                return sendDirectMessage(username, campaign.message);
              }
            });

            Promise.all(promises)
              .then(() => res.sendStatus(200))
              .catch((error) => {
                console.error("Error sending message:", error);
                res.status(500).send("Error sending message");
              });
          });
        }
      });
    });
  } else {
    res.sendStatus(200);
  }
});

// Function to send direct message
const sendDirectMessage = (username, message) => {
  const url = `https://graph.facebook.com/v11.0/me/messages?access_token=${ACCESS_TOKEN}`;
  const messageData = {
    recipient: { username: username },
    message: { text: message },
  };

  return axios.post(url, messageData);
};

// API to create a campaign
app.post("/api/campaigns", (req, res) => {
  const { name, postId, keyword, message } = req.body;
  const userId = req.session.passport.user;

  const newCampaign = new Campaign({ userId, name, postId, keyword, message });

  newCampaign.save((err) => {
    if (err) {
      res.status(500).send("Error saving campaign");
    } else {
      res.status(200).send("Campaign saved");
    }
  });
});

app.post("/send", (req, res) => {
  const { username, message } = req.body;

  sendDirectMessage(username, message)
    .then(() => res.json({ message: "Message sent successfully" }))
    .catch((err) => {
      console.error("Error sending message:", err);
      res.status(500).json({ error: "Error sending message" });
    });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
