#!/usr/bin/env node
import AuthButton from 'https://centerfordigitalhumanities.github.io/LRDA-Users-CDN/auth.js'
const auth = document.querySelector('[is="auth-button"]')

const AUDIENCE = "https://cubap.auth0.com/api/v2/"
const CLIENTID = "CayJsaU9sXIrOIgziOwDIDdGfDfR3Am1"
const LRDA_REDIRECT = origin + "/manage.html"
const DOMAIN = "cubap.auth0.com"
const LRDA_USER_ROLES_CLAIM = "http://lrda.rerum.io/user_roles"
const LRDA_PUBLIC_ROLE = "lrda_user_public"
const LRDA_CONTRIBUTOR_ROLE = "lrda_user_contributor"
const LRDA_ADMIN_ROLE = "lrda_user_admin"
const myURL = document.location.href

/**
 * Solely for getting the user profile.
 */
let authenticator = new auth0.Authentication({
    "domain": DOMAIN,
    "clientID": CLIENTID,
    "scope": "read:roles update:current_user_metadata read:current_user name nickname picture email profile openid offline_access"
})

auth.addEventListener("lrda-authenticated", ev => {
    const ref = getReferringPage()
    if (ref && ref.startsWith(location.href)) {
        stopHeartbeat()
        location.href = ref
    }
    if (window.username) {
        username.innerHTML = ev.detail.name ?? ev.detail.nickname ?? ev.detail.email
    }
    if (location.pathname.includes("profile.html")) {
        window.userForm?.addEventListener('submit', updateUserInfo)
        //Populate know information into the form inputs.
        for(let prop in ev.detail){
            try{
                document.querySelector(`input[name='${prop}']`)?.setAttribute('value',ev.detail[prop])
                document.querySelector(`[data-${prop}]`)?.setAttribute(`data-${prop}`,ev.detail[prop])
            } catch (err) {}
        }
        document.querySelector(`[data-picture]`).innerHTML = `<img src="${ev.detail.picture}"/>`
    }
    if (document.querySelector("[data-user='admin']")) {
        adminOnly(ev.detail.authorization)
    }
})

function adminOnly(token = window.LRDA_USER?.authorization) {
    //You can trust the token.  However, it may have expired.
    //A token was in localStorage, so there was a login during this window session.
    //An access token from login is stored. Let's use it to get THIS USER's info.  If it fails, the user needs to login again.
    try {
        authenticator.userInfo(token, async (err, _u) => {
            if (err) {
                auth.login({
                    "authParamsMap": { 'app': ['lrda', 'rerum'] },
                    "scope": "read:roles update:current_user_metadata read:current_user name nickname picture email profile openid offline_access",
                    "redirectUri": LRDA_REDIRECT,
                    "responseType": "id_token token"
                })
                return
            }
            if (isAdmin(_u)) {
                userList.innerHTML = ""
                const user_arr = await getAllUsers()
                let elem = ``
                for (let user of user_arr) {
                    //This presumes they will only have one role here.  Make sure getAllUsers() accounts for that.
                    const role = user[LRDA_USER_ROLES_CLAIM]?.roles[0]?.replace("lrda_user_", "") ?? "Role Not Assigned"
                    elem += `<li user="${_u.name}">${user.name}
            <em class="role" userid="${user.user_id}"> : ${role}</em>`
                    if (role !== "Admin") {
                        elem += `<div class="actions">
                        <input class="tag is-small "bg-primary" 
                            type="button" 
                            value="Make ${role === "public" ? "Contributor" : "Public"}" 
                            onclick="assignRole('${user.user_id}','${role === "public" ? 'Contributor' : 'Public'}')"/>
                    </div>`
                    }
                    elem += `</li>`
                }
                userList.innerHTML += elem
            }
        })
    } catch (_err) {
        //auth0 crashing error
        auth.login({
            "authParamsMap": { 'app': ['lrda', 'rerum'] },
            "scope": "read:roles update:current_user_metadata read:current_user name nickname picture email profile openid offline_access",
            "redirectUri": LRDA_REDIRECT,
            "responseType": "id_token token"
        })
        return
    }
    history.replaceState(null, null, ' ')
}

async function assignRole(userid, role) {
    let url = `/lrda-users/manage/assign${role}Role/${userid}`
    document.querySelectorAll(`.role[userid="${userid}"]`).forEach(elem => {
        elem.innerHTML = ` : Updating Role...`
    })
    fetch(url, {
        method: 'GET',
        cache: 'default',
        headers: {
            'Authorization': `Bearer ${window.LRDA_USER?.authorization}`,
            'Content-Type': "application/json; charset=utf-8"
        }
    })
        .then(_resp => {
            document.querySelectorAll(`.role[userid="${userid}"]`).forEach(elem => {
                elem.innerHTML = ` : ${role}`
            })
        })
        .catch(err => {
            console.error("Role was not assigned")
            console.error(err)
            document.querySelectorAll(`.role[userid="${userid}"]`).forEach(elem => {
                elem.innerHTML = ` : Error`
            })
        })
}

/**
 * PUT to the lrda-users back end.
 * You must supply your login token in the Authorization header.
 * The body needs to be a user object, and you need to supply the user id in the body.
 * You can only update the user info belonging to the user encoded on the token in the Authorization header
 * This means you can only do this to update "your own" profile information.
 */
async function updateUserInfo(event, userid=window.LRDA_USER?.sub) {
    event.preventDefault()
    let info = new FormData(event.target)
    let data = Object.fromEntries(info.entries())
    for (let prop in data) {
        if (data[prop] === "" || data[prop] === null || data[prop] === undefined) {
            delete data[prop]
        }
    }
    data.user_id = userid
        let updatedUser = await fetch("/lrda-users/manage/updateProfileInfo", {
            method: 'PUT',
            cache: 'default',
            headers: {
                'Authorization': `Bearer ${window.LRDA_USER?.authorization}`,
                'Content-Type': "application/json; charset=utf-8"
            },
            body: JSON.stringify(data)
        })
            .then(r => r.json())
            .catch(err => {
                console.error("User Not Updated")
                console.error(err)
                return {}
            })
        if (updatedUser.user_id) {
            alert("User Info Updated!")
        }
        else {
            alert("User Info Update Failed!")
        }
}

/**
 * Auth0 redirects here with a bunch of info in hash variables.
 * This function allows you pull a single variable from the hash
 */
function getURLHash(variable, urlString = document.location.href) {
    const url = new URL(urlString)
    var vars = new URLSearchParams(url.hash.substring(1))
    return vars.get(variable) ?? false
}

/**
 * Use our Auth0 Server back end to ask for all the Dunbap Apps users.
 */
async function getAllUsers() {
    return fetch("/lrda-users/manage/getAllUsers", {
        "method": "GET",
        "cache": "no-store",
        "headers": {
            "Authorization": `Bearer ${window.LRDA_USER?.authorization}`
        }
    })
        .then(resp => resp.json())
        .catch(err => {
            console.error("Error getting Users!!")
            console.error(err)
            return []
        })
}

function isAdmin(user) {
    return userHasRole(user, LRDA_ADMIN_ROLE)
}
/**
 * Follows the 'base64url' rules to decode a string.
 * @param {String} base64str from `state` parameter in the hash from Auth0
 * @returns referring URL
 */
function b64toUrl(base64str) {
    return window.atob(base64str.replace(/\-/g, "+").replace(/_/g, "/"))
}
/**
 * Follows the 'base64url' rules to encode a string.
 * @param {String} url from `window.location.href`
 * @returns encoded string to pass as `state` to Auth0
 */
function urlToBase64(url) {
    return window.btoa(url).replace(/\//g, "_").replace(/\+/g, "-").replace(/=+$/, "")
}

function getReferringPage() {
    try {
        return b64toUrl(location.hash.split("state=")[1].split("&")[0])
    } catch (err) {
        return false
    }
}

/**
 * Checks array of stored roles for any of the roles provided.
 * @param {Array} roles Strings of roles to check.
 * @returns Boolean user has one of these roles.
 */
function userHasRole(user, roles) {
    if (!Array.isArray(roles)) { roles = [roles] }
    return Boolean(user?.[LRDA_USER_ROLES_CLAIM]?.roles.filter(r => roles.includes(r)).length)
}
