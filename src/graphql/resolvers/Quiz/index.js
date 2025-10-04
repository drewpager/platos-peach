"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quizResolvers = void 0;
const mongodb_1 = require("mongodb");
const api_1 = require("../../../lib/api");
exports.quizResolvers = {
    Query: {
        quiz: async (_root, { id }, { db }) => {
            const quiz = await db.quizzes.findOne({ _id: new mongodb_1.ObjectId(id) });
            if (!quiz) {
                throw new Error("Failed to query quiz");
            }
            return quiz;
        },
        allquizzes: async (_root, { limit, page }, { db }) => {
            const data = {
                total: 0,
                result: [],
                totalCount: 0,
            };
            let cursor = await db.quizzes.find({});
            cursor = cursor.skip(page > 1 ? (page - 1) * limit : 0);
            cursor = cursor.limit(limit);
            data.result = await cursor.toArray();
            data.total = data.result.length;
            data.totalCount = await db.quizzes.countDocuments({});
            return data;
        },
    },
    Quiz: {
        id: (quiz) => {
            return quiz._id;
        },
    },
    Mutation: {
        createQuiz: async (_root, { input }, { db }) => {
            const id = new mongodb_1.ObjectId();
            try {
                const insertQuiz = await db.quizzes.insertOne({
                    _id: id,
                    ...input,
                });
                const insertedQuiz = insertQuiz
                    ? await db.quizzes.findOne({ _id: insertQuiz.insertedId })
                    : false;
                if (!insertedQuiz) {
                    throw new Error(`Failed to insert quiz!`);
                }
                return insertedQuiz;
            }
            catch (err) {
                throw new Error(`Failed with error: ${err}`);
            }
        },
        deleteQuiz: async (_root, { id }, { db }) => {
            try {
                const deletedQuiz = await db.quizzes.deleteOne({
                    _id: new mongodb_1.ObjectId(id),
                });
                if (!deletedQuiz) {
                    throw new Error("Failed to delete quiz");
                }
                return deletedQuiz.acknowledged;
            }
            catch (error) {
                throw new Error(`Failed to start deleting quiz: ${error}`);
            }
        },
        generateQuiz: async (_root, { numMCQuestions, numTFQuestions, subject }) => {
            try {
                const quiz = await (0, api_1.OpenAIQuiz)({
                    numMCQuestions,
                    numTFQuestions,
                    subject,
                });
                const message = quiz;
                return message;
            }
            catch (err) {
                throw new Error(`Failed to generate quiz: ${err}`);
            }
        },
    },
};
