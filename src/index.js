"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config();
const stripe = require("stripe")(`${process.env.S_SECRET_KEY}`);
const enforce = require("express-sslify");
const express_1 = __importDefault(require("express"));
const apollo_server_express_1 = require("apollo-server-express");
// import { ApolloServer } from "@apollo/server";
// import { startStandaloneServer } from "@apollo/server/standalone";
// import { expressMiddleware } from "@apollo/server/express4";
// import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
// import http from "http";
const body_parser_1 = __importDefault(require("body-parser"));
const graphql_scalars_1 = require("graphql-scalars");
const graphql_1 = require("./graphql");
const database_1 = require("./database");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const corsOptions = {
    credentials: true,
    preflightContinue: true,
};
const mount = async (app) => {
    const db = await (0, database_1.connectDatabase)();
    app.use(body_parser_1.default.json({ limit: "2mb" }));
    app.use((0, cookie_parser_1.default)(process.env.SECRET));
    app.use((0, compression_1.default)());
    app.use((0, cors_1.default)(corsOptions));
    // DEPLOY TODO: UNCOMMENT FOR PRODUCTION
    // app.use(enforce.HTTPS({ trustProtoHeader: true }));
    // app.use(express.static(`${__dirname}/`));
    // app.get("/*", (_req, res) => res.sendFile(`${__dirname}/index.html`));
    const server = new apollo_server_express_1.ApolloServer({
        typeDefs: [graphql_1.typeDefs, graphql_scalars_1.typeDefs],
        resolvers: [graphql_1.resolvers, graphql_scalars_1.resolvers],
        context: ({ req, res }) => ({ db, req, res }),
    });
    await server.start();
    server.applyMiddleware({ app, path: "/api" });
    app.listen(process.env.PORT);
    app.get("/config", (req, res) => {
        res.send({
            publishableKey: `${process.env.S_PUBLISHABLE_KEY}`,
        });
    });
    app.post("/create-payment-intent", async (req, res) => {
        try {
            const paymentIntent = await stripe.paymentIntents.create({
                currency: "usd",
                amount: 399,
                automatic_payment_methods: {
                    enabled: true,
                },
            });
            res.send({ clientSecret: paymentIntent.client_secret });
        }
        catch (e) {
            throw new Error(`Failed to create payment intent: ${e}`);
        }
    });
    const configuration = await stripe.billingPortal.configurations.create({
        business_profile: {
            headline: "Platos Peach partners with Stripe for simplified billing.",
        },
        features: { invoice_history: { enabled: true } },
    });
    app.post("/create-customer-portal-session", async (req, res) => {
        // Authenticate your user.
        const session = await stripe.billingPortal.sessions.create({
            customer: req.body.customer,
            return_url: process.env.PUBLIC_URL,
        });
        res.redirect(session.url);
    });
    app.post("/create-checkout-session", async (req, res) => {
        const prices = await stripe.prices.list({
            lookup_keys: [req.body.lookup_key],
            expand: ["data.product"],
        });
        const session = await stripe.checkout.sessions.create({
            billing_address_collection: "auto",
            line_items: [
                {
                    price: prices.data[0].id,
                    // For metered billing, do not pass quantity
                    quantity: 1,
                },
            ],
            mode: "subscription",
            success_url: `http://localhost:3000/?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `http://localhost:3000?canceled=true`,
        });
        res.redirect(303, session.url);
    });
    app.post("/create-portal-session", async (req, res) => {
        // For demonstration purposes, we're using the Checkout session to retrieve the customer ID.
        // Typically this is stored alongside the authenticated user in your database.
        const { session_id } = req.body;
        const checkoutSession = await stripe.checkout.sessions.retrieve(session_id);
        // This is the url to which the customer will be redirected when they are done
        // managing their billing with the portal.
        const returnUrl = process.env.PUBLIC_URL;
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: checkoutSession.customer,
            return_url: returnUrl,
        });
        res.redirect(303, portalSession.url);
    });
    app.post("/webhook", express_1.default.raw({ type: "application/json" }), (request, response) => {
        let event = request.body;
        // Replace this endpoint secret with your endpoint's unique secret
        // If you are testing with the CLI, find the secret by running 'stripe listen'
        // If you are using an endpoint defined with the API or dashboard, look in your webhook settings
        // at https://dashboard.stripe.com/webhooks
        const endpointSecret = "whsec_12345";
        // Only verify the event if you have an endpoint secret defined.
        // Otherwise use the basic event deserialized with JSON.parse
        if (endpointSecret) {
            // Get the signature sent by Stripe
            const signature = request.headers["stripe-signature"];
            try {
                event = stripe.webhooks.constructEvent(request.body, signature, endpointSecret);
            }
            catch (err) {
                console.log(`⚠️  Webhook signature verification failed.`, err.message);
                return response.sendStatus(400);
            }
        }
        let subscription;
        let status;
        // Handle the event
        switch (event.type) {
            case "customer.subscription.trial_will_end":
                subscription = event.data.object;
                status = subscription.status;
                console.log(`Subscription status is ${status}.`);
                // Then define and call a method to handle the subscription trial ending.
                // handleSubscriptionTrialEnding(subscription);
                break;
            case "customer.subscription.deleted":
                subscription = event.data.object;
                status = subscription.status;
                console.log(`Subscription status is ${status}.`);
                // Then define and call a method to handle the subscription deleted.
                // handleSubscriptionDeleted(subscriptionDeleted);
                break;
            case "customer.subscription.created":
                subscription = event.data.object;
                status = subscription.status;
                console.log(`Subscription status is ${status}.`);
                // Then define and call a method to handle the subscription created.
                // handleSubscriptionCreated(subscription);
                break;
            case "customer.subscription.updated":
                subscription = event.data.object;
                status = subscription.status;
                console.log(`Subscription status is ${status}.`);
                // Then define and call a method to handle the subscription update.
                // handleSubscriptionUpdated(subscription);
                break;
            default:
                // Unexpected event type
                console.log(`Unhandled event type ${event.type}.`);
        }
        // Return a 200 response to acknowledge receipt of the event
        response.send();
    });
    console.log(`[app] : http://localhost:${process.env.PORT}`);
};
mount((0, express_1.default)());
