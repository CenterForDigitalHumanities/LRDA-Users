const got = require('got')
const { auth } = require('express-oauth2-jwt-bearer')
const dotenv = require('dotenv')
dotenv.config()

const _tokenError = function(err, req, res, next) {
    if (err.status === 401) {
        err.message = err.statusMessage = `This token does not have permission to perform this action. 
        ${err.message}
        Received token: ${req.header("authorization")}`
        next(err)
    }
}

/**
 * Get the Auth0 User JSON Object out of the encoded token.
 */
const _extractUser = (req, res, next) => {
    req.user = JSON.parse(Buffer.from(req.header("authorization").split(" ")[1].split('.')[1], 'base64').toString())
    next()
}

const checkJwt = [auth(), _tokenError, _extractUser]

/**
 * Upon requesting an action, confirm the request has a valid token.
 * @param {(Base64)String} secret access_token from `Bearer` header in request
 * @returns decoded payload of JWT if successful
 * @throws Error if token, signature, or date is invalid
 */
const verifyAccess = (secret) => {
    return jwt({
        secret,
        audience: process.env.AUDIENCE,
        issuer: `https://cubap.auth0.com/api/v2/`,
        algorithms: ['RS256']
    })
}

module.exports = {
    checkJwt,
    verifyAccess
}