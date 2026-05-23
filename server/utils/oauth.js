const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

/**
 * Verify Google id_token and return payload { email, name, picture, sub }.
 * @param {string} idToken - Token from Google Sign-In (frontend)
 */
async function verifyGoogleToken(idToken) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }
  const client = new OAuth2Client(GOOGLE_CLIENT_ID);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();
  return {
    email: payload.email,
    name: payload.name || payload.email,
    picture: payload.picture,
    sub: payload.sub // Google user id
  };
}

/**
 * Verify Facebook access_token and return { email, name, id }.
 * @param {string} accessToken - Token from Facebook Login (frontend)
 */
async function verifyFacebookToken(accessToken) {
  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
    throw new Error('Facebook app credentials are not configured');
  }
  const appAccessToken = `${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`;
  const url = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appAccessToken)}`;
  const debugRes = await axios.get(url);
  const data = debugRes.data?.data;
  if (!data?.is_valid) {
    throw new Error('Invalid Facebook token');
  }
  const meUrl = `https://graph.facebook.com/me?fields=id,email,name&access_token=${encodeURIComponent(accessToken)}`;
  const meRes = await axios.get(meUrl);
  const profile = meRes.data;
  return {
    email: profile.email,
    name: profile.name || profile.email || 'User',
    id: profile.id
  };
}

module.exports = { verifyGoogleToken, verifyFacebookToken };
