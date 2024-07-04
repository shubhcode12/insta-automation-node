const axios = require('axios');

// Replace these with your actual values
const ACCESS_TOKEN = 'EAAPtobgSVawBO99e0Yec7HIjLWtzz8IHMoxdUyN0zkUhwXqa3D8qKFcY7bl8Chtm5AdvC74ZA1DtLe8NbaKo4ZAZCgEIEoPDDu2NBZB5IzGiRUi1mzCedhECHqhnsX3skNAB052NhSZAT9Vwvddu6PKUXbpQIqjuQbLnpj9JiwlfLgwv5amQUngj9qKM55YjRPbOvBagIZCdlRqyZBe';
const IG_USERNAME = 'imnitish.dev';

async function getInstagramUserId(username) {
    const url = `https://graph.facebook.com/v13.0/2218819661803475?fields=business_discovery.username(${username}){id,username}&access_token=${ACCESS_TOKEN}`;
    
    try {
        const response = await axios.get(url);
        const userId = response.data.business_discovery.id;
        console.log(`Instagram User ID for ${username} is: ${userId}`);
        return userId;
    } catch (error) {
        console.error('Error getting Instagram User ID:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Main function
(async () => {
    try {
        const userId = await getInstagramUserId(IG_USERNAME);
        console.log(`Fetched Instagram User ID: ${userId}`);
    } catch (error) {
        console.error('An error occurred:', error.message);
    }
})();
