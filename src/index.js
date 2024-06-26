"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config();
const nodemailer = require("nodemailer");
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
    app.use(enforce.HTTPS({ trustProtoHeader: true }));
    app.use(express_1.default.static(`${__dirname}/`));
    app.get("/*", (_req, res) => res.sendFile(`${__dirname}/index.html`));
    app.post("/contact", async (req, res) => {
        // console.log(req.body);
        const contactEmail = nodemailer.createTransport({
            host: "smtp-relay.sendinblue.com",
            port: 587,
            auth: {
                user: "drew@greadings.com",
                pass: `${process.env.EMAILPASSWORD}`,
            },
        });
        contactEmail.sendMail(req.body, (error, info) => {
            if (error) {
                // console.log(error);
                res.send("error");
            }
            else {
                // console.log("Email sent: " + info.response);
                res.send("success");
            }
        });
    });
    // const customer = await stripe.customers.search({
    //   query: `email:'drew@greadings.com'`,
    // });
    // if (customer) {
    //   const subscriptions = await stripe.customers.retrieve(
    //     `${customer.data[0].id}`,
    //     {
    //       expand: ["subscriptions"],
    //     }
    //   );
    //   const amount = subscriptions.subscriptions.data[0].plan.amount;
    //   console.log(subscriptions.subscriptions.data[0]);
    // }
    const server = new apollo_server_express_1.ApolloServer({
        typeDefs: [graphql_1.typeDefs, graphql_scalars_1.typeDefs],
        resolvers: [graphql_1.resolvers, graphql_scalars_1.resolvers],
        context: ({ req, res }) => ({ db, req, res }),
    });
    await server.start();
    server.applyMiddleware({ app, path: "/api" });
    app.listen(process.env.PORT);
    console.log(`[app] : http://localhost:${process.env.PORT}`);
};
mount((0, express_1.default)());
