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
const body_parser_1 = __importDefault(require("body-parser"));
const graphql_scalars_1 = require("graphql-scalars");
const graphql_1 = require("./graphql");
const database_1 = require("./database");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const graphql_depth_limit_1 = __importDefault(require("graphql-depth-limit"));
const loaders_1 = require("./lib/loaders");
// CORS configuration with origin whitelist
const corsOptions = {
    credentials: true,
    origin: process.env.NODE_ENV === "production"
        ? [
            "https://platospeach.com",
            "https://www.platospeach.com",
            process.env.PUBLIC_URL || "",
        ].filter(Boolean)
        : ["http://localhost:3000", "http://localhost:9000"],
};
// Rate limiting configuration
const generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests, please try again later.",
});
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many login attempts, please try again later.",
});
const mount = async (app) => {
    const db = await (0, database_1.connectDatabase)();
    // Trust proxy - required for rate limiting behind reverse proxy (Heroku, nginx, etc.)
    // This allows express-rate-limit to correctly identify users via X-Forwarded-For header
    app.set("trust proxy", 1);
    // Security middleware
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "https:"],
                fontSrc: ["'self'", "fonts.gstatic.com", "https:"],
                imgSrc: ["'self'", "data:", "https:", "blob:"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                frameSrc: ["'self'", "https://www.youtube.com", "https://player.vimeo.com", "https://js.stripe.com"],
                connectSrc: ["'self'", "https:", "wss:"],
            },
        },
        crossOriginEmbedderPolicy: false, // Required for embedding videos
    }));
    app.use(body_parser_1.default.json({ limit: "2mb" }));
    app.use((0, cookie_parser_1.default)(process.env.SECRET));
    app.use((0, compression_1.default)());
    app.use((0, cors_1.default)(corsOptions));
    // Rate limiting
    app.use("/api", generalLimiter);
    app.use("/contact", authLimiter);
    // HTTPS enforcement in production
    if (process.env.NODE_ENV === "production") {
        app.use(enforce.HTTPS({ trustProtoHeader: true }));
        app.use(express_1.default.static(`${__dirname}/`));
        app.get("/*", (_req, res) => res.sendFile(`${__dirname}/index.html`));
    }
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
        context: ({ req, res }) => ({
            db,
            req,
            res,
            loaders: (0, loaders_1.createLoaders)(db), // Create fresh loaders per request
        }),
        introspection: process.env.NODE_ENV !== "production",
        validationRules: [(0, graphql_depth_limit_1.default)(10)],
    });
    await server.start();
    server.applyMiddleware({ app, path: "/api" });
    app.listen(process.env.PORT);
    console.log(`[app] : http://localhost:${process.env.PORT}`);
};
mount((0, express_1.default)());
