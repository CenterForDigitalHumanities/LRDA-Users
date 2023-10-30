#!/usr/bin/env node

/**
 * Note that all of this is fresh upon entering the page with a good login token.
 * Instead of a timer, we can refresh these upon page focus/action
 * It depends how quick tokens will die.
 */
const webAuth = new auth0.WebAuth({
    "domain": DOMAIN,
    "clientID": CLIENTID,
    "audience": AUDIENCE
})
let login_beat = null
function startHeartbeat() {
    login_beat = setInterval(async function () {
        if (localStorage.getItem("LRDA-Login-Token")) {
            webAuth.checkSession({}, (err, result) => {
                if (err) {
                    login()
                    stopHeartbeat()
                }
                else {
                    localStorage.setItem("LRDA-Login-Token", result.accessToken)
                }
            })
        }
        else {
            login()
            //You need to login to start a session!
        }
    }, 60000 * 4.5) // These tokens expire every 5 Mins
}

function stopHeartbeat() {
    if (login_beat !== null && login_beat !== undefined) {
        clearInterval(login_beat)
    }
}

function login() {
    localStorage.removeItem('LRDA-Login-Token')
    webAuth.authorize({
        "authParamsMap": { 'app': 'lrda' },
        "scope": "read:roles update:current_user_metadata read:current_user name nickname picture email profile openid offline_access",
        "redirectUri": LRDA_REDIRECT,
        "responseType": "id_token token"
    })
    stopHeartbeat()
}
