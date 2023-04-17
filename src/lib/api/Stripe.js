"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stripe = void 0;
// import stripe from "stripe";
require("dotenv").config();
const client = require("stripe")(`${process.env.S_SECRET_KEY}`);
// const client = new stripe(`${process.env.S_SECRET_KEY}`);
exports.Stripe = {
    connect: async (code) => {
        const response = await client.oauth.token({
            grant_type: "authorization_code",
            code,
        });
        return response.stripe_user_id;
    },
};
